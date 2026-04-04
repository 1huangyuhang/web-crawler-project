/**
 * 队列服务
 * 使用 Bull + Redis 管理异步爬虫任务。
 * 无 Redis 时 addCrawlJob 会 reject，index.js 会回退到同步执行。
 *
 * 进度推送通过 WebSocketService.getInstance() 获取实例方法，
 * 不再在顶层 require('./WebSocketService') 以避免循环依赖。
 */

const Queue = require('bull');
const { runCrawler } = require('./crawlRunner');

function pushCrawlProgress(crawlId, progress, currentUrl, stats) {
  try {
    const WebSocketService = require('./WebSocketService');
    const inst = WebSocketService.getInstance();
    if (inst) {
      inst.sendCrawlProgress(crawlId, progress, currentUrl, stats);
    }
  } catch {
    // WS 未初始化时静默忽略
  }
}

class QueueService {
  constructor() {
    this.crawlQueue = new Queue('crawl-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 }
      }
    });

    this.setupQueueHandlers();
    this.setupQueueEvents();
  }

  setupQueueHandlers() {
    this.crawlQueue.process('crawl', 4, async (job) => {
      const { crawlId, type, url, depth } = job.data;
      console.log(`开始处理爬虫任务 ${job.id}, crawlId: ${crawlId}`);

      try {
        await job.progress(10);
        pushCrawlProgress(crawlId, 10, url, {
          message: '爬虫任务已开始执行',
          jobId: job.id
        });

        const result = await runCrawler(type, url, depth, {
          onProgress: (pct, u) => {
            pushCrawlProgress(crawlId, pct, u || url, { phase: 'running' });
          }
        });
        result.crawlId = crawlId;

        await job.progress(100);
        pushCrawlProgress(crawlId, 100, url, {
          message: '爬虫任务已完成',
          result: result
        });

        console.log(`爬虫任务 ${job.id} 完成`);
        return { success: true, crawlId, result };
      } catch (error) {
        console.error(`爬虫任务 ${job.id} 失败:`, error);
        pushCrawlProgress(crawlId, 0, url, {
          message: '爬虫任务失败',
          error: error.message
        });
        throw error;
      }
    });

    this.crawlQueue.on('job progress', (job, progress) => {
      const { crawlId } = job.data;
      pushCrawlProgress(crawlId, progress, '', {
        message: `任务进度: ${progress}%`,
        jobId: job.id
      });
    });
  }

  setupQueueEvents() {
    this.crawlQueue.on('completed', (job, result) => {
      console.log(`任务 ${job.id} 已完成`);
    });
    this.crawlQueue.on('failed', (job, err) => {
      console.error(`任务 ${job.id} 失败:`, err.message);
    });
    this.crawlQueue.on('stalled', (job) => {
      console.warn(`任务 ${job.id} 停滞`);
    });
  }

  async addCrawlJob(crawlData) {
    const { crawlId, type, url, depth, priority = 5 } = crawlData;
    const d = Number(depth);

    if (!crawlId || !type || !url || !Number.isFinite(d) || d < 1) {
      throw new Error('缺少必要的爬虫参数');
    }
    if (!['link', 'content', 'image'].includes(type)) {
      throw new Error('不支持的爬虫类型');
    }

    const job = await this.crawlQueue.add('crawl', {
      crawlId, type, url, depth: d
    }, {
      jobId: crawlId,
      priority: Math.min(10, Math.max(1, priority)),
      attempts: 3
    });

    console.log(`爬虫任务已添加到队列: ${job.id}, crawlId: ${crawlId}`);
    return job;
  }

  async getQueueStatus() {
    const counts = await this.crawlQueue.getJobCounts();
    return { ...counts, timestamp: Date.now() };
  }
}

const queueService = new QueueService();

process.on('SIGTERM', async () => {
  try { await queueService.crawlQueue.close(); } catch {}
  process.exit(0);
});
process.on('SIGINT', async () => {
  try { await queueService.crawlQueue.close(); } catch {}
  process.exit(0);
});

module.exports = queueService;
