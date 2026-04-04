#!/usr/bin/env node

/**
 * 数据库迁移脚本
 * 用于执行数据库迁移和初始化
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

async function runMigration() {
  console.log('🚀 开始数据库迁移...');

  try {
    // 检查Prisma CLI是否可用
    await execAsync('npx prisma --version');
    console.log('✅ Prisma CLI 可用');

    // 生成Prisma客户端
    console.log('📦 生成Prisma客户端...');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma客户端生成成功');

    // 检查是否有未应用的迁移
    console.log('🔍 检查迁移状态...');
    const { stdout: statusOutput } = await execAsync('npx prisma migrate status');
    console.log('迁移状态:', statusOutput);

    // 如果有待应用的迁移，应用它们
    if (statusOutput.includes('Pending')) {
      console.log('⏳ 应用待处理的迁移...');
      await execAsync('npx prisma migrate deploy');
      console.log('✅ 迁移应用成功');
    } else {
      console.log('✅ 没有待处理的迁移');
    }

    // 如果没有迁移，创建初始迁移
    const { stdout: diffOutput } = await execAsync('npx prisma migrate diff --from-empty --to-schema Datasource db');
    if (diffOutput.includes('Drift detected') || diffOutput.includes('-- Create')) {
      console.log('📝 检测到架构变化，创建新的迁移...');
      const migrationName = `init_${Date.now()}`;
      await execAsync(`npx prisma migrate dev --name ${migrationName} --create-only`);
      console.log('✅ 迁移创建成功');

      // 应用新创建的迁移
      console.log('⏳ 应用新创建的迁移...');
      await execAsync('npx prisma migrate dev');
      console.log('✅ 迁移应用成功');
    }

    // 验证数据库连接
    console.log('🔌 验证数据库连接...');
    await execAsync('npx prisma db execute --file scripts/validate.sql');
    console.log('✅ 数据库连接验证成功');

    console.log('🎉 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    if (error.stdout) {
      console.error('STDOUT:', error.stdout);
    }
    if (error.stderr) {
      console.error('STDERR:', error.stderr);
    }
    process.exit(1);
  }
}

async function resetDatabase() {
  console.log('⚠️  重置数据库...');

  try {
    // 删除所有数据
    await execAsync('npx prisma migrate reset --force');
    console.log('✅ 数据库已重置');

    // 重新运行迁移
    await runMigration();

  } catch (error) {
    console.error('❌ 重置失败:', error);
    process.exit(1);
  }
}

async function createInitialData() {
  console.log('🌱 创建初始数据...');

  try {
    // 创建默认的爬虫配置
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 创建链接爬虫配置
    await prisma.crawlerConfig.create({
      data: {
        name: '默认链接爬虫',
        description: '默认的链接爬虫配置',
        type: 'link',
        maxDepth: 3,
        maxPages: 100,
        timeout: 30,
        userAgent: 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
        headers: {},
        rules: {},
        isActive: true
      }
    });

    // 创建内容爬虫配置
    await prisma.crawlerConfig.create({
      data: {
        name: '默认内容爬虫',
        description: '默认的内容爬虫配置',
        type: 'content',
        maxDepth: 2,
        maxPages: 50,
        timeout: 30,
        userAgent: 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
        headers: {},
        rules: {},
        isActive: true
      }
    });

    // 创建图片爬虫配置
    await prisma.crawlerConfig.create({
      data: {
        name: '默认图片爬虫',
        description: '默认的图片爬虫配置',
        type: 'image',
        maxDepth: 2,
        maxPages: 50,
        timeout: 30,
        userAgent: 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
        headers: {},
        rules: {},
        isActive: true
      }
    });

    console.log('✅ 初始数据创建成功');

  } catch (error) {
    console.error('❌ 创建初始数据失败:', error);
    process.exit(1);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0] || 'migrate';

switch (command) {
  case 'migrate':
    runMigration();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'seed':
    createInitialData();
    break;
  case 'help':
  default:
    console.log('📖 使用方法:');
    console.log('  node scripts/migrate.js migrate    # 执行迁移');
    console.log('  node scripts/migrate.js reset      # 重置数据库');
    console.log('  node scripts/migrate.js seed       # 创建初始数据');
    console.log('  node scripts/migrate.js help       # 显示帮助');
    break;
}