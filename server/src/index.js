const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { URL } = require('url');

// 导入数据库模块
const db = require('./db');

// 导入服务
const QueueService = require('./services/QueueService');
const WebSocketService = require('./services/WebSocketService');

// 导入中间件
const { sendSuccess, sendError, notFound, errorHandler, successResponse } = require('./middleware/response');
const { validateCrawlRequest, validateHistoryRequest, validateIdParam, crawlRateLimiter } = require('./middleware/validation');
const { authMiddleware } = require('./middleware/auth');

// 导入路由
const authRoutes = require('./routes/auth');
const { runCrawler, normalizeCrawlRuntime } = require('./services/crawlRunner');
const { listenFromBasePort } = require('./devListen');

function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);
    // 限制协议，防止file://、data://等危险协议
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    // 限制长度，防止过长的URL导致缓冲区溢出
    if (url.length > 2048) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateCrawlerType(type) {
  return ['link', 'content', 'image'].includes(type);
}

function validateDepth(depth) {
  const depthNum = parseInt(depth);
  return !isNaN(depthNum) && depthNum >= 1 && depthNum <= 10;
}

// 创建 Express 应用
const app = express();
/** 首选端口；若被占用 devListen 会自动尝试 base+1…（见 devListen.js） */
const baseListenPort = parseInt(String(process.env.PORT || '3001'), 10) || 3001;

// 配置中间件
app.use(cors());
app.use(bodyParser.json());

/**
 * 生成唯一的爬取 ID
 * @returns {string} 唯一的爬取 ID
 */
function generateCrawlId() {
  return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 定义 API 路由
app.post('/api/crawl', async (req, res) => {
  let type;
  let url;
  let depth;
  try {
    ({ type, url, depth = 2, crawlRuntime: rawCrawlRuntime } = req.body);
    const depthNum = parseInt(String(depth), 10) || 2;
    const crawlRuntime = normalizeCrawlRuntime(rawCrawlRuntime);

    // 安全验证参数
    if (!type || !url) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证爬虫类型
    if (!validateCrawlerType(type)) {
      return res.status(400).json({ error: '不支持的爬虫类型' });
    }

    // 验证URL格式和安全性
    if (!validateUrl(url)) {
      return res.status(400).json({ error: '无效的URL格式或协议' });
    }

    // 验证深度
    if (!validateDepth(depthNum)) {
      return res.status(400).json({ error: '爬取深度必须在1-10之间' });
    }

    const crawlId = generateCrawlId();
    console.log('创建爬虫任务:', type, url, depthNum, 'crawlId:', crawlId);

    try {
      await QueueService.addCrawlJob({ crawlId, type, url, depth: depthNum, crawlRuntime });
      return res.json({
        success: true,
        id: crawlId,
        jobId: crawlId,
        status: 'queued',
        message: '爬虫任务已加入队列',
        url,
        type,
        depth: depthNum,
        timestamp: Date.now()
      });
    } catch (queueErr) {
      console.warn('队列不可用，改为同步执行爬虫:', queueErr?.message || queueErr);
      const result = await runCrawler(type, url, depthNum, { crawlRuntime });
      result.id = crawlId;
      result.status = result.error ? 'failed' : 'completed';
      const dataArr = Array.isArray(result.data) ? result.data : [];
      const cappedData = dataArr.length > 500 ? dataArr.slice(0, 500) : dataArr;
      db.saveCrawlHistory({
        id: crawlId,
        type,
        targetUrl: url,
        depth: depthNum,
        totalItems: result.items || 0,
        time: result.time || 0,
        data: cappedData,
        error: result.error || null,
        userId: req.user?.userId
      }).catch((err) => console.error('同步爬取写入历史失败:', err));
      return res.json(result);
    }
  } catch (error) {
    console.error('处理爬虫请求失败:', error);
    const b = req.body || {};

    // 错误时也返回符合前端接口格式的结果
    const errorRecord = {
      id: generateCrawlId(),
      timestamp: Date.now(),
      url: url ?? b.url ?? '',
      type: type ?? b.type ?? 'link',
      depth: depth ?? b.depth ?? 2,
      items: 0,
      time: 0,
      data: [],
      error: error.message || '爬取失败',
      status: 'failed',
      progress: 0,
      currentUrl: null
    };

    // 保存错误记录到数据库
    const crawlData = {
      id: errorRecord.id,
      type: errorRecord.type,
      targetUrl: errorRecord.url,
      depth: errorRecord.depth,
      totalItems: errorRecord.items,
      time: errorRecord.time,
      data: errorRecord.data,
      error: errorRecord.error,
      userId: req.user?.userId // 如果有认证信息，保存用户ID
    };

    db.saveCrawlHistory(crawlData).catch(err => {
      console.error('保存错误记录到数据库失败:', err);
    });

    res.status(500).json(errorRecord);
  }
});

// 健康检查路由
app.get('/api/health', (req, res) => {
  return res.json({
    success: true,
    code: 0,
    message: '服务正常运行',
    data: { status: 'ok' },
    timestamp: new Date().toISOString()
  });
});

// 数据分析（与前端 analyticsSlice / analyticsApi 对齐；置于认证前便于本地开发）
app.get('/api/analytics/performance', (req, res) => {
  const data = {
    apiResponseTime: { average: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 },
    databaseQueries: { total: 0, slowQueries: 0, averageTime: 0 },
    cacheMetrics: { hitRate: 0, totalRequests: 0, cacheSize: 0 },
    systemMetrics: { cpuUsage: 0, memoryUsage: 0, activeConnections: 0 }
  };
  return res.json(successResponse(data, '获取性能指标成功'));
});

app.get('/api/analytics/crawl', async (req, res) => {
  try {
    const startTime = parseInt(req.query.startTime, 10) || 0;
    const endTime = parseInt(req.query.endTime, 10) || Date.now();
    const history = await db.getCrawlHistory(1000);
    const formatted = history
      .filter((record) => {
        const ts = record.createdAt ? new Date(record.createdAt).getTime() : 0;
        return ts >= startTime && ts <= endTime;
      })
      .map((record) => {
        let domain = '';
        try {
          domain = new URL(record.targetUrl || record.url || 'http://localhost').hostname || '';
        } catch {
          domain = '';
        }
        const type = String(record.type || 'link').toLowerCase();
        return {
          id: record.id,
          timestamp: record.createdAt ? new Date(record.createdAt).getTime() : Date.now(),
          url: record.targetUrl || record.url,
          type: ['link', 'content', 'image'].includes(type) ? type : 'link',
          duration: record.time || 0,
          itemsFound: record.totalItems ?? 0,
          success: !record.error,
          errorType: record.error || undefined,
          domain,
          depth: record.depth ?? 1
        };
      });
    return res.json(successResponse(formatted, '获取爬取分析成功'));
  } catch (error) {
    console.error('获取爬取分析失败:', error);
    return sendError(req, res, error, 500);
  }
});

app.get('/api/analytics/trends', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const trends = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    trends.push({
      date,
      crawls: 0,
      success: 0,
      averageDuration: 0,
      itemsPerCrawl: 0
    });
  }
  return res.json(successResponse(trends, '获取趋势数据成功'));
});

// 系统设置（内存存储，与 settingsSlice / settingsApi 对齐）
const defaultSettings = {
  defaultCrawlerType: 'link',
  defaultDepth: 2,
  maxConcurrentRequests: 5,
  theme: 'auto',
  language: 'zh-CN',
  autoSave: true,
  notifications: {
    enabled: true,
    types: {
      crawlComplete: true,
      crawlFailed: true,
      systemUpdates: false
    }
  },
  performance: {
    cacheEnabled: true,
    cacheTTL: 3600,
    batchSize: 100
  }
};
let settingsCache = { ...defaultSettings };

app.get('/api/settings', (req, res) => {
  return res.json(successResponse(settingsCache, '获取设置成功'));
});

app.put('/api/settings', (req, res) => {
  settingsCache = { ...settingsCache, ...req.body };
  return res.json(successResponse(settingsCache, '保存设置成功'));
});

// 历史统计、收藏更新（置于认证前便于本地开发）
app.get('/api/history/stats', async (req, res) => {
  try {
    const history = await db.getCrawlHistory(10000);
    const byType = { link: 0, content: 0, image: 0 };
    let completedCrawls = 0;
    let failedCrawls = 0;
    let totalItems = 0;
    let totalTime = 0;
    const byDateMap = new Map();

    for (const r of history) {
      const t = String(r.type || '').toLowerCase();
      if (t === 'link' || t === 'content' || t === 'image') {
        byType[t]++;
      }
      const st = String(r.status || '').toLowerCase();
      if (st === 'failed') {
        failedCrawls++;
      } else {
        completedCrawls++;
      }
      totalItems += r.totalItems || 0;
      totalTime += r.time || 0;
      const day = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '';
      if (day) {
        byDateMap.set(day, (byDateMap.get(day) || 0) + 1);
      }
    }

    const byDate = [...byDateMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const stats = {
      totalCrawls: history.length,
      completedCrawls,
      failedCrawls,
      totalItems,
      averageTime: history.length ? totalTime / history.length : 0,
      successRate: history.length ? completedCrawls / history.length : 0,
      byType,
      byDate
    };
    return res.json(successResponse(stats, '获取统计成功'));
  } catch (error) {
    console.error('获取历史统计失败:', error);
    return sendError(req, res, error, 500);
  }
});

app.patch('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const { favorite } = req.body || {};
  return res.json(successResponse({ id, favorite: Boolean(favorite) }, '更新成功'));
});

// 认证路由
app.use('/api/auth', authRoutes);

// API路由 - 需要认证
app.use('/api', authMiddleware);

app.get('/api/history', validateHistoryRequest, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await db.getCrawlHistory(limit);

    const formattedHistory = history.map(record => ({
      id: record.id,
      timestamp: record.createdAt ? new Date(record.createdAt).getTime() : record.timestamp,
      url: record.targetUrl || record.url,
      type: String(record.type || 'link').toLowerCase(),
      depth: record.depth,
      items: record.totalItems || record.items || 0,
      time: record.time || 0,
      data: record.data || [],
      error: record.error,
      status: (record.status || 'completed').toLowerCase(),
      progress: record.status === 'completed' ? 100 : (record.status === 'failed' ? 0 : 50),
      currentUrl: null
    }));

    return sendSuccess(req, res, formattedHistory, '历史记录获取成功');
  } catch (error) {
    console.error('获取爬取历史记录失败:', error);
    return sendError(req, res, error, 500);
  }
});

app.delete('/api/history/:id', validateIdParam, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteCrawlHistory(id);
    if (success) {
      return sendSuccess(req, res, { success: true }, '历史记录删除成功');
    } else {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '记录不存在',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('删除爬取历史记录失败:', error);
    return sendError(req, res, error, 500);
  }
});

app.delete('/api/history', async (req, res) => {
  try {
    const success = await db.clearCrawlHistory();
    return sendSuccess(req, res, { success }, '历史记录清空成功');
  } catch (error) {
    console.error('清空爬取历史记录失败:', error);
    return sendError(req, res, error, 500);
  }
});

// 404处理
app.use(notFound);

// 全局错误处理
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库连接
    const dbConnected = await db.initDb();
    if (!dbConnected) {
      console.warn('数据库连接失败，将使用本地存储作为备选方案');
    }

    const { server, port } = await listenFromBasePort(app, baseListenPort);

    console.log(`后端服务运行在 http://localhost:${port}`);
    console.log('可用的 API 端点:');
    console.log('POST /api/crawl - 执行爬虫');
    console.log('GET /api/history - 获取爬取历史记录');
    console.log('DELETE /api/history/:id - 删除指定爬取历史记录');
    console.log('DELETE /api/history - 清空所有爬取历史记录');
    console.log('GET /api/health - 健康检查');
    console.log(`WebSocket: ws://localhost:${port}/ws - 实时进度推送`);

    // 初始化 WebSocket 服务并注入队列（打破循环依赖）
    const wsService = new WebSocketService(server);
    wsService.setupQueueListeners(QueueService);
    console.log('WebSocket服务已初始化');

    app.set('wsService', wsService);

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
