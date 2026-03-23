# 内容爬虫实现

from base_crawler import BaseCrawler
from bs4 import BeautifulSoup
from typing import Dict, Any, List


class ContentCrawler(BaseCrawler):
    """
    内容爬虫类，用于爬取页面中的文本内容
    """
    
    def __init__(self, url: str, depth: int = 2):
        """
        初始化内容爬虫
        
        Args:
            url: 目标URL
            depth: 爬取深度
        """
        super().__init__(url, depth)
        self.contents: List[Dict[str, Any]] = []
    
    def start_crawling(self) -> Dict[str, Any]:
        """
        开始爬取
        
        Returns:
            爬取结果
        """
        self.contents.clear()
        results = super().start_crawling()
        results['data'] = self.contents
        results['type'] = 'content'
        return results
    
    def _process_page(self, url: str, soup: BeautifulSoup, current_depth: int):
        """
        处理页面内容，提取文本内容
        
        Args:
            url: 当前URL
            soup: BeautifulSoup对象
            current_depth: 当前深度
        """
        # 提取页面标题
        title = soup.title.string if soup.title else '无标题'
        
        # 提取正文内容
        content = self._extract_content(soup)
        
        # 提取关键词
        keywords = self._extract_keywords(soup)
        
        # 保存内容信息
        self.contents.append({
            'url': url,
            'title': title,
            'depth': current_depth,
            'content': content[:500],  # 只保存前500个字符，避免结果过大
            'keywords': keywords[:10]  # 只保存前10个关键词
        })
        
        # 更新爬取数量
        self.items_count += 1
        
        # 递归爬取链接
        links = self._extract_links(url, soup)
        for link in links:
            self._crawl(link, current_depth + 1)
    
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """
        提取页面正文内容
        
        Args:
            soup: BeautifulSoup对象
            
        Returns:
            提取的文本内容
        """
        # 移除脚本和样式
        for script in soup(['script', 'style']):
            script.decompose()
        
        # 提取文本
        text = soup.get_text(separator='\n', strip=True)
        
        # 清理文本
        lines = (line.strip() for line in text.split('\n'))
        cleaned_text = '\n'.join(line for line in lines if line)
        
        return cleaned_text
    
    def _extract_keywords(self, soup: BeautifulSoup) -> List[str]:
        """
        提取页面关键词
        
        Args:
            soup: BeautifulSoup对象
            
        Returns:
            关键词列表
        """
        keywords = []
        
        # 尝试从meta标签提取关键词
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        if meta_keywords and meta_keywords.get('content'):
            keywords.extend([kw.strip() for kw in meta_keywords['content'].split(',')])
        
        # 从标题和正文中提取关键词（简单实现）
        title = soup.title.string if soup.title else ''
        content = self._extract_content(soup)
        
        # 简单的关键词提取（实际项目中可以使用更复杂的算法）
        words = title.split() + content[:200].split()
        word_freq = {}
        for word in words:
            if len(word) > 2:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # 排序并获取高频词
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        top_words = [word for word, _ in sorted_words[:10]]
        keywords.extend(top_words)
        
        # 去重
        return list(set(keywords))[:10]
