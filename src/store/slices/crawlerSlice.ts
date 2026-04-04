/**
 * 爬虫状态管理 Slice
 * 使用 Redux Toolkit 统一管理爬虫状态
 *
 * 主要功能:
 * - 管理爬虫配置(类型、URL、深度)
 * - 跟踪当前爬取任务状态
 * - 维护爬取历史记录
 * - 监控系统服务状态
 * - 实时进度更新
 *
 * 状态结构:
 * - config: 爬虫配置参数
 * - status: 当前爬虫状态(idle|running|completed|error)
 * - currentCrawl: 当前爬取任务详情
 * - history: 历史爬取记录列表
 * - progress: 当前爬取进度(0-100)
 * - serviceStatus: 后端服务状态
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { crawlerApi } from '../../services/api'
import { safeGetItem, safeSetItem } from '../../utils/safeStorage'

export interface CrawlerConfig {
  type: 'link' | 'content' | 'image'
  url: string
  depth: number
}

export interface CrawlRecord extends CrawlerConfig {
  id: string
  timestamp: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  items: number
  time: number
  data?: any[]
  error?: string
  progress: number
  currentUrl?: string
}

interface CrawlerState {
  config: CrawlerConfig
  status: 'idle' | 'running' | 'completed' | 'error'
  currentCrawl: CrawlRecord | null
  history: CrawlRecord[]
  progress: number
  serviceStatus: 'checking' | 'available' | 'unavailable'
}

export const initialState: CrawlerState = {
  config: {
    type: 'link',
    url: safeGetItem('crawlerTargetUrl', '') || '',
    depth: parseInt(safeGetItem('crawlerDepth', '2') || '2', 10) || 2
  },
  status: 'idle',
  currentCrawl: null,
  history: [],
  progress: 0,
  serviceStatus: 'checking'
}

export const startCrawling = createAsyncThunk(
  'crawler/startCrawling',
  async (config: CrawlerConfig) => {
    try {
      const response = await crawlerApi.startCrawl(config)
      return response.data
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '爬取失败')
    }
  }
)

export const checkServiceHealth = createAsyncThunk(
  'crawler/checkServiceHealth',
  async () => {
    try {
      await crawlerApi.checkHealth()
      return true
    } catch (error) {
      return false
    }
  }
)

const crawlerSlice = createSlice({
  name: 'crawler',
  initialState,
  reducers: {
    updateConfig: (state, action: PayloadAction<Partial<CrawlerConfig>>) => {
      state.config = { ...state.config, ...action.payload }
      // 保持向后兼容性，同时更新 localStorage
      if (action.payload.type) {
        safeSetItem('crawlerType', action.payload.type)
      }
      if (action.payload.url !== undefined) {
        safeSetItem('crawlerTargetUrl', action.payload.url)
      }
      if (action.payload.depth !== undefined) {
        safeSetItem('crawlerDepth', action.payload.depth.toString())
      }
    },
    resetCrawler: (state) => {
      state.status = 'idle'
      state.progress = 0
      state.currentCrawl = null
    },
    updateProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload
      if (state.currentCrawl) {
        state.currentCrawl.progress = action.payload
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(startCrawling.pending, (state) => {
        state.status = 'running'
        state.progress = 0
      })
      .addCase(startCrawling.fulfilled, (state, action) => {
        state.status = 'completed'
        state.progress = 100
        state.currentCrawl = action.payload
        state.history.unshift(action.payload)
      })
      .addCase(startCrawling.rejected, (state, action) => {
        state.status = 'error'
        state.currentCrawl = {
          ...state.config,
          id: `crawl_${Date.now()}`,
          timestamp: Date.now(),
          status: 'failed',
          items: 0,
          time: 0,
          error: action.error.message || '爬取失败',
          progress: 0
        }
      })
      .addCase(checkServiceHealth.pending, (state) => {
        state.serviceStatus = 'checking'
      })
      .addCase(checkServiceHealth.fulfilled, (state, action) => {
        state.serviceStatus = action.payload ? 'available' : 'unavailable'
      })
      .addCase(checkServiceHealth.rejected, (state) => {
        state.serviceStatus = 'unavailable'
      })
  }
})

export const { updateConfig, resetCrawler, updateProgress } = crawlerSlice.actions
export default crawlerSlice.reducer