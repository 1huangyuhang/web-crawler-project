# 异步爬虫管理器 - 负责协调不同类型的异步爬虫

import asyncio
import sys
import json
from typing import Dict, Any
from async_content_crawler import AsyncContentCrawler
from async_image_crawler import AsyncImageCrawler, AsyncLinkCrawler
from async_base_crawler import CrawlConfig


class AsyncCrawlerManager:
    """
    异步爬虫管理器
    负责根据类型创建对应的异步爬虫实例并执行爬取
    """

    @staticmethod
    async def create_crawler(crawler_type: str, url: str, depth: int = 2, config: CrawlConfig = None):
        """
        创建对应类型的异步爬虫实例

        Args:
            crawler_type: 爬虫类型 (link, content, image)
            url: 目标URL
            depth: 爬取深度
            config: 爬虫配置

        Returns:
            对应的异步爬虫实例
        """
        if crawler_type == 'link':
            return AsyncLinkCrawler(url, depth, config)
        elif crawler_type == 'content':
            return AsyncContentCrawler(url, depth, config)
        elif crawler_type == 'image':
            return AsyncImageCrawler(url, depth, config)
        else:
            raise ValueError(f"不支持的爬虫类型: {crawler_type}")

    @staticmethod
    async def crawl(crawler_type: str, url: str, depth: int = 2, config: CrawlConfig = None) -> Dict[str, Any]:
        """
        执行爬虫任务并返回结果

        Args:
            crawler_type: 爬虫类型 (link, content, image)
            url: 目标URL
            depth: 爬取深度
            config: 爬虫配置

        Returns:
            爬取结果字典
        """
        try:
            # 创建爬虫实例
            crawler = await AsyncCrawlerManager.create_crawler(crawler_type, url, depth, config)

            # 执行爬取
            async with crawler:
                result = await crawler.start_crawling()

            return {
                'success': True,
                'data': result,
                'error': None
            }

        except Exception as e:
            return {
                'success': False,
                'data': None,
                'error': str(e)
            }


def main():
    """
    命令行入口函数
    支持参数：--type <link|content|image> --url <url> --depth <depth> --json
    """
    import argparse

    parser = argparse.ArgumentParser(description='异步爬虫管理器')
    parser.add_argument('--type', required=True, choices=['link', 'content', 'image'],
                       help='爬虫类型: link, content, image')
    parser.add_argument('--url', required=True, help='目标URL')
    parser.add_argument('--depth', type=int, default=2, help='爬取深度 (1-10)')
    parser.add_argument('--max-concurrent', type=int, default=5, help='最大并发数')
    parser.add_argument('--request-delay', type=float, default=0.5, help='请求延迟 (秒)')
    parser.add_argument('--json', action='store_true', help='以JSON格式输出结果')

    args = parser.parse_args()

    # 验证参数
    if not (1 <= args.depth <= 10):
        print(json.dumps({
            'success': False,
            'error': '深度必须在1-10之间'
        }))
        sys.exit(1)

    # 创建配置
    config = CrawlConfig(
        max_concurrent=args.max_concurrent,
        request_delay=args.request_delay
    )

    # 运行异步爬虫
    try:
        result = asyncio.run(AsyncCrawlerManager.crawl(args.type, args.url, args.depth, config))

        # 输出结果
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            if result['success']:
                data = result['data']
                print(f"爬取成功！")
                print(f"类型: {data['type']}")
                print(f"URL: {data['url']}")
                print(f"项目数: {data['items']}")
                print(f"耗时: {data['time']} 秒")
                print(f"统计数据: {data['stats']}")
            else:
                print(f"爬取失败: {result['error']}")

    except KeyboardInterrupt:
        print(json.dumps({
            'success': False,
            'error': '用户中断'
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'执行错误: {str(e)}'
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()