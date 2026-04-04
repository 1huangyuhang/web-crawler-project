# 异步图片爬虫实现

from async_base_crawler import AsyncBaseCrawler, CrawlConfig
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import Dict, Any, List
import asyncio


class AsyncImageCrawler(AsyncBaseCrawler):
    """
    异步图片爬虫类，用于高效爬取页面中的图片
    支持并发控制和错误处理
    """

    def __init__(self, url: str, depth: int = 2, config: CrawlConfig = None):
        """
        初始化异步图片爬虫

        Args:
            url: 目标URL
            depth: 爬取深度
            config: 爬虫配置
        """
        super().__init__(url, depth, config)
        self.images: List[Dict[str, Any]] = []

    async def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取（异步版本）

        Returns:
            爬取结果
        """
        self.images.clear()
        results = await super().start_crawling()
        results['data'] = self.images
        results['type'] = 'image'
        return results

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容，提取图片（异步版本）

        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 提取页面标题
        title = soup.title.string if soup.title else '无标题'

        # 提取图片
        page_images = await asyncio.to_thread(self._extract_images, url, soup)

        # 保存图片信息
        for img_info in page_images:
            self.images.append({
                'url': url,
                'title': title,
                'depth': current_depth,
                'image_url': img_info['url'],
                'alt': img_info['alt'],
                'width': img_info['width'],
                'height': img_info['height']
            })

        # 更新爬取数量
        self.items_count += len(page_images)

        # 异步爬取链接
        links = self._extract_links(url, soup)
        tasks = [self._crawl(link, current_depth + 1) for link in links]
        await asyncio.gather(*tasks, return_exceptions=True)

    def _extract_images(self, url: str, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        提取页面中的图片

        Args:
            url: 当前URL
            soup: BeautifulSoup对象

        Returns:
            图片信息列表
        """
        images = []

        for img_tag in soup.find_all('img'):
            # 提取图片URL
            img_src = img_tag.get('src')
            if not img_src:
                continue

            # 转换为绝对URL
            absolute_url = urljoin(url, img_src)

            # 提取图片信息
            alt = img_tag.get('alt', '')
            width = img_tag.get('width', '')
            height = img_tag.get('height', '')

            # 只保存有效的图片URL
            if absolute_url.startswith(('http://', 'https://')):
                images.append({
                    'url': absolute_url,
                    'alt': alt,
                    'width': width,
                    'height': height
                })

        # 只返回前20张图片，避免结果过大
        return images[:20]


# 异步链接爬虫实现
class AsyncLinkCrawler(AsyncBaseCrawler):
    """
    异步链接爬虫类，用于高效爬取页面中的链接
    支持并发控制和错误处理
    """

    def __init__(self, url: str, depth: int = 2, config: CrawlConfig = None):
        """
        初始化异步链接爬虫

        Args:
            url: 目标URL
            depth: 爬取深度
            config: 爬虫配置
        """
        super().__init__(url, depth, config)
        self.links: List[Dict[str, Any]] = []

    async def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取（异步版本）

        Returns:
            爬取结果
        """
        self.links.clear()
        results = await super().start_crawling()
        results['data'] = self.links
        results['type'] = 'link'
        return results

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容，提取链接（异步版本）

        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 提取页面标题
        title = soup.title.string if soup.title else '无标题'

        # 提取链接
        page_links = self._extract_links(url, soup)

        # 保存链接信息
        for link in page_links:
            self.links.append({
                'url': url,
                'title': title,
                'depth': current_depth,
                'link_url': link
            })

        # 更新爬取数量
        self.items_count += len(page_links)

        # 异步爬取链接
        tasks = [self._crawl(link, current_depth + 1) for link in page_links]
        await asyncio.gather(*tasks, return_exceptions=True)


# 使用示例
async def main():
    """异步图片爬虫使用示例"""
    config = CrawlConfig(
        max_concurrent=3,
        request_delay=0.5,
        timeout=10,
        max_retries=3
    )

    try:
        # 图片爬虫示例
        async with AsyncImageCrawler("https://example.com", depth=2, config=config) as crawler:
            result = await crawler.start_crawling()
            print(f"图片爬取完成: {result['items']} 个项目，耗时 {result['time']} 秒")
            print(f"统计数据: {result['stats']}")

            # 链接爬虫示例
        async with AsyncLinkCrawler("https://example.com", depth=2, config=config) as crawler:
            result = await crawler.start_crawling()
            print(f"链接爬取完成: {result['items']} 个项目，耗时 {result['time']} 秒")
            print(f"统计数据: {result['stats']}")

    except Exception as e:
        print(f"执行失败: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())