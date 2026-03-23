#!/usr/bin/env python3
# 爬虫主脚本

import argparse
import json
import sys
import os

# 添加脚本所在目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from crawler_manager import CrawlerManager


def main():
    """
    主函数
    """
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='网页爬虫工具')
    parser.add_argument('--type', '-t', required=True, choices=CrawlerManager.get_supported_types(),
                        help='爬虫类型: link (链接爬虫), content (内容爬虫), image (图片爬虫)')
    parser.add_argument('--url', '-u', required=True, help='目标URL')
    parser.add_argument('--depth', '-d', type=int, default=2, help='爬取深度 (默认: 2)')
    parser.add_argument('--output', '-o', help='输出文件路径 (JSON格式)')
    parser.add_argument('--json', action='store_true', help='以JSON格式输出结果')
    
    args = parser.parse_args()
    
    # 开始爬取
    results = CrawlerManager.start_crawling(args.type, args.url, args.depth)
    
    # 如果指定了JSON格式输出
    if args.json:
        print(json.dumps(results, ensure_ascii=False))
        return results
    
    # 否则，以人类可读的格式输出
    print(f"开始爬取 {args.url}")
    print(f"爬虫类型: {args.type}")
    print(f"爬取深度: {args.depth}")
    print("=" * 60)
    
    print("爬取结果:")
    print("=" * 60)
    print(f"目标URL: {results['url']}")
    print(f"爬虫类型: {results['type']}")
    print(f"爬取深度: {results['depth']}")
    print(f"爬取数量: {results['items']} 个")
    print(f"爬取时间: {results['time']} 秒")
    
    if 'error' in results:
        print(f"错误信息: {results['error']}")
    else:
        print(f"数据条数: {len(results['data'])}")
    
    print("=" * 60)
    
    # 保存结果到文件
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"结果已保存到: {args.output}")
        except Exception as e:
            print(f"保存结果时出错: {e}")
    
    return results


if __name__ == '__main__':
    main()
