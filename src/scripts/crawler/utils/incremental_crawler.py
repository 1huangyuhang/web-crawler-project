# 增量爬取机制
# 轻量级指纹去重，支持断点续爬

import json
import os
import hashlib
from typing import Set, Dict, Any, List, Optional
from datetime import datetime


class IncrementalCrawler:
    """
    增量爬取管理器，基于内容指纹的去重和断点续爬
    """

    def __init__(self, storage_file: str = "crawler_state.json"):
        """
        初始化增量爬取管理器

        Args:
            storage_file: 状态存储文件路径
        """
        self.storage_file = storage_file
        self.content_hashes: Set[str] = set()
        self.url_status: Dict[str, Dict[str, Any]] = {}
        self.crawl_history: List[Dict[str, Any]] = []

        # 加载现有状态
        self.load_state()

    def load_state(self):
        """从文件加载状态"""
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r', encoding='utf-8') as f:
                    state_data = json.load(f)

                # 加载内容指纹
                if 'content_hashes' in state_data:
                    self.content_hashes = set(state_data['content_hashes'])

                # 加载URL状态
                if 'url_status' in state_data:
                    self.url_status = state_data['url_status']

                # 加载爬取历史
                if 'crawl_history' in state_data:
                    self.crawl_history = state_data['crawl_history']

            except Exception as e:
                print(f"加载状态文件失败: {e}")
                # 初始化空状态
                self.content_hashes = set()
                self.url_status = {}
                self.crawl_history = []

    def save_state(self):
        """保存状态到文件"""
        try:
            state_data = {
                'content_hashes': list(self.content_hashes),
                'url_status': self.url_status,
                'crawl_history': self.crawl_history[-100:],  # 只保留最近的100条历史
                'last_updated': datetime.now().isoformat()
            }

            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump(state_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            print(f"保存状态文件失败: {e}")

    def generate_content_hash(self, content: str) -> str:
        """
        生成内容指纹

        Args:
            content: 内容文本

        Returns:
            内容指纹（MD5哈希）
        """
        if not content:
            return ""

        # 规范化内容
        normalized_content = content.strip().lower()

        # 生成MD5哈希
        return hashlib.md5(normalized_content.encode('utf-8')).hexdigest()

    def is_content_crawled(self, content: str, url: Optional[str] = None) -> bool:
        """
        检查内容是否已经爬取过

        Args:
            content: 内容文本
            url: 可选，URL地址

        Returns:
            是否已经爬取
        """
        content_hash = self.generate_content_hash(content)
        return content_hash in self.content_hashes

    def is_url_crawled(self, url: str) -> bool:
        """
        检查URL是否已经爬取过

        Args:
            url: URL地址

        Returns:
            是否已经爬取
        """
        if url not in self.url_status:
            return False

        # 检查状态
        status = self.url_status[url].get('status', '')
        return status in ['completed', 'success', 'processed']

    def should_skip_url(self, url: str, content: Optional[str] = None) -> tuple[bool, str]:
        """
        判断是否应该跳过URL

        Args:
            url: URL地址
            content: 可选，内容文本

        Returns:
            (是否跳过, 原因)
        """
        # 检查URL是否已爬取
        if self.is_url_crawled(url):
            return True, f"URL已爬取: {url}"

        # 如果有内容，检查内容是否已爬取
        if content and self.is_content_crawled(content, url):
            return True, f"内容已爬取: {url[:50]}..."

        return False, ""

    def mark_url_crawled(self, url: str, success: bool = True, content: Optional[str] = None,
                         error_message: Optional[str] = None):
        """
        标记URL为已爬取

        Args:
            url: URL地址
            success: 是否成功
            content: 可选，内容文本
            error_message: 可选，错误信息
        """
        status = 'success' if success else 'failed'

        # 更新URL状态
        self.url_status[url] = {
            'status': status,
            'crawl_time': datetime.now().isoformat(),
            'error_message': error_message
        }

        # 如果有内容，记录内容指纹
        if content and success:
            content_hash = self.generate_content_hash(content)
            self.content_hashes.add(content_hash)

        # 添加到历史记录
        self.crawl_history.append({
            'url': url,
            'status': status,
            'timestamp': datetime.now().isoformat(),
            'error_message': error_message
        })

        # 定期保存状态
        if len(self.crawl_history) % 10 == 0:
            self.save_state()

    def get_crawl_stats(self) -> Dict[str, Any]:
        """
        获取爬取统计信息

        Returns:
            统计信息
        """
        total_urls = len(self.url_status)
        success_urls = sum(1 for status in self.url_status.values() if status.get('status') == 'success')
        failed_urls = total_urls - success_urls

        return {
            'total_urls': total_urls,
            'success_urls': success_urls,
            'failed_urls': failed_urls,
            'unique_content_count': len(self.content_hashes),
            'crawl_history_count': len(self.crawl_history),
            'success_rate': success_urls / total_urls if total_urls > 0 else 0.0
        }

    def filter_new_urls(self, urls: List[str]) -> List[str]:
        """
        过滤掉已爬取的URL

        Args:
            urls: URL列表

        Returns:
            新的URL列表
        """
        new_urls = []
        for url in urls:
            if not self.is_url_crawled(url):
                new_urls.append(url)

        return new_urls

    def filter_new_content(self, content_list: List[Dict[str, Any]],
                           content_key: str = 'content') -> List[Dict[str, Any]]:
        """
        过滤掉已爬取的内容

        Args:
            content_list: 内容列表
            content_key: 内容字段名

        Returns:
            新的内容列表
        """
        new_content = []
        for item in content_list:
            content = item.get(content_key, '')
            url = item.get('url', '')

            if not self.is_content_crawled(content, url):
                new_content.append(item)

        return new_content

    def reset_domain_state(self, domain: str):
        """
        重置指定域名的状态

        Args:
            domain: 域名
        """
        # 过滤掉指定域名的URL状态
        urls_to_remove = [url for url in self.url_status.keys() if domain in url]
        for url in urls_to_remove:
            del self.url_status[url]

        # 保存更改
        self.save_state()

    def clear_all_state(self):
        """清除所有状态"""
        self.content_hashes.clear()
        self.url_status.clear()
        self.crawl_history.clear()
        self.save_state()

    def get_last_crawl_time(self, url: str) -> Optional[str]:
        """
        获取URL的最后爬取时间

        Args:
            url: URL地址

        Returns:
            最后爬取时间，如果未爬取则返回None
        """
        if url in self.url_status:
            return self.url_status[url].get('crawl_time')
        return None

    def export_state(self, output_file: str):
        """
        导出状态到文件

        Args:
            output_file: 输出文件路径
        """
        try:
            state_data = {
                'content_hashes': list(self.content_hashes),
                'url_status': self.url_status,
                'crawl_history': self.crawl_history,
                'export_time': datetime.now().isoformat()
            }

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(state_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            print(f"导出状态失败: {e}")

    def import_state(self, input_file: str):
        """
        从文件导入状态

        Args:
            input_file: 输入文件路径
        """
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                state_data = json.load(f)

            # 导入内容指纹
            if 'content_hashes' in state_data:
                self.content_hashes.update(state_data['content_hashes'])

            # 导入URL状态
            if 'url_status' in state_data:
                self.url_status.update(state_data['url_status'])

            # 导入爬取历史
            if 'crawl_history' in state_data:
                self.crawl_history.extend(state_data['crawl_history'])

            # 保存合并后的状态
            self.save_state()

        except Exception as e:
            print(f"导入状态失败: {e}")


# 使用示例
if __name__ == '__main__':
    # 创建增量爬取管理器
    inc_crawler = IncrementalCrawler("test_state.json")

    # 测试内容
    test_content_1 = "这是第一个测试内容"
    test_content_2 = "这是第二个测试内容"
    test_url_1 = "https://example.com/page1"
    test_url_2 = "https://example.com/page2"

    # 检查内容是否已爬取
    print(f"内容1是否已爬取: {inc_crawler.is_content_crawled(test_content_1)}")
    print(f"URL1是否已爬取: {inc_crawler.is_url_crawled(test_url_1)}")

    # 标记为已爬取
    inc_crawler.mark_url_crawled(test_url_1, success=True, content=test_content_1)
    inc_crawler.mark_url_crawled(test_url_2, success=True, content=test_content_2)

    # 再次检查
    print(f"内容1是否已爬取: {inc_crawler.is_content_crawled(test_content_1)}")
    print(f"URL1是否已爬取: {inc_crawler.is_url_crawled(test_url_1)}")

    # 获取统计信息
    stats = inc_crawler.get_crawl_stats()
    print("统计信息:", stats)

    # 测试过滤新内容
    new_urls = [test_url_1, "https://example.com/page3", test_url_2, "https://example.com/page4"]
    filtered_urls = inc_crawler.filter_new_urls(new_urls)
    print(f"原始URL列表: {new_urls}")
    print(f"新URL列表: {filtered_urls}")

    # 清理状态文件
    if os.path.exists("test_state.json"):
        os.remove("test_state.json")