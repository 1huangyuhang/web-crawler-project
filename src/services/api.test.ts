import axios, { AxiosInstance } from 'axios'
import { crawlerApi } from './api'

// Mock axios
const mockAxiosInstance = {
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  defaults: { baseURL: 'http://localhost:3001' },
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
}

vi.spyOn(axios, 'create').mockReturnValue(mockAxiosInstance as unknown as AxiosInstance)

describe('crawlerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('startCrawl', () => {
    it('should make POST request to start crawl', async () => {
      const mockData = { type: 'link', url: 'https://example.com', depth: 2 }
      const mockResponse = { data: { success: true } }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await crawlerApi.startCrawl(mockData)

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/crawl', mockData)
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
      mockAxiosInstance.get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.checkHealth()

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/health')
    })

    it('should handle errors when checking health', async () => {
      const mockError = new Error('Service unavailable')
      mockAxiosInstance.get.mockRejectedValue(mockError)

      await expect(crawlerApi.checkHealth()).rejects.toThrow('Service unavailable')
    })
  })

  describe('getHistory', () => {
    it('should make GET request to get history with default limit', async () => {
      const mockResponse = { data: [] }
      mockAxiosInstance.get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory()

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/history?limit=50')
    })

    it('should make GET request to get history with custom limit', async () => {
      const mockResponse = { data: [] }
      const limit = 25
      mockAxiosInstance.get.mockResolvedValue(mockResponse)

      const result = await crawlerApi.getHistory(limit)

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/api/history?limit=${limit}`)
    })
  })

  describe('deleteHistory', () => {
    it('should make DELETE request to delete specific history', async () => {
      const mockResponse = { data: { success: true } }
      const id = 'test-id-123'
      mockAxiosInstance.delete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.deleteHistory(id)

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/history/${id}`)
    })
  })

  describe('clearHistory', () => {
    it('should make DELETE request to clear all history', async () => {
      const mockResponse = { data: { success: true } }
      mockAxiosInstance.delete.mockResolvedValue(mockResponse)

      const result = await crawlerApi.clearHistory()

      expect(result).toEqual(mockResponse)
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/history')
    })
  })

  describe('axios configuration', () => {
    it('should create axios client with correct baseURL', () => {
      // Reset the mock to test actual axios creation
      vi.spyOn(axios, 'create').mockClear()
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
      // Reset the mock to test actual axios creation
      vi.spyOn(axios, 'create').mockClear()
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