/**
 * 数据分析状态管理 Slice
 * 负责爬取数据分析、性能监控、趋势分析等功能
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { analyticsApi } from '../../services/analyticsApi'

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
  type: 'link' | 'content' | 'image'
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

interface AnalyticsState {
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

const initialState: AnalyticsState = {
  performance: null,
  crawlAnalytics: [],
  trends: [],
  loading: false,
  error: null,
  timeRange: {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近7天
    end: Date.now()
  }
}

// 异步Thunk - 加载性能数据
export const loadPerformanceMetrics = createAsyncThunk(
  'analytics/loadPerformanceMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await analyticsApi.getPerformanceMetrics()
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载性能数据失败')
    }
  }
)

// 异步Thunk - 加载爬取分析数据
export const loadCrawlAnalytics = createAsyncThunk(
  'analytics/loadCrawlAnalytics',
  async ({ start, end }: { start: number; end: number }, { rejectWithValue }) => {
    try {
      const response = await analyticsApi.getCrawlAnalytics({
        startTime: start,
        endTime: end
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载爬取分析数据失败')
    }
  }
)

// 异步Thunk - 加载趋势数据
export const loadTrends = createAsyncThunk(
  'analytics/loadTrends',
  async ({ days }: { days: number }, { rejectWithValue }) => {
    try {
      const response = await analyticsApi.getTrends({ days })
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载趋势数据失败')
    }
  }
)

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    // 更新时间范围
    updateTimeRange: (state, action: PayloadAction<{ start: number; end: number }>) => {
      state.timeRange = action.payload
    },

    // 添加爬取分析记录
    addCrawlAnalytics: (state, action: PayloadAction<CrawlAnalytics>) => {
      state.crawlAnalytics.unshift(action.payload)

      // 保持最多1000条记录
      if (state.crawlAnalytics.length > 1000) {
        state.crawlAnalytics = state.crawlAnalytics.slice(0, 1000)
      }
    },

    // 清除错误信息
    clearError: (state) => {
      state.error = null
    },

    // 重置分析数据
    resetAnalytics: (state) => {
      state.crawlAnalytics = []
      state.trends = []
      state.performance = null
    }
  },

  extraReducers: (builder) => {
    builder
      // 加载性能数据
      .addCase(loadPerformanceMetrics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadPerformanceMetrics.fulfilled, (state, action) => {
        state.loading = false
        state.performance = action.payload
      })
      .addCase(loadPerformanceMetrics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // 加载爬取分析数据
      .addCase(loadCrawlAnalytics.pending, (state) => {
        state.loading = true
      })
      .addCase(loadCrawlAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.crawlAnalytics = action.payload
      })
      .addCase(loadCrawlAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // 加载趋势数据
      .addCase(loadTrends.pending, (state) => {
        state.loading = true
      })
      .addCase(loadTrends.fulfilled, (state, action) => {
        state.loading = false
        state.trends = action.payload
      })
      .addCase(loadTrends.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  }
})

export const { updateTimeRange, addCrawlAnalytics, clearError, resetAnalytics } = analyticsSlice.actions
export default analyticsSlice.reducer