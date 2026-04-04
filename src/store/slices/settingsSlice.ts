/**
 * 系统设置状态管理 Slice
 * 负责管理系统配置、用户偏好设置等功能
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { settingsApi } from '../../services/settingsApi'

export interface SystemSettings {
  // 爬虫默认配置
  defaultCrawlerType: 'link' | 'content' | 'image'
  defaultDepth: number
  maxConcurrentRequests: number

  // 界面设置
  theme: 'light' | 'dark' | 'auto'
  language: string
  autoSave: boolean

  // 通知设置
  notifications: {
    enabled: boolean
    types: {
      crawlComplete: boolean
      crawlFailed: boolean
      systemUpdates: boolean
    }
  }

  // 性能设置
  performance: {
    cacheEnabled: boolean
    cacheTTL: number
    batchSize: number
  }
}

const initialSettings: SystemSettings = {
  defaultCrawlerType: 'link',
  defaultDepth: 2,
  maxConcurrentRequests: 5,

  theme: 'auto',
  language: 'zh-CN',
  autoSave: true,

  notifications: {
    enabled: true,
    types: {
      crawlComplete: true,
      crawlFailed: true,
      systemUpdates: false
    }
  },

  performance: {
    cacheEnabled: true,
    cacheTTL: 3600,
    batchSize: 100
  }
}

interface SettingsState {
  settings: SystemSettings
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

const initialState: SettingsState = {
  settings: initialSettings,
  loading: false,
  error: null,
  lastUpdated: null
}

// 异步Thunk - 加载设置
export const loadSettings = createAsyncThunk(
  'settings/loadSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await settingsApi.getSettings()
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '加载设置失败')
    }
  }
)

// 异步Thunk - 保存设置
export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: Partial<SystemSettings>, { rejectWithValue }) => {
    try {
      const response = await settingsApi.updateSettings(settings)
      return response.data
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '保存设置失败')
    }
  }
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // 更新单个设置项
    updateSetting: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload

      // 使用类型安全的更新方式
      if (key.includes('.')) {
        // 处理嵌套路径，如 'notifications.enabled'
        const keys = key.split('.')
        let current: any = state.settings
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]]
        }
        current[keys[keys.length - 1]] = value
      } else {
        // @ts-ignore - 动态属性赋值
        state.settings[key] = value
      }

      state.lastUpdated = Date.now()
    },

    // 批量更新设置
    updateSettings: (state, action: PayloadAction<Partial<SystemSettings>>) => {
      state.settings = { ...state.settings, ...action.payload }
      state.lastUpdated = Date.now()
    },

    // 重置设置为默认值
    resetSettings: (state) => {
      state.settings = initialSettings
      state.lastUpdated = Date.now()
    },

    // 清除错误信息
    clearError: (state) => {
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      // 加载设置
      .addCase(loadSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = { ...state.settings, ...action.payload }
        state.lastUpdated = Date.now()
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // 保存设置
      .addCase(saveSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = { ...state.settings, ...action.payload }
        state.lastUpdated = Date.now()
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  }
})

export const { updateSetting, updateSettings, resetSettings, clearError } = settingsSlice.actions
export default settingsSlice.reducer