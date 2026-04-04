# 智能请求调度器
# 自适应调整请求间隔，防止被封禁

import time
import random
from typing import Optional, Dict, Any
from urllib.parse import urlparse


class SmartScheduler:
    """
    智能请求调度器，根据响应状态自适应调整请求频率
    """

    def __init__(self, base_delay: float = 1.0, max_delay: float = 10.0, min_delay: float = 0.5):
        """
        初始化调度器

        Args:
            base_delay: 基础延迟时间（秒）
            max_delay: 最大延迟时间（秒）
            min_delay: 最小延迟时间（秒）
        """
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.min_delay = min_delay

        # 域名请求历史记录
        self.domain_history: Dict[str, Dict[str, Any]] = {}

        # 响应时间统计
        self.response_stats: Dict[str, list] = {}

    def _get_domain(self, url: str) -> str:
        """从URL中提取域名"""
        return urlparse(url).netloc

    def _ensure_domain_record(self, domain: str):
        """确保域名记录存在"""
        if domain not in self.domain_history:
            self.domain_history[domain] = {
                'last_request_time': 0,
                'current_delay': self.base_delay,
                'success_count': 0,
                'error_count': 0,
                'consecutive_errors': 0
            }

    def wait(self, url: str):
        """
        等待适当的时间再发送请求

        Args:
            url: 目标URL
        """
        domain = self._get_domain(url)
        self._ensure_domain_record(domain)

        domain_data = self.domain_history[domain]

        # 计算需要等待的时间
        current_time = time.time()
        last_request = domain_data['last_request_time']
        current_delay = domain_data['current_delay']

        # 如果距离上次请求时间小于当前延迟，则等待
        if current_time - last_request < current_delay:
            wait_time = current_delay - (current_time - last_request)
            # 添加随机扰动，避免被识别为机器人
            wait_time += random.uniform(0.1, 0.5)
            time.sleep(wait_time)

        # 更新最后请求时间
        self.domain_history[domain]['last_request_time'] = time.time()

    def record_success(self, url: str, response_time: float):
        """
        记录成功的请求

        Args:
            url: 请求URL
            response_time: 响应时间（秒）
        """
        domain = self._get_domain(url)
        self._ensure_domain_record(domain)

        domain_data = self.domain_history[domain]
        domain_data['success_count'] += 1
        domain_data['consecutive_errors'] = 0

        # 记录响应时间
        if domain not in self.response_stats:
            self.response_stats[domain] = []
        self.response_stats[domain].append(response_time)

        # 只保留最近的100个响应时间
        if len(self.response_stats[domain]) > 100:
            self.response_stats[domain] = self.response_stats[domain][-100:]

        # 根据响应时间调整延迟
        self._adjust_delay_based_on_performance(domain)

    def record_error(self, url: str, error_type: str = 'general'):
        """
        记录失败的请求

        Args:
            url: 请求URL
            error_type: 错误类型
        """
        domain = self._get_domain(url)
        self._ensure_domain_record(domain)

        domain_data = self.domain_history[domain]
        domain_data['error_count'] += 1
        domain_data['consecutive_errors'] += 1

        # 根据错误类型和连续错误次数增加延迟
        if domain_data['consecutive_errors'] >= 3:
            # 连续3次错误，显著增加延迟
            domain_data['current_delay'] = min(domain_data['current_delay'] * 2, self.max_delay)
        elif domain_data['consecutive_errors'] >= 2:
            # 连续2次错误，适度增加延迟
            domain_data['current_delay'] = min(domain_data['current_delay'] * 1.5, self.max_delay)
        else:
            # 单次错误，轻微增加延迟
            domain_data['current_delay'] = min(domain_data['current_delay'] * 1.2, self.max_delay)

    def _adjust_delay_based_on_performance(self, domain: str):
        """根据性能调整延迟"""
        if domain not in self.response_stats or len(self.response_stats[domain]) < 5:
            return

        domain_data = self.domain_history[domain]
        recent_times = self.response_stats[domain][-5:]  # 最近5次响应时间
        avg_response_time = sum(recent_times) / len(recent_times)

        # 如果响应时间过长，适当增加延迟
        if avg_response_time > 5.0:  # 平均响应时间超过5秒
            domain_data['current_delay'] = min(domain_data['current_delay'] * 1.3, self.max_delay)
        elif avg_response_time < 1.0:  # 响应时间很短，可以适当减少延迟
            domain_data['current_delay'] = max(domain_data['current_delay'] * 0.9, self.min_delay)

        # 根据成功率调整延迟
        total_requests = domain_data['success_count'] + domain_data['error_count']
        if total_requests > 10:  # 有足够的数据
            success_rate = domain_data['success_count'] / total_requests
            if success_rate < 0.7:  # 成功率低于70%，增加延迟
                domain_data['current_delay'] = min(domain_data['current_delay'] * 1.2, self.max_delay)
            elif success_rate > 0.95 and domain_data['current_delay'] > self.base_delay:  # 成功率很高，尝试减少延迟
                domain_data['current_delay'] = max(domain_data['current_delay'] * 0.95, self.base_delay)

    def get_current_delay(self, url: str) -> float:
        """
        获取当前域名的延迟时间

        Args:
            url: 目标URL

        Returns:
            当前延迟时间（秒）
        """
        domain = self._get_domain(url)
        self._ensure_domain_record(domain)
        return self.domain_history[domain]['current_delay']

    def reset_domain(self, url: str):
        """
        重置域名的统计数据

        Args:
            url: 目标URL
        """
        domain = self._get_domain(url)
        if domain in self.domain_history:
            del self.domain_history[domain]
        if domain in self.response_stats:
            del self.response_stats[domain]

    def get_stats(self, url: Optional[str] = None) -> Dict[str, Any]:
        """
        获取统计数据

        Args:
            url: 如果提供，则返回特定域名的统计；否则返回所有域名统计

        Returns:
            统计数据
        """
        if url:
            domain = self._get_domain(url)
            if domain in self.domain_history:
                return {
                    'domain': domain,
                    'current_delay': self.domain_history[domain]['current_delay'],
                    'success_count': self.domain_history[domain]['success_count'],
                    'error_count': self.domain_history[domain]['error_count'],
                    'consecutive_errors': self.domain_history[domain]['consecutive_errors']
                }
            return {}
        else:
            return {
                domain: {
                    'current_delay': data['current_delay'],
                    'success_count': data['success_count'],
                    'error_count': data['error_count'],
                    'consecutive_errors': data['consecutive_errors']
                }
                for domain, data in self.domain_history.items()
            }


# 使用示例
if __name__ == '__main__':
    scheduler = SmartScheduler()

    # 模拟请求
    test_url = "https://example.com/page1"

    print("等待后发送请求...")
    scheduler.wait(test_url)

    # 模拟成功响应
    scheduler.record_success(test_url, 0.5)
    print(f"当前延迟: {scheduler.get_current_delay(test_url)} 秒")

    # 再次等待
    scheduler.wait(test_url)

    # 模拟错误
    scheduler.record_error(test_url, 'timeout')
    print(f"错误后延迟: {scheduler.get_current_delay(test_url)} 秒")

    # 查看统计
    print("统计信息:", scheduler.get_stats(test_url))