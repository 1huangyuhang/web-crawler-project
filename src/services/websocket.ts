/**
 * WebSocket 客户端服务
 * 实现实时进度接收和安全性处理
 */

import { logger } from './logger';

/** 服务端会推送的爬取相关消息类型（仅注册 crawl:progress 会收不到 completed/failed） */
const CRAWL_MESSAGE_TYPES = [
  'crawl:progress',
  'crawl:completed',
  'crawl:failed',
  'crawl:started'
] as const

/** 服务端要求 subscribe 前必须先 auth；token 需为长度 >10 的字符串才会通过当前校验逻辑 */
function defaultWsAuthToken(): string {
  const fromEnv =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WS_AUTH_TOKEN : undefined
  if (fromEnv) return String(fromEnv)
  return 'anonymous-ws-dev-token'
}

function resolveWebSocketUrl(): string {
  const envWs =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WS_URL : undefined
  if (envWs) {
    return String(envWs)
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws`
  }
  return 'ws://127.0.0.1:3001/ws'
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 初始重连延迟
  private maxReconnectDelay: number = 30000; // 最大重连延迟
  private messageQueue: Array<string> = [];
  private authToken: string | null = null;
  private subscriptions: Set<string> = new Set();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private url: string;
  /** 当前连接是否已通过服务端 auth（subscribe:crawl 依赖此状态） */
  private authResolved = false;
  private authWaiters: Array<(ok: boolean) => void> = [];

  constructor() {
    this.url = resolveWebSocketUrl()
  }

  /**
   * 连接到WebSocket服务器
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.url = resolveWebSocketUrl()
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => this.handleOpen(resolve);
        this.ws.onclose = () => this.handleClose();
        this.ws.onerror = (error) => this.handleError(error, reject);
        this.ws.onmessage = (event) => this.handleMessage(event);

        // 设置连接超时
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('连接超时'));
          }
        }, 10000); // 10秒连接超时

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理连接打开
   */
  private handleOpen(resolve: () => void) {
    logger.info('WebSocket连接已建立', { url: this.url });
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.authResolved = false;

    // 必须先 auth 才能 subscribe:crawl；未配置时也发开发用 token
    this.authenticate(this.authToken ?? defaultWsAuthToken())

    // 处理消息队列
    this.processMessageQueue();

    // 禁止在此处发 subscribe：此时 auth 响应可能尚未到达，会触发服务端「未经认证」。
    // 重连后由业务层在 ensureAuthenticated() 之后再 subscribe（见 useCrawler onConnectionChange）。

    // 通知连接状态变化
    this.connectionCallbacks.forEach(callback => callback(true));
    resolve();
  }

  /**
   * 处理连接关闭
   */
  private handleClose() {
    logger.warn('WebSocket连接已关闭');
    this.ws = null;
    this.authResolved = false;
    const waiters = this.authWaiters;
    this.authWaiters = [];
    waiters.forEach((w) => w(false));

    // 通知连接状态变化
    this.connectionCallbacks.forEach(callback => callback(false));

    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnect();
    }
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Event, reject: (reason?: any) => void) {
    logger.error('WebSocket连接错误', error, { url: this.url });
    reject(error);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      this.handleServerMessage(data);
    } catch (error) {
      logger.error('解析WebSocket消息失败', error, { data: event.data });
    }
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(data: any) {
    if (data.type === 'error') {
      logger.warn('WebSocket 服务端返回错误', { message: data.message, code: data.code })
    }

    const handlers = this.messageHandlers.get(data.type);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }

    // 特殊处理认证响应（须在 subscribe:crawl 之前完成）
    if (data.type === 'auth') {
      const waiters = this.authWaiters;
      this.authWaiters = [];
      if (data.status === 'success') {
        logger.info('WebSocket认证成功');
        this.authResolved = true;
        waiters.forEach((w) => w(true));
      } else {
        logger.error('WebSocket认证失败', { reason: data.message });
        waiters.forEach((w) => w(false));
        this.disconnect();
      }
    }
  }

  /**
   * 等待服务端 auth 成功后再发 subscribe（避免竞态导致「未经认证」）
   */
  /**
   * 未连接则先 connect，再等待 auth；用于队列爬取开始前与重连后恢复订阅。
   */
  async ensureAuthenticatedWithRecovery(timeoutMs = 8000): Promise<boolean> {
    try {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        await this.connect();
      }
      await this.ensureAuthenticated(timeoutMs);
      this.processMessageQueue();
      for (const crawlId of this.subscriptions) {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send({
            type: 'subscribe:crawl',
            payload: { crawlId }
          });
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  ensureAuthenticated(timeoutMs = 8000): Promise<void> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket 未连接'));
    }
    if (this.authResolved) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this.authWaiters.indexOf(onAuth);
        if (idx >= 0) this.authWaiters.splice(idx, 1);
        reject(new Error('WebSocket 认证超时'));
      }, timeoutMs);
      const onAuth = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        const idx = this.authWaiters.indexOf(onAuth);
        if (idx >= 0) this.authWaiters.splice(idx, 1);
        if (ok) resolve();
        else reject(new Error('WebSocket 认证失败'));
      };
      this.authWaiters.push(onAuth);
    });
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token: string) {
    this.authToken = token;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.authenticate(token);
    }
  }

  /**
   * 发送认证
   */
  private authenticate(token: string) {
    this.send({
      type: 'auth',
      payload: { token }
    });
  }

  /**
   * 发送消息
   */
  send(message: any) {
    const messageStr = JSON.stringify(message);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(messageStr);
    } else {
      // 如果未连接，将消息加入队列
      this.messageQueue.push(messageStr);
    }
  }

  /**
   * 处理消息队列
   */
  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(message);
      }
    }
  }

  /**
   * 订阅爬取进度
   */
  subscribeToCrawl(crawlId: string, handler: (data: any) => void): () => void {
    if (!this.subscriptions.has(crawlId)) {
      this.subscriptions.add(crawlId);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'subscribe:crawl',
          payload: { crawlId }
        });
      }
    }

    for (const t of CRAWL_MESSAGE_TYPES) {
      if (!this.messageHandlers.has(t)) {
        this.messageHandlers.set(t, new Set());
      }
      this.messageHandlers.get(t)!.add(handler);
    }

    // 返回取消订阅函数
    return () => {
      this.unsubscribeFromCrawl(crawlId, handler);
    };
  }

  /**
   * 取消订阅爬取进度
   */
  unsubscribeFromCrawl(crawlId: string, handler: (data: any) => void) {
    if (this.subscriptions.has(crawlId)) {
      this.subscriptions.delete(crawlId);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'unsubscribe:crawl',
          payload: { crawlId }
        });
      }
    }

    for (const t of CRAWL_MESSAGE_TYPES) {
      const set = this.messageHandlers.get(t);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.messageHandlers.delete(t);
        }
      }
    }
  }

  /**
   * 订阅连接状态变化
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * 订阅通用消息
   */
  onMessage(type: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    return () => {
      if (this.messageHandlers.has(type)) {
        this.messageHandlers.get(type)!.delete(handler);
        if (this.messageHandlers.get(type)!.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.subscriptions.clear();
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close(1000, '正常关闭');
      this.ws = null;
    }
  }

  /**
   * 尝试重连
   */
  private reconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    logger.info(`WebSocket尝试重连 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, { delay });

    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect().catch(error => {
          logger.error('WebSocket重连失败', error);
          this.reconnect();
        });
      } else {
        logger.error('WebSocket重连次数已达到最大值');
      }
    }, delay);
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions)
    };
  }

  /**
   * 发送心跳
   */
  sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping', timestamp: Date.now() });
    }
  }
}

const wsClient = new WebSocketClient();

// 定期发送心跳
setInterval(() => {
  wsClient.sendPing();
}, 30000); // 每30秒发送一次心跳

export const websocketService = {
  connect: () => wsClient.connect(),
  disconnect: () => wsClient.disconnect(),
  ensureAuthenticated: (timeoutMs?: number) => wsClient.ensureAuthenticated(timeoutMs),
  ensureAuthenticatedWithRecovery: (timeoutMs?: number) =>
    wsClient.ensureAuthenticatedWithRecovery(timeoutMs),
  subscribeToCrawl: (crawlId: string, handler: (data: any) => void) => wsClient.subscribeToCrawl(crawlId, handler),
  unsubscribeFromCrawl: (crawlId: string, handler: (data: any) => void) => wsClient.unsubscribeFromCrawl(crawlId, handler),
  onConnectionChange: (callback: (connected: boolean) => void) => wsClient.onConnectionChange(callback),
  onMessage: (type: string, handler: (data: any) => void) => wsClient.onMessage(type, handler),
  setAuthToken: (token: string) => wsClient.setAuthToken(token),
  getConnectionStatus: () => wsClient.getConnectionStatus()
};

export default wsClient;