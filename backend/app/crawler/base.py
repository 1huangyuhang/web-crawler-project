"""Async base crawler -- migrated from src/scripts/crawler/async_base_crawler.py."""

import asyncio
import time
import logging
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Set, Dict, Any, Optional, List
from asyncio import Semaphore
from app.crawler.config import CrawlConfig
from app.crawler.ua_pool import random_ua


class AsyncBaseCrawler:
    def __init__(self, url: str, depth: int = 2, config: CrawlConfig | None = None):
        self.url = url
        self.depth = depth
        self.config = config or CrawlConfig()
        self.visited_urls: Set[str] = set()
        self.start_time = 0.0
        self.items_count = 0
        self.results: Dict[str, Any] = {}
        self.semaphore = Semaphore(self.config.max_concurrent)
        self.session: Optional[aiohttp.ClientSession] = None
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_response_time": 0.0,
        }
        self.logger = logging.getLogger(self.__class__.__name__)
        self._last_request_time = 0.0

    async def __aenter__(self):
        connector = aiohttp.TCPConnector(limit=self.config.max_concurrent, limit_per_host=2)
        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        self.session = aiohttp.ClientSession(
            connector=connector, timeout=timeout,
            headers={"User-Agent": random_ua()},
        )
        return self

    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def start_crawling(self) -> Dict[str, Any]:
        self.start_time = time.time()
        self.visited_urls.clear()
        self.items_count = 0
        self.results = {"url": self.url, "depth": self.depth, "items": 0, "time": 0, "data": [], "stats": {}}

        try:
            await self._crawl(self.url, 0)
        except Exception as e:
            self.logger.error(f"爬虫执行失败: {e}")
            self.results["error"] = str(e)

        elapsed = time.time() - self.start_time
        self.results["items"] = self.items_count
        self.results["time"] = round(elapsed, 2)
        self.results["stats"] = self.stats
        return self.results

    async def _crawl(self, url: str, current_depth: int):
        if current_depth >= self.depth or url in self.visited_urls:
            return
        self.visited_urls.add(url)

        async with self.semaphore:
            now = time.time()
            gap = self.config.request_delay - (now - self._last_request_time)
            if gap > 0:
                await asyncio.sleep(gap)
            self._last_request_time = time.time()

            soup = await self._fetch_with_retry(url)
            if soup:
                await self._process_page(url, soup, current_depth)
                self.stats["successful_requests"] += 1
            else:
                self.stats["failed_requests"] += 1

    async def _fetch_with_retry(self, url: str, attempt: int = 0) -> Optional[BeautifulSoup]:
        try:
            self.stats["total_requests"] += 1
            t0 = time.time()
            async with self.session.get(url, ssl=False) as resp:
                self.stats["total_response_time"] += time.time() - t0
                if resp.status == 200:
                    text = await resp.text()
                    return BeautifulSoup(text, "html.parser")
                self.logger.warning(f"HTTP {resp.status}: {url}")
                return None
        except (asyncio.TimeoutError, aiohttp.ClientError, Exception) as e:
            self.logger.warning(f"请求失败 ({attempt+1}/{self.config.max_retries}): {url} — {e}")
            if attempt < self.config.max_retries:
                await asyncio.sleep(2 ** attempt)
                return await self._fetch_with_retry(url, attempt + 1)
            return None

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        pass  # subclasses implement

    def _extract_links(self, url: str, soup: BeautifulSoup) -> Set[str]:
        links = set()
        for a in soup.find_all("a", href=True):
            abs_url = urljoin(url, a["href"])
            if urlparse(abs_url).scheme in ("http", "https"):
                links.add(abs_url)
        return links
