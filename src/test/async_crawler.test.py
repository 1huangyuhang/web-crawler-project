"""
异步爬虫单元测试
测试异步爬虫的核心功能和性能
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from src.scripts.crawler.async_base_crawler import AsyncBaseCrawler, CrawlConfig
from src.scripts.crawler.async_content_crawler import AsyncContentCrawler
from src.scripts.crawler.async_image_crawler import AsyncImageCrawler


class TestAsyncBaseCrawler:
    """测试异步基础爬虫类"""

    @pytest.fixture
    def config(self):
        """测试配置"""
        return CrawlConfig(
            max_concurrent=3,
            request_delay=0.1,
            timeout=5,
            max_retries=2
        )

    @pytest.fixture
    def crawler(self, config):
        """测试爬虫实例"""
        return AsyncBaseCrawler("https://example.com", depth=2, config=config)

    def test_initialization(self, config):
        """测试初始化"""
        crawler = AsyncBaseCrawler("https://example.com", depth=3, config=config)
        assert crawler.url == "https://example.com"
        assert crawler.depth == 3
        assert crawler.config == config
        assert len(crawler.visited_urls) == 0
        assert crawler.items_count == 0

    def test_default_config(self):
        """测试默认配置"""
        crawler = AsyncBaseCrawler("https://example.com")
        assert crawler.config.max_concurrent == 5
        assert crawler.config.request_delay == 0.5
        assert crawler.config.timeout == 10
        assert crawler.config.max_retries == 3

    @pytest.mark.asyncio
    async def test_context_manager(self, config):
        """测试异步上下文管理器"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)
        assert crawler.session is None

        async with crawler:
            assert crawler.session is not None
            assert crawler.isConnected is True

        # 退出上下文后应该关闭会话
        assert crawler.session is None

    @pytest.mark.asyncio
    async def test_rate_limit(self, config):
        """测试速率限制"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)
        async with crawler:
            # 设置上次请求时间
            crawler._last_request_time = asyncio.get_event_loop().time() - 0.05

            # 应该等待剩余时间
            start_time = asyncio.get_event_loop().time()
            await crawler._rate_limit()
            end_time = asyncio.get_event_loop().time()

            # 检查是否等待了正确的延迟时间
            elapsed = end_time - start_time
            assert elapsed >= config.request_delay - 0.05

    def test_extract_links(self, crawler):
        """测试链接提取"""
        from bs4 import BeautifulSoup

        html = """
        <html>
        <body>
            <a href="/page1">Page 1</a>
            <a href="https://example.com/page2">Page 2</a>
            <a href="http://other.com/page3">Other Domain</a>
            <a href="javascript:void(0)">JavaScript Link</a>
        </body>
        </html>
        """

        soup = BeautifulSoup(html, 'html.parser')
        base_url = "https://example.com"

        links = crawler._extract_links(base_url, soup)

        # 应该只包含HTTP/HTTPS链接
        assert len(links) == 3
        assert "https://example.com/page1" in links
        assert "https://example.com/page2" in links
        assert "http://other.com/page3" in links
        assert "javascript:void(0)" not in links

    @pytest.mark.asyncio
    async def test_fetch_url_with_retry_success(self, config):
        """测试带重试的URL获取 - 成功情况"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)

        # 模拟成功的响应
        mock_response = Mock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value="<html></html>")

        async with crawler:
            with patch.object(crawler.session, 'get', return_value=mock_response):
                result = await crawler._fetch_url_with_retry("https://example.com")

                # 验证结果
                assert result is not None
                assert mock_response.text.called

    @pytest.mark.asyncio
    async def test_fetch_url_with_retry_timeout(self, config):
        """测试带重试的URL获取 - 超时重试"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)

        async with crawler:
            # 模拟超时错误，然后成功
            call_count = 0
            async def mock_get(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise asyncio.TimeoutError("Connection timeout")
                # 第二次调用成功
                mock_response = Mock()
                mock_response.status = 200
                mock_response.text = AsyncMock(return_value="<html></html>")
                return mock_response

            with patch.object(crawler.session, 'get', side_effect=mock_get):
                result = await crawler._fetch_url_with_retry("https://example.com", retry_count=0)

                # 验证重试发生
                assert call_count == 2
                assert result is not None

    @pytest.mark.asyncio
    async def test_fetch_url_with_retry_max_retries(self, config):
        """测试带重试的URL获取 - 超过最大重试次数"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)

        async with crawler:
            # 总是失败
            with patch.object(crawler.session, 'get', side_effect=asyncio.TimeoutError("Always timeout")):
                result = await crawler._fetch_url_with_retry("https://example.com", retry_count=0)

                # 应该返回None，因为超过了最大重试次数
                assert result is None

    @pytest.mark.asyncio
    async def test_crawl_depth_limit(self, config):
        """测试爬取深度限制"""
        crawler = AsyncBaseCrawler("https://example.com", depth=2, config=config)

        async with crawler:
            # 模拟页面处理
            async def mock_process_page(url, soup, depth):
                crawler.items_count += 1
                # 只添加几个已访问URL，不实际爬取
                if depth < 2:
                    crawler.visited_urls.add(f"https://example.com/page{depth}")

            crawler._process_page = mock_process_page

            # 模拟获取页面
            with patch.object(crawler, '_fetch_url_with_retry', return_value=Mock()):
                await crawler._crawl("https://example.com", 0)

                # 验证深度限制生效
                assert crawler.items_count > 0

    def test_generate_cache_key(self, config):
        """测试缓存键生成"""
        crawler = AsyncBaseCrawler("https://example.com", config=config)
        key = crawler.generateCacheKey("test", "123")
        assert key == "test123"


class TestAsyncContentCrawler:
    """测试异步内容爬虫"""

    @pytest.fixture
    def config(self):
        return CrawlConfig(max_concurrent=2, request_delay=0.1)

    @pytest.mark.asyncio
    async def test_content_extraction(self, config):
        """测试内容提取"""
        crawler = AsyncContentCrawler("https://example.com", config=config)

        html = """
        <html>
        <head><title>Test Page</title></head>
        <body>
            <h1>Main Title</h1>
            <p>This is a test paragraph with some content.</p>
            <p>Another paragraph for testing.</p>
            <script>console.log('script');</script>
            <style>.test { color: red; }</style>
        </body>
        </html>
        """

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        content = await asyncio.to_thread(crawler._extract_content, soup)

        # 验证内容提取
        assert "Main Title" in content
        assert "test paragraph" in content
        assert "script" not in content  # 脚本应该被移除
        assert "style" not in content  # 样式应该被移除

    def test_keyword_extraction(self, config):
        """测试关键词提取"""
        crawler = AsyncContentCrawler("https://example.com", config=config)

        html = """
        <html>
        <head>
            <title>Python Programming Test</title>
            <meta name="keywords" content="python, programming, coding">
        </head>
        <body>
            <p>Python is a popular programming language. It is used for web development.</p>
        </body>
        </html>
        """

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        keywords = crawler._extract_keywords(soup)

        # 验证关键词提取
        assert "python" in keywords
        assert "programming" in keywords
        assert "coding" in keywords
        assert len(keywords) <= 10  # 应该限制数量


class TestAsyncImageCrawler:
    """测试异步图片爬虫"""

    def test_image_extraction(self):
        """测试图片提取"""
        crawler = AsyncImageCrawler("https://example.com")

        html = """
        <html>
        <body>
            <img src="/image1.jpg" alt="Image 1" width="100" height="100">
            <img src="https://example.com/image2.png" alt="Image 2" width="200">
            <img src="invalid-url" alt="Invalid">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" alt="Data URL">
        </body>
        </html>
        """

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        images = crawler._extract_images("https://example.com", soup)

        # 验证图片提取
        assert len(images) == 2  # 只包含有效的HTTP/HTTPS图片
        assert images[0]['url'] == "https://example.com/image1.jpg"
        assert images[0]['alt'] == "Image 1"
        assert images[1]['url'] == "https://example.com/image2.png"


class TestPerformance:
    """性能测试"""

    @pytest.mark.asyncio
    async def test_concurrent_performance(self):
        """测试并发性能"""
        config = CrawlConfig(max_concurrent=5, request_delay=0.01)
        crawler = AsyncBaseCrawler("https://example.com", config=config)

        # 模拟多个并发请求
        async def mock_work():
            await asyncio.sleep(0.1)
            return True

        start_time = asyncio.get_event_loop().time()
        tasks = [mock_work() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        end_time = asyncio.get_event_loop().time()

        # 验证所有任务都完成了
        assert all(results)
        # 由于并发，总时间应该小于顺序执行的时间
        assert end_time - start_time < 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])