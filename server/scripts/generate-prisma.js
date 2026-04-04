#!/usr/bin/env node

/**
 * Prisma客户端生成脚本
 * 用于生成Prisma Client并检查数据库连接
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

async function generatePrismaClient() {
  console.log('🚀 开始生成Prisma Client...');

  try {
    // 1. 检查Prisma CLI是否安装
    console.log('📋 检查Prisma CLI...');
    try {
      execSync('npx prisma --version', { stdio: 'ignore' });
      console.log('✅ Prisma CLI已安装');
    } catch (error) {
      console.error('❌ Prisma CLI未安装，请先安装: npm install -g prisma');
      process.exit(1);
    }

    // 2. 生成Prisma Client
    console.log('🔧 生成Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client生成成功');

    // 3. 检查数据库连接
    console.log('🗄️  检查数据库连接...');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 4. 测试基本查询
    console.log('🧪 测试数据库查询...');
    const count = await prisma.crawlRecord.count();
    console.log(`📊 当前爬取记录数: ${count}`);

    // 5. 断开连接
    await prisma.$disconnect();
    console.log('🔌 数据库连接已关闭');

    console.log('🎉 Prisma Client生成和测试完成！');

  } catch (error) {
    console.error('❌ Prisma Client生成失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generatePrismaClient();
}

module.exports = { generatePrismaClient };