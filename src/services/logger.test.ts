import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createLogger } from './logger'

describe('LoggerService (createLogger)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('creates instance with custom config', () => {
    const log = createLogger({ level: 'debug', enableConsole: true })
    expect(log).toBeDefined()
    expect(typeof log.debug).toBe('function')
  })

  it('debug returns a request id string', () => {
    const log = createLogger({ level: 'debug', enableConsole: true })
    const id = log.debug('hello', { a: 1 }, 'Ctx')
    expect(id).toMatch(/^req_\d+/)
  })

  it('getLogs returns queued entries after info', () => {
    const log = createLogger({ level: 'info', enableConsole: false, maxLogSize: 50 })
    log.info('msg')
    const logs = log.getLogs()
    expect(logs.length).toBeGreaterThanOrEqual(1)
    expect(logs.some((e) => e.message === 'msg')).toBe(true)
  })

  it('clearLogs empties queue', () => {
    const log = createLogger({ level: 'info', enableConsole: false })
    log.warn('w')
    log.clearLogs()
    expect(log.getLogs().length).toBe(0)
  })
})
