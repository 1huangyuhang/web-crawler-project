# 动态User-Agent池
# 独立模块，不依赖任何现有代码

import random
from typing import List


class UserAgentPool:
    """
    动态User-Agent池，提供随机浏览器标识
    """

    # 预定义的User-Agent列表
    USER_AGENTS = [
        # Chrome
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',

        # Firefox
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0',

        # Safari
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',

        # Edge
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    ]

    # 移动端User-Agent
    MOBILE_USER_AGENTS = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0',
        'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    ]

    @classmethod
    def get_random_ua(cls, mobile: bool = False) -> str:
        """
        获取随机User-Agent

        Args:
            mobile: 是否返回移动端User-Agent

        Returns:
            随机User-Agent字符串
        """
        if mobile:
            return random.choice(cls.MOBILE_USER_AGENTS)
        else:
            return random.choice(cls.USER_AGENTS)

    @classmethod
    def get_random_desktop_ua(cls) -> str:
        """获取随机桌面端User-Agent"""
        return cls.get_random_ua(mobile=False)

    @classmethod
    def get_random_mobile_ua(cls) -> str:
        """获取随机移动端User-Agent"""
        return cls.get_random_ua(mobile=True)

    @classmethod
    def add_custom_ua(cls, ua: str):
        """
        添加自定义User-Agent

        Args:
            ua: User-Agent字符串
        """
        if ua not in cls.USER_AGENTS:
            cls.USER_AGENTS.append(ua)

    @classmethod
    def get_all_ua(cls) -> List[str]:
        """获取所有User-Agent"""
        return cls.USER_AGENTS.copy()


# 使用示例
if __name__ == '__main__':
    # 获取随机User-Agent
    print("随机桌面UA:", UserAgentPool.get_random_desktop_ua())
    print("随机移动UA:", UserAgentPool.get_random_mobile_ua())