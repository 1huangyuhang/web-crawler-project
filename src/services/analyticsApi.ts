/**
 * 数据分析相关 API（与后端 successResponse 格式对齐，供 Redux thunk 使用）
 */

import apiClient from './api'
import type { CrawlAnalytics, PerformanceMetrics, TrendData } from '../types'

interface ApiEnvelope<T> {
  success: boolean
  code: number
  message: string
  data: T
  timestamp?: string
}

async function unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<{ data: T }> {
  const res = await request
  return { data: res.data.data }
}

export const analyticsApi = {
  getPerformanceMetrics: () =>
    unwrap(apiClient.get<ApiEnvelope<PerformanceMetrics>>('/api/analytics/performance')),

  getCrawlAnalytics: (params: { startTime: number; endTime: number }) =>
    unwrap(
      apiClient.get<ApiEnvelope<CrawlAnalytics[]>>('/api/analytics/crawl', {
        params: {
          startTime: params.startTime,
          endTime: params.endTime
        }
      })
    ),

  getTrends: (params: { days: number }) =>
    unwrap(
      apiClient.get<ApiEnvelope<TrendData[]>>('/api/analytics/trends', {
        params: { days: params.days }
      })
    )
}
