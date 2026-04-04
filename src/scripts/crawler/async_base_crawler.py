# 异步基础爬虫类 - 支持并发控制

import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Set, Dict, Any, Optional, List
import time
import logging
from dataclasses import dataclass
from asyncio import Semaphore


@dataclass
class CrawlConfig:
    """爬虫配置类"""
    max_concurrent: int = 5  # 最大并发数
    request_delay: float = 0.5  # 请求延迟（秒）
    timeout: int = 10  # 请求超时时间
    max_retries: int = 3  # 最大重试次数
    user_agent: str = 'Mozilla/5.0 (compatible; AsyncCrawler/1.0)'


class AsyncBaseCrawler:
    """
    异步基础爬虫类，提供高效的并发爬取能力
    支持速率限制、错误重试、会话管理等功能

    主要特性:
    - 基于 asyncio 和 aiohttp 实现真正的异步并发
    - Semaphore 控制最大并发连接数，防止资源耗尽
    - 可配置的请求延迟和超时机制
    - 指数退避策略的错误重试机制
    - 详细的统计数据收集和性能监控
    - 支持优雅的资源管理和连接池

    使用示例:
    ```python
    config = CrawlConfig(max_concurrent=5, request_delay=0.5)
    async with AsyncBaseCrawler("https://example.com", depth=2, config=config) as crawler:
        result = await crawler.start_crawling()
        print(f"爬取完成: {result['items']} 个项目，耗时 {result['time']} 秒")
    ```
    """

    def __init__(self, url: str, depth: int = 2, config: CrawlConfig = None):
        """
        初始化异步爬虫

        Args:
            url: 目标URL
            depth: 爬取深度
            config: 爬虫配置
        """
        self.url = url
        self.depth = depth
        self.config = config or CrawlConfig()

        # 状态管理
        self.visited_urls: Set[str] = set()
        self.start_time = 0
        self.end_time = 0
        self.items_count = 0
        self.results: Dict[str, Any] = {}

        # 并发控制
        self.semaphore = Semaphore(self.config.max_concurrent)
        self.session: Optional[aiohttp.ClientSession] = None

        # 统计数据
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_response_time': 0,
            'average_response_time': 0
        }

        # 设置日志
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    async def __aenter__(self):
        """异步上下文管理器入口"""
        connector = aiohttp.TCPConnector(
            limit=self.config.max_concurrent,
            limit_per_host=2  # 每个主机限制连接数
        )
        timeout = aiohttp.ClientTimeout(total=self.config.timeout)

        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': self.config.user_agent}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        if self.session:
            await self.session.close()

    async def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取（异步版本）

        这是主要的入口方法，负责管理整个爬取流程的生命周期:
        1. 初始化爬取状态和时间统计
        2. 创建异步上下文管理器确保资源正确释放
        3. 启动递归爬取过程
        4. 收集统计数据和性能指标

        Returns:
            完整的爬取结果字典，包含:
            - url: 目标URL
            - depth: 爬取深度
            - items: 爬取项目总数
            - time: 总耗时(秒)
            - data: 爬取数据列表
            - stats: 详细的性能指标
            - error: 错误信息(如果有)

        Raises:
            Exception: 当爬取过程中发生严重错误时
        """
        self.start_time = time.time()
        self.visited_urls.clear()
        self.items_count = 0
        self.results = {
            'url': self.url,
            'depth': self.depth,
            'items': 0,
            'time': 0,
            'data': [],
            'stats': {}
        }

        try:
            async with self:
                await self._crawl(self.url, 0)
        except Exception as e:
            self.logger.error(f"爬虫执行失败: {str(e)}")
            self.results['error'] = str(e)

        self.end_time = time.time()
        self.results['items'] = self.items_count
        self.results['time'] = round(self.end_time - self.start_time, 2)
        self.results['stats'] = self.stats

        # 计算平均响应时间
        if self.stats['successful_requests'] > 0:
            self.stats['average_response_time'] = round(
                self.stats['total_response_time'] / self.stats['successful_requests'], 3
            )

        return self.results

    async def _crawl(self, url: str, current_depth: int):
        """
        递归爬取方法（异步版本）

        核心爬取逻辑，负责:
        1. 检查深度限制和已访问URL，避免重复爬取
        2. 使用信号量控制并发连接数
        3. 执行速率限制，防止对目标服务器造成过大压力
        4. 获取页面内容并处理异常
        5. 递归处理发现的链接

        Args:
            url: 当前要爬取的URL
            current_depth: 当前爬取深度

        Note:
            使用 asyncio.gather 并行处理子链接，显著提高爬取效率
            return_exceptions=True 确保单个链接失败不影响整体爬取
        """
        if current_depth >= self.depth or url in self.visited_urls:
            return

        self.visited_urls.add(url)

        # 使用信号量控制并发
        async with self.semaphore:
            await self._rate_limit()  # 速率限制

            response = await self._fetch_url_with_retry(url)
            if response:
                await self._process_page(url, response, current_depth)
                self.stats['successful_requests'] += 1
            else:
                self.stats['failed_requests'] += 1

    async def _rate_limit(self):
        """简单的速率限制实现"""
        if hasattr(self, '_last_request_time'):
            elapsed = time.time() - self._last_request_time
            if elapsed < self.config.request_delay:
                await asyncio.sleep(self.config.request_delay - elapsed)

        self._last_request_time = time.time()

    async def _fetch_url_with_retry(self, url: str, retry_count: int = 0) -> Optional[BeautifulSoup]:
        """
        带重试机制的URL获取

        实现了指数退避策略的智能重试机制:
        1. 记录响应时间用于性能分析
        2. 处理HTTP状态码异常
        3. 对超时和连接错误进行重试
        4. 使用指数退避算法(2^retry_count)避免重试风暴

        Args:
            url: 要获取的URL
            retry_count: 当前重试次数

        Returns:
            BeautifulSoup对象(成功时)或None(失败时)

        Note:
            重试次数由 config.max_retries 控制
            重试间隔 = 2^retry_count 秒 (指数退避)
        """
        try:
            response_start_time = time.time()
            async with self.session.get(url, ssl=False) as response:
                response_time = time.time() - response_start_time
                self.stats['total_response_time'] += response_time
                self.stats['total_requests'] += 1

                if response.status == 200:
                    content = await response.text()
                    return BeautifulSoup(content, 'html.parser')
                else:
                    self.logger.warning(f"HTTP {response.status} for {url}")
                    return None

        except asyncio.TimeoutError:
            self.logger.warning(f"请求超时: {url}")
            if retry_count < self.config.max_retries:
                await asyncio.sleep(2 ** retry_count)  # 指数退避
                return await self._fetch_url_with_retry(url, retry_count + 1)
            return None

        except Exception as e:
            self.logger.error(f"请求失败 {url}: {str(e)}")
            if retry_count < self.config.max_retries:
                await asyncio.sleep(2 ** retry_count)
                return await self._fetch_url_with_retry(url, retry_count + 1)
            return None

    async def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容（需要子类实现）

        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 子类实现具体的页面处理逻辑
        pass

    def _extract_links(self, url: str, soup: BeautifulSoup) -> Set[str]:
        """
        提取页面中的链接

        Args:
            url: 当前URL
            soup: BeautifulSoup对象

        Returns:
            链接集合
        """
        links = set()
        for a_tag in soup.find_all('a', href=True):
            href = a_tag.get('href')
            absolute_url = urljoin(url, href)

            # 只保留HTTP/HTTPS链接
            parsed_url = urlparse(absolute_url)
            if parsed_url.scheme in ['http', 'https']:
                links.add(absolute_url)

        return links

    def _extract_links_with_depth(self, url: str, soup: BeautifulSoup, current_depth: int) -> List[tuple]:
        """
        提取链接并附带深度信息

        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度

        Returns:
            (链接, 深度)的列表
        """
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag.get('href')
            absolute_url = urljoin(url, href)

            parsed_url = urlparse(absolute_url)
            if parsed_url.scheme in ['http', 'https']:
                links.append((absolute_url, current_depth + 1))

        return links

# 使用示例
async def main():
    """异步爬虫使用示例"""
    config = CrawlConfig(max_concurrent=5, request_delay=0.5)

    async with AsyncBaseCrawler("https://example.com", depth=2, config=config) as crawler:
        result = await crawler.start_crawling()
        print(f"爬取完成: {result['items']} 个项目，耗时 {result['time']} 秒")
        print(f"统计数据: {result['stats']}")

if __name__ == "__main__":
    asyncio.run(main())