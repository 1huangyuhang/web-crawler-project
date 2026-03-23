# 链接爬虫实现

from base_crawler import BaseCrawler
from bs4 import BeautifulSoup
from typing import Dict, Any


class LinkCrawler(BaseCrawler):
    """
    链接爬虫类，用于爬取页面中的链接
    """
    
    def __init__(self, url: str, depth: int = 2):
        """
        初始化链接爬虫
        
        Args:
            url: 目标URL
            depth: 爬取深度
        """
        super().__init__(url, depth)
        self.links: Dict[str, Dict[str, Any]] = {}
    
    def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取
        
        Returns:
            爬取结果
        """
        self.links.clear()
        results = super().start_crawling()
        results['data'] = list(self.links.values())
        results['type'] = 'link'
        return results
    
    def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容，提取链接
        
        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 提取页面标题
        title = soup.title.string if soup.title else '无标题'
        
        # 提取链接
        links = self._extract_links(url, soup)
        
        # 保存链接信息
        self.links[url] = {
            'url': url,
            'title': title,
            'depth': current_depth,
            'links': list(links)[:10]  # 只保存前10个链接，避免结果过大
        }
        
        # 更新爬取数量
        self.items_count += 1
        
        # 递归爬取链接
        for link in links:
            self._crawl(link, current_depth + 1)
