/**
 * Prisma 连接池配置
 * 提供数据库连接池优化和监控配置
 */

module.exports = {
  pool: {
    max: process.env.DB_POOL_MAX || 20,           // 最大连接数
    min: process.env.DB_POOL_MIN || 5,            // 最小连接数
    acquireTimeout: process.env.DB_ACQUIRE_TIMEOUT || 30000,  // 获取连接超时时间(ms)
    idleTimeout: process.env.DB_IDLE_TIMEOUT || 10000,        // 空闲连接超时时间(ms)
    reapInterval: process.env.DB_REAP_INTERVAL || 1000,       // 清理间隔(ms)
  },

  monitoring: {
    enabled: process.env.NODE_ENV === 'development',  // 是否启用监控
    logLevel: process.env.LOG_LEVEL || 'info',        // 日志级别
    slowQueryThreshold: process.env.SLOW_QUERY_THRESHOLD || 1000,  // 慢查询阈值(ms)
  },

  // 查询优化配置
  query: {
    timeout: process.env.QUERY_TIMEOUT || 30000,      // 查询超时时间(ms)
    maxConnections: process.env.MAX_CONNECTIONS || 100,  // 最大并发连接数
  }
};