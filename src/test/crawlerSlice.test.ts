/**
 * Redux slice 测试 - crawlerSlice
 * 测试爬虫状态管理的所有功能
 */

import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, beforeEach } from 'vitest'
import { crawlerSlice, startCrawling, checkServiceHealth, updateConfig, resetCrawler } from '../store/slices/crawlerSlice'
import { crawlerApi } from '../services/api'


// Mock API
vi.mock('../services/api', () => ({
  crawlerApi: {
    startCrawl: vi.fn(),
    checkHealth: vi.fn()
  }
}))


describe('crawlerSlice', () => {
  const initialState = {
    config: {
      type: 'link' as const,
      url: '',
      depth: 2
    },
    status: 'idle' as const,
    currentCrawl: null,
    history: [],
    progress: 0,
    serviceStatus: 'checking' as const
  }

  describe('reducers', () => {
    it('should handle updateConfig', () => {
      const state = { ...initialState }
      const action = updateConfig({ type: 'content', url: 'https://example.com' })

      const newState = crawlerSlice.reducer(state, action)

      expect(newState.config.type).toBe('content')
      expect(newState.config.url).toBe('https://example.com')
      expect(localStorage.setItem).toHaveBeenCalledWith('crawlerType', 'content')
      expect(localStorage.setItem).toHaveBeenCalledWith('crawlerTargetUrl', 'https://example.com')
    })

    it('should handle resetCrawler', () => {
      const state = {
        ...initialState,
        status: 'completed' as const,
        progress: 100,
        currentCrawl: {
          id: 'test-id',
          type: 'link' as const,
          url: 'https://example.com',
          depth: 2,
          status: 'completed' as const,
          progress: 100
        }
      }

      const action = resetCrawler()
      const newState = crawlerSlice.reducer(state, action)

      expect(newState.status).toBe('idle')
      expect(newState.progress).toBe(0)
      expect(newState.currentCrawl).toBeNull()
    })
  })

  describe('async thunks', () => {
    let store: any

    beforeEach(() => {
      store = configureStore({
        reducer: {
          crawler: crawlerSlice.reducer
        }
      })
    })

    it('should handle startCrawling.pending', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'link' as const,
          url: 'https://example.com',
          depth: 2,
          status: 'running' as const,
          progress: 0
        }
      }

      ;(crawlerApi.startCrawl as any).mockResolvedValue(mockResponse)

      const action = startCrawling({
        type: 'link',
        url: 'https://example.com',
        depth: 2
      })

      await store.dispatch(action)

      const state = store.getState().crawler

      expect(state.status).toBe('running')
      expect(state.progress).toBe(0)
    })

    it('should handle startCrawling.fulfilled', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'link' as const,
          url: 'https://example.com',
          depth: 2,
          status: 'completed' as const,
          progress: 100
        }
      }

      ;(crawlerApi.startCrawl as any).mockResolvedValue(mockResponse)

      const action = startCrawling({
        type: 'link',
        url: 'https://example.com',
        depth: 2
      })

      await store.dispatch(action)

      const state = store.getState().crawler

      expect(state.status).toBe('completed')
      expect(state.progress).toBe(100)
      expect(state.currentCrawl).toEqual(mockResponse.data)
      expect(state.history).toContainEqual(mockResponse.data)
    })

    it('should handle startCrawling.rejected', async () => {
      const mockError = new Error('Crawling failed')

      ;(crawlerApi.startCrawl as any).mockRejectedValue(mockError)

      const action = startCrawling({
        type: 'link',
        url: 'https://example.com',
        depth: 2
      })

      await store.dispatch(action)

      const state = store.getState().crawler

      expect(state.status).toBe('error')
      expect(state.currentCrawl).not.toBeNull()
      expect(state.currentCrawl?.error).toBe('Crawling failed')
    })

    it('should handle checkServiceHealth', async () => {
      ;(crawlerApi.checkHealth as any).mockResolvedValue({})

      const action = checkServiceHealth()
      await store.dispatch(action)

      const state = store.getState().crawler

      expect(state.serviceStatus).toBe('available')
    })

    it('should handle checkServiceHealth failure', async () => {
      ;(crawlerApi.checkHealth as any).mockRejectedValue(new Error('Service unavailable'))

      const action = checkServiceHealth()
      await store.dispatch(action)

      const state = store.getState().crawler

      expect(state.serviceStatus).toBe('unavailable')
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = crawlerSlice.getInitialState()

      expect(state.status).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.currentCrawl).toBeNull()
      expect(state.history).toEqual([])
      expect(state.serviceStatus).toBe('checking')
    })

    it('should load config from localStorage', () => {
      localStorage.setItem('crawlerTargetUrl', 'https://example.com')
      localStorage.setItem('crawlerDepth', '3')

      const state = crawlerSlice.getInitialState()

      expect(state.config.url).toBe('https://example.com')
      expect(state.config.depth).toBe(3)
    })
  })
})


describe('crawlerSlice integration', () => {
  let store: any

  beforeEach(() => {
    store = configureStore({
      reducer: {
        crawler: crawlerSlice.reducer
      }
    })

    // Clear localStorage
    localStorage.clear()
  })

  it('should handle full crawl workflow', async () => {
    // Initial state
    let state = store.getState().crawler
    expect(state.status).toBe('idle')

    // Update config
    store.dispatch(updateConfig({ type: 'content', url: 'https://example.com', depth: 2 }))
    state = store.getState().crawler
    expect(state.config.type).toBe('content')
    expect(state.config.url).toBe('https://example.com')

    // Start crawling
    const mockResponse = {
      data: {
        id: 'test-id',
        type: 'content' as const,
        url: 'https://example.com',
        depth: 2,
        status: 'completed' as const,
        progress: 100,
        items: 50,
        time: 10.5
      }
    }

    ;(crawlerApi.startCrawl as any).mockResolvedValue(mockResponse)

    const crawlAction = startCrawling({
      type: 'content',
      url: 'https://example.com',
      depth: 2
    })

    await store.dispatch(crawlAction)

    state = store.getState().crawler
    expect(state.status).toBe('completed')
    expect(state.currentCrawl).toEqual(mockResponse.data)
    expect(state.history.length).toBe(1)

    // Reset
    store.dispatch(resetCrawler())
    state = store.getState().crawler
    expect(state.status).toBe('idle')
    expect(state.currentCrawl).toBeNull()
  })
})