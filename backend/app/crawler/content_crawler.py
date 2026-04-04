import asyncio
import re
from collections import Counter
from typing import Dict, Any, List
from bs4 import BeautifulSoup
from app.crawler.base import AsyncBaseCrawler
from app.crawler.config import CrawlConfig


class AsyncContentCrawler(AsyncBaseCrawler):
    def __init__(self, url: str, depth: int = 2, config: CrawlConfig | None = None):
        super().__init__(url, depth, config)
        self.contents: List[Dict[str, Any]] = []

    async def start_crawling(self) -> Dict[str, Any]:
        self.contents.clear()
        results = await super().start_crawling()
        results["data"] = self.contents
        results["type"] = "content"
        return results

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        title = soup.title.string if soup.title else "无标题"
        content = await asyncio.to_thread(self._extract_content, soup)
        keywords = await asyncio.to_thread(self._extract_keywords, soup)

        self.contents.append({
            "url": url, "title": title, "depth": current_depth,
            "content": content[:500], "keywords": keywords[:10],
        })
        self.items_count += 1

        links = self._extract_links(url, soup)
        await asyncio.gather(*[self._crawl(l, current_depth + 1) for l in links], return_exceptions=True)

    @staticmethod
    def _extract_content(soup: BeautifulSoup) -> str:
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return re.sub(r"\n{3,}", "\n\n", text)

    @staticmethod
    def _extract_keywords(soup: BeautifulSoup) -> list[str]:
        meta = soup.find("meta", attrs={"name": "keywords"})
        if meta and meta.get("content"):
            return [k.strip() for k in meta["content"].split(",") if k.strip()]
        text = soup.get_text()
        words = re.findall(r"[\u4e00-\u9fff]+|[a-zA-Z]{3,}", text)
        freq = Counter(words)
        return [w for w, _ in freq.most_common(10)]
