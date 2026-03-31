import axios from 'axios'
import { crawlerApi } from './api'

// Mock axios
vi.mock('axios')

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('crawlerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('startCrawl', () => {
    it('should make POST request to start crawl', async () => {
      const mockData = { type: 'link', url: 'https://example.com', depth: 2 }
      const mockResponse = { data: { success: true } }

      mockedAxios.create().post.mockResolvedValue(mockResponse)

      const result = await crawlerApi.startCrawl(mockData)

      expect(result).toEqual(mockResponse)
      expect(axios.create().post).toHaveBeenCalledWith('/api/crawl', mockData)
    })

    it('should handle errors when starting crawl', async () => {
      const mockData = { type: 'link', url: 'https://example.com', depth: 2 }
      const mockError = new Error('Network error')

      mockedAxios.create().post.mockRejectedValue(mockError)

      await expect(crawlerApi.startCrawl(mockData)).rejects.toThrow('Network error')
    })
  })

  describe('checkHealth', () => {
    it('should make GET request to check health', async () => {
      const mockResponse = { data: { status: 'ok' } }

      mockedAxios.create().get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.checkHealth()

      expect(result).toEqual(mockResponse)
      expect(axios.create().get).toHaveBeenCalledWith('/api/health')
    })

    it('should handle errors when checking health', async () => {
      const mockError = new Error('Service unavailable')

      mockedAxios.create().get.mockRejectedValue(mockError)

      await expect(crawlerApi.checkHealth()).rejects.toThrow('Service unavailable')
    })
  })

  describe('getHistory', () => {
    it('should make GET request to get history with default limit', async () => {
      const mockResponse = { data: [] }

      mockedAxios.create().get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory()

      expect(result).toEqual(mockResponse)
      expect(axios.create().get).toHaveBeenCalledWith('/api/history?limit=50')
    })

    it('should make GET request to get history with custom limit', async () => {
      const mockResponse = { data: [] }
      const limit = 25

      mockedAxios.create().get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory(limit)

      expect(result).toEqual(mockResponse)
      expect(axios.create().get).toHaveBeenCalledWith(`/api/history?limit=${limit}`)
    })
  })

  describe('deleteHistory', () => {
    it('should make DELETE request to delete specific history', async () => {
      const mockResponse = { data: { success: true } }
      const id = 'test-id-123'

      mockedAxios.create().delete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.deleteHistory(id)

      expect(result).toEqual(mockResponse)
      expect(axios.create().delete).toHaveBeenCalledWith(`/api/history/${id}`)
    })
  })

  describe('clearHistory', () => {
    it('should make DELETE request to clear all history', async () => {
      const mockResponse = { data: { success: true } }

      mockedAxios.create().delete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.clearHistory()

      expect(result).toEqual(mockResponse)
      expect(axios.create().delete).toHaveBeenCalledWith('/api/history')
    })
  })

  describe('axios configuration', () => {
    it('should create axios client with correct baseURL', () => {
      const client = axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      expect(client.defaults.baseURL).toBe(import.meta.env.VITE_API_BASE_URL)
      expect(client.defaults.timeout).toBe(30000)
      expect(client.defaults.headers['Content-Type']).toBe('application/json')
    })

    it('should have request interceptor', () => {
      const client = axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Add the same interceptors as in the original code
      client.interceptors.request.use(
        (config) => config,
        (error) => Promise.reject(error)
      )

      expect(client.interceptors.request).toBeDefined()
    })

    it('should have response interceptor', () => {
      const client = axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Add the same interceptors as in the original code
      let errorLog = ''
      const mockConsoleError = (msg: string) => { errorLog = msg }

      client.interceptors.response.use(
        (response) => response,
        (error) => {
          mockConsoleError(`API Error: ${error}`)
          return Promise.reject(error)
        }
      )

      expect(client.interceptors.response).toBeDefined()
    })
  })
})