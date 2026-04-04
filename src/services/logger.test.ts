import { logger, createLogger, LogEntry, LoggerConfig } from './logger'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

global.localStorage = localStorageMock as any

// Mock fetch
global.fetch = vi.fn()

// Mock logger for each test
let mockLoggerInstance: any
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    generateRequestId: vi.fn().mockReturnValue('test-request-id'),
    getLogs: vi.fn().mockReturnValue([]),
    clearLogs: vi.fn(),
    setUserId: vi.fn(),
    setUserSession: vi.fn(),
    clearUserInfo: vi.fn(),
    destroy: vi.fn(),
    updateConfig: vi.fn(),
    flush: vi.fn(),
    setContext: vi.fn()
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    generateRequestId: vi.fn().mockReturnValue('test-request-id'),
    getLogs: vi.fn().mockReturnValue([]),
    clearLogs: vi.fn(),
    setUserId: vi.fn(),
    setUserSession: vi.fn(),
    clearUserInfo: vi.fn(),
    destroy: vi.fn(),
    updateConfig: vi.fn(),
    flush: vi.fn(),
    setContext: vi.fn()
  }))
}))

describe('LoggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('constructor', () => {
    it('should create logger with default config', () => {
      const logger = new (logger.constructor as any)()
      expect(logger).toBeDefined()
    })

    it('should create logger with custom config', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: false,
        enableFile: true,
        enableRemote: true,
        remoteEndpoint: '/custom/logs',
        maxLogSize: 500,
        flushInterval: 2000
      }

      const customLogger = createLogger(config)

      expect(customLogger).toBeDefined()
    })
  })

  describe('log levels', () => {
    it('should log debug message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const requestId = logger.debug('Debug message', { test: 'data' }, 'TestContext')

      expect(requestId).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String))

      consoleSpy.mockRestore()
    })

    it('should log info message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const requestId = logger.info('Info message', { test: 'data' }, 'TestContext')

      expect(requestId).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should log warn message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const requestId = logger.warn('Warn message', { test: 'data' }, 'TestContext')

      expect(requestId).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should log error message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const error = new Error('Test error')
      const requestId = logger.error('Error message', error, { test: 'data' }, 'TestContext')

      expect(requestId).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should not log debug messages when level is info', () => {
      const customLogger = createLogger({ level: 'info' })
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      customLogger.debug('Debug message', { test: 'data' }, 'TestContext')

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('requestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = logger.info('Message 1')
      const id2 = logger.info('Message 2')
      const id3 = logger.info('Message 3')

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should include requestId in log entry', () => {
      const requestId = logger.info('Test message')
      const logs = logger.getLogs()

      const lastLog = logs[logs.length - 1]
      expect(lastLog.requestId).toBe(requestId)
    })
  })

  describe('context', () => {
    it('should include context in log entry', () => {
      logger.info('Test message', undefined, 'MyContext')
      const logs = logger.getLogs()

      const lastLog = logs[logs.length - 1]
      expect(lastLog.context).toBe('MyContext')
    })
  })

  describe('userId', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('test-user-id')
    })

    it('should include userId from localStorage', () => {
      logger.info('Test message')
      const logs = logger.getLogs()

      const lastLog = logs[logs.length - 1]
      expect(lastLog.userId).toBe('test-user-id')
    })

    it('should handle missing userId', () => {
      localStorageMock.getItem.mockReturnValue(null)
      logger.info('Test message')
      const logs = logger.getLogs()

      const lastLog = logs[logs.length - 1]
      expect(lastLog.userId).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should log error with stack trace', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const error = new Error('Test error')
      error.stack = 'Error stack trace'

      logger.error('Error message', error)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error stack trace'))

      consoleSpy.mockRestore()
    })

    it('should handle non-Error objects', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      logger.error('Error message', 'string error')
      expect(consoleSpy).toHaveBeenCalled()

      logger.error('Error message', { custom: 'error object' })
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('localStorage integration', () => {
    it('should set userId', () => {
      logger.setUserId('new-user-id')
      expect(localStorage.setItem).toHaveBeenCalledWith('userId', 'new-user-id')
    })

    it('should set user session', () => {
      const session = { userId: 'session-user', token: 'abc123' }
      logger.setUserSession(session)

      expect(localStorage.setItem).toHaveBeenCalledWith('userSession', JSON.stringify(session))
      expect(localStorage.setItem).toHaveBeenCalledWith('userId', 'session-user')
    })

    it('should clear user info', () => {
      logger.clearUserInfo()

      expect(localStorage.removeItem).toHaveBeenCalledWith('userId')
      expect(localStorage.removeItem).toHaveBeenCalledWith('userSession')
    })
  })

  describe('log queue', () => {
    it('should store logs in queue', () => {
      logger.info('Message 1')
      logger.info('Message 2')
      logger.warn('Message 3')
      logger.error('Message 4')

      const allLogs = logger.getLogs()
      expect(allLogs.length).toBe(4)

      const infoLogs = logger.getLogs('info')
      expect(infoLogs.length).toBe(2)

      const warnLogs = logger.getLogs('warn')
      expect(warnLogs.length).toBe(1)

      const errorLogs = logger.getLogs('error')
      expect(errorLogs.length).toBe(1)
    })

    it('should limit queue size', () => {
      const customLogger = createLogger({ maxLogSize: 3 })

      for (let i = 0; i < 5; i++) {
        customLogger.info(`Message ${i}`)
      }

      const logs = customLogger.getLogs()
      expect(logs.length).toBe(3)
      expect(logs[0].message).toBe('Message 2') // 前两个应该被移除
      expect(logs[2].message).toBe('Message 4')
    })

    it('should clear logs', () => {
      logger.info('Message 1')
      logger.clearLogs()

      const logs = logger.getLogs()
      expect(logs.length).toBe(0)
    })
  })

  describe('flush logs', () => {
    it('should flush logs to remote', async () => {
      const customLogger = createLogger({
        enableRemote: true,
        remoteEndpoint: '/api/logs'
      })

      customLogger.info('Test message')
      await customLogger.flush()

      expect(fetch).toHaveBeenCalledWith('/api/logs/batch', expect.any(Object))
    })

    it('should save logs to file when enabled', async () => {
      const createObjectURLMock = vi.fn()
      const revokeObjectURLMock = vi.fn()
      const clickMock = vi.fn()

      global.URL.createObjectURL = createObjectURLMock
      global.URL.revokeObjectURL = revokeObjectURLMock
      global.document.createElement = vi.fn().mockReturnValue({
        click: clickMock,
        href: 'blob:url',
        download: 'test.json'
      })

      const customLogger = createLogger({
        enableFile: true
      })

      customLogger.info('Test message')
      await customLogger.flush()

      expect(createObjectURLMock).toHaveBeenCalled()
      expect(clickMock).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalled()

      // Cleanup
      global.URL.createObjectURL = URL.createObjectURL
      global.URL.revokeObjectURL = URL.revokeObjectURL
    })
  })

  describe('global error handling', () => {
    it('should handle unhandled promise rejection', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      // Create and dispatch unhandledrejection event
      const event = new Event('unhandledrejection')
      ;(event as any).reason = new Error('Unhandled promise error')
      window.dispatchEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未处理的Promise拒绝'))

      consoleSpy.mockRestore()
    })

    it('should handle uncaught errors', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      // Create and dispatch error event
      const event = new ErrorEvent('error', {
        message: 'Uncaught error',
        error: new Error('Test uncaught error')
      })
      window.dispatchEvent(event)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未捕获的JavaScript错误'))

      consoleSpy.mockRestore()
    })
  })

  describe('destroy', () => {
    it('should flush logs and clear timer on destroy', async () => {
      const customLogger = createLogger({
        enableRemote: true,
        flushInterval: 1000
      })

      customLogger.info('Test message before destroy')
      customLogger.destroy()

      // Wait a bit for flush to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(fetch).toHaveBeenCalled()
    })
  })
})

describe('logger default instance', () => {
  it('should have default configuration', () => {
    expect(logger).toBeDefined()
    const logs = logger.getLogs()
    expect(Array.isArray(logs)).toBe(true)
  })

  it('should generate request IDs', () => {
    const id1 = logger.info('Test 1')
    const id2 = logger.info('Test 2')

    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^req_/)
    expect(id2).toMatch(/^req_/)
  })
})