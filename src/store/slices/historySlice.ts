/**
 * 爬取历史记录状态管理 Slice
 * 负责管理爬取历史、收藏记录、统计信息等功能
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { historyApi } from '../../services/historyApi'

export interface CrawlHistoryItem {
  id: string
  timestamp: number
  url: string
  type: 'link' | 'content' | 'image'
  depth: number
  items: number
  time: number
  status: 'completed' | 'failed' | 'running'
  error?: string
  favorite?: boolean
  tags?: string[]
  notes?: string
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

interface HistoryState {
  history: CrawlHistoryItem[]
  stats: HistoryStats | null
  loading: boolean
  error: string | null
  filters: {
    type?: 'link' | 'content' | 'image'
    status?: 'completed' | 'failed' | 'running'
    favorite?: boolean
    dateRange?: {
      start: number
      end: number
    }
  }
  searchQuery: string
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

const initialState: HistoryState = {
  history: [],
  stats: null,
  loading: false,
  error: null,
  filters: {},
  searchQuery: '',
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0
  }
}

// 异步Thunk - 加载历史记录
export const loadHistory = createAsyncThunk(
  'history/loadHistory',
  async ({ page, pageSize, filters }: { page: number; pageSize: number; filters?: any }, { rejectWithValue }) => {
    try {
      const response = await historyApi.getHistory({
        page,
        limit: pageSize,
        type: filters?.type,
        status: filters?.status,
        favorite: filters?.favorite
      })
      return {
        data: response.data,
        total: response.headers['x-total-count'] || 0
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载历史记录失败')
    }
  }
)

// 异步Thunk - 加载统计信息
export const loadStats = createAsyncThunk(
  'history/loadStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await historyApi.getStats()
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载统计信息失败')
    }
  }
)

// 异步Thunk - 删除历史记录
export const deleteHistoryItem = createAsyncThunk(
  'history/deleteHistoryItem',
  async (id: string, { rejectWithValue }) => {
    try {
      await historyApi.deleteHistory(id)
      return id
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '删除历史记录失败')
    }
  }
)

// 异步Thunk - 清空历史记录
export const clearHistory = createAsyncThunk(
  'history/clearHistory',
  async (_, { rejectWithValue }) => {
    try {
      await historyApi.clearHistory()
      return true
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '清空历史记录失败')
    }
  }
)

// 异步Thunk - 收藏/取消收藏
export const toggleFavorite = createAsyncThunk(
  'history/toggleFavorite',
  async ({ id, favorite }: { id: string; favorite: boolean }, { rejectWithValue }) => {
    try {
      const response = await historyApi.updateHistory(id, { favorite })
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '更新收藏状态失败')
    }
  }
)

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    // 添加历史记录项
    addHistoryItem: (state, action: PayloadAction<CrawlHistoryItem>) => {
      state.history.unshift(action.payload)
      state.pagination.total++
    },

    // 更新历史记录项
    updateHistoryItem: (state, action: PayloadAction<{ id: string; updates: Partial<CrawlHistoryItem> }>) => {
      const { id, updates } = action.payload
      const index = state.history.findIndex(item => item.id === id)
      if (index !== -1) {
        state.history[index] = { ...state.history[index], ...updates }
      }
    },

    // 从本地状态删除历史记录项
    removeHistoryItem: (state, action: PayloadAction<string>) => {
      const index = state.history.findIndex(item => item.id === action.payload)
      if (index !== -1) {
        state.history.splice(index, 1)
        state.pagination.total--
      }
    },

    // 设置筛选条件
    setFilters: (state, action: PayloadAction<Partial<HistoryState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1 // 重置到第一页
    },

    // 设置搜索查询
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      state.pagination.page = 1
    },

    // 设置分页
    setPagination: (state, action: PayloadAction<Partial<HistoryState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },

    // 清除错误信息
    clearError: (state) => {
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      // 加载历史记录
      .addCase(loadHistory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.loading = false
        state.history = action.payload.data
        state.pagination.total = action.payload.total
      })
      .addCase(loadHistory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // 加载统计信息
      .addCase(loadStats.pending, (state) => {
        state.loading = true
      })
      .addCase(loadStats.fulfilled, (state, action) => {
        state.loading = false
        state.stats = action.payload
      })
      .addCase(loadStats.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // 删除历史记录项
      .addCase(deleteHistoryItem.fulfilled, (state, action) => {
        const index = state.history.findIndex(item => item.id === action.payload)
        if (index !== -1) {
          state.history.splice(index, 1)
          state.pagination.total--
        }
      })

      // 清空历史记录
      .addCase(clearHistory.fulfilled, (state) => {
        state.history = []
        state.pagination.total = 0
        state.stats = null
      })

      // 切换收藏状态
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        const index = state.history.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.history[index] = { ...state.history[index], ...action.payload }
        }
      })
  }
})

export const {
  addHistoryItem,
  updateHistoryItem,
  removeHistoryItem,
  setFilters,
  setSearchQuery,
  setPagination,
  clearError
} = historySlice.actions

export default historySlice.reducer