/**
 * 全局类型定义
 * 集中管理项目中的所有接口类型和类型别名
 */

// ==================== 基础类型 ====================

export interface BaseEntity {
  id: string
  createdAt: number
  updatedAt?: number
}

export interface BaseResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  timestamp: number
}

export interface PaginatedResponse<T> extends BaseResponse<T> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ErrorResponse extends BaseResponse {
  success: false
  error: string
  code: string
}

// ==================== 爬虫相关类型 ====================

export type CrawlerType = 'link' | 'content' | 'image'
export type CrawlerStatus = 'idle' | 'running' | 'completed' | 'error'
export type CrawlRecordStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface CrawlerConfig {
  type: CrawlerType
  url: string
  depth: number
  maxConcurrent?: number
  requestDelay?: number
}

export interface CrawlRecord extends BaseEntity, CrawlerConfig {
  timestamp: number
  status: CrawlRecordStatus
  items: number
  time: number
  data?: any[]
  error?: string
  progress: number
  currentUrl?: string
}

export interface CrawlStats {
  totalUrls: number
  successUrls: number
  failedUrls: number
  totalLinks: number
  totalImages: number
  totalContent: number
  avgResponseTime: number
}

// ==================== API相关类型 ====================

export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  data?: any
  params?: Record<string, any>
  headers?: Record<string, string>
  timeout?: number
}

export interface ApiResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: ApiRequestConfig
  requestId: string
}

export interface ApiError extends Error {
  response?: ApiResponse
  config?: ApiRequestConfig
  code?: string
  requestId?: string
}

// ==================== 状态管理相关类型 ====================

export interface RootState {
  crawler: {
    config: CrawlerConfig
    status: CrawlerStatus
    currentCrawl: CrawlRecord | null
    history: CrawlRecord[]
    progress: number
    serviceStatus: 'checking' | 'available' | 'unavailable'
  }
  settings: {
    settings: SystemSettings
    loading: boolean
    error: string | null
    lastUpdated: number | null
  }
  history: {
    history: CrawlRecord[]
    stats: HistoryStats | null
    loading: boolean
    error: string | null
    filters: Record<string, any>
    searchQuery: string
    pagination: {
      page: number
      pageSize: number
      total: number
    }
  }
  analytics: {
    performance: PerformanceMetrics | null
    crawlAnalytics: CrawlAnalytics[]
    trends: TrendData[]
    loading: boolean
    error: string | null
    timeRange: {
      start: number
      end: number
    }
  }
}

export interface AppThunkAction<T = void> {
  type: string
  payload?: T
  meta?: any
  error?: any
}

// ==================== 系统设置相关类型 ====================

export interface SystemSettings {
  defaultCrawlerType: CrawlerType
  defaultDepth: number
  maxConcurrentRequests: number
  theme: 'light' | 'dark' | 'auto'
  language: string
  autoSave: boolean
  notifications: {
    enabled: boolean
    types: {
      crawlComplete: boolean
      crawlFailed: boolean
      systemUpdates: boolean
    }
  }
  performance: {
    cacheEnabled: boolean
    cacheTTL: number
    batchSize: number
  }
}

// ==================== 统计和数据分析类型 ====================

export interface PerformanceMetrics {
  apiResponseTime: {
    average: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  }
  databaseQueries: {
    total: number
    slowQueries: number
    averageTime: number
  }
  cacheMetrics: {
    hitRate: number
    totalRequests: number
    cacheSize: number
  }
  systemMetrics: {
    cpuUsage: number
    memoryUsage: number
    activeConnections: number
  }
}

export interface CrawlAnalytics {
  id: string
  timestamp: number
  url: string
  type: CrawlerType
  duration: number
  itemsFound: number
  success: boolean
  errorType?: string
  domain: string
  depth: number
}

export interface TrendData {
  date: string
  crawls: number
  success: number
  averageDuration: number
  itemsPerCrawl: number
}

export interface HistoryStats {
  totalCrawls: number
  completedCrawls: number
  failedCrawls: number
  totalItems: number
  averageTime: number
  successRate: number
  byType: {
    link: number
    content: number
    image: number
  }
  byDate: {
    date: string
    count: number
  }[]
}

// ==================== 缓存相关类型 ====================

export interface CacheConfig {
  key: string
  ttl: number
  serialize?: (data: any) => string
  deserialize?: (data: string) => any
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
}

// ==================== WebSocket相关类型 ====================

export interface WebSocketMessage<T = any> {
  type: string
  payload: T
  timestamp: number
  requestId?: string
}

export interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

// ==================== 工具类型 ====================

export type AsyncThunkResult<R = any, S = any> = (
  dispatch: any,
  getState: () => S,
  extraArgument: any
) => Promise<R> | R

export type Reducer<S = any, A = any> = (state: S | undefined, action: A) => S

export type Action<T = any> = {
  type: string
  payload?: T
}

// ==================== 环境变量类型 ====================

declare global {
  interface ImportMetaEnv {
    VITE_API_BASE_URL: string
    VITE_APP_ENV: 'development' | 'production' | 'test'
    VITE_REDIS_HOST?: string
    VITE_REDIS_PORT?: string
    VITE_DATABASE_URL?: string
  }
}