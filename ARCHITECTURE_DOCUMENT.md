# 爬虫网页项目完整架构文档

> **与主文档的关系**：[README.md](README.md) 是仓库的**单一入口**，描述默认如何启动（`npm run dev`）、端口、Vite 代理与双后端分工。本文档侧重**历史与深度的架构说明**（Node 网关、队列、Prisma、Python 爬虫分层等），可能与 README 中的「扩展 FastAPI」并行演进；若与 README 冲突，以 README 与当前 [vite.config.ts](vite.config.ts) 为准。

## 📋 文档概要

**项目名称**：网页爬虫系统
**文档版本**：v2.0
**最后更新**：2026-03-31
**适用阶段**：开发阶段 → 多用户扩展

---

## 1. 项目概述

### 1.1 项目目标

开发一个功能完善的网页爬虫系统，支持多种爬虫类型（链接、内容、图片），提供可视化的操作界面和任务管理功能。系统需要支持从个人使用到多用户服务的平滑扩展。

### 1.2 技术栈

- **前端**：React 19 + TypeScript + Vite + Redux Toolkit + TailwindCSS
- **后端**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL (Prisma ORM) + Redis (缓存/队列)
- **爬虫引擎**：Python 3 + BeautifulSoup/Scrapy
- **消息队列**：Bull + Redis
- **实时通信**：WebSocket (ws 库)
- **定时任务**：node-cron + Bull
- **部署**：Docker + PM2

### 1.3 系统特性

- ✅ 多类型爬虫支持（链接、内容、图片）
- ✅ 实时进度监控
- ✅ 定时任务调度
- ✅ 异步任务处理
- ✅ 可扩展的多用户架构
- ✅ RESTful API 设计
- ✅ 响应式 Web 界面

---

## 2. 系统架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (Presentation)                     │
│  React 19 + TypeScript + Redux Toolkit + Vite + TailwindCSS │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Crawler    │  │  Analysis   │  │  Settings   │        │
│  │   Page      │  │    Page     │  │    Page     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │ HTTP/WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端层 (Application)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   API层     │→ │  服务层     │→ │  队列层     │        │
│  │  Express    │  │  Services   │  │   Bull      │        │
│  │  WebSocket  │  │   Redis     │  │  Redis      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (Data)                           │
│  PostgreSQL (Prisma ORM) + Redis (Cache/Session/Queue)      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Crawl      │  │   Task      │  │   Config    │        │
│  │  Records    │  │  Schedules  │  │    Data     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python爬虫层 (Crawler)                    │
│  BaseCrawler + LinkCrawler + ContentCrawler + ImageCrawler  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Link      │  │  Content    │  │   Image     │        │
│  │  Crawler    │  │  Crawler    │  │  Crawler    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责划分

#### 2.2.1 前端模块

| 模块 | 职责 | 关键组件 |
|------|------|----------|
| **Layout** | 页面布局和导航 | Navbar, Footer, Sidebar |
| **Crawler** | 爬虫配置和执行 | ConfigForm, ControlPanel, Progress, Results |
| **Analysis** | 数据分析和可视化 | Charts, Tables, Statistics |
| **Settings** | 系统配置管理 | UserPreferences, SystemConfig |
| **Services** | API通信层 | api.ts, websocket.ts, crawler.ts |
| **Store** | 状态管理 | Redux slices, hooks |
| **Hooks** | 业务逻辑复用 | useCrawler, useWebSocket |

#### 2.2.2 后端模块

| 模块 | 职责 | 关键技术 |
|------|------|----------|
| **Config** | 配置管理 | 环境变量, 配置文件 |
| **Controllers** | 请求处理 | Express路由, 参数验证 |
| **Services** | 业务逻辑 | CrawlerService, TaskService, QueueService |
| **Models** | 数据模型 | Prisma ORM, 数据验证 |
| **Middleware** | 请求处理链 | 错误处理, 验证, 日志 |
| **Routes** | API路由 | RESTful设计, WebSocket |
| **Utils** | 工具函数 | 日志, 验证器, 格式化 |

#### 2.2.3 Python爬虫模块

| 模块 | 职责 | 功能特性 |
|------|------|----------|
| **BaseCrawler** | 基础爬虫类 | 通用方法, 错误处理, 进度报告 |
| **LinkCrawler** | 链接爬取 | 页面链接提取, 深度控制 |
| **ContentCrawler** | 内容爬取 | 文本提取, 结构化数据 |
| **ImageCrawler** | 图片爬取 | 图片下载, 格式处理 |
| **CrawlerManager** | 爬虫管理 | 进程控制, 并发管理 |

---

## 3. 详细设计

### 3.1 前端详细设计

#### 3.1.1 目录结构
```
src/
├── components/
│   ├── Layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   ├── Crawler/
│   │   ├── ConfigForm.tsx      # 爬虫配置表单
│   │   ├── ControlPanel.tsx    # 控制面板
│   │   ├── ProgressBar.tsx     # 进度条
│   │   ├── StatusIndicator.tsx # 状态指示器
│   │   └── ResultsTable.tsx    # 结果表格
│   ├── Analysis/
│   │   ├── DataCharts.tsx      # 数据图表
│   │   ├── Statistics.tsx      # 统计信息
│   │   └── ExportPanel.tsx     # 导出面板
│   └── Common/
│       ├── LoadingSpinner.tsx
│       ├── ErrorMessage.tsx
│       └── Modal.tsx
├── pages/
│   ├── Home/
│   │   ├── HomePage.tsx
│   │   └── HomeComponents.tsx
│   ├── Crawler/
│   │   ├── CrawlerPage.tsx
│   │   └── TaskList.tsx
│   ├── Analysis/
│   │   ├── AnalysisPage.tsx
│   │   └── DataVisualization.tsx
│   └── Settings/
│       ├── SettingsPage.tsx
│       └── ConfigManager.tsx
├── services/
│   ├── api.ts              # HTTP API 服务
│   ├── websocket.ts        # WebSocket 服务
│   └── crawler.ts          # 爬虫业务服务
├── store/
│   ├── index.ts            # Store 配置
│   └── slices/
│       ├── crawlerSlice.ts # 爬虫状态管理
│       ├── configSlice.ts  # 配置管理
│       └── tasksSlice.ts   # 任务管理
├── hooks/
│   ├── useCrawler.ts       # 爬虫业务 Hook
│   └── useWebSocket.ts     # WebSocket Hook
└── utils/
    ├── validators.ts       # 输入验证
    └── formatters.ts       # 数据格式化
```

#### 3.1.2 状态管理设计

```typescript
// Redux Store 结构
interface RootState {
  crawler: CrawlerState;
  config: ConfigState;
  tasks: TasksState;
}

interface CrawlerState {
  config: CrawlerConfig;      // 当前配置
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;           // 进度百分比
  currentCrawl: CrawlRecord | null;
  history: CrawlRecord[];     // 历史记录
  queue: CrawlQueueItem[];    // 队列状态
}

interface ConfigState {
  system: SystemConfig;       // 系统配置
  user: UserPreferences;      // 用户偏好
  crawler: CrawlerOptions;    // 爬虫选项
}

interface TasksState {
  schedules: TaskSchedule[];  // 定时任务
  active: string[];           // 活跃任务ID
  history: TaskHistory[];     // 任务历史
}
```

### 3.2 后端详细设计

#### 3.2.1 目录结构
```
server/
├── src/
│   ├── config/
│   │   ├── database.ts      # 数据库配置
│   │   ├── redis.ts         # Redis 配置
│   │   ├── crawler.ts       # 爬虫配置
│   │   └── index.ts         # 配置导出
│   ├── controllers/
│   │   ├── CrawlController.ts    # 爬取控制器
│   │   ├── TaskController.ts     # 任务控制器
│   │   ├── ConfigController.ts   # 配置控制器
│   │   └── HealthController.ts   # 健康检查
│   ├── services/
│   │   ├── CrawlerService.ts     # 爬虫服务
│   │   ├── TaskService.ts        # 任务服务
│   │   ├── QueueService.ts       # 队列服务
│   │   ├── WebSocketService.ts   # WebSocket服务
│   │   └── DatabaseService.ts    # 数据库服务
│   ├── models/
│   │   ├── CrawlRecord.ts        # 爬取记录模型
│   │   ├── TaskSchedule.ts       # 定时任务模型
│   │   └── SystemConfig.ts       # 系统配置模型
│   ├── middleware/
│   │   ├── errorHandler.ts       # 错误处理
│   │   ├── validation.ts         # 请求验证
│   │   └── logger.ts             # 日志中间件
│   ├── routes/
│   │   ├── api.ts                # API 路由
│   │   ├── crawls.ts             # 爬取路由
│   │   ├── tasks.ts              # 任务路由
│   │   └── websocket.ts          # WebSocket路由
│   └── utils/
│       ├── logger.ts             # 日志工具
│       ├── validators.ts         # 验证工具
│       └── formatters.ts         # 格式化工具
├── prisma/
│   └── schema.prisma             # 数据模型
└── package.json
```

#### 3.2.2 服务层设计

```typescript
// CrawlerService - 爬虫服务
class CrawlerService {
  async startCrawl(crawlId: string, config: CrawlerConfig): Promise<void>;
  async stopCrawl(crawlId: string): Promise<void>;
  async getCrawlStatus(crawlId: string): Promise<CrawlStatus>;
  async parseProgress(output: string, record: CrawlRecord): Promise<void>;
}

// TaskService - 任务服务
class TaskService {
  async createTask(config: TaskConfig): Promise<TaskSchedule>;
  async updateTask(id: string, config: Partial<TaskConfig>): Promise<void>;
  async deleteTask(id: string): Promise<void>;
  async executeTask(taskId: string): Promise<void>;
  async scheduleTasks(): Promise<void>;
}

// QueueService - 队列服务
class QueueService {
  async addCrawlJob(data: CrawlJobData): Promise<Job>;
  async getQueueStatus(): Promise<QueueStatus>;
  async pauseQueue(): Promise<void>;
  async resumeQueue(): Promise<void>;
}

// WebSocketService - WebSocket服务
class WebSocketService {
  constructor(server: Server);
  broadcast(message: WebSocketMessage): void;
  sendToClient(clientId: string, message: WebSocketMessage): void;
  sendCrawlProgress(crawlId: string, progress: ProgressData): void;
}
```

---

## 4. 数据模型设计

### 4.1 数据库 Schema

```prisma
// Prisma Schema - server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 爬取记录
model CrawlRecord {
  id          String   @id @default(uuid())
  userId      String   @default("default") // 后期多用户支持
  type        String   // link, content, image
  targetUrl   String   @db.Text
  depth       Int      @default(2)
  status      String   // pending, running, completed, failed, cancelled
  items       Int      @default(0)
  time        Float    @default(0.0)
  data        Json?    // 爬取结果数据
  error       String?  @db.Text
  config      Json?    // 爬虫配置
  progress    Float    @default(0.0) // 0-100
  currentUrl  String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status])
  @@index([createdAt])
  @@index([updatedAt])
}

// 定时任务
model TaskSchedule {
  id          String   @id @default(uuid())
  userId      String   @default("default")
  name        String
  type        String   // link, content, image
  url         String   @db.Text
  cron        String   // cron 表达式
  isActive    Boolean  @default(true)
  lastRun     DateTime?
  nextRun     DateTime?
  config      Json?    // 额外配置
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, isActive])
  @@index([nextRun])
  @@index([updatedAt])
}

// 系统配置
model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  metadata  Json?    // 元数据
  updatedAt DateTime @updatedAt

  @@index([key])
}

// 用户表（为多用户准备）
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String   // 哈希存储
  role      String   @default("user") // user, admin
  isActive  Boolean  @default(true)
  quota     Json?    // 资源配额
  settings  Json?    // 用户设置
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([username])
  @@index([email])
}
```

### 4.2 数据访问模式

```typescript
// 数据库服务接口
interface DatabaseService {
  // 爬取记录操作
  createCrawl(data: CreateCrawlData): Promise<CrawlRecord>;
  updateCrawl(id: string, data: UpdateCrawlData): Promise<CrawlRecord>;
  deleteCrawl(id: string): Promise<void>;
  getCrawl(id: string): Promise<CrawlRecord | null>;
  listCrawls(userId: string, options?: QueryOptions): Promise<CrawlRecord[]>;
  countCrawls(userId: string, status?: string): Promise<number>;

  // 定时任务操作
  createTask(data: CreateTaskData): Promise<TaskSchedule>;
  updateTask(id: string, data: UpdateTaskData): Promise<TaskSchedule>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<TaskSchedule | null>;
  listTasks(userId: string, active?: boolean): Promise<TaskSchedule[]>;
  updateTaskSchedule(id: string, lastRun: DateTime, nextRun: DateTime): Promise<void>;

  // 系统配置操作
  getConfig<T>(key: string, defaultValue?: T): Promise<T>;
  setConfig<T>(key: string, value: T, metadata?: any): Promise<void>;
  deleteConfig(key: string): Promise<void>;
}
```

---

## 5. API 接口设计

### 5.1 RESTful API

#### 5.1.1 爬取相关接口

| 方法 | 路径 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/api/crawls` | 创建爬取任务 | CrawlConfig | CrawlRecord |
| GET | `/api/crawls` | 获取爬取列表 | QueryParams | CrawlRecord[] |
| GET | `/api/crawls/:id` | 获取爬取详情 | id | CrawlRecord |
| PUT | `/api/crawls/:id` | 更新爬取任务 | id, CrawlConfig | CrawlRecord |
| DELETE | `/api/crawls/:id` | 删除爬取记录 | id | 204 |
| POST | `/api/crawls/:id/start` | 开始爬取 | id | { success: true } |
| POST | `/api/crawls/:id/stop` | 停止爬取 | id | { success: true } |
| GET | `/api/crawls/:id/progress` | 获取进度 | id | ProgressData |

**请求示例：**
```json
POST /api/crawls
{
  "type": "link",
  "url": "https://example.com",
  "depth": 3,
  "config": {
    "timeout": 30000,
    "userAgent": "Mozilla/5.0...",
    "headers": {}
  }
}
```

**响应示例：**
```json
{
  "id": "crawl_123",
  "status": "pending",
  "type": "link",
  "targetUrl": "https://example.com",
  "depth": 3,
  "createdAt": "2026-03-31T10:00:00Z"
}
```

#### 5.1.2 定时任务接口

| 方法 | 路径 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/api/tasks` | 创建定时任务 | TaskConfig | TaskSchedule |
| GET | `/api/tasks` | 获取任务列表 | QueryParams | TaskSchedule[] |
| GET | `/api/tasks/:id` | 获取任务详情 | id | TaskSchedule |
| PUT | `/api/tasks/:id` | 更新定时任务 | id, TaskConfig | TaskSchedule |
| DELETE | `/api/tasks/:id` | 删除定时任务 | id | 204 |
| POST | `/api/tasks/:id/execute` | 立即执行任务 | id | { success: true, jobId: "..." } |
| PUT | `/api/tasks/:id/toggle` | 启用/禁用任务 | id, isActive | TaskSchedule |

#### 5.1.3 系统配置接口

| 方法 | 路径 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/api/config/:key` | 获取配置 | key | ConfigValue |
| PUT | `/api/config/:key` | 更新配置 | key, value | ConfigValue |
| DELETE | `/api/config/:key` | 删除配置 | key | 204 |
| GET | `/api/config` | 获取所有配置 | - | ConfigMap |

#### 5.1.4 健康检查接口

| 方法 | 路径 | 描述 | 响应 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | { status: "healthy", timestamp: "..." } |
| GET | `/api/health/db` | 数据库检查 | { status: "connected", latency: 10 } |
| GET | `/api/health/redis` | Redis检查 | { status: "connected", latency: 5 } |
| GET | `/api/health/queue` | 队列状态 | { status: "active", waiting: 2, active: 1 } |

### 5.2 WebSocket 接口

#### 5.2.1 连接建立
```javascript
// 客户端连接
const ws = new WebSocket('ws://localhost:3001');

// 连接成功
ws.on('open', () => {
  console.log('WebSocket connected');

  // 订阅爬取任务进度
  ws.send(JSON.stringify({
    type: 'subscribe:crawl',
    crawlId: 'crawl_123'
  }));
});
```

#### 5.2.2 消息类型

```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

// 消息类型定义
const MessageTypes = {
  // 客户端消息
  'subscribe:crawl': '订阅爬取进度',
  'unsubscribe:crawl': '取消订阅',
  'ping': '心跳检测',

  // 服务器消息
  'crawl:progress': '爬取进度更新',
  'crawl:completed': '爬取完成',
  'crawl:failed': '爬取失败',
  'crawl:cancelled': '爬取取消',
  'task:scheduled': '任务已调度',
  'system:error': '系统错误',
  'pong': '心跳响应'
};
```

#### 5.2.3 进度更新示例
```json
{
  "type": "crawl:progress",
  "data": {
    "crawlId": "crawl_123",
    "progress": 65.5,
    "currentUrl": "https://example.com/page1",
    "items": 123,
    "speed": 2.5
  },
  "timestamp": "2026-03-31T10:30:00Z"
}
```

---

## 6. 性能要求与扩展性

### 6.1 性能指标

#### 6.1.1 并发处理能力
- **爬取任务并发数**：5-8 个同时执行
- **队列等待任务**：支持 50+ 任务排队
- **API 响应时间**：< 200ms (95% 请求)
- **WebSocket 连接**：支持 100+ 并发连接
- **数据库查询**：< 100ms (95% 查询)

#### 6.1.2 爬虫性能
- **单任务最大深度**：10 层
- **单任务超时时间**：300 秒
- **并发请求数**：3-5 个/任务
- **请求间隔**：1-3 秒 (可配置)
- **单任务最大页面数**：1000 个
- **爬取速度**：10-50 页面/分钟

#### 6.1.3 存储性能
- **爬取记录保留**：30 天 (可配置)
- **总记录数支持**：100,000+ 条
- **数据导出速度**：1000 条/秒
- **备份恢复时间**：< 5 分钟

### 6.2 扩展性设计

#### 6.2.1 水平扩展
```typescript
// 负载均衡配置
const loadBalancer = {
  algorithm: 'round-robin',
  healthCheck: '/api/health',
  servers: [
    { host: 'server1', port: 3001, weight: 1 },
    { host: 'server2', port: 3001, weight: 1 },
    { host: 'server3', port: 3001, weight: 1 }
  ]
};

// 分布式任务队列
const distributedQueue = {
  redis: {
    cluster: true,
    nodes: [
      { host: 'redis1', port: 6379 },
      { host: 'redis2', port: 6379 },
      { host: 'redis3', port: 6379 }
    ]
  },
  queuePrefix: 'crawler-cluster'
};
```

#### 6.2.2 资源隔离
```typescript
// 用户资源配额
interface UserQuota {
  maxConcurrentCrawls: number;  // 最大并发爬取数
  maxDailyCrawls: number;       // 每日最大爬取数
  maxDepth: number;             // 最大爬取深度
  maxUrlsPerCrawl: number;      // 单任务最大URL数
  rateLimit: number;            // 请求速率限制
  storageLimit: number;         // 存储限制(MB)
}

// 默认配额配置
const defaultQuota: UserQuota = {
  maxConcurrentCrawls: 3,
  maxDailyCrawls: 100,
  maxDepth: 5,
  maxUrlsPerCrawl: 500,
  rateLimit: 10,  // 请求/秒
  storageLimit: 1024  // MB
};
```

---

## 7. 安全架构

### 7.1 安全分层设计

#### 7.1.1 输入验证
```typescript
// 验证中间件
const validationMiddleware = {
  // URL 验证
  validateUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  // 深度验证
  validateDepth: (depth: number): boolean => {
    return Number.isInteger(depth) && depth >= 1 && depth <= 10;
  },

  // Cron 表达式验证
  validateCron: (cron: string): boolean => {
    const cronPattern = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronPattern.test(cron);
  }
};
```

#### 7.1.2 访问控制
```typescript
// 认证中间件
const authMiddleware = {
  // JWT 验证
  authenticate: async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  },

  // 权限检查
  authorize: (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }
};
```

#### 7.1.3 速率限制
```typescript
// 速率限制配置
const rateLimitConfig = {
  // API 速率限制
  api: {
    windowMs: 15 * 60 * 1000,  // 15分钟
    max: 100,                  // 最多100个请求
    message: 'Too many requests from this IP'
  },

  // 爬取速率限制
  crawl: {
    windowMs: 60 * 1000,       // 1分钟
    max: 60,                   // 最多60个请求
    perIP: true
  },

  // WebSocket 连接限制
  websocket: {
    maxConnections: 10,        // 每个IP最多10个连接
    maxMessagesPerMinute: 100  // 每分钟最多100条消息
  }
};
```

---

## 8. 部署架构

### 8.1 开发环境

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  # 前端开发服务器
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: frontend
    ports:
      - "5173:5173"
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
    environment:
      - VITE_API_URL=http://localhost:3001
      - VITE_WS_URL=ws://localhost:3001

  # 后端开发服务器
  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: backend
    ports:
      - "3001:3001"
    volumes:
      - ./server:/app/server
      - ./scripts:/app/scripts
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/crawler
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=development
    depends_on:
      - db
      - redis

  # PostgreSQL 数据库
  db:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=crawler
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis 缓存和队列
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Python 爬虫环境
  crawler:
    build:
      context: .
      dockerfile: Dockerfile.crawler
    volumes:
      - ./scripts:/app/scripts
      - ./data:/app/data
    environment:
      - PYTHONPATH=/app/scripts
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

### 8.2 生产环境

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  # 前端静态服务
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      target: frontend
    environment:
      - VITE_API_URL=/api
      - VITE_WS_URL=wss://your-domain.com
    restart: unless-stopped

  # 后端 API 服务
  backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: backend
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/crawler
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - PYTHON_PATH=/app/venv/bin/python
    depends_on:
      - db
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  # PostgreSQL 数据库
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=crawler
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G

  # Redis 集群
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    deploy:
      replicas: 3

  # 爬虫 Worker
  crawler-worker:
    build:
      context: .
      dockerfile: Dockerfile.crawler
    environment:
      - PYTHONPATH=/app/scripts
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    volumes:
      - ./scripts:/app/scripts
      - ./data:/app/data
    depends_on:
      - redis
      - backend
    restart: unless-stopped
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

volumes:
  postgres_data:
  redis_data:
```

---

## 9. 监控与维护

### 9.1 监控系统

```typescript
// 监控指标
const metrics = {
  // 应用指标
  app: {
    requestCount: new Counter({ name: 'http_requests_total', help: 'Total HTTP requests' }),
    requestDuration: new Histogram({ name: 'http_request_duration_seconds', help: 'HTTP request duration' }),
    errorCount: new Counter({ name: 'app_errors_total', help: 'Total application errors' })
  },

  // 爬虫指标
  crawler: {
    activeCrawls: new Gauge({ name: 'crawler_active_tasks', help: 'Active crawl tasks' }),
    completedCrawls: new Counter({ name: 'crawler_completed_tasks', help: 'Completed crawl tasks' }),
    failedCrawls: new Counter({ name: 'crawler_failed_tasks', help: 'Failed crawl tasks' }),
    crawlDuration: new Histogram({ name: 'crawler_duration_seconds', help: 'Crawl duration' }),
    crawledItems: new Counter({ name: 'crawler_items_total', help: 'Total crawled items' })
  },

  // 队列指标
  queue: {
    waitingJobs: new Gauge({ name: 'queue_waiting', help: 'Waiting jobs in queue' }),
    activeJobs: new Gauge({ name: 'queue_active', help: 'Active jobs in queue' }),
    completedJobs: new Counter({ name: 'queue_completed', help: 'Completed jobs' }),
    failedJobs: new Counter({ name: 'queue_failed', help: 'Failed jobs' })
  },

  // 系统指标
  system: {
    cpuUsage: new Gauge({ name: 'system_cpu_usage', help: 'CPU usage percentage' }),
    memoryUsage: new Gauge({ name: 'system_memory_usage', help: 'Memory usage in bytes' }),
    diskUsage: new Gauge({ name: 'system_disk_usage', help: 'Disk usage in bytes' })
  }
};
```

### 9.2 日志系统

```typescript
// 日志配置
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],

  // 日志轮转
  rotation: {
    size: '10m',  // 10MB
    count: 5      // 保留5个文件
  },

  // 敏感信息过滤
  redact: [
    'password',
    'token',
    'secret',
    'authorization'
  ]
};
```

---

## 10. 实施计划

### 10.1 第一阶段：基础架构（2周）

**Week 1：数据库和API层**
- [ ] 统一数据库访问层（Prisma）
- [ ] 完善数据模型定义
- [ ] 实现基础 CRUD API
- [ ] 添加请求验证中间件

**Week 2：服务层和队列**
- [ ] 创建 CrawlerService
- [ ] 集成 Bull 任务队列
- [ ] 实现 Redis 缓存
- [ ] 添加基础错误处理

### 10.2 第二阶段：核心功能（2周）

**Week 3：实时通信和定时任务**
- [ ] 实现 WebSocket 服务
- [ ] 集成定时任务系统
- [ ] 优化爬虫执行器
- [ ] 添加进度推送功能

**Week 4：前端集成**
- [ ] 集成 WebSocket 客户端
- [ ] 优化 Redux 状态管理
- [ ] 完善组件拆分
- [ ] 添加实时进度展示

### 10.3 第三阶段：多用户准备（2周）

**Week 5：认证授权**
- [ ] 实现 JWT 认证
- [ ] 添加用户管理 API
- [ ] 实现权限控制
- [ ] 数据隔离设计

**Week 6：资源管理**
- [ ] 实现配额系统
- [ ] 添加使用统计
- [ ] 优化性能监控
- [ ] 完善错误处理

### 10.4 第四阶段：优化部署（2周）

**Week 7：性能优化**
- [ ] 数据库查询优化
- [ ] 添加缓存策略
- [ ] 优化爬虫算法
- [ ] 压力测试

**Week 8：生产准备**
- [ ] 完善 Docker 配置
- [ ] 添加监控告警
- [ ] 安全加固
- [ ] 文档完善

---

## 11. 风险控制

### 11.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| Python 爬虫失败 | 高 | 中 | 完善的错误处理和重试机制 |
| 数据库连接异常 | 高 | 低 | 连接池管理，自动重连 |
| Redis 故障 | 中 | 中 | 降级策略，本地缓存 |
| 网络请求超时 | 中 | 高 | 超时设置，重试机制 |

### 11.2 业务风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 爬虫被封禁 | 中 | 请求间隔控制，User-Agent 轮换 |
| 数据丢失 | 高 | 定期备份，数据验证 |
| 性能瓶颈 | 中 | 水平扩展，缓存优化 |
| 安全漏洞 | 高 | 代码审计，安全测试 |

---

## 12. 参考文档

- [Prisma 文档](https://www.prisma.io/docs/)
- [Bull 队列文档](https://optimalbits.github.io/bull/)
- [WebSocket 文档](https://github.com/websockets/ws)
- [React 文档](https://react.dev/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)

---

**文档版本历史：**
- v1.0 (2026-03-30): 初始版本
- v2.0 (2026-03-31): 完整架构设计，包含详细的技术规范和实施计划