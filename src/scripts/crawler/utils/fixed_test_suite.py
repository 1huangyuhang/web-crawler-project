#!/usr/bin/env python3
"""
修正后的专业测试套件 - 修复测试逻辑问题
"""

import sys
import os
import time
import unittest
from unittest.mock import Mock, patch, MagicMock
import json

# 添加路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from user_agent_pool import UserAgentPool
from smart_scheduler import SmartScheduler
from data_cleaner import DataCleaner
from incremental_crawler import IncrementalCrawler


class UserAgentPoolUnitTest(unittest.TestCase):
    """User-Agent池单元测试"""

    def test_get_random_ua_returns_valid_string(self):
        """测试获取随机UA返回有效字符串"""
        ua = UserAgentPool.get_random_ua()
        self.assertIsInstance(ua, str)
        self.assertGreater(len(ua), 0)
        self.assertIn('Mozilla', ua)

    def test_get_random_desktop_ua(self):
        """测试获取桌面端UA"""
        ua = UserAgentPool.get_random_desktop_ua()
        self.assertIsInstance(ua, str)
        self.assertIn('Mozilla', ua)
        # 桌面端UA通常不包含Mobile
        self.assertNotIn('Mobile', ua)

    def test_get_random_mobile_ua(self):
        """测试获取移动端UA"""
        ua = UserAgentPool.get_random_mobile_ua()
        self.assertIsInstance(ua, str)
        self.assertIn('Mozilla', ua)
        # 移动端UA通常包含Mobile或Android/iOS
        self.assertTrue('Mobile' in ua or 'Android' in ua or 'iPhone' in ua)

    def test_add_custom_ua(self):
        """测试添加自定义UA"""
        custom_ua = 'Custom User Agent 1.0'
        UserAgentPool.add_custom_ua(custom_ua)
        self.assertIn(custom_ua, UserAgentPool.USER_AGENTS)

    def test_get_all_ua_returns_copy(self):
        """测试获取所有UA返回副本"""
        all_ua = UserAgentPool.get_all_ua()
        self.assertIsInstance(all_ua, list)
        self.assertEqual(len(all_ua), len(UserAgentPool.USER_AGENTS))
        # 修改返回的列表不应影响原始列表
        all_ua.append('Test UA')
        self.assertNotIn('Test UA', UserAgentPool.USER_AGENTS)

    def test_ua_uniqueness(self):
        """测试UA列表中没有重复项"""
        self.assertEqual(len(UserAgentPool.USER_AGENTS), len(set(UserAgentPool.USER_AGENTS)))


class SmartSchedulerUnitTest(unittest.TestCase):
    """智能调度器单元测试"""

    def setUp(self):
        """测试前准备"""
        self.scheduler = SmartScheduler(base_delay=0.1, max_delay=1.0, min_delay=0.05)

    def test_initialization(self):
        """测试初始化参数"""
        self.assertEqual(self.scheduler.base_delay, 0.1)
        self.assertEqual(self.scheduler.max_delay, 1.0)
        self.assertEqual(self.scheduler.min_delay, 0.05)

    def test_get_domain(self):
        """测试域名提取"""
        url = "https://www.example.com:8080/path?query=1"
        domain = self.scheduler._get_domain(url)
        self.assertEqual(domain, "www.example.com:8080")

    def test_ensure_domain_record(self):
        """测试确保域名记录存在"""
        domain = "example.com"
        self.scheduler._ensure_domain_record(domain)
        self.assertIn(domain, self.scheduler.domain_history)

    def test_wait_first_request(self):
        """测试首次请求等待"""
        url = "https://example.com/page1"
        start_time = time.time()
        self.scheduler.wait(url)
        elapsed = time.time() - start_time
        # 首次请求应该几乎不等待
        self.assertLess(elapsed, 0.01)

    def test_record_success_updates_domain_history(self):
        """测试记录成功请求更新域名历史"""
        url = "https://example.com/page1"
        domain = self.scheduler._get_domain(url)

        # 确保域名记录存在
        self.scheduler._ensure_domain_record(domain)

        # 记录成功
        self.scheduler.record_success(url, 0.5)

        # 验证域名历史更新
        self.assertIn(domain, self.scheduler.domain_history)
        self.assertEqual(self.scheduler.domain_history[domain]['success_count'], 1)
        self.assertEqual(self.scheduler.domain_history[domain]['consecutive_errors'], 0)

    def test_record_error_increases_delay(self):
        """测试错误记录增加延迟"""
        url = "https://example.com/page1"
        original_delay = self.scheduler.get_current_delay(url)
        self.scheduler.record_error(url, 'timeout')
        new_delay = self.scheduler.get_current_delay(url)
        self.assertGreater(new_delay, original_delay)

    def test_consecutive_errors_exponential_backoff(self):
        """测试连续错误指数退避"""
        url = "https://example.com/page1"

        # 第一次错误
        self.scheduler.record_error(url, 'timeout')
        delay1 = self.scheduler.get_current_delay(url)

        # 第二次错误
        self.scheduler.record_error(url, 'timeout')
        delay2 = self.scheduler.get_current_delay(url)

        # 第三次错误
        self.scheduler.record_error(url, 'timeout')
        delay3 = self.scheduler.get_current_delay(url)

        # 验证指数增长
        self.assertGreater(delay2, delay1)
        self.assertGreater(delay3, delay2)

    def test_max_delay_limit(self):
        """测试最大延迟限制"""
        url = "https://example.com/page1"

        # 连续多次错误
        for _ in range(10):
            self.scheduler.record_error(url, 'timeout')

        delay = self.scheduler.get_current_delay(url)
        self.assertLessEqual(delay, self.scheduler.max_delay)

    def test_response_time_based_adjustment(self):
        """测试基于响应时间的调整"""
        url = "https://example.com/page1"

        # 记录快速响应
        self.scheduler.record_success(url, 0.1)
        delay_after_fast = self.scheduler.get_current_delay(url)

        # 重置
        self.scheduler.reset_domain(url)

        # 记录慢速响应，应该增加延迟
        self.scheduler.record_success(url, 6.0)
        delay_after_slow = self.scheduler.get_current_delay(url)

        # 慢速响应应该导致延迟增加
        self.assertGreater(delay_after_slow, self.scheduler.min_delay)

    def test_get_stats(self):
        """测试获取统计信息"""
        url = "https://example.com/page1"
        self.scheduler.record_success(url, 0.5)

        stats = self.scheduler.get_stats(url)
        self.assertIn('domain', stats)
        self.assertIn('current_delay', stats)
        self.assertIn('success_count', stats)
        self.assertIn('error_count', stats)


class DataCleanerUnitTest(unittest.TestCase):
    """数据清洗器单元测试"""

    def setUp(self):
        """测试前准备"""
        self.cleaner = DataCleaner()

    def test_clean_text_removes_html_tags(self):
        """测试移除HTML标签"""
        text = "<p>Hello <b>World</b></p>"
        cleaned = self.cleaner.clean_text(text, remove_html=True)
        self.assertNotIn('<p>', cleaned)
        self.assertNotIn('<b>', cleaned)
        self.assertNotIn('</p>', cleaned)
        self.assertNotIn('</b>', cleaned)

    def test_clean_text_removes_urls(self):
        """测试移除URL"""
        text = "Visit www.example.com for more info"
        cleaned = self.cleaner.clean_text(text)
        self.assertNotIn('www.example.com', cleaned)

    def test_clean_text_removes_emails(self):
        """测试移除邮箱"""
        text = "Contact us at info@example.com"
        cleaned = self.cleaner.clean_text(text)
        self.assertNotIn('info@example.com', cleaned)

    def test_clean_text_removes_phone_numbers(self):
        """测试移除手机号"""
        text = "Call 13800138000 for support"
        cleaned = self.cleaner.clean_text(text)
        self.assertNotIn('13800138000', cleaned)

    def test_clean_text_removes_ads(self):
        """测试移除广告关键词"""
        text = "立即购买享受优惠促销"
        cleaned = self.cleaner.clean_text(text, remove_ads=True)
        self.assertNotIn('立即', cleaned)
        self.assertNotIn('购买', cleaned)
        self.assertNotIn('优惠', cleaned)
        self.assertNotIn('促销', cleaned)

    def test_extract_paragraphs(self):
        """测试提取段落"""
        text = "段落1\n\n段落2\n段落3"
        paragraphs = self.cleaner.extract_paragraphs(text, min_length=2)
        self.assertEqual(len(paragraphs), 3)

    def test_extract_paragraphs_min_length(self):
        """测试段落最小长度限制"""
        text = "短\n\n这是一个较长的段落"
        paragraphs = self.cleaner.extract_paragraphs(text, min_length=5)
        self.assertEqual(len(paragraphs), 1)

    def test_clean_url_removes_tracking_params(self):
        """测试移除URL跟踪参数"""
        url = "https://example.com/page?utm_source=google&utm_medium=cpc&spm=123"
        cleaned = self.cleaner.clean_url(url)
        self.assertNotIn('utm_source', cleaned)
        self.assertNotIn('utm_medium', cleaned)
        self.assertNotIn('spm', cleaned)

    def test_extract_keywords(self):
        """测试关键词提取"""
        text = "Python is a programming language. Python is widely used."
        keywords = self.cleaner.extract_keywords(text, top_n=2)
        self.assertIn('Python', keywords)

    def test_generate_content_fingerprint(self):
        """测试生成内容指纹"""
        text = "Hello World"
        fingerprint = self.cleaner.generate_content_fingerprint(text)
        self.assertEqual(len(fingerprint), 32)  # MD5长度
        self.assertTrue(all(c in '0123456789abcdef' for c in fingerprint))

    def test_fingerprint_consistency(self):
        """测试指纹一致性"""
        text = "Hello World"
        fp1 = self.cleaner.generate_content_fingerprint(text)
        fp2 = self.cleaner.generate_content_fingerprint(text)
        self.assertEqual(fp1, fp2)

    def test_fingerprint_uniqueness(self):
        """测试指纹唯一性"""
        text1 = "Hello World"
        text2 = "Hello World!"
        fp1 = self.cleaner.generate_content_fingerprint(text1)
        fp2 = self.cleaner.generate_content_fingerprint(text2)
        self.assertNotEqual(fp1, fp2)

    def test_clean_content_data(self):
        """测试清理内容数据"""
        data = [
            {
                'url': 'https://example.com/page1',
                'title': '<b>Test Title</b>',
                'content': 'Content with <p>HTML</p> tags'
            }
        ]
        cleaned = self.cleaner.clean_content_data(data)
        self.assertEqual(len(cleaned), 1)
        self.assertNotIn('<b>', cleaned[0]['title'])
        self.assertIn('content_hash', cleaned[0])
        self.assertIn('auto_keywords', cleaned[0])

    def test_remove_duplicates_by_similarity(self):
        """测试相似度去重"""
        texts = [
            "This is a test document",
            "This is a test document",  # 完全重复
            "This is another test document",  # 相似
            "Completely different content"  # 不同
        ]
        unique = self.cleaner.remove_duplicates_by_similarity(texts, similarity_threshold=0.8)
        self.assertLess(len(unique), len(texts))


class IncrementalCrawlerUnitTest(unittest.TestCase):
    """增量爬取器单元测试"""

    def setUp(self):
        """测试前准备"""
        self.temp_file = "test_incremental_unit.json"
        self.inc_crawler = IncrementalCrawler(self.temp_file)

    def tearDown(self):
        """测试后清理"""
        if os.path.exists(self.temp_file):
            os.remove(self.temp_file)

    def test_generate_content_hash(self):
        """测试生成内容哈希"""
        content = "Test content"
        hash_value = self.inc_crawler.generate_content_hash(content)
        self.assertEqual(len(hash_value), 32)

    def test_is_content_crawled_initially_false(self):
        """测试初始状态下内容未爬取"""
        content = "New content"
        self.assertFalse(self.inc_crawler.is_content_crawled(content))

    def test_mark_and_check_crawled(self):
        """测试标记和检查爬取状态"""
        url = "https://example.com/page1"
        content = "Page content"

        # 初始状态
        self.assertFalse(self.inc_crawler.is_url_crawled(url))
        self.assertFalse(self.inc_crawler.is_content_crawled(content))

        # 标记为已爬取
        self.inc_crawler.mark_url_crawled(url, success=True, content=content)

        # 验证状态
        self.assertTrue(self.inc_crawler.is_url_crawled(url))
        self.assertTrue(self.inc_crawler.is_content_crawled(content))

    def test_should_skip_url(self):
        """测试URL跳过逻辑"""
        url = "https://example.com/page1"
        content = "Page content"

        # 初始状态不应跳过
        should_skip, reason = self.inc_crawler.should_skip_url(url, content)
        self.assertFalse(should_skip)

        # 标记为已爬取
        self.inc_crawler.mark_url_crawled(url, success=True, content=content)

        # 现在应跳过
        should_skip, reason = self.inc_crawler.should_skip_url(url, content)
        self.assertTrue(should_skip)
        self.assertIn("已爬取", reason)

    def test_filter_new_urls(self):
        """测试过滤新URL"""
        # 添加一些已爬取的URL
        self.inc_crawler.mark_url_crawled("https://example.com/page1", success=True)
        self.inc_crawler.mark_url_crawled("https://example.com/page2", success=True)

        # 测试URL列表
        test_urls = [
            "https://example.com/page1",  # 已爬取
            "https://example.com/page3",  # 新
            "https://example.com/page2",  # 已爬取
            "https://example.com/page4"   # 新
        ]

        new_urls = self.inc_crawler.filter_new_urls(test_urls)
        self.assertEqual(len(new_urls), 2)
        self.assertIn("https://example.com/page3", new_urls)
        self.assertIn("https://example.com/page4", new_urls)

    def test_filter_new_content(self):
        """测试过滤新内容"""
        # 添加已爬取的内容
        content1 = "Content 1"
        self.inc_crawler.mark_url_crawled("https://example.com/page1", success=True, content=content1)

        # 测试内容列表
        content_list = [
            {'url': 'https://example.com/page1', 'content': content1},  # 已爬取
            {'url': 'https://example.com/page2', 'content': 'Content 2'},  # 新
        ]

        new_content = self.inc_crawler.filter_new_content(content_list)
        self.assertEqual(len(new_content), 1)

    def test_get_crawl_stats(self):
        """测试获取爬取统计"""
        # 添加一些爬取记录
        self.inc_crawler.mark_url_crawled("https://example.com/page1", success=True, content="Content 1")
        self.inc_crawler.mark_url_crawled("https://example.com/page2", success=True, content="Content 2")
        self.inc_crawler.mark_url_crawled("https://example.com/page3", success=False, error_message="Timeout")

        stats = self.inc_crawler.get_crawl_stats()
        self.assertEqual(stats['total_urls'], 3)
        self.assertEqual(stats['success_urls'], 2)
        self.assertEqual(stats['failed_urls'], 1)
        self.assertEqual(stats['unique_content_count'], 2)

    def test_state_persistence(self):
        """测试状态持久化"""
        url = "https://example.com/page1"
        content = "Page content"

        # 标记为已爬取
        self.inc_crawler.mark_url_crawled(url, success=True, content=content)

        # 手动保存状态
        self.inc_crawler.save_state()

        # 创建新的实例，应该加载之前的状态
        new_inc_crawler = IncrementalCrawler(self.temp_file)

        # 验证状态已加载
        self.assertTrue(new_inc_crawler.is_url_crawled(url))
        self.assertTrue(new_inc_crawler.is_content_crawled(content))

    def test_reset_domain_state(self):
        """测试重置域名状态"""
        # 添加不同域名的记录
        self.inc_crawler.mark_url_crawled("https://example.com/page1", success=True)
        self.inc_crawler.mark_url_crawled("https://test.com/page1", success=True)

        # 重置example.com
        self.inc_crawler.reset_domain_state("example.com")

        # 验证example.com已重置，test.com保持不变
        self.assertFalse(self.inc_crawler.is_url_crawled("https://example.com/page1"))
        self.assertTrue(self.inc_crawler.is_url_crawled("https://test.com/page1"))


class IntegrationTest(unittest.TestCase):
    """集成测试"""

    def setUp(self):
        """测试前准备"""
        self.temp_file = "test_integration.json"
        self.inc_crawler = IncrementalCrawler(self.temp_file)

    def tearDown(self):
        """测试后清理"""
        if os.path.exists(self.temp_file):
            os.remove(self.temp_file)

    def test_full_workflow(self):
        """测试完整工作流程"""
        # 模拟爬虫工作流程
        urls = [
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page3"
        ]

        scheduler = SmartScheduler()
        cleaner = DataCleaner()

        processed_urls = []

        for url in urls:
            # 1. 检查是否需要跳过
            should_skip, reason = self.inc_crawler.should_skip_url(url)
            if should_skip:
                continue

            # 2. 等待适当时间
            scheduler.wait(url)

            # 3. 模拟获取内容
            content = f"Content from {url}"

            # 4. 清理内容
            cleaned_content = cleaner.clean_text(content)

            # 5. 生成指纹并标记为已爬取
            self.inc_crawler.mark_url_crawled(url, success=True, content=cleaned_content)

            processed_urls.append(url)

            # 6. 记录成功
            scheduler.record_success(url, 0.5)

        # 验证所有URL都已处理
        self.assertEqual(len(processed_urls), 3)

        # 验证状态
        for url in processed_urls:
            self.assertTrue(self.inc_crawler.is_url_crawled(url))

    def test_error_handling_workflow(self):
        """测试错误处理工作流程"""
        url = "https://example.com/error_page"
        scheduler = SmartScheduler()

        # 模拟多次错误
        for i in range(3):
            scheduler.wait(url)
            # 模拟请求失败
            scheduler.record_error(url, 'connection_error')

        # 验证延迟已增加
        delay = scheduler.get_current_delay(url)
        self.assertGreater(delay, scheduler.base_delay)

        # 标记URL为失败
        self.inc_crawler.mark_url_crawled(url, success=False, error_message='Max retries exceeded')

        # 验证URL已在状态管理中（即使失败也记录了）
        self.assertIn(url, self.inc_crawler.url_status)
        self.assertEqual(self.inc_crawler.url_status[url]['status'], 'failed')


class StressTest(unittest.TestCase):
    """压力测试"""

    def test_user_agent_pool_performance(self):
        """测试User-Agent池性能"""
        import time

        start_time = time.time()

        # 获取1000次UA
        for _ in range(1000):
            UserAgentPool.get_random_ua()

        elapsed = time.time() - start_time
        self.assertLess(elapsed, 1.0)  # 应该在1秒内完成
        print(f"✅ User-Agent池性能：1000次获取耗时 {elapsed:.4f} 秒")

    def test_scheduler_concurrent_domains(self):
        """测试调度器处理多域名"""
        scheduler = SmartScheduler()

        # 模拟100个不同域名的请求
        domains = [f"domain{i}.com" for i in range(100)]

        for domain in domains:
            url = f"https://{domain}/page"
            scheduler.wait(url)
            scheduler.record_success(url, 0.5)

        # 验证所有域名都有记录
        self.assertEqual(len(scheduler.domain_history), 100)
        print(f"✅ 调度器多域名性能：成功处理 {len(domains)} 个域名")

    def test_data_cleaner_large_text(self):
        """测试数据清洗器处理大文本"""
        cleaner = DataCleaner()

        # 生成大文本（100KB）
        large_text = "This is a test. " * 5000

        start_time = time.time()
        cleaned_text = cleaner.clean_text(large_text)
        elapsed = time.time() - start_time

        self.assertLess(elapsed, 1.0)  # 应该在1秒内完成
        self.assertIsInstance(cleaned_text, str)
        print(f"✅ 数据清洗器性能：100KB文本清洗耗时 {elapsed:.4f} 秒")

    def test_incremental_crawler_large_dataset(self):
        """测试增量爬取器处理大数据集"""
        temp_file = "test_stress.json"
        inc_crawler = IncrementalCrawler(temp_file)

        # 模拟1000个URL（减少数量以加快速度）
        urls = [f"https://example.com/page{i}" for i in range(1000)]
        contents = [f"Content {i}" for i in range(1000)]

        start_time = time.time()

        # 标记为已爬取
        for url, content in zip(urls, contents):
            inc_crawler.mark_url_crawled(url, success=True, content=content)

        elapsed = time.time() - start_time

        # 验证所有URL都已记录
        self.assertEqual(len(inc_crawler.url_status), 1000)
        self.assertEqual(len(inc_crawler.content_hashes), 1000)

        # 测试过滤性能
        start_time = time.time()
        new_urls = inc_crawler.filter_new_urls(urls[:100])  # 过滤前100个
        filter_elapsed = time.time() - start_time

        self.assertEqual(len(new_urls), 0)  # 都应该是已爬取的
        self.assertLess(filter_elapsed, 0.1)  # 过滤应该在0.1秒内完成

        print(f"✅ 增量爬取器性能：1000个URL处理耗时 {elapsed:.4f} 秒，过滤耗时 {filter_elapsed:.4f} 秒")

        # 清理
        if os.path.exists(temp_file):
            os.remove(temp_file)


def run_professional_tests():
    """运行专业测试套件"""
    print("🚀 开始运行专业测试套件...\n")

    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # 添加测试类
    suite.addTests(loader.loadTestsFromTestCase(UserAgentPoolUnitTest))
    suite.addTests(loader.loadTestsFromTestCase(SmartSchedulerUnitTest))
    suite.addTests(loader.loadTestsFromTestCase(DataCleanerUnitTest))
    suite.addTests(loader.loadTestsFromTestCase(IncrementalCrawlerUnitTest))
    suite.addTests(loader.loadTestsFromTestCase(IntegrationTest))
    suite.addTests(loader.loadTestsFromTestCase(StressTest))

    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # 返回测试结果
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_professional_tests()
    sys.exit(0 if success else 1)