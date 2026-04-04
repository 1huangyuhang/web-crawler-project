# 数据清洗管道
# 轻量级数据清洗，不依赖现有代码结构

import re
import hashlib
from typing import List, Dict, Any, Optional, Union


class DataCleaner:
    """
    数据清洗管道，提供文本清理、去重、格式化等功能
    """

    def __init__(self):
        # 常见广告关键词
        self.ad_keywords = [
            '广告', '推广', '赞助商', '赞助', 'advertisement', 'sponsor',
            '点击', '下载', '注册', '免费', '优惠', '促销', '购买',
            '立即', '马上', '现在', '快来', '抢购', '秒杀'
        ]

        # 垃圾字符模式
        self.spam_patterns = [
            r'【.*?】',  # 方括号内容
            r'《.*?》',  # 书名号内容
            r'（.*?）',  # 中文括号
            r'\(.*?\)',  # 英文括号
            r'\[.*?\]',  # 英文方括号
            r'www\.\S+',  # 网址
            r'\S+@\S+',  # 邮箱
            r'\d{11}',  # 手机号
            r'\d{6}',  # 邮编
        ]

        # HTML标签模式
        self.html_tag_pattern = r'<[^>]+>'

    def clean_text(self, text: str, remove_ads: bool = True, remove_html: bool = True) -> str:
        """
        清理文本内容

        Args:
            text: 原始文本
            remove_ads: 是否移除广告内容
            remove_html: 是否移除HTML标签

        Returns:
            清理后的文本
        """
        if not text:
            return ""

        # 移除HTML标签
        if remove_html:
            text = re.sub(self.html_tag_pattern, '', text)

        # 移除垃圾字符
        for pattern in self.spam_patterns:
            text = re.sub(pattern, '', text)

        # 移除广告关键词
        if remove_ads:
            for keyword in self.ad_keywords:
                text = text.replace(keyword, '')

        # 清理空白字符
        text = re.sub(r'\s+', ' ', text)  # 多个空格转为单个空格
        text = text.strip()  # 移除首尾空格

        return text

    def extract_paragraphs(self, text: str, min_length: int = 50) -> List[str]:
        """
        提取有效段落

        Args:
            text: 文本内容
            min_length: 最小段落长度

        Returns:
            有效段落列表
        """
        if not text:
            return []

        # 按换行符分割
        paragraphs = text.split('\n')

        # 过滤短段落
        valid_paragraphs = []
        for para in paragraphs:
            cleaned_para = self.clean_text(para).strip()
            if len(cleaned_para) >= min_length:
                valid_paragraphs.append(cleaned_para)

        return valid_paragraphs

    def clean_url(self, url: str) -> str:
        """
        清理URL，移除跟踪参数

        Args:
            url: 原始URL

        Returns:
            清理后的URL
        """
        if not url:
            return ""

        # 移除常见跟踪参数
        tracking_params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                           'spm', 'from', 'share', 'timestamp', 'ref']

        for param in tracking_params:
            # 移除参数
            url = re.sub(rf'[?&]{param}=[^&]*', '', url)

        # 清理URL末尾的?或&
        url = re.sub(r'[?&]$', '', url)

        return url

    def extract_keywords(self, text: str, top_n: int = 10) -> List[str]:
        """
        提取关键词（简单实现）

        Args:
            text: 文本内容
            top_n: 返回的关键词数量

        Returns:
            关键词列表
        """
        if not text:
            return []

        # 清理文本
        cleaned_text = self.clean_text(text, remove_ads=True, remove_html=True)

        # 分词（简单按空格分割）
        words = cleaned_text.split()

        # 过滤短词和常见词
        stop_words = {'的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '个', '中', '到', '就', '要', '会', '可以', '能', '而', '且', '或者', '但是', '如果', '因为', '所以', '为了', '关于', '对于', '由于', '而且', '然后', '还有', '已经', '现在', '之前', '之后', '以后', '之前', '之后', '以后', '之前', '之后', '以后', '和', '与', '跟', '同', '以及', '及', '并', '并且', '或者', '还是', '要么', '与其', '不如', '何况', '况且', '以至', '至于', '从而', '因此', '所以', '于是', '然后', '接着', '随后', '最后', '终于', '本来', '原来', '向来', '一直', '一向', '其实', '实际上', '事实上', '确实', '实在', '的确', '毕竟', '究竟', '到底', '毕竟', '究竟', '到底', '为什么', '怎么', '如何', '哪里', '哪个', '哪些', '什么', '什么时候', '多少', '几', '谁', '哪里', '哪个', '哪些', '什么', '什么时候', '多少', '几', '谁'}

        word_freq = {}
        for word in words:
            if len(word) > 2 and word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1

        # 按频率排序
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)

        return [word for word, _ in sorted_words[:top_n]]

    def remove_duplicates_by_similarity(self, texts: List[str], similarity_threshold: float = 0.8) -> List[str]:
        """
        基于相似度去重

        Args:
            texts: 文本列表
            similarity_threshold: 相似度阈值

        Returns:
            去重后的文本列表
        """
        if not texts:
            return []

        # 使用简单的n-gram相似度
        def get_ngrams(text: str, n: int = 3) -> set:
            """获取文本的n-gram集合"""
            text = text.strip().lower()
            ngrams = set()
            for i in range(len(text) - n + 1):
                ngrams.add(text[i:i + n])
            return ngrams

        def similarity(text1: str, text2: str) -> float:
            """计算两个文本的相似度"""
            ngrams1 = get_ngrams(text1)
            ngrams2 = get_ngrams(text2)

            if not ngrams1 or not ngrams2:
                return 0.0

            intersection = ngrams1.intersection(ngrams2)
            union = ngrams1.union(ngrams2)

            return len(intersection) / len(union) if union else 0.0

        # 去重
        unique_texts = []
        for text in texts:
            is_duplicate = False
            for unique_text in unique_texts:
                if similarity(text, unique_text) >= similarity_threshold:
                    is_duplicate = True
                    break

            if not is_duplicate:
                unique_texts.append(text)

        return unique_texts

    def generate_content_fingerprint(self, content: str) -> str:
        """
        生成内容指纹（用于增量爬取）

        Args:
            content: 内容文本

        Returns:
            内容指纹（MD5哈希）
        """
        if not content:
            return ""

        # 清理内容
        cleaned_content = self.clean_text(content, remove_ads=True, remove_html=True)

        # 生成MD5哈希
        return hashlib.md5(cleaned_content.encode('utf-8')).hexdigest()

    def clean_content_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        清理内容爬虫的数据

        Args:
            data: 原始数据列表

        Returns:
            清理后的数据列表
        """
        cleaned_data = []

        for item in data:
            cleaned_item = item.copy()

            # 清理标题
            if 'title' in cleaned_item:
                cleaned_item['title'] = self.clean_text(cleaned_item['title'])

            # 清理内容
            if 'content' in cleaned_item:
                cleaned_item['content'] = self.clean_text(cleaned_item['content'])

            # 提取有效段落
            if 'content' in cleaned_item:
                paragraphs = self.extract_paragraphs(cleaned_item['content'])
                cleaned_item['paragraphs'] = paragraphs
                cleaned_item['paragraph_count'] = len(paragraphs)

            # 提取关键词
            if 'content' in cleaned_item:
                keywords = self.extract_keywords(cleaned_item['content'])
                cleaned_item['auto_keywords'] = keywords

            # 清理URL
            if 'url' in cleaned_item:
                cleaned_item['clean_url'] = self.clean_url(cleaned_item['url'])

            # 生成内容指纹
            if 'content' in cleaned_item:
                cleaned_item['content_hash'] = self.generate_content_fingerprint(cleaned_item['content'])

            cleaned_data.append(cleaned_item)

        # 基于内容指纹去重
        unique_data = []
        seen_hashes = set()

        for item in cleaned_data:
            if 'content_hash' in item and item['content_hash']:
                if item['content_hash'] not in seen_hashes:
                    seen_hashes.add(item['content_hash'])
                    unique_data.append(item)
            else:
                unique_data.append(item)

        return unique_data

    def clean_link_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        清理链接爬虫的数据

        Args:
            data: 原始数据列表

        Returns:
            清理后的数据列表
        """
        cleaned_data = []

        for item in data:
            cleaned_item = item.copy()

            # 清理标题
            if 'title' in cleaned_item:
                cleaned_item['title'] = self.clean_text(cleaned_item['title'])

            # 清理URL
            if 'url' in cleaned_item:
                cleaned_item['clean_url'] = self.clean_url(cleaned_item['url'])

            # 清理链接列表
            if 'links' in cleaned_item and isinstance(cleaned_item['links'], list):
                cleaned_links = []
                for link in cleaned_item['links']:
                    if isinstance(link, str):
                        cleaned_link = self.clean_url(link)
                        if cleaned_link:  # 只保留有效URL
                            cleaned_links.append(cleaned_link)
                cleaned_item['links'] = cleaned_links

            cleaned_data.append(cleaned_item)

        return cleaned_data

    def clean_image_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        清理图片爬虫的数据

        Args:
            data: 原始数据列表

        Returns:
            清理后的数据列表
        """
        cleaned_data = []

        for item in data:
            cleaned_item = item.copy()

            # 清理标题
            if 'title' in cleaned_item:
                cleaned_item['title'] = self.clean_text(cleaned_item['title'])

            # 清理alt文本
            if 'alt' in cleaned_item:
                cleaned_item['alt'] = self.clean_text(cleaned_item['alt'])

            # 清理图片URL
            if 'image_url' in cleaned_item:
                cleaned_item['clean_image_url'] = self.clean_url(cleaned_item['image_url'])

            # 清理页面URL
            if 'url' in cleaned_item:
                cleaned_item['clean_url'] = self.clean_url(cleaned_item['url'])

            cleaned_data.append(cleaned_item)

        # 基于图片URL去重
        unique_data = []
        seen_urls = set()

        for item in cleaned_data:
            if 'clean_image_url' in item and item['clean_image_url']:
                if item['clean_image_url'] not in seen_urls:
                    seen_urls.add(item['clean_image_url'])
                    unique_data.append(item)
            else:
                unique_data.append(item)

        return unique_data


# 使用示例
if __name__ == '__main__':
    cleaner = DataCleaner()

    # 测试文本清理
    test_text = """
    <p>这是一段测试文本，包含<a href="http://example.com">链接</a>和广告内容。</p>
    <script>alert('广告')</script>
    联系电话：13800138000 邮箱：test@example.com
    【重要通知】点击这里下载APP，立即享受优惠！
    """

    cleaned_text = cleaner.clean_text(test_text)
    print("清理后的文本:", cleaned_text)

    # 测试关键词提取
    keywords = cleaner.extract_keywords(cleaned_text)
    print("提取的关键词:", keywords)

    # 测试内容指纹
    fingerprint = cleaner.generate_content_fingerprint(cleaned_text)
    print("内容指纹:", fingerprint)

    # 测试URL清理
    test_url = "https://example.com/page?utm_source=google&utm_medium=cpc&spm=123"
    cleaned_url = cleaner.clean_url(test_url)
    print("清理后的URL:", cleaned_url)