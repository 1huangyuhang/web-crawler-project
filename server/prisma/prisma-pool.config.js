/**
 * Prisma 连接池配置
 * 优化数据库连接管理，提高性能和可靠性
 */

module.exports = {
  // 连接池配置
  pool: {
    // 连接池大小
    min: 2,
    max: 10,

    // 连接超时设置
    acquireTimeout: 30000, // 获取连接超时时间 (30秒)
    createTimeout: 30000, // 创建连接超时时间 (30秒)

    // 空闲连接设置
    idleTimeout: 10000, // 空闲连接超时时间 (10秒)
    maxIdle: 5, // 最大空闲连接数

    // 连接生命周期
    maxLifetime: 600000, // 连接最大生命周期 (10分钟)

    // 重试策略
    retryStrategy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
    },

    // 健康检查
    healthCheckInterval: 30000, // 健康检查间隔 (30秒)
  },

  // 查询配置
  query: {
    // 查询超时
    timeout: 30000,

    // 查询重试
    maxRetries: 2,

    // 查询批处理
    batchSize: 100,

    // 游标配置
    cursor: {
      batchSize: 50,
    },
  },

  // 事务配置
  transaction: {
    timeout: 60000, // 事务超时 (60秒)
    maxWait: 2000, // 最大等待时间 (2秒)
    isolationLevel: 'READ_COMMITTED', // 隔离级别
  },

  // 连接监控
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    slowQueryThreshold: 1000, // 慢查询阈值 (1秒)
    logLevel: 'warn',
  },

  // 连接预热配置
  warmup: {
    enabled: true,
    concurrentConnections: 3,
    timeout: 5000,
  },
};