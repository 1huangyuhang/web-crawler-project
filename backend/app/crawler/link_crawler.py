import asyncio
from typing import Dict, Any, List
from bs4 import BeautifulSoup
from app.crawler.base import AsyncBaseCrawler
from app.crawler.config import CrawlConfig


class AsyncLinkCrawler(AsyncBaseCrawler):
    def __init__(self, url: str, depth: int = 2, config: CrawlConfig | None = None):
        super().__init__(url, depth, config)
        self.links: List[Dict[str, Any]] = []

    async def start_crawling(self) -> Dict[str, Any]:
        self.links.clear()
        results = await super().start_crawling()
        results["data"] = self.links
        results["type"] = "link"
        return results

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        title = soup.title.string if soup.title else "无标题"
        page_links = self._extract_links(url, soup)

        for link in page_links:
            self.links.append({"url": url, "title": title, "depth": current_depth, "link_url": link})

        self.items_count += len(page_links)
        tasks = [self._crawl(link, current_depth + 1) for link in page_links]
        await asyncio.gather(*tasks, return_exceptions=True)
