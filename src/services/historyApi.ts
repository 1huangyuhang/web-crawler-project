/**
 * 爬取历史 API（与 historySlice 及后端 successResponse 对齐）
 */

import apiClient from './api'
import type { CrawlHistoryItem, HistoryStats } from '../store/slices/historySlice'

interface ApiEnvelope<T> {
  success: boolean
  code: number
  message: string
  data: T
  timestamp?: string
}

function mapRowToItem(r: Record<string, unknown>): CrawlHistoryItem {
  const statusRaw = String(r.status ?? 'completed').toLowerCase()
  const status: CrawlHistoryItem['status'] =
    statusRaw === 'failed' ? 'failed' : statusRaw === 'running' ? 'running' : 'completed'
  const typeRaw = String(r.type ?? 'link').toLowerCase()
  const type: CrawlHistoryItem['type'] = ['link', 'content', 'image'].includes(typeRaw)
    ? (typeRaw as CrawlHistoryItem['type'])
    : 'link'

  return {
    id: String(r.id),
    timestamp: typeof r.timestamp === 'number' ? r.timestamp : Date.now(),
    url: String(r.url ?? ''),
    type,
    depth: typeof r.depth === 'number' ? r.depth : 1,
    items: typeof r.items === 'number' ? r.items : 0,
    time: typeof r.time === 'number' ? r.time : 0,
    status,
    error: r.error != null ? String(r.error) : undefined,
    favorite: Boolean(r.favorite)
  }
}

export const historyApi = {
  async getHistory(params: {
    page: number
    limit: number
    type?: string
    status?: CrawlHistoryItem['status']
    favorite?: boolean
  }) {
    const res = await apiClient.get<ApiEnvelope<Record<string, unknown>[]>>(`/api/history`, {
      params: { limit: Math.min(1000, Math.max(100, params.limit * params.page + 100)) }
    })
    let rows = (res.data.data || []).map(mapRowToItem)
    if (params.type) {
      rows = rows.filter((i) => i.type === params.type)
    }
    if (params.status) {
      rows = rows.filter((i) => i.status === params.status)
    }
    if (params.favorite === true) {
      rows = rows.filter((i) => i.favorite)
    }
    const total = rows.length
    const start = (params.page - 1) * params.limit
    const pageItems = rows.slice(start, start + params.limit)
    return {
      data: pageItems,
      headers: { 'x-total-count': String(total) }
    }
  },

  async getStats() {
    const res = await apiClient.get<ApiEnvelope<HistoryStats>>('/api/history/stats')
    return { data: res.data.data }
  },

  deleteHistory: (id: string) => apiClient.delete(`/api/history/${id}`),

  clearHistory: () => apiClient.delete('/api/history'),

  async updateHistory(id: string, updates: Partial<Pick<CrawlHistoryItem, 'favorite' | 'notes' | 'tags'>>) {
    const res = await apiClient.patch<ApiEnvelope<CrawlHistoryItem>>(`/api/history/${id}`, updates)
    return { data: res.data.data }
  }
}
