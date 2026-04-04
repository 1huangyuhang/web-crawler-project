/**
 * 数据库模块
 * 提供数据库操作接口
 */

const { PrismaClient } = require('@prisma/client');

// 创建Prisma客户端实例，使用正确的配置格式
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://crawler_user:crawler_password@localhost:5432/crawler_db"
    }
  }
});

/**
 * 初始化数据库连接
 * @returns {Promise<boolean>} 连接是否成功
 */
async function initDb() {
  try {
    await prisma.$connect();
    console.log('数据库连接成功');
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
}

/**
 * 关闭数据库连接
 */
async function closeDb() {
  try {
    await prisma.$disconnect();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
}

/**
 * 保存爬取历史记录
 * @param {Object} crawlData - 爬取数据
 * @returns {Promise<Object>} 保存的记录
 */
async function saveCrawlHistory(crawlData) {
  try {
    const {
      id,
      type,
      targetUrl,
      url, // 兼容旧字段
      depth,
      items, // 旧字段，先声明
      totalItems = items || 0, // 兼容旧字段
      successCount = 0,
      errorCount = 0,
      time = 0,
      data,
      error,
      configId,
      userId
    } = crawlData;

    const record = await prisma.crawlRecord.create({
      data: {
        id: id,
        type: type.toUpperCase(),
        targetUrl: targetUrl || url, // 兼容旧字段
        depth: depth,
        totalItems: totalItems,
        successCount: successCount,
        errorCount: errorCount,
        time: time,
        data: data || [],
        error: error,
        configId: configId,
        userId: userId,
        status: error ? 'FAILED' : 'COMPLETED'
      }
    });

    console.log('爬取历史记录已保存:', record.id);
    return record;
  } catch (error) {
    console.error('保存爬取历史记录失败:', error);
    throw error;
  }
}

/**
 * 获取爬取历史记录
 * @param {number} limit - 限制数量
 * @param {string} userId - 用户ID (可选，如果提供则只获取该用户的记录)
 * @returns {Promise<Array>} 历史记录列表
 */
async function getCrawlHistory(limit = 50, userId = null) {
  try {
    const whereClause = userId ? { userId: userId } : {};

    const history = await prisma.crawlRecord.findMany({
      where: whereClause,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return history;
  } catch (error) {
    console.error('获取爬取历史记录失败:', error);
    throw error;
  }
}

/**
 * 删除爬取历史记录
 * @param {string} id - 记录ID
 * @param {string} userId - 用户ID (用于验证权限)
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteCrawlHistory(id, userId = null) {
  try {
    const record = await prisma.crawlRecord.findUnique({
      where: { id: id }
    });

    if (!record) {
      return false;
    }

    // 如果提供了userId，验证用户是否有权限删除
    if (userId && record.userId !== userId) {
      return false;
    }

    await prisma.crawlRecord.delete({
      where: { id: id }
    });

    console.log('爬取历史记录已删除:', id);
    return true;
  } catch (error) {
    console.error('删除爬取历史记录失败:', error);
    throw error;
  }
}

/**
 * 清空爬取历史记录
 * @param {string} userId - 用户ID (可选，如果提供则只清空该用户的记录)
 * @returns {Promise<boolean>} 是否成功清空
 */
async function clearCrawlHistory(userId = null) {
  try {
    if (userId) {
      await prisma.crawlRecord.deleteMany({
        where: { userId: userId }
      });
      console.log(`用户 ${userId} 的所有爬取历史记录已清空`);
    } else {
      await prisma.crawlRecord.deleteMany({});
      console.log('所有爬取历史记录已清空');
    }
    return true;
  } catch (error) {
    console.error('清空爬取历史记录失败:', error);
    throw error;
  }
}

/**
 * 获取用户信息
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户信息
 */
async function getUser(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        apiKeys: true,
        crawlRecords: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    return user;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
}

/**
 * 通过用户名获取用户
 * @param {string} username - 用户名
 * @returns {Promise<Object>} 用户信息
 */
async function getUserByUsername(username) {
  try {
    const user = await prisma.user.findUnique({
      where: { username: username },
      include: {
        apiKeys: true
      }
    });
    return user;
  } catch (error) {
    console.error('通过用户名获取用户失败:', error);
    throw error;
  }
}

/**
 * 通过邮箱获取用户
 * @param {string} email - 邮箱
 * @returns {Promise<Object>} 用户信息
 */
async function getUserByEmail(email) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
      include: {
        apiKeys: true
      }
    });
    return user;
  } catch (error) {
    console.error('通过邮箱获取用户失败:', error);
    throw error;
  }
}

/**
 * 创建用户
 * @param {Object} userData - 用户数据
 * @returns {Promise<Object>} 创建的用户
 */
async function createUser(userData) {
  try {
    const { username, email, passwordHash } = userData;
    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: passwordHash,
        isActive: true
      }
    });
    return user;
  } catch (error) {
    console.error('创建用户失败:', error);
    throw error;
  }
}

/**
 * 创建API密钥
 * @param {Object} apiKeyData - API密钥数据
 * @returns {Promise<Object>} 创建的API密钥
 */
async function createApiKey(apiKeyData) {
  try {
    const { name, keyHash, userId, permissions } = apiKeyData;
    const apiKey = await prisma.apiKey.create({
      data: {
        name: name,
        keyHash: keyHash,
        userId: userId,
        permissions: permissions,
        isActive: true
      }
    });
    return apiKey;
  } catch (error) {
    console.error('创建API密钥失败:', error);
    throw error;
  }
}

/**
 * 获取有效的API密钥
 * @param {string} keyHash - 密钥哈希
 * @returns {Promise<Object>} API密钥信息
 */
async function getValidApiKey(keyHash) {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        keyHash: keyHash,
        isActive: true
      },
      include: {
        user: true
      }
    });

    if (!apiKey) {
      return null;
    }

    // 更新最后使用时间
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    return apiKey;
  } catch (error) {
    console.error('获取API密钥失败:', error);
    throw error;
  }
}

/**
 * 获取用户的爬取记录
 * @param {string} userId - 用户ID
 * @param {number} limit - 限制数量
 * @returns {Promise<Array>} 用户的历史记录
 */
async function getUserCrawlHistory(userId, limit = 50) {
  try {
    const history = await prisma.crawlRecord.findMany({
      where: {
        userId: userId
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return history;
  } catch (error) {
    console.error('获取用户爬取历史记录失败:', error);
    throw error;
  }
}

/**
 * 创建爬虫配置
 * @param {Object} configData - 配置数据
 * @returns {Promise<Object>} 创建的配置
 */
async function createCrawlerConfig(configData) {
  try {
    const config = await prisma.crawlerConfig.create({
      data: configData
    });
    return config;
  } catch (error) {
    console.error('创建爬虫配置失败:', error);
    throw error;
  }
}

/**
 * 获取爬虫配置
 * @param {string} configId - 配置ID
 * @returns {Promise<Object>} 配置信息
 */
async function getCrawlerConfig(configId) {
  try {
    const config = await prisma.crawlerConfig.findUnique({
      where: { id: configId }
    });
    return config;
  } catch (error) {
    console.error('获取爬虫配置失败:', error);
    throw error;
  }
}

module.exports = {
  // 数据库连接
  initDb,
  closeDb,

  // 爬取历史记录
  saveCrawlHistory,
  getCrawlHistory,
  deleteCrawlHistory,
  clearCrawlHistory,

  // 用户管理
  getUser,
  getUserByUsername,
  getUserByEmail,
  createUser,

  // API密钥管理
  createApiKey,
  getValidApiKey,

  // 用户历史记录
  getUserCrawlHistory,

  // 爬虫配置
  createCrawlerConfig,
  getCrawlerConfig,

  // Prisma客户端实例
  prisma
};