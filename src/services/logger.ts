/**
 * 基础日志服务
 * 提供结构化的日志记录和错误追踪功能
 */

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data?: any
  error?: Error
  requestId?: string
  userId?: string
  context?: string
}

export interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error'
  enableConsole?: boolean
  enableFile?: boolean
  enableRemote?: boolean
  remoteEndpoint?: string
  maxLogSize?: number
  flushInterval?: number
}

class LoggerService {
  private config: Required<LoggerConfig>
  private logQueue: LogEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private requestIdCounter = 0

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || 'info',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile || false,
      enableRemote: config.enableRemote || false,
      remoteEndpoint: config.remoteEndpoint || '/api/logs',
      maxLogSize: config.maxLogSize || 1000,
      flushInterval: config.flushInterval || 5000
    }

    this.setupFlushTimer()
    this.setupErrorHandling()
  }

  /**
   * 生成唯一的请求ID
   */
  generateRequestId(): string {
    this.requestIdCounter++
    return `req_${Date.now()}_${this.requestIdCounter}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 设置全局上下文
   */
  setContext(context: string) {
    this.config.level = context as any
  }

  /**
   * 调试级别日志
   */
  debug(message: string, data?: any, context?: string): string {
    return this.log('debug', message, data, context)
  }

  /**
   * 信息级别日志
   */
  info(message: string, data?: any, context?: string): string {
    return this.log('info', message, data, context)
  }

  /**
   * 警告级别日志
   */
  warn(message: string, data?: any, context?: string): string {
    return this.log('warn', message, data, context)
  }

  /**
   * 错误级别日志
   */
  error(message: string, error?: Error | any, data?: any, context?: string): string {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    return this.log('error', message, data, context, errorObj)
  }

  /**
   * 核心日志方法
   */
  private log(
    level: LogEntry['level'],
    message: string,
    data?: any,
    context?: string,
    error?: Error
  ): string {
    const requestId = this.generateRequestId()
    const timestamp = Date.now()

    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      data,
      error,
      requestId,
      context,
      userId: this.getUserId()
    }

    // 添加到队列
    this.logQueue.push(logEntry)

    // 限制队列大小
    if (this.logQueue.length > this.config.maxLogSize) {
      this.logQueue.shift()
    }

    // 立即处理日志
    this.processLog(logEntry)

    // 如果错误级别，触发错误上报
    if (level === 'error' && this.config.enableRemote) {
      this.reportError(logEntry)
    }

    return requestId
  }

  /**
   * 处理日志输出
   */
  private processLog(entry: LogEntry) {
    const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 }
    const currentLevelOrder = levelOrder[this.config.level]
    const entryLevelOrder = levelOrder[entry.level]

    // 如果当前日志级别低于配置的级别，不输出
    if (entryLevelOrder < currentLevelOrder) {
      return
    }

    const formattedMessage = this.formatLogEntry(entry)

    // 控制台输出
    if (this.config.enableConsole) {
      this.consoleLog(entry.level, formattedMessage, entry.data)
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString()
    const levelStr = entry.level.toUpperCase().padEnd(5, ' ')
    const requestIdStr = entry.requestId ? `[${entry.requestId}]` : ''
    const contextStr = entry.context ? `[${entry.context}]` : ''
    const userIdStr = entry.userId ? `[用户:${entry.userId}]` : ''

    let message = `${timestamp} ${levelStr} ${requestIdStr}${contextStr}${userIdStr} ${entry.message}`

    if (entry.error) {
      message += `\n错误详情: ${entry.error.message}`
      if (entry.error.stack) {
        message += `\n堆栈: ${entry.error.stack}`
      }
    }

    return message
  }

  /**
   * 控制台日志输出
   */
  private consoleLog(level: LogEntry['level'], message: string, data?: any) {
    const styles = {
      debug: 'color: #6c757d',
      info: 'color: #17a2b8',
      warn: 'color: #ffc107',
      error: 'color: #dc3545'
    }

    console.log(`%c${message}`, styles[level])

    if (data !== undefined) {
      console.log('%c附加数据:', 'color: #6610f2', data)
    }
  }

  /**
   * 获取用户ID（从localStorage或其他存储）
   */
  private getUserId(): string | undefined {
    try {
      // 从localStorage获取用户ID
      const userId = localStorage.getItem('userId')
      if (userId) return userId

      // 从session获取
      const sessionData = localStorage.getItem('userSession')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        return session.userId
      }
    } catch (error) {
      console.warn('获取用户ID失败:', error)
    }
    return undefined
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string) {
    try {
      localStorage.setItem('userId', userId)
    } catch (error) {
      console.warn('设置用户ID失败:', error)
    }
  }

  /**
   * 设置用户会话
   */
  setUserSession(session: { userId: string; [key: string]: any }) {
    try {
      localStorage.setItem('userSession', JSON.stringify(session))
      this.setUserId(session.userId)
    } catch (error) {
      console.warn('设置用户会话失败:', error)
    }
  }

  /**
   * 清除用户信息
   */
  clearUserInfo() {
    try {
      localStorage.removeItem('userId')
      localStorage.removeItem('userSession')
    } catch (error) {
      console.warn('清除用户信息失败:', error)
    }
  }

  /**
   * 上报错误到远程服务器
   */
  private async reportError(entry: LogEntry) {
    try {
      const errorData = {
        timestamp: entry.timestamp,
        requestId: entry.requestId,
        level: entry.level,
        message: entry.message,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name
        } : undefined,
        data: entry.data,
        context: entry.context,
        userId: entry.userId,
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      // 发送到后端
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      })
    } catch (error) {
      console.error('上报错误失败:', error)
    }
  }

  /**
   * 批量上报日志
   */
  private async flushLogs() {
    if (this.logQueue.length === 0) return

    const logsToFlush = [...this.logQueue]
    this.logQueue = []

    if (this.config.enableRemote) {
      try {
        await fetch(`${this.config.remoteEndpoint}/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            logs: logsToFlush,
            timestamp: Date.now()
          })
        })
      } catch (error) {
        console.error('批量上报日志失败:', error)
        // 如果失败，将日志重新加入队列
        this.logQueue.unshift(...logsToFlush)
      }
    }

    // 本地存储（如果启用）
    if (this.config.enableFile) {
      this.saveLogsToFile(logsToFlush)
    }
  }

  /**
   * 保存日志到本地文件
   */
  private saveLogsToFile(logs: LogEntry[]) {
    try {
      const logData = logs.map(entry => ({
        ...entry,
        formatted: this.formatLogEntry(entry)
      }))

      // 创建下载链接
      const blob = new Blob([JSON.stringify(logData, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)

      // 创建下载链接
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${new Date().toISOString().split('T')[0]}.json`
      a.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('保存日志到文件失败:', error)
    }
  }

  /**
   * 设置定时刷新
   */
  private setupFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      this.flushLogs()
    }, this.config.flushInterval)
  }

  /**
   * 设置全局错误处理
   */
  private setupErrorHandling() {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason
      this.error('未处理的Promise拒绝', error, {
        promise: event.promise ? 'Promise对象' : undefined
      }, 'Global')
    })

    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      this.error('未捕获的JavaScript错误', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, 'Global')
    })

    // 捕获资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as HTMLElement).nodeType === 1) {
        // 资源加载错误
        const target = event.target as HTMLElement
        this.warn('资源加载失败', {
          tagName: target.tagName,
          src: (target as any).src || (target as any).href,
          outerHTML: target.outerHTML
        }, 'Resource')
      }
    }, true)
  }

  /**
   * 获取日志队列
   */
  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logQueue.filter(entry => entry.level === level)
    }
    return [...this.logQueue]
  }

  /**
   * 清除日志
   */
  clearLogs() {
    this.logQueue = []
  }

  /**
   * 手动刷新日志
   */
  flush() {
    this.flushLogs()
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.setupFlushTimer()
  }

  /**
   * 销毁logger
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flushLogs()
  }
}

// 导出默认实例
export const logger = new LoggerService({
  level: 'info',
  enableConsole: true,
  enableFile: false,
  enableRemote: false,
  maxLogSize: 1000,
  flushInterval: 5000
})

// 导出工厂函数
export const createLogger = (config: LoggerConfig) => {
  return new LoggerService(config)
}