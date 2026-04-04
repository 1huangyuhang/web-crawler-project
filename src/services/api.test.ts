/**
 * crawlerApi 单元测试：在 import api 之前用 vi.mock 替换 axios.create，避免真实 XHR。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

const { mockPost, mockGet, mockDelete, buildClient } = vi.hoisted(() => {
  const mockPost = vi.fn()
  const mockGet = vi.fn()
  const mockDelete = vi.fn()
  const buildClient = () =>
    ({
      post: mockPost,
      get: mockGet,
      delete: mockDelete,
      defaults: { baseURL: '' },
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    }) as unknown as AxiosInstance
  return { mockPost, mockGet, mockDelete, buildClient }
})

vi.mock('../config/api', () => ({ getApiBaseUrl: () => '' }))

vi.mock('./logger', () => ({
  logger: {
    generateRequestId: vi.fn(() => 'test-req-id'),
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => buildClient()),
  },
}))

import { crawlerApi } from './api'

describe('crawlerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.mockReset()
    mockGet.mockReset()
    mockDelete.mockReset()
  })

  describe('startCrawl', () => {
    it('should make POST request to start crawl', async () => {
      const mockData = { type: 'link', url: 'https://example.com', depth: 2 }
      const mockResponse = { data: { success: true } }
      mockPost.mockResolvedValue(mockResponse)

      const result = await crawlerApi.startCrawl(mockData)

      expect(result).toEqual(mockResponse)
      expect(mockPost).toHaveBeenCalledWith('/api/crawl', mockData)
    })

    it('should handle errors when starting crawl', async () => {
      const mockData = { type: 'link', url: 'https://example.com', depth: 2 }
      mockPost.mockRejectedValue(new Error('Network error'))

      await expect(crawlerApi.startCrawl(mockData)).rejects.toThrow('Network error')
    })
  })

  describe('checkHealth', () => {
    it('should make GET request to check health', async () => {
      const mockResponse = { data: { status: 'ok' } }
      mockGet.mockResolvedValue(mockResponse)

      const result = await crawlerApi.checkHealth()

      expect(result).toEqual(mockResponse)
      expect(mockGet).toHaveBeenCalledWith('/api/health', { timeout: 5000 })
    })

    it('should handle errors when checking health', async () => {
      mockGet.mockRejectedValue(new Error('Service unavailable'))

      await expect(crawlerApi.checkHealth()).rejects.toThrow('Service unavailable')
    })
  })

  describe('getHistory', () => {
    it('should make GET request to get history with default limit', async () => {
      const mockResponse = { data: [] }
      mockGet.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory()

      expect(result).toEqual(mockResponse)
      expect(mockGet).toHaveBeenCalledWith('/api/history?limit=50')
    })

    it('should make GET request to get history with custom limit', async () => {
      const mockResponse = { data: [] }
      const limit = 25
      mockGet.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory(limit)

      expect(result).toEqual(mockResponse)
      expect(mockGet).toHaveBeenCalledWith(`/api/history?limit=${limit}`)
    })
  })

  describe('deleteHistory', () => {
    it('should make DELETE request to delete specific history', async () => {
      const mockResponse = { data: { success: true } }
      const id = 'test-id-123'
      mockDelete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.deleteHistory(id)

      expect(result).toEqual(mockResponse)
      expect(mockDelete).toHaveBeenCalledWith(`/api/history/${id}`)
    })
  })

  describe('clearHistory', () => {
    it('should make DELETE request to clear all history', async () => {
      const mockResponse = { data: { success: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.clearHistory()

      expect(result).toEqual(mockResponse)
      expect(mockDelete).toHaveBeenCalledWith('/api/history')
    })
  })
})
