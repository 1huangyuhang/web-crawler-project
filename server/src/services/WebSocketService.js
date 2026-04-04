/**
 * WebSocket 服务
 * 实现实时进度推送和安全性控制
 *
 * 注意：不再 require('./QueueService')，由 index.js 在两个服务都就绪后
 * 调用 wsService.setupQueueListeners(queueService) 注入，避免循环依赖。
 */

const WebSocket = require('ws');
const crypto = require('crypto');

let wsServiceSingleton = null;

class WebSocketService {
  constructor(server) {
    wsServiceSingleton = this;

    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      maxPayload: 1024 * 1024,
      clientTracking: true
    });

    this.clients = new Map();
    this.subscriptions = new Map();
    this.rateLimits = new Map();

    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId(req);
      this.clients.set(clientId, { ws, authenticated: false });

      ws.on('close', () => this.handleClientDisconnect(clientId));
      ws.on('error', (error) => this.handleClientError(clientId, error));
      ws.on('message', (message) => this.handleClientMessage(clientId, message));

      ws.send(JSON.stringify({
        type: 'connection',
        message: 'WebSocket连接已建立',
        clientId: clientId,
        requiresAuth: true
      }));
    });

    setInterval(() => this.cleanupInactiveConnections(), 60000);
  }

  /**
   * 注入队列实例并注册 Bull 事件监听。
   * 必须在 index.js 中、QueueService 和 WebSocketService 都初始化后调用。
   * @param {Object} queueService - QueueService 单例
   */
  setupQueueListeners(queueService) {
    if (!queueService || !queueService.crawlQueue) {
      console.warn('[WebSocketService] 队列不可用，跳过 Bull 事件监听');
      return;
    }

    queueService.crawlQueue.on('completed', (job, result) => {
      this.broadcastCrawlUpdate('completed', job.data.crawlId, result);
    });

    queueService.crawlQueue.on('failed', (job, error) => {
      this.broadcastCrawlUpdate('failed', job.data.crawlId, { error: error.message });
    });

    queueService.crawlQueue.on('active', (job) => {
      this.broadcastCrawlUpdate('started', job.data.crawlId, { jobId: job.id });
    });

    console.log('[WebSocketService] Bull 队列事件监听已注册');
  }

  generateClientId(req) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = Date.now();
    return crypto.createHash('sha256')
      .update(`${ip}-${userAgent}-${timestamp}`)
      .digest('hex')
      .substring(0, 16);
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.checkRateLimit(clientId)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED'
      }));
      return;
    }

    try {
      const data = JSON.parse(message);

      if (!this.validateMessageFormat(data)) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: '无效的消息格式',
          code: 'INVALID_MESSAGE_FORMAT'
        }));
        return;
      }

      switch (data.type) {
        case 'auth':
          this.handleAuthentication(clientId, data.payload);
          break;
        case 'subscribe:crawl':
          this.handleSubscribeCrawl(clientId, data.payload);
          break;
        case 'unsubscribe:crawl':
          this.handleUnsubscribeCrawl(clientId, data.payload);
          break;
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        default:
          if (!client.authenticated) {
            client.ws.send(JSON.stringify({
              type: 'error',
              message: '未经认证，请先进行认证',
              code: 'UNAUTHENTICATED'
            }));
            return;
          }
          this.handleUnknownMessage(clientId, data);
      }
    } catch (error) {
      console.error(`处理WebSocket消息失败 (客户端 ${clientId}):`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: '服务器处理错误',
        code: 'SERVER_ERROR'
      }));
    }
  }

  handleAuthentication(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { token } = payload || {};
    if (!token || !this.validateAuthToken(token)) {
      client.ws.send(JSON.stringify({
        type: 'auth',
        status: 'failed',
        message: '认证失败，无效的令牌',
        code: 'INVALID_TOKEN'
      }));
      return;
    }

    client.authenticated = true;
    client.ws.send(JSON.stringify({
      type: 'auth',
      status: 'success',
      message: '认证成功'
    }));
  }

  handleSubscribeCrawl(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      client?.ws.send(JSON.stringify({
        type: 'error',
        message: '未经认证',
        code: 'UNAUTHENTICATED'
      }));
      return;
    }

    const { crawlId } = payload || {};
    if (!crawlId || !this.validateCrawlId(crawlId)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: '无效的爬取ID',
        code: 'INVALID_CRAWL_ID'
      }));
      return;
    }

    if (!this.subscriptions.has(crawlId)) {
      this.subscriptions.set(crawlId, new Set());
    }
    this.subscriptions.get(crawlId).add(clientId);
    client.subscribedCrawlId = crawlId;

    client.ws.send(JSON.stringify({
      type: 'subscription',
      status: 'subscribed',
      crawlId: crawlId
    }));
  }

  handleUnsubscribeCrawl(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { crawlId } = payload || {};
    if (crawlId && this.subscriptions.has(crawlId)) {
      this.subscriptions.get(crawlId).delete(clientId);
      if (this.subscriptions.get(crawlId).size === 0) {
        this.subscriptions.delete(crawlId);
      }
    }

    if (client.subscribedCrawlId === crawlId) {
      client.subscribedCrawlId = null;
    }

    client.ws.send(JSON.stringify({
      type: 'subscription',
      status: 'unsubscribed',
      crawlId: crawlId
    }));
  }

  broadcastCrawlUpdate(eventType, crawlId, data) {
    const subscribers = this.subscriptions.get(crawlId) || new Set();
    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: `crawl:${eventType}`,
          crawlId: crawlId,
          data: data,
          timestamp: Date.now()
        }));
      }
    });
  }

  sendCrawlProgress(crawlId, progress, currentUrl = null, stats = {}) {
    const subscribers = this.subscriptions.get(crawlId) || new Set();
    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'crawl:progress',
          crawlId: crawlId,
          data: {
            progress: Math.min(100, Math.max(0, progress)),
            currentUrl: currentUrl,
            stats: stats,
            timestamp: Date.now()
          }
        }));
      }
    });
  }

  validateMessageFormat(data) {
    if (typeof data !== 'object' || data === null) return false;
    if (typeof data.type !== 'string') return false;
    if (data.payload && typeof data.payload !== 'object') return false;
    const allowedTypes = ['auth', 'subscribe:crawl', 'unsubscribe:crawl', 'ping'];
    if (!allowedTypes.includes(data.type)) return false;
    return true;
  }

  validateAuthToken(token) {
    try {
      return typeof token === 'string' && token.length > 10;
    } catch (error) {
      return false;
    }
  }

  validateCrawlId(crawlId) {
    return typeof crawlId === 'string' &&
           crawlId.length > 0 &&
           crawlId.length <= 100 &&
           /^[a-zA-Z0-9_-]+$/.test(crawlId);
  }

  checkRateLimit(clientId) {
    const now = Date.now();
    const limits = this.rateLimits.get(clientId) || { count: 0, resetTime: now + 60000 };
    if (now > limits.resetTime) {
      limits.count = 0;
      limits.resetTime = now + 60000;
    }
    if (limits.count >= 100) {
      return false;
    }
    limits.count++;
    this.rateLimits.set(clientId, limits);
    return true;
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveTimeout = 5 * 60 * 1000;
    this.clients.forEach((client, clientId) => {
      if (client.lastActivity && (now - client.lastActivity > inactiveTimeout)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1001, '连接超时');
        }
        this.clients.delete(clientId);
        if (client.subscribedCrawlId) {
          const subscribers = this.subscriptions.get(client.subscribedCrawlId);
          if (subscribers) {
            subscribers.delete(clientId);
            if (subscribers.size === 0) {
              this.subscriptions.delete(client.subscribedCrawlId);
            }
          }
        }
      }
    });
  }

  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client?.subscribedCrawlId) {
      const subscribers = this.subscriptions.get(client.subscribedCrawlId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(client.subscribedCrawlId);
        }
      }
    }
    this.clients.delete(clientId);
    this.rateLimits.delete(clientId);
  }

  handleClientError(clientId, error) {
    console.error(`WebSocket客户端错误 (客户端 ${clientId}):`, error);
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.close(1011, '服务器错误');
    }
  }

  handleUnknownMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.ws.send(JSON.stringify({
      type: 'error',
      message: '未知的消息类型',
      code: 'UNKNOWN_MESSAGE_TYPE',
      receivedType: data.type
    }));
  }

  getConnectionStats() {
    return {
      totalConnections: this.clients.size,
      authenticatedConnections: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      activeSubscriptions: this.subscriptions.size,
      timestamp: Date.now()
    };
  }

  /** @returns {WebSocketService | null} */
  static getInstance() {
    return wsServiceSingleton;
  }
}

module.exports = WebSocketService;
