# 图片爬虫实现

from base_crawler import BaseCrawler
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import Dict, Any, List


class ImageCrawler(BaseCrawler):
    """
    图片爬虫类，用于爬取页面中的图片
    """
    
    def __init__(self, url: str, depth: int = 2):
        """
        初始化图片爬虫
        
        Args:
            url: 目标URL
            depth: 爬取深度
        """
        super().__init__(url, depth)
        self.images: List[Dict[str, Any]] = []
    
    def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取
        
        Returns:
            爬取结果
        """
        self.images.clear()
        results = super().start_crawling()
        results['data'] = self.images
        results['type'] = 'image'
        return results
    
    def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容，提取图片
        
        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 提取页面标题
        title = soup.title.string if soup.title else '无标题'
        
        # 提取图片
        page_images = self._extract_images(url, soup)
        
        # 保存图片信息
        for img_info in page_images:
            self.images.append({
                'url': url,
                'title': title,
                'depth': current_depth,
                'image_url': img_info['url'],
                'alt': img_info['alt'],
                'width': img_info['width'],
                'height': img_info['height']
            })
        
        # 更新爬取数量
        self.items_count += len(page_images)
        
        # 递归爬取链接
        links = self._extract_links(url, soup)
        for link in links:
            self._crawl(link, current_depth + 1)
    
    def _extract_images(self, url: str, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        提取页面中的图片
        
        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            
        Returns:
            图片信息列表
        """
        images = []
        
        for img_tag in soup.find_all('img'):
            # 提取图片URL
            img_src = img_tag.get('src')
            if not img_src:
                continue
            
            # 转换为绝对URL
            absolute_url = urljoin(url, img_src)
            
            # 提取图片信息
            alt = img_tag.get('alt', '')
            width = img_tag.get('width', '')
            height = img_tag.get('height', '')
            
            # 只保存有效的图片URL
            if absolute_url.startswith(('http://', 'https://')):
                images.append({
                    'url': absolute_url,
                    'alt': alt,
                    'width': width,
                    'height': height
                })
        
        # 只返回前20张图片，避免结果过大
        return images[:20]
