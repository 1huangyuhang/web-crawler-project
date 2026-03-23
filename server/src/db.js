/**
 * 数据库连接模块
 * 用于连接 PostgreSQL 数据库并提供基本的数据库操作功能
 */

const { Client } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'crawler_db',
  user: 'crawler_user',
  password: 'crawler_password',
};

/**
 * 数据库客户端实例
 */
let client = null;

/**
 * 初始化数据库连接
 */
exports.initDb = async () => {
  try {
    client = new Client(dbConfig);
    await client.connect();
    console.log('成功连接到 PostgreSQL 数据库');
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
};

/**
 * 关闭数据库连接
 */
exports.closeDb = async () => {
  try {
    if (client) {
      await client.end();
      console.log('数据库连接已关闭');
    }
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
};

/**
 * 保存爬取历史记录到数据库
 * @param {Object} crawlData 爬取数据
 */
exports.saveCrawlHistory = async (crawlData) => {
  try {
    if (!client) {
      console.error('数据库未连接');
      return false;
    }

    const query = `
      INSERT INTO crawl_history (crawl_id, timestamp, url, type, depth, items, time, data, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (crawl_id) DO UPDATE
      SET timestamp = $2, url = $3, type = $4, depth = $5, items = $6, time = $7, data = $8, error = $9
    `;

    const values = [
      crawlData.id,
      crawlData.timestamp,
      crawlData.url,
      crawlData.type,
      crawlData.depth,
      crawlData.items,
      crawlData.time,
      crawlData.data ? JSON.stringify(crawlData.data) : null,
      crawlData.error || null
    ];

    await client.query(query, values);
    console.log('爬取历史记录已保存到数据库');
    return true;
  } catch (error) {
    console.error('保存爬取历史记录失败:', error);
    return false;
  }
};

/**
 * 获取所有爬取历史记录
 * @param {number} limit 限制返回的记录数量
 */
exports.getCrawlHistory = async (limit = 50) => {
  try {
    if (!client) {
      console.error('数据库未连接');
      return [];
    }

    const query = `
      SELECT * FROM crawl_history
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const result = await client.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('获取爬取历史记录失败:', error);
    return [];
  }
};

/**
 * 根据 ID 删除爬取历史记录
 * @param {string} crawlId 爬取记录 ID
 */
exports.deleteCrawlHistory = async (crawlId) => {
  try {
    if (!client) {
      console.error('数据库未连接');
      return false;
    }

    const query = `
      DELETE FROM crawl_history
      WHERE crawl_id = $1
    `;

    const result = await client.query(query, [crawlId]);
    console.log('爬取历史记录已删除:', crawlId);
    return result.rowCount > 0;
  } catch (error) {
    console.error('删除爬取历史记录失败:', error);
    return false;
  }
};

/**
 * 清空所有爬取历史记录
 */
exports.clearCrawlHistory = async () => {
  try {
    if (!client) {
      console.error('数据库未连接');
      return false;
    }

    const query = 'DELETE FROM crawl_history';
    await client.query(query);
    console.log('所有爬取历史记录已清空');
    return true;
  } catch (error) {
    console.error('清空爬取历史记录失败:', error);
    return false;
  }
};
