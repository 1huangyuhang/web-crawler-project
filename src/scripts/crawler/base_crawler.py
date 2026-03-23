# 基础爬虫类

import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Set, Dict, Any, Optional


class BaseCrawler:
    """
    基础爬虫类，提供通用的爬虫功能
    """
    
    def __init__(self, url: str, depth: int = 2):
        """
        初始化爬虫
        
        Args:
            url: 目标URL
            depth: 爬取深度
        """
        self.url = url
        self.depth = depth
        self.visited_urls: Set[str] = set()
        self.start_time = 0
        self.end_time = 0
        self.items_count = 0
        self.results: Dict[str, Any] = {}
        
    def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取
        
        Returns:
            爬取结果
        """
        self.start_time = time.time()
        self.visited_urls.clear()
        self.items_count = 0
        self.results = {
            'url': self.url,
            'depth': self.depth,
            'items': 0,
            'time': 0,
            'data': []
        }
        
        try:
            self._crawl(self.url, 0)
        except Exception as e:
            # 移除 print 语句，避免污染 JSON 输出
            pass
        
        self.end_time = time.time()
        self.results['items'] = self.items_count
        self.results['time'] = round(self.end_time - self.start_time, 2)
        
        return self.results
    
    def _crawl(self, url: str, current_depth: int):
        """
        递归爬取方法
        
        Args:
            url: 当前URL
            current_depth: 当前深度
        """
        if current_depth >= self.depth or url in self.visited_urls:
            return
        
        self.visited_urls.add(url)
        
        try:
            response = self._fetch_url(url)
            if response:
                self._process_page(url, response, current_depth)
        except Exception as e:
            # 移除 print 语句，避免污染 JSON 输出
            pass
    
    def _fetch_url(self, url: str) -> Optional[BeautifulSoup]:
        """
        获取URL内容
        
        Args:
            url: 要获取的URL
            
        Returns:
            BeautifulSoup对象或None
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            # 移除 print 语句，避免污染 JSON 输出
            return None
    
    def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容
        
        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 子类实现
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
