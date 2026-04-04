/**
 * API 服务层
 * 使用环境变量配置，保持技术栈精简
 *
 * 功能特性:
 * - 统一的Axios客户端配置
 * - 请求/响应拦截器实现日志记录
 * - 自动生成请求ID用于分布式追踪
 * - 错误处理和重试机制
 * - 类型安全的API接口定义
 *
 * 配置选项:
 * - VITE_API_BASE_URL: API基础URL
 * - 超时时间: 30秒
 * - 内容类型: application/json
 *
 * 使用示例:
 * ```typescript
 * import { crawlerApi } from './services/api'
 *
 * // 发起爬虫请求
 * const result = await crawlerApi.startCrawl({
 *   type: 'content',
 *   url: 'https://example.com',
 *   depth: 2
 * })
 * ```
 */

import axios from 'axios'
import { getApiBaseUrl } from '../config/api'
import { logger } from './logger'

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以添加认证 token
    const requestId = logger.generateRequestId()
    config.headers['X-Request-ID'] = requestId
    logger.debug('API请求发送', { url: config.url, method: config.method, requestId }, 'API')
    return config
  },
  (error) => {
    logger.error('API请求错误', error, {}, 'API')
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    const requestId = response.config.headers['X-Request-ID']
    logger.debug('API响应成功', { url: response.config.url, status: response.status, requestId }, 'API')
    return response
  },
  (error) => {
    const requestId = error.config?.headers?.['X-Request-ID']
    logger.error('API响应错误', error, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      requestId
    }, 'API')
    return Promise.reject(error)
  }
)

export type CrawlRuntimeClient = {
  maxConcurrent?: number
  requestDelay?: number
  timeout?: number
  maxRetries?: number
  userAgent?: string
}

export const crawlerApi = {
  startCrawl: (data: {
    type: string
    url: string
    depth: number
    crawlRuntime?: CrawlRuntimeClient
  }) => apiClient.post('/api/crawl', data),

  /** 短超时，避免健康检查占用默认 30s，拖成「长时间不可用」 */
  checkHealth: () => apiClient.get('/api/health', { timeout: 5000 }),

  getHistory: (limit: number = 50) =>
    apiClient.get(`/api/history?limit=${limit}`),

  deleteHistory: (id: string) =>
    apiClient.delete(`/api/history/${id}`),

  clearHistory: () =>
    apiClient.delete('/api/history')
}

export default apiClient