# 📚 爬虫系统API文档

> **与主文档的关系**：[README.md](README.md) 说明整体启动方式与 **Vite 代理规则**。本文档专门描述 **Node 爬虫网关（Express）** 暴露在 **`http://localhost:3001/api`** 下的 HTTP 接口（路径以 `/api` 为前缀时在开发中经 Vite 转发到 3001）。**版本化接口** `/api/v1/*` 由 FastAPI（默认 **8000**）提供，详见 README「双后端说明」与 FastAPI 自带 `http://127.0.0.1:8000/docs`。

基于OpenAPI 3.0规范的API接口文档。

## 🔧 服务信息

- **服务名称**: Web Crawler API
- **版本**: 1.0.0
- **描述**: 基于Python的网页爬虫系统，支持链接、内容、图片三种爬取类型
- **基础URL**: `http://localhost:3001/api`

## 📋 接口列表

### 1. 健康检查
```
GET /health
```

**描述**: 检查服务是否正常运行

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "服务正常运行",
  "data": {
    "status": "ok"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 执行爬虫
```
POST /crawl
```

**描述**: 执行网页爬取任务

**请求参数**:
```json
{
  "type": "link",           // 爬虫类型: link, content, image
  "url": "https://example.com",  // 目标URL
  "depth": 2                 // 爬取深度 (1-10)
}
```

**参数验证规则**:
- `type`: 必需，必须是 ['link', 'content', 'image'] 之一
- `url`: 必需，必须是有效的URL格式
- `depth`: 可选，默认为2，范围1-10

**成功响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "爬虫执行成功",
  "data": {
    "id": "crawl_1774956315639_1ngqtrzbf",
    "timestamp": 1774956315639,
    "url": "https://example.com",
    "type": "link",
    "depth": 1,
    "items": 1,
    "time": 0.76,
    "data": [
      {
        "url": "https://example.com",
        "title": "Example Domain",
        "depth": 0,
        "links": ["https://iana.org/domains/example"]
      }
    ],
    "status": "completed",
    "progress": 100
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**错误响应**:
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "参数验证失败",
  "data": null,
  "details": "缺少必要参数: url",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. 获取爬取历史
```
GET /history?limit=50
```

**描述**: 获取爬取历史记录

**查询参数**:
- `limit`: 可选，返回记录数量限制 (1-100，默认50)

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "历史记录获取成功",
  "data": [
    {
      "id": "crawl_1774956315639_1ngqtrzbf",
      "timestamp": 1774956315639,
      "url": "https://example.com",
      "type": "link",
      "depth": 1,
      "items": 1,
      "time": 0.76,
      "status": "completed",
      "progress": 100
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. 删除历史记录
```
DELETE /history/{id}
```

**描述**: 删除指定历史记录

**路径参数**:
- `id`: 历史记录ID

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "历史记录删除成功",
  "data": {
    "success": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. 清空历史记录
```
DELETE /history
```

**描述**: 清空所有爬取历史记录

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "历史记录清空成功",
  "data": {
    "success": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📊 数据模型

### CrawlRecord
```typescript
interface CrawlRecord {
  id: string;              // 唯一ID
  timestamp: number;       // 时间戳
  url: string;             // 目标URL
  type: 'link' | 'content' | 'image';  // 爬虫类型
  depth: number;           // 爬取深度
  items: number;           // 爬取项目数
  time: number;            // 执行时间(秒)
  data?: any[];            // 爬取数据
  error?: string;          // 错误信息
  status: 'pending' | 'running' | 'completed' | 'failed';  // 状态
  progress: number;        // 进度(0-100)
}
```

## 🚨 错误码说明

| 错误码 | 描述 | HTTP状态码 |
|--------|------|-----------|
| `VALIDATION_ERROR` | 参数验证失败 | 400 |
| `INVALID_CRAWLER_TYPE` | 不支持的爬虫类型 | 400 |
| `INVALID_URL` | URL格式无效 | 400 |
| `INVALID_DEPTH` | 深度参数无效 | 400 |
| `INVALID_LIMIT` | limit参数无效 | 400 |
| `NOT_FOUND` | 记录不存在 | 404 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `CRAWLER_EXECUTION_FAILED` | 爬虫执行失败 | 500 |
| `RESULT_PARSE_FAILED` | 结果解析失败 | 500 |

## 🔐 安全性

目前API未实现认证机制，建议在生产环境中添加：
- API Key认证
- OAuth 2.0
- JWT Token

## 📈 性能建议

1. **爬虫执行**: 建议设置合理的爬取深度 (1-3)
2. **超时处理**: 建议设置超时时间 (60秒)
3. **频率限制**: 建议添加速率限制防止滥用

## 🔄 变更记录

- **2024-03-31**: 初始版本 (v1.0.0)
  - 添加标准化响应格式
  - 添加输入验证
  - 修复URL路径问题
  - 完成数据库迁移

---

*文档最后更新: 2024-03-31*