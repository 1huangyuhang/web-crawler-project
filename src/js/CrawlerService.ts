/**
 * 爬虫服务
 * 用于处理不同类型的爬虫请求
 */

/**
 * 真实爬虫服务
 * 用于处理不同类型的爬虫请求，调用后端 API
 */
export class CrawlerService {
  /**
   * API 基础 URL
   */
  private static readonly API_BASE_URL = 'http://localhost:3001/api';
  
  /**
   * 开始爬取
   * @param crawlerType 爬虫类型
   * @param url 目标URL
   * @param depth 爬取深度
   * @returns 爬取结果
   */
  static async startCrawling(crawlerType: string, url: string, depth: number): Promise<any> {
    try {
      // 发送请求到后端 API
      const response = await fetch(`${this.API_BASE_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: crawlerType,
          url,
          depth
        })
      });
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }
      
      // 解析响应数据
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('爬取失败:', error);
      throw new Error(`爬取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 检查后端服务是否可用
   * @returns 服务是否可用
   */
  static async checkServiceHealth(): Promise<boolean> {
    try {
      console.log('开始检查服务健康状态:', `${this.API_BASE_URL}/health`);
      const response = await fetch(`${this.API_BASE_URL}/health`);
      console.log('服务健康检查响应:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers)
      });
      return response.ok;
    } catch (error) {
      console.error('检查服务健康状态失败:', error);
      return false;
    }
  }
}