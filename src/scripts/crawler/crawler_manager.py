# 爬虫管理器

from link_crawler import LinkCrawler
from content_crawler import ContentCrawler
from image_crawler import ImageCrawler
from typing import Dict, Any, Optional


class CrawlerManager:
    """
    爬虫管理器，负责根据爬虫类型创建相应的爬虫实例并执行爬取操作
    """
    
    @staticmethod
    def create_crawler(crawler_type: str, url: str, depth: int = 2):
        """
        根据爬虫类型创建爬虫实例
        
        Args:
            crawler_type: 爬虫类型 (link, content, image)
            url: 目标URL
            depth: 爬取深度
            
        Returns:
            爬虫实例
        """
        if crawler_type == 'link':
            return LinkCrawler(url, depth)
        elif crawler_type == 'content':
            return ContentCrawler(url, depth)
        elif crawler_type == 'image':
            return ImageCrawler(url, depth)
        else:
            raise ValueError(f"不支持的爬虫类型: {crawler_type}")
    
    @staticmethod
    def start_crawling(crawler_type: str, url: str, depth: int = 2) -> Dict[str, Any]:
        """
        开始爬取
        
        Args:
            crawler_type: 爬虫类型 (link, content, image)
            url: 目标URL
            depth: 爬取深度
            
        Returns:
            爬取结果
        """
        try:
            # 创建爬虫实例
            crawler = CrawlerManager.create_crawler(crawler_type, url, depth)
            
            # 开始爬取
            results = crawler.start_crawling()
            
            # 添加爬虫类型信息
            results['type'] = crawler_type
            
            return results
        except Exception as e:
            return {
                'url': url,
                'depth': depth,
                'items': 0,
                'time': 0,
                'type': crawler_type,
                'data': [],
                'error': str(e)
            }
    
    @staticmethod
    def get_supported_types() -> list:
        """
        获取支持的爬虫类型
        
        Returns:
            支持的爬虫类型列表
        """
        return ['link', 'content', 'image']
    
    @staticmethod
    def validate_crawler_type(crawler_type: str) -> bool:
        """
        验证爬虫类型是否支持
        
        Args:
            crawler_type: 爬虫类型
            
        Returns:
            是否支持
        """
        return crawler_type in CrawlerManager.get_supported_types()
