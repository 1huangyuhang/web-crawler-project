const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

// 导入数据库模块
const db = require('./db');

// 创建 Express 应用
const app = express();
const port = 3001;

// 配置中间件
app.use(cors());
app.use(bodyParser.json());

// 爬虫脚本路径
const CRAWLER_SCRIPT_PATH = path.join(__dirname, '../../src/scripts/crawler/main.py');

/**
 * 生成唯一的爬取 ID
 * @returns {string} 唯一的爬取 ID
 */
function generateCrawlId() {
  return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 执行爬虫脚本
 * @param {string} crawlerType 爬虫类型
 * @param {string} url 目标URL
 * @param {number} depth 爬取深度
 * @returns {Promise<Object>} 爬取结果
 */
function runCrawler(crawlerType, url, depth) {
  return new Promise((resolve, reject) => {
    try {
      // 构建命令参数
      const pythonPath = '/Users/huangyuhang/Downloads/Test/1/my-website/venv/bin/python3';
      const args = [
        CRAWLER_SCRIPT_PATH,
        '--type', crawlerType,
        '--url', url,
        '--depth', depth,
        '--json'
      ];
      console.log('执行爬虫命令:', pythonPath, args);
      
      // 使用 spawn 执行命令，获取实时输出
      const pythonProcess = spawn(pythonPath, args);
      let output = '';
      let errorOutput = '';
      
      // 监听标准输出
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // 监听标准错误
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // 监听进程结束
      pythonProcess.on('close', (code) => {
        console.log('爬虫进程结束，退出码:', code);
        
        if (code !== 0) {
          console.error('爬虫执行失败，错误输出:', errorOutput);
          reject(new Error(`爬虫执行失败，退出码: ${code}\n错误信息: ${errorOutput}`));
          return;
        }
        
        try {
          // 解析 JSON 结果 - 只提取有效的 JSON 部分
          console.log('原始结果长度:', output.length);
          console.log('原始结果前200字符:', output.substring(0, 200));
          
          // 尝试找到 JSON 开始和结束的位置
          let jsonStart = output.indexOf('{');
          let jsonEnd = output.lastIndexOf('}');
          
          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('无法找到有效的 JSON 格式');
          }
          
          const jsonString = output.substring(jsonStart, jsonEnd + 1);
          console.log('提取的 JSON 字符串:', jsonString);
          
          const parsedResult = JSON.parse(jsonString);
          console.log('解析后的爬虫结果:', parsedResult);
          
          resolve(parsedResult);
        } catch (error) {
          console.error('解析爬虫结果失败:', error);
          reject(new Error(`解析爬虫结果失败: ${error.message}`));
        }
      });
      
      // 监听进程错误
      pythonProcess.on('error', (error) => {
        console.error('启动爬虫进程失败:', error);
        reject(new Error(`启动爬虫进程失败: ${error.message}`));
      });
      
    } catch (error) {
      console.error('执行爬虫脚本失败:', error.message);
      reject(new Error(`执行爬虫脚本失败: ${error.message}`));
    }
  });
}

// 定义 API 路由
app.post('/api/crawl', async (req, res) => {
  try {
    const { type, url, depth = 2 } = req.body;
    
    // 验证参数
    if (!type || !url) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['link', 'content', 'image'].includes(type)) {
      return res.status(400).json({ error: '不支持的爬虫类型' });
    }
    
    // 执行爬虫
    console.log('执行爬虫:', type, url, depth);
    const result = await runCrawler(type, url, depth);
    
    // 生成爬取 ID 并保存到数据库
    const crawlId = generateCrawlId();
    const crawlData = {
      id: crawlId,
      timestamp: Date.now(),
      url: result.url,
      type: result.type,
      depth: result.depth,
      items: result.items,
      time: result.time,
      data: result.data,
      error: result.error
    };
    
    // 保存到数据库
    await db.saveCrawlHistory(crawlData);
    console.log('爬虫任务完成并保存到数据库:', crawlId);
    
    // 返回结果
    res.json(result);
  } catch (error) {
    console.error('处理爬虫请求失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 获取爬取历史记录
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await db.getCrawlHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('获取爬取历史记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除爬取历史记录
app.delete('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteCrawlHistory(id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '记录不存在' });
    }
  } catch (error) {
    console.error('删除爬取历史记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 清空爬取历史记录
app.delete('/api/history', async (req, res) => {
  try {
    const success = await db.clearCrawlHistory();
    res.json({ success });
  } catch (error) {
    console.error('清空爬取历史记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库连接
    const dbConnected = await db.initDb();
    if (!dbConnected) {
      console.warn('数据库连接失败，将使用本地存储作为备选方案');
    }
    
    // 启动 Express 服务器
    app.listen(port, () => {
      console.log(`后端服务运行在 http://localhost:${port}`);
      console.log('可用的 API 端点:');
      console.log('POST /api/crawl - 执行爬虫');
      console.log('GET /api/history - 获取爬取历史记录');
      console.log('DELETE /api/history/:id - 删除指定爬取历史记录');
      console.log('DELETE /api/history - 清空所有爬取历史记录');
      console.log('GET /api/health - 健康检查');
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

// 进程退出时关闭数据库连接
process.on('SIGINT', async () => {
  try {
    await db.closeDb();
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try {
    await db.closeDb();
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
  process.exit(0);
});
