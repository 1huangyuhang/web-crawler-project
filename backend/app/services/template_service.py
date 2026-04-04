"""Spider template service: built-in templates, URL matching, CRUD operations."""

import re
import logging
from sqlalchemy import select
from app.database import async_session
from app.models.template import SpiderTemplate

logger = logging.getLogger(__name__)

# anti_crawl_config 中与运行时相关的键（由前端映射为 Node / Python crawlRuntime）：
#   max_concurrent, request_delay, timeout, max_retries, user_agent
#   recommended_type: link | content | image
#   recommended_depth: 1–10
# 其余如 random_delay、rotate_ua、requires_login 仅作策略说明，供 UI / 后续扩展使用。

BUILTIN_TEMPLATES = [
    {
        "name": "通用网站",
        "category": "general",
        "description": "默认兜底策略：礼貌抓取、提取标题与正文区块、收集站内链接。适合未单独建模的站点。",
        "url_patterns": [".*"],
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "parse_rules": {
            "title": "title",
            "content": "main, article, [role=main], .content, #content, body",
            "links": "a[href]",
        },
        "anti_crawl_config": {
            "request_delay": 1.0,
            "max_concurrent": 5,
            "timeout": 18,
            "max_retries": 3,
            "random_delay": True,
            "rotate_ua": True,
            "recommended_type": "link",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {
            "next_selectors": ["a[rel=next]", "link[rel=next]"],
            "list_item_links": "a[href]",
            "notes": "通用站优先跟随 rel=next；列表页再展开详情需提高 depth。",
        },
        "data_clean_rules": {
            "text": {"collapse_whitespace": True, "strip": True},
            "urls": {"normalize": True, "drop_fragments": False},
        },
    },
    {
        "name": "电商平台",
        "category": "ecommerce",
        "description": "商品详情页：标题、价格、主图、SKU 区。电商反爬强，降低并发、加大间隔。",
        "url_patterns": [
            r"taobao\.com",
            r"tmall\.com",
            r"jd\.com",
            r"pinduoduo\.com",
            r"yangkeduo\.com",
            r"amazon\.(com|co\.uk|de|jp)",
        ],
        "headers": {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "parse_rules": {
            "title": "h1, [data-title], .sku-name, .product-title, #productTitle",
            "price": ".price, .p-price, [class*='Price'], #priceblock_ourprice",
            "image": ".product-img img, #landingImage, #imgTagWrapperId img, img[data-src]",
            "breadcrumb": ".breadcrumb, [class*='breadcrumb']",
        },
        "anti_crawl_config": {
            "request_delay": 2.2,
            "max_concurrent": 3,
            "timeout": 28,
            "max_retries": 4,
            "random_delay": True,
            "rotate_ua": True,
            "use_proxy": False,
            "recommended_type": "content",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {
            "next_selectors": ["a[rel=next]", ".pagination .next a"],
            "notes": "列表页常带 page/query 参数，需遵守 robots 与站点条款。",
        },
        "data_clean_rules": {
            "price": {"strip": True, "regex_extract": r"[\d.,]+", "note": "提取数字与小数点，币种需另映射"},
            "title": {"collapse_whitespace": True},
        },
    },
    {
        "name": "新闻资讯",
        "category": "news",
        "description": "门户与媒体正文：标题、正文容器、作者、时间。适配常见中文新闻 DOM。",
        "url_patterns": [
            r"sina\.com",
            r"163\.com",
            r"qq\.com",
            r"sohu\.com",
            r"ifeng\.com",
            r"thepaper\.cn",
            r"people\.com\.cn",
        ],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9"},
        "parse_rules": {
            "title": "h1, .article-title, .post_title, [class*='article'] h1",
            "content": "#artibody, .article-body, .post_body, .content, article",
            "author": ".author, .source, [class*='author'], .byline",
            "date": "time[datetime], .date, .publish-time, [class*='time']",
        },
        "anti_crawl_config": {
            "request_delay": 1.2,
            "max_concurrent": 5,
            "timeout": 22,
            "max_retries": 3,
            "rotate_ua": True,
            "recommended_type": "content",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {
            "list_item_links": ".news-list a[href], .list a[href], a[href*='/article/']",
            "next_selectors": ["a[rel=next]"],
        },
        "data_clean_rules": {
            "content": {"collapse_whitespace": True, "strip_script_tags": True},
            "date": {"strip": True},
        },
    },
    {
        "name": "社交媒体",
        "category": "social",
        "description": "问答/信息流类页面结构（知乎问题页、微博正文等）。多数需登录或强校验，仅作解析参考。",
        "url_patterns": [r"weibo\.com", r"zhihu\.com", r"douban\.com", r"xiaohongshu\.com"],
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9",
            "Accept-Language": "zh-CN,zh;q=0.9",
        },
        "parse_rules": {
            "title": "h1, .QuestionHeader-title, [class*='title']",
            "content": ".RichText, .RichContent, .weibo-text, [class*='detail']",
            "author": ".AuthorInfo-name, .UserLink, [class*='nickname']",
        },
        "anti_crawl_config": {
            "request_delay": 3.0,
            "max_concurrent": 2,
            "timeout": 30,
            "max_retries": 2,
            "random_delay": True,
            "rotate_ua": True,
            "requires_login": True,
            "recommended_type": "content",
            "recommended_depth": 1,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {"notes": "无限滚动站点需浏览器自动化，本模板以首屏 HTML 解析为主。"},
        "data_clean_rules": {"text": {"collapse_whitespace": True}},
    },
    {
        "name": "招聘网站",
        "category": "recruitment",
        "description": "职位列表与详情：职位名、公司、薪资、城市。适合聚合后做薪酬与市场分析。",
        "url_patterns": [r"zhaopin\.com", r"51job\.com", r"zhipin\.com", r"lagou\.com", r"liepin\.com"],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9"},
        "parse_rules": {
            "title": ".job-title, .job-name, h1, [class*='job-title']",
            "company": ".company-name, .cname, [class*='company']",
            "salary": ".salary, .job-salary, [class*='salary']",
            "location": ".job-area, .job-address, [class*='location']",
        },
        "anti_crawl_config": {
            "request_delay": 2.0,
            "max_concurrent": 4,
            "timeout": 24,
            "max_retries": 3,
            "rotate_ua": True,
            "recommended_type": "content",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {
            "list_item_links": ".job-list a[href], a[href*='/job']",
            "next_selectors": ["a[rel=next]", ".pagination a.next"],
        },
        "data_clean_rules": {
            "salary": {"strip": True, "note": "「面议」等需单独分类"},
            "location": {"collapse_whitespace": True},
        },
    },
    {
        "name": "技术文档与博客",
        "category": "docs",
        "description": "文档站、开发者博客（Docusaurus、VitePress、ReadTheDocs 等）：侧栏导航 + 正文 markdown 容器。",
        "url_patterns": [
            r"readthedocs\.io",
            r"docs\.github\.com",
            r"developer\.mozilla\.org",
            r"tailwindcss\.com/docs",
            r"vitejs\.dev",
            r"cn\.vitejs\.dev",
        ],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"},
        "parse_rules": {
            "title": "h1, article h1, .markdown h1",
            "content": "article, main, .markdown, .theme-doc-markdown, .docs-markdown, [role=main]",
            "nav_links": "nav a[href], .menu a[href], .sidebar a[href]",
            "code_blocks": "pre code, .highlight pre",
        },
        "anti_crawl_config": {
            "request_delay": 0.7,
            "max_concurrent": 6,
            "timeout": 20,
            "max_retries": 3,
            "recommended_type": "link",
            "recommended_depth": 3,
            "user_agent": "Mozilla/5.0 (compatible; SpiderX-DocBot/1.0; +https://example.com)",
        },
        "pagination_config": {
            "next_selectors": ["a[rel=next]", ".pagination-nav__link--next"],
            "notes": "文档站多为站内相对链接，link 爬虫较深时注意域名范围。",
        },
        "data_clean_rules": {"code_blocks": {"preserve_linebreaks": True}},
    },
    {
        "name": "代码托管平台",
        "category": "code_host",
        "description": "GitHub / GitLab 等：仓库 README、文件树链接、Issue 列表。公开页面以 HTML 为主，API 有独立速率限制。",
        "url_patterns": [r"github\.com", r"gitlab\.com", r"gitee\.com", r"bitbucket\.org"],
        "headers": {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
        "parse_rules": {
            "title": "h1, .repository-content h1, [itemprop=name]",
            "readme": "#readme, .markdown-body, .blob-wrapper .markdown-body",
            "file_links": "a[href*='/blob/'], a[href*='/tree/']",
            "meta_stars": "a[href$='/stargazers'], [id$='repo-stars-counter-star']",
        },
        "anti_crawl_config": {
            "request_delay": 1.0,
            "max_concurrent": 4,
            "timeout": 25,
            "max_retries": 3,
            "recommended_type": "link",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {
            "next_selectors": ["a[rel=next]", ".pagination a.next_page"],
            "notes": "遵循 GitHub/GitLab 可接受使用政策；大批量请改用官方 API。",
        },
        "data_clean_rules": {"readme": {"strip": False, "collapse_whitespace": False}},
    },
    {
        "name": "论坛与问答",
        "category": "forum",
        "description": "论坛楼层、问答线程：主题标题、帖子正文、回复列表。",
        "url_patterns": [
            r"stackoverflow\.com",
            r"stackexchange\.com",
            r"v2ex\.com",
            r"segmentfault\.com",
            r"reddit\.com",
        ],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"},
        "parse_rules": {
            "title": "h1, a.question-hyperlink, [data-questionid] h1",
            "content": ".s-prose, .postcell .s-prose, .topic_content, .markdown_body",
            "answers": ".answer, .reply, [itemprop='suggestedAnswer']",
        },
        "anti_crawl_config": {
            "request_delay": 1.5,
            "max_concurrent": 4,
            "timeout": 22,
            "max_retries": 3,
            "rotate_ua": True,
            "recommended_type": "content",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {"next_selectors": ["a[rel=next]", ".pager .next a"]},
        "data_clean_rules": {"content": {"collapse_whitespace": True}},
    },
    {
        "name": "政府与政务公开",
        "category": "gov",
        "description": "gov.cn 等政务站点：公告正文、附件链接、表格。适合公开信息采集与归档。",
        "url_patterns": [r"\.gov\.cn", r"gov\.cn"],
        "headers": {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9"},
        "parse_rules": {
            "title": "h1, .title, .article-title, .xxgk_title",
            "content": ".article, .TRS_Editor, .article-content, #zoom, .pages_content",
            "attachments": "a[href$='.pdf'], a[href$='.doc'], a[href$='.docx'], a[href$='.xlsx']",
        },
        "anti_crawl_config": {
            "request_delay": 1.0,
            "max_concurrent": 4,
            "timeout": 30,
            "max_retries": 4,
            "recommended_type": "content",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {"list_item_links": "ul.list a[href], .news_list a[href], table a[href]"},
        "data_clean_rules": {"content": {"collapse_whitespace": True}},
    },
    {
        "name": "图片素材站",
        "category": "media",
        "description": "以图为主的页面：主图、srcset、画廊缩略图。配合「图片爬虫」类型使用。",
        "url_patterns": [
            r"unsplash\.com",
            r"pexels\.com",
            r"pixabay\.com",
            r"flickr\.com",
            r"500px\.com",
        ],
        "headers": {"Accept": "text/html,image/avif,image/webp,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"},
        "parse_rules": {
            "gallery_images": "img[src], img[data-src], picture source[srcset]",
            "title": "h1, [class*='title']",
        },
        "anti_crawl_config": {
            "request_delay": 1.2,
            "max_concurrent": 4,
            "timeout": 25,
            "max_retries": 3,
            "recommended_type": "image",
            "recommended_depth": 2,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        "pagination_config": {"next_selectors": ["a[rel=next]"]},
        "data_clean_rules": {"urls": {"prefer_https": True}},
    },
]


def _template_specificity(tmpl: SpiderTemplate) -> int:
    score = 0
    for p in tmpl.url_patterns or []:
        if not p or p == ".*":
            continue
        score += len(p) + 8
    return score


async def seed_builtin_templates():
    """插入或更新内置模板（按 name 唯一键同步字段，便于升级内容）。"""
    try:
        async with async_session() as session:
            for tmpl_data in BUILTIN_TEMPLATES:
                name = tmpl_data["name"]
                result = await session.execute(select(SpiderTemplate).where(SpiderTemplate.name == name))
                row = result.scalar_one_or_none()
                common = {
                    "category": tmpl_data["category"],
                    "description": tmpl_data["description"],
                    "url_patterns": tmpl_data["url_patterns"],
                    "headers": tmpl_data["headers"],
                    "parse_rules": tmpl_data["parse_rules"],
                    "anti_crawl_config": tmpl_data["anti_crawl_config"],
                    "pagination_config": tmpl_data.get("pagination_config"),
                    "data_clean_rules": tmpl_data.get("data_clean_rules"),
                }
                if row:
                    if row.is_builtin:
                        for k, v in common.items():
                            setattr(row, k, v)
                else:
                    session.add(
                        SpiderTemplate(
                            name=name,
                            is_builtin=True,
                            **common,
                        )
                    )
            await session.commit()
        logger.info("Built-in templates seeded/synced")
    except Exception as e:
        logger.warning("Failed to seed templates (DB may not be ready): %s", e)


def match_template_for_url(url: str, templates: list[SpiderTemplate]) -> SpiderTemplate | None:
    """按 URL 匹配模板；越具体的模式优先，最后回退「通用网站」。"""
    general: SpiderTemplate | None = None
    candidates: list[tuple[int, SpiderTemplate]] = []
    for tmpl in templates:
        if tmpl.name == "通用网站":
            general = tmpl
            continue
        candidates.append((_template_specificity(tmpl), tmpl))

    candidates.sort(key=lambda x: -x[0])

    for _, tmpl in candidates:
        for pattern in tmpl.url_patterns or []:
            try:
                if re.search(pattern, url, re.IGNORECASE):
                    return tmpl
            except re.error:
                continue

    return general