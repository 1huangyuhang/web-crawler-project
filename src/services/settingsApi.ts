/**
 * 系统设置 API（与后端 successResponse 对齐）
 */

import apiClient from './api'
import type { SystemSettings } from '../store/slices/settingsSlice'

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

export const settingsApi = {
  getSettings: () => unwrap(apiClient.get<ApiEnvelope<SystemSettings>>('/api/settings')),

  updateSettings: (partial: Partial<SystemSettings>) =>
    unwrap(apiClient.put<ApiEnvelope<SystemSettings>>('/api/settings', partial))
}
