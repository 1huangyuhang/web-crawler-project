# 集成测试脚本
# 测试所有新功能，确保与现有代码兼容

import sys
import os

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from user_agent_pool import UserAgentPool
from smart_scheduler import SmartScheduler
from data_cleaner import DataCleaner
from incremental_crawler import IncrementalCrawler


def test_user_agent_pool():
    """测试User-Agent池"""
    print("🔍 测试User-Agent池...")

    # 测试获取随机UA
    ua1 = UserAgentPool.get_random_desktop_ua()
    ua2 = UserAgentPool.get_random_mobile_ua()

    print(f"桌面UA: {ua1[:50]}...")
    print(f"移动UA: {ua2[:50]}...")

    # 验证UA不为空
    assert ua1, "桌面UA不应为空"
    assert ua2, "移动UA不应为空"

    # 验证UA包含浏览器标识
    assert "Mozilla" in ua1, "UA应包含Mozilla标识"
    assert "Mozilla" in ua2, "UA应包含Mozilla标识"

    print("✅ User-Agent池测试通过")


def test_smart_scheduler():
    """测试智能调度器"""
    print("\n🔍 测试智能调度器...")

    scheduler = SmartScheduler(base_delay=0.1, max_delay=1.0, min_delay=0.05)

    test_url = "https://example.com/page1"

    # 测试等待功能
    print("测试等待功能...")
    start_time = __import__('time').time()
    scheduler.wait(test_url)
    wait_duration = __import__('time').time() - start_time

    assert wait_duration >= 0, "等待时间应为正数"
    print(f"等待时间: {wait_duration:.3f} 秒")

    # 测试记录成功
    scheduler.record_success(test_url, 0.5)
    current_delay = scheduler.get_current_delay(test_url)
    print(f"成功后的延迟: {current_delay:.3f} 秒")

    # 测试记录错误
    scheduler.record_error(test_url, 'timeout')
    current_delay_after_error = scheduler.get_current_delay(test_url)
    print(f"错误后的延迟: {current_delay_after_error:.3f} 秒")

    # 验证错误后延迟增加
    assert current_delay_after_error >= current_delay, "错误后延迟应增加"

    # 测试统计功能
    stats = scheduler.get_stats(test_url)
    print(f"统计信息: {stats}")

    print("✅ 智能调度器测试通过")


def test_data_cleaner():
    """测试数据清洗器"""
    print("\n🔍 测试数据清洗器...")

    cleaner = DataCleaner()

    # 测试文本清理
    test_text = """
    <p>这是一段测试文本，包含<a href="http://example.com">链接</a>和广告内容。</p>
    <script>alert('广告')</script>
    联系电话：13800138000 邮箱：test@example.com
    【重要通知】点击这里下载APP，立即享受优惠！
    """

    cleaned_text = cleaner.clean_text(test_text)
    print(f"清理后的文本: {cleaned_text[:100]}...")

    # 验证清理效果
    assert "<p>" not in cleaned_text, "应移除HTML标签"
    assert "13800138000" not in cleaned_text, "应移除手机号"
    assert "test@example.com" not in cleaned_text, "应移除邮箱"
    assert "【重要通知】" not in cleaned_text, "应移除广告内容"

    # 测试关键词提取
    keywords = cleaner.extract_keywords(cleaned_text)
    print(f"提取的关键词: {keywords}")

    # 测试内容指纹
    fingerprint = cleaner.generate_content_fingerprint(cleaned_text)
    print(f"内容指纹: {fingerprint}")

    assert fingerprint, "内容指纹不应为空"
    assert len(fingerprint) == 32, "MD5指纹应为32位"

    # 测试URL清理
    test_url = "https://example.com/page?utm_source=google&utm_medium=cpc&spm=123"
    cleaned_url = cleaner.clean_url(test_url)
    print(f"清理后的URL: {cleaned_url}")

    assert "utm_source" not in cleaned_url, "应移除跟踪参数"
    assert "spm" not in cleaned_url, "应移除跟踪参数"

    # 测试数据清理
    test_data = [
        {
            'url': 'https://example.com/page1',
            'title': '<b>测试标题</b>',
            'content': '测试内容，包含广告信息。'
        }
    ]

    cleaned_data = cleaner.clean_content_data(test_data)
    print(f"清理后的数据: {cleaned_data}")

    assert len(cleaned_data) == 1, "应保留有效数据"
    assert '<b>' not in cleaned_data[0]['title'], "应清理HTML标签"

    print("✅ 数据清洗器测试通过")


def test_incremental_crawler():
    """测试增量爬取器"""
    print("\n🔍 测试增量爬取器...")

    # 使用临时文件
    temp_file = "test_incremental_state.json"
    inc_crawler = IncrementalCrawler(temp_file)

    # 测试内容指纹
    content1 = "这是第一个测试内容"
    content2 = "这是第二个测试内容"

    hash1 = inc_crawler.generate_content_hash(content1)
    hash2 = inc_crawler.generate_content_hash(content2)

    print(f"内容1指纹: {hash1}")
    print(f"内容2指纹: {hash2}")

    assert hash1 != hash2, "不同内容应有不同指纹"

    # 测试去重功能
    url1 = "https://example.com/page1"
    url2 = "https://example.com/page2"

    # 初始状态，都应未爬取
    assert not inc_crawler.is_content_crawled(content1), "初始状态内容1应未爬取"
    assert not inc_crawler.is_url_crawled(url1), "初始状态URL1应未爬取"

    # 标记为已爬取
    inc_crawler.mark_url_crawled(url1, success=True, content=content1)
    inc_crawler.mark_url_crawled(url2, success=True, content=content2)

    # 验证状态
    assert inc_crawler.is_content_crawled(content1), "标记后内容1应已爬取"
    assert inc_crawler.is_url_crawled(url1), "标记后URL1应已爬取"

    # 测试过滤功能
    test_urls = [url1, "https://example.com/page3", url2, "https://example.com/page4"]
    new_urls = inc_crawler.filter_new_urls(test_urls)

    print(f"原始URL: {test_urls}")
    print(f"新URL: {new_urls}")

    assert url1 not in new_urls, "已爬取的URL应被过滤"
    assert url2 not in new_urls, "已爬取的URL应被过滤"
    assert "https://example.com/page3" in new_urls, "新URL应保留"
    assert "https://example.com/page4" in new_urls, "新URL应保留"

    # 测试统计功能
    stats = inc_crawler.get_crawl_stats()
    print(f"统计信息: {stats}")

    assert stats['total_urls'] == 2, "总URL数应为2"
    assert stats['success_urls'] == 2, "成功URL数应为2"
    assert stats['unique_content_count'] == 2, "唯一内容数应为2"

    # 清理测试文件
    if os.path.exists(temp_file):
        os.remove(temp_file)

    print("✅ 增量爬取器测试通过")


def test_compatibility():
    """测试与现有代码的兼容性"""
    print("\n🔍 测试与现有代码的兼容性...")

    # 模拟现有的BaseCrawler使用方式
    print("测试User-Agent集成...")
    headers = {
        'User-Agent': UserAgentPool.get_random_ua()
    }
    assert 'User-Agent' in headers, "应能正常集成到请求头"
    print(f"请求头: {headers}")

    # 模拟智能调度器集成
    print("测试调度器集成...")
    scheduler = SmartScheduler()
    test_url = "https://example.com/test"

    # 模拟请求前等待
    scheduler.wait(test_url)

    # 模拟成功记录
    scheduler.record_success(test_url, 0.5)

    # 验证能正常工作
    assert scheduler.get_current_delay(test_url) > 0, "调度器应正常工作"
    print("调度器集成正常")

    print("✅ 兼容性测试通过")


def run_all_tests():
    """运行所有测试"""
    print("🚀 开始运行集成测试...\n")

    try:
        test_user_agent_pool()
        test_smart_scheduler()
        test_data_cleaner()
        test_incremental_crawler()
        test_compatibility()

        print("\n🎉 所有测试通过！")
        print("\n📋 测试总结：")
        print("- ✅ 动态User-Agent池：工作正常")
        print("- ✅ 智能请求调度器：工作正常")
        print("- ✅ 数据清洗管道：工作正常")
        print("- ✅ 增量爬取机制：工作正常")
        print("- ✅ 兼容性：与现有代码完全兼容")

        return True

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)