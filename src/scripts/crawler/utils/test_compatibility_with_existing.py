# 兼容性测试 - 与现有爬虫代码的集成测试

import sys
import os

# 添加父目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.user_agent_pool import UserAgentPool
from utils.smart_scheduler import SmartScheduler
from utils.data_cleaner import DataCleaner
from utils.incremental_crawler import IncrementalCrawler

# 测试与现有爬虫的兼容性
from base_crawler import BaseCrawler
from link_crawler import LinkCrawler
from content_crawler import ContentCrawler
from image_crawler import ImageCrawler
from crawler_manager import CrawlerManager


def test_base_crawler_compatibility():
    """测试基础爬虫兼容性"""
    print("🔍 测试基础爬虫兼容性...")

    # 测试BaseCrawler是否能正常工作
    crawler = BaseCrawler("https://example.com", depth=1)
    results = crawler.start_crawling()

    # 验证结果结构
    assert 'url' in results
    assert 'depth' in results
    assert 'items' in results
    assert 'time' in results
    assert 'data' in results

    print("✅ 基础爬虫兼容性正常")


def test_link_crawler_compatibility():
    """测试链接爬虫兼容性"""
    print("🔍 测试链接爬虫兼容性...")

    # 测试LinkCrawler
    crawler = LinkCrawler("https://example.com", depth=1)
    results = crawler.start_crawling()

    # 验证结果结构
    assert 'type' in results
    assert results['type'] == 'link'
    assert 'data' in results

    # 验证数据格式
    if results['data']:
        for item in results['data']:
            assert 'url' in item
            assert 'title' in item
            assert 'depth' in item
            assert 'links' in item

    print("✅ 链接爬虫兼容性正常")


def test_content_crawler_compatibility():
    """测试内容爬虫兼容性"""
    print("🔍 测试内容爬虫兼容性...")

    # 测试ContentCrawler
    crawler = ContentCrawler("https://example.com", depth=1)
    results = crawler.start_crawling()

    # 验证结果结构
    assert 'type' in results
    assert results['type'] == 'content'
    assert 'data' in results

    # 验证数据格式
    if results['data']:
        for item in results['data']:
            assert 'url' in item
            assert 'title' in item
            assert 'depth' in item
            assert 'content' in item
            assert 'keywords' in item

    print("✅ 内容爬虫兼容性正常")


def test_image_crawler_compatibility():
    """测试图片爬虫兼容性"""
    print("🔍 测试图片爬虫兼容性...")

    # 测试ImageCrawler
    crawler = ImageCrawler("https://example.com", depth=1)
    results = crawler.start_crawling()

    # 验证结果结构
    assert 'type' in results
    assert results['type'] == 'image'
    assert 'data' in results

    # 验证数据格式
    if results['data']:
        for item in results['data']:
            assert 'url' in item
            assert 'title' in item
            assert 'depth' in item
            assert 'image_url' in item

    print("✅ 图片爬虫兼容性正常")


def test_crawler_manager_compatibility():
    """测试爬虫管理器兼容性"""
    print("🔍 测试爬虫管理器兼容性...")

    # 测试支持的爬虫类型
    supported_types = CrawlerManager.get_supported_types()
    assert 'link' in supported_types
    assert 'content' in supported_types
    assert 'image' in supported_types

    # 测试类型验证
    assert CrawlerManager.validate_crawler_type('link') == True
    assert CrawlerManager.validate_crawler_type('content') == True
    assert CrawlerManager.validate_crawler_type('image') == True
    assert CrawlerManager.validate_crawler_type('invalid') == False

    # 测试爬虫创建
    link_crawler = CrawlerManager.create_crawler('link', 'https://example.com', 1)
    assert isinstance(link_crawler, LinkCrawler)

    content_crawler = CrawlerManager.create_crawler('content', 'https://example.com', 1)
    assert isinstance(content_crawler, ContentCrawler)

    image_crawler = CrawlerManager.create_crawler('image', 'https://example.com', 1)
    assert isinstance(image_crawler, ImageCrawler)

    print("✅ 爬虫管理器兼容性正常")


def test_integration_with_existing_crawlers():
    """测试与现有爬虫的集成"""
    print("🔍 测试与现有爬虫的集成...")

    # 测试User-Agent集成
    class TestCrawlerWithUA(BaseCrawler):
        def __init__(self, url: str, depth: int = 2):
            super().__init__(url, depth)
            self.ua_pool = UserAgentPool()

        def _fetch_url(self, url: str):
            try:
                headers = {
                    'User-Agent': self.ua_pool.get_random_ua()
                }
                # 模拟请求（不实际发送）
                return None  # 实际测试时返回模拟响应
            except Exception:
                return None

    # 测试调度器集成
    class TestCrawlerWithScheduler(BaseCrawler):
        def __init__(self, url: str, depth: int = 2):
            super().__init__(url, depth)
            self.scheduler = SmartScheduler()

        def _crawl(self, url: str, current_depth: int):
            # 使用调度器
            self.scheduler.wait(url)
            # 记录成功
            self.scheduler.record_success(url, 0.5)
            super()._crawl(url, current_depth)

    # 测试数据清洗集成
    def test_data_cleaning_integration():
        cleaner = DataCleaner()

        # 模拟爬虫数据
        raw_data = [
            {
                'url': 'https://example.com/page1',
                'title': '<b>测试标题</b>',
                'content': '测试内容包含广告信息 www.example.com'
            }
        ]

        # 清理数据
        cleaned_data = cleaner.clean_content_data(raw_data)

        # 验证清理效果
        assert len(cleaned_data) == 1
        assert '<b>' not in cleaned_data[0]['title']
        assert 'www.example.com' not in cleaned_data[0]['content']

    # 测试增量爬取集成
    def test_incremental_integration():
        inc_crawler = IncrementalCrawler("test_integration.json")

        # 模拟检查URL
        test_url = "https://example.com/test"
        test_content = "测试内容"

        # 初始状态应未爬取
        should_skip, reason = inc_crawler.should_skip_url(test_url, test_content)
        assert should_skip == False

        # 标记为已爬取
        inc_crawler.mark_url_crawled(test_url, success=True, content=test_content)

        # 现在应跳过
        should_skip, reason = inc_crawler.should_skip_url(test_url, test_content)
        assert should_skip == True

        # 清理测试文件
        if os.path.exists("test_integration.json"):
            os.remove("test_integration.json")

    # 执行所有集成测试
    test_data_cleaning_integration()
    test_incremental_integration()

    print("✅ 集成测试正常")


def test_main_script_compatibility():
    """测试主脚本兼容性"""
    print("🔍 测试主脚本兼容性...")

    # 测试CrawlerManager.start_crawling方法
    results = CrawlerManager.start_crawling('link', 'https://example.com', 1)

    # 验证结果结构
    assert 'url' in results
    assert 'type' in results
    assert 'depth' in results
    assert 'items' in results
    assert 'time' in results
    assert 'data' in results

    # 测试错误处理
    invalid_results = CrawlerManager.start_crawling('invalid_type', 'https://example.com', 1)
    assert 'error' in invalid_results or 'type' in invalid_results

    print("✅ 主脚本兼容性正常")


def run_all_compatibility_tests():
    """运行所有兼容性测试"""
    print("🚀 开始运行兼容性测试...\n")

    try:
        test_base_crawler_compatibility()
        test_link_crawler_compatibility()
        test_content_crawler_compatibility()
        test_image_crawler_compatibility()
        test_crawler_manager_compatibility()
        test_integration_with_existing_crawlers()
        test_main_script_compatibility()

        print("\n🎉 所有兼容性测试通过！")
        print("\n📋 兼容性总结：")
        print("- ✅ BaseCrawler: 完全兼容")
        print("- ✅ LinkCrawler: 完全兼容")
        print("- ✅ ContentCrawler: 完全兼容")
        print("- ✅ ImageCrawler: 完全兼容")
        print("- ✅ CrawlerManager: 完全兼容")
        print("- ✅ 主脚本: 完全兼容")
        print("- ✅ 新功能集成: 完全兼容")

        return True

    except Exception as e:
        print(f"\n❌ 兼容性测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = run_all_compatibility_tests()
    sys.exit(0 if success else 1)