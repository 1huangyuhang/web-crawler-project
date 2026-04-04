import asyncio
from urllib.parse import urljoin
from typing import Dict, Any, List
from bs4 import BeautifulSoup
from app.crawler.base import AsyncBaseCrawler
from app.crawler.config import CrawlConfig


class AsyncImageCrawler(AsyncBaseCrawler):
    def __init__(self, url: str, depth: int = 2, config: CrawlConfig | None = None):
        super().__init__(url, depth, config)
        self.images: List[Dict[str, Any]] = []

    async def start_crawling(self) -> Dict[str, Any]:
        self.images.clear()
        results = await super().start_crawling()
        results["data"] = self.images
        results["type"] = "image"
        return results

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        page_images = self._extract_images(url, soup)
        self.images.extend(page_images)
        self.items_count += len(page_images)

        links = self._extract_links(url, soup)
        await asyncio.gather(*[self._crawl(l, current_depth + 1) for l in links], return_exceptions=True)

    @staticmethod
    def _extract_images(url: str, soup: BeautifulSoup) -> list[dict]:
        images = []
        for img in soup.find_all("img", src=True):
            abs_url = urljoin(url, img["src"])
            if abs_url.startswith(("http://", "https://")):
                images.append({
                    "image_url": abs_url, "alt": img.get("alt", ""),
                    "width": img.get("width", ""), "height": img.get("height", ""),
                    "depth": 0,
                })
        return images[:20]
