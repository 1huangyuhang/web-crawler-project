#!/usr/bin/env node

/**
 * 数据迁移脚本
 * 将旧数据库中的数据迁移到新的Prisma架构
 */

const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');

// 旧数据库配置
const oldDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'crawler_db',
  user: 'crawler_user',
  password: 'crawler_password',
};

// 新Prisma客户端
const prisma = new PrismaClient();

async function migrateData() {
  console.log('🚀 开始数据迁移...');

  try {
    // 连接旧数据库
    const oldClient = new Client(oldDbConfig);
    await oldClient.connect();
    console.log('✅ 连接到旧数据库成功');

    // 1. 迁移爬取历史记录
    console.log('📊 迁移爬取历史记录...');
    const oldCrawlData = await oldClient.query('SELECT * FROM crawl_history');
    console.log(`找到 ${oldCrawlData.rows.length} 条爬取记录`);

    let migratedCount = 0;
    for (const record of oldCrawlData.rows) {
      try {
        await prisma.crawlRecord.create({
          data: {
            id: record.crawl_id,
            type: record.type ? record.type.toUpperCase() : 'LINK', // 转换为枚举类型
            targetUrl: record.url,
            depth: record.depth || 1,
            status: 'COMPLETED', // 历史记录都是已完成的
            totalItems: record.items || 0,
            time: record.time || 0,
            data: record.data ? (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) : null,
            error: record.error,
            createdAt: new Date(parseInt(record.timestamp)),
            updatedAt: new Date(parseInt(record.timestamp)),
          }
        });
        migratedCount++;
        console.log(`✓ 迁移记录: ${record.crawl_id}`);
      } catch (error) {
        console.error(`✗ 迁移记录失败: ${record.crawl_id}`, error.message);
      }
    }
    console.log(`✅ 爬取历史记录迁移完成: ${migratedCount}/${oldCrawlData.rows.length}`);

    // 2. 迁移系统配置（如果有）
    console.log('⚙️  检查系统配置...');
    try {
      const oldConfigData = await oldClient.query('SELECT * FROM system_config');
      console.log(`找到 ${oldConfigData.rows.length} 条系统配置`);

      for (const config of oldConfigData.rows) {
        try {
          await prisma.systemConfig.create({
            data: {
              key: config.key,
              value: config.value,
              updatedAt: config.updated_at ? new Date(config.updated_at) : new Date(),
            }
          });
          console.log(`✓ 迁移配置: ${config.key}`);
        } catch (error) {
          console.error(`✗ 迁移配置失败: ${config.key}`, error.message);
        }
      }
    } catch (error) {
      console.log('ℹ️  没有找到系统配置表，跳过迁移');
    }

    // 3. 创建默认配置
    console.log('🔧 创建默认配置...');
    await createDefaultConfigs();

    await oldClient.end();
    console.log('🎉 数据迁移完成！');

  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function createDefaultConfigs() {
  // 创建默认系统配置
  const defaultConfigs = [
    { key: 'max_concurrent_crawls', value: 5 },
    { key: 'default_crawl_timeout', value: 30 },
    { key: 'rate_limit_per_minute', value: 60 },
    { key: 'user_agent', value: 'Mozilla/5.0 (compatible; CrawlerBot/1.0)' },
  ];

  for (const config of defaultConfigs) {
    try {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: { key: config.key, value: config.value },
      });
      console.log(`✓ 创建配置: ${config.key}`);
    } catch (error) {
      console.error(`✗ 创建配置失败: ${config.key}`, error.message);
    }
  }

  // 创建默认爬虫配置
  const defaultCrawlerConfigs = [
    {
      name: '默认链接爬虫',
      description: '默认的链接爬取配置',
      type: 'link',
      maxDepth: 3,
      maxPages: 100,
      timeout: 30,
      userAgent: 'Mozilla/5.0 (compatible; CrawlerBot/1.0)',
      isActive: true,
    },
    {
      name: '默认内容爬虫',
      description: '默认的内容爬取配置',
      type: 'content',
      maxDepth: 2,
      maxPages: 50,
      timeout: 30,
      userAgent: 'Mozilla/5.0 (compatible; CrawlerBot/1.0)',
      isActive: true,
    },
    {
      name: '默认图片爬虫',
      description: '默认的图片爬取配置',
      type: 'image',
      maxDepth: 2,
      maxPages: 30,
      timeout: 30,
      userAgent: 'Mozilla/5.0 (compatible; CrawlerBot/1.0)',
      isActive: true,
    },
  ];

  for (const config of defaultCrawlerConfigs) {
    try {
      await prisma.crawlerConfig.upsert({
        where: { name: config.name },
        update: config,
        create: config,
      });
      console.log(`✓ 创建爬虫配置: ${config.name}`);
    } catch (error) {
      console.error(`✗ 创建爬虫配置失败: ${config.name}`, error.message);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData, createDefaultConfigs };