import { vi, describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import crawlerReducer, {
  updateConfig,
  resetCrawler,
  updateProgress,
  startCrawling,
  checkServiceHealth,
  initialState,
  CrawlerConfig
} from './crawlerSlice'
import { crawlerApi } from '../../services/api'

// Mock the API
vi.mock('../../services/api')

describe('crawlerSlice', () => {
  describe('reducers', () => {
    it('should handle updateConfig', () => {
      const newConfig: Partial<CrawlerConfig> = {
        type: 'content',
        url: 'https://example.com',
        depth: 3
      }

      const state = crawlerReducer(initialState, updateConfig(newConfig))

      expect(state.config.type).toBe('content')
      expect(state.config.url).toBe('https://example.com')
      expect(state.config.depth).toBe(3)
      expect(localStorage.getItem('crawlerType')).toBe('content')
      expect(localStorage.getItem('crawlerTargetUrl')).toBe('https://example.com')
      expect(localStorage.getItem('crawlerDepth')).toBe('3')
    })

    it('should handle resetCrawler', () => {
      const modifiedState = {
        ...initialState,
        status: 'running' as const,
        progress: 50,
        currentCrawl: {
          id: 'test-id',
          timestamp: Date.now(),
          status: 'running' as const,
          items: 0,
          time: 0,
          progress: 50
        } as any
      }

      const state = crawlerReducer(modifiedState, resetCrawler())

      expect(state.status).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.currentCrawl).toBeNull()
    })

    it('should handle updateProgress', () => {
      const modifiedState = {
        ...initialState,
        currentCrawl: {
          id: 'test-id',
          timestamp: Date.now(),
          status: 'running' as const,
          items: 0,
          time: 0,
          progress: 0
        } as any
      }

      const state = crawlerReducer(modifiedState, updateProgress(75))

      expect(state.progress).toBe(75)
      expect(state.currentCrawl?.progress).toBe(75)
    })
  })

  describe('async thunks', () => {
    it('should handle startCrawling.pending', () => {
      const action = { type: startCrawling.pending.type }
      const state = crawlerReducer(initialState, action)

      expect(state.status).toBe('running')
      expect(state.progress).toBe(0)
    })

    it('should handle startCrawling.fulfilled', () => {
      const crawlData = {
        id: 'crawl_123',
        timestamp: Date.now(),
        status: 'completed' as const,
        items: 100,
        time: 5000,
        data: [],
        progress: 100
      }

      const action = {
        type: startCrawling.fulfilled.type,
        payload: crawlData
      }
      const state = crawlerReducer(initialState, action)

      expect(state.status).toBe('completed')
      expect(state.progress).toBe(100)
      expect(state.currentCrawl).toEqual(crawlData)
      expect(state.history[0]).toEqual(crawlData)
    })

    it('should handle startCrawling.rejected', () => {
      const action = {
        type: startCrawling.rejected.type,
        error: { message: 'Network error' }
      }
      const state = crawlerReducer(initialState, action)

      expect(state.status).toBe('error')
      expect(state.currentCrawl).toBeDefined()
      expect(state.currentCrawl?.error).toBe('Network error')
      expect(state.currentCrawl?.status).toBe('failed')
    })

    it('should handle checkServiceHealth.pending', () => {
      const action = { type: checkServiceHealth.pending.type }
      const state = crawlerReducer(initialState, action)

      expect(state.serviceStatus).toBe('checking')
    })

    it('should handle checkServiceHealth.fulfilled with true', () => {
      const action = {
        type: checkServiceHealth.fulfilled.type,
        payload: true
      }
      const state = crawlerReducer(initialState, action)

      expect(state.serviceStatus).toBe('available')
    })

    it('should handle checkServiceHealth.fulfilled with false', () => {
      const action = {
        type: checkServiceHealth.fulfilled.type,
        payload: false
      }
      const state = crawlerReducer(initialState, action)

      expect(state.serviceStatus).toBe('unavailable')
    })
  })

  describe('integration tests', () => {
    let store: any

    beforeEach(() => {
      store = configureStore({
        reducer: {
          crawler: crawlerReducer
        }
      })
    })

    it('should update config and store in localStorage', () => {
      const newConfig: Partial<CrawlerConfig> = {
        type: 'image',
        url: 'https://test.com',
        depth: 2
      }

      store.dispatch(updateConfig(newConfig))

      expect(store.getState().crawler.config.type).toBe('image')
      expect(store.getState().crawler.config.url).toBe('https://test.com')
      expect(store.getState().crawler.config.depth).toBe(2)

      expect(localStorage.getItem('crawlerType')).toBe('image')
      expect(localStorage.getItem('crawlerTargetUrl')).toBe('https://test.com')
      expect(localStorage.getItem('crawlerDepth')).toBe('2')
    })
  })
})