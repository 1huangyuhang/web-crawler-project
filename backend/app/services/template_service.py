"""Spider template service: built-in templates, URL matching, CRUD operations."""

import re
import logging
from sqlalchemy import select
from app.database import async_session
from app.models.template import SpiderTemplate

logger = logging.getLogger(__name__)

BUILTIN_TEMPLATES = [
    {
        "name": "通用网站",
        "category": "general",
        "description": "适用于大多数网站的通用爬虫模板，支持基本的链接提取和内容抓取",
        "url_patterns": [".*"],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"},
        "parse_rules": {"title": "title", "content": "body", "links": "a[href]"},
        "anti_crawl_config": {"request_delay": 1.0, "random_delay": True, "rotate_ua": True},
    },
    {
        "name": "电商平台",
        "category": "ecommerce",
        "description": "适用于淘宝、京东、拼多多等电商网站，提取商品信息",
        "url_patterns": ["taobao\\.com", "jd\\.com", "pinduoduo\\.com", "tmall\\.com"],
        "headers": {"Accept": "text/html", "Accept-Language": "zh-CN,zh;q=0.9"},
        "parse_rules": {"title": ".product-title, .sku-name, .p-name", "price": ".price, .p-price", "image": ".product-img img, .main-img img"},
        "anti_crawl_config": {"request_delay": 2.0, "random_delay": True, "rotate_ua": True, "use_proxy": False},
    },
    {
        "name": "新闻资讯",
        "category": "news",
        "description": "适用于新浪、网易、腾讯等新闻门户网站",
        "url_patterns": ["sina\\.com", "163\\.com", "qq\\.com", "sohu\\.com", "ifeng\\.com"],
        "headers": {"Accept": "text/html"},
        "parse_rules": {"title": "h1, .article-title", "content": ".article-body, .post-body, #artibody", "author": ".author, .source", "date": ".date, time"},
        "anti_crawl_config": {"request_delay": 1.0, "rotate_ua": True},
    },
    {
        "name": "社交媒体",
        "category": "social",
        "description": "适用于微博、知乎、豆瓣等社交平台",
        "url_patterns": ["weibo\\.com", "zhihu\\.com", "douban\\.com"],
        "headers": {"Accept": "text/html,application/json"},
        "parse_rules": {"title": "h1, .QuestionHeader-title", "content": ".Post-RichText, .RichContent", "author": ".AuthorInfo, .UserLink"},
        "anti_crawl_config": {"request_delay": 3.0, "random_delay": True, "rotate_ua": True, "requires_login": True},
    },
    {
        "name": "招聘网站",
        "category": "recruitment",
        "description": "适用于智联招聘、前程无忧、BOSS直聘等招聘平台",
        "url_patterns": ["zhaopin\\.com", "51job\\.com", "zhipin\\.com", "lagou\\.com"],
        "headers": {"Accept": "text/html,application/json"},
        "parse_rules": {"title": ".job-title, .job-name", "company": ".company-name", "salary": ".salary, .job-salary", "location": ".job-area, .job-address"},
        "anti_crawl_config": {"request_delay": 2.0, "rotate_ua": True, "use_proxy": True},
    },
]


async def seed_builtin_templates():
    """Insert built-in templates if they don't exist yet."""
    try:
        async with async_session() as session:
            for tmpl_data in BUILTIN_TEMPLATES:
                result = await session.execute(
                    select(SpiderTemplate).where(SpiderTemplate.name == tmpl_data["name"])
                )
                if result.scalar_one_or_none():
                    continue
                tmpl = SpiderTemplate(
                    name=tmpl_data["name"],
                    category=tmpl_data["category"],
                    description=tmpl_data["description"],
                    url_patterns=tmpl_data["url_patterns"],
                    headers=tmpl_data["headers"],
                    parse_rules=tmpl_data["parse_rules"],
                    anti_crawl_config=tmpl_data["anti_crawl_config"],
                    is_builtin=True,
                )
                session.add(tmpl)
            await session.commit()
        logger.info("Built-in templates seeded")
    except Exception as e:
        logger.warning(f"Failed to seed templates (DB may not be ready): {e}")


def match_template_for_url(url: str, templates: list[SpiderTemplate]) -> SpiderTemplate | None:
    """Find the best matching template for a given URL."""
    for tmpl in templates:
        if tmpl.name == "通用网站":
            continue
        patterns = tmpl.url_patterns or []
        for pattern in patterns:
            try:
                if re.search(pattern, url, re.IGNORECASE):
                    return tmpl
            except re.error:
                continue

    # Fall back to general template
    for tmpl in templates:
        if tmpl.name == "通用网站":
            return tmpl
    return None
