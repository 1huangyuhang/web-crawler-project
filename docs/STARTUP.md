# SpiderX 启动说明（前后端）

本文专门说明 **如何在本地把前端、Node 网关、可选 FastAPI 跑起来**。更完整的架构与接口说明见 [README.md](../README.md)、[PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md)、[API_DOCUMENTATION.md](../API_DOCUMENTATION.md)。

---

## 1. 你将得到什么

| 服务 | 目录 | 默认端口 | 作用 |
|------|------|----------|------|
| **前端（Vite）** | 仓库根目录 | **5173**（被占用时会顺延） | React SPA；开发时代理 `/api`、`/ws`、`/api/v1` |
| **Node 爬虫网关** | [server/](../server/) | **3001** | 爬取 API、Bull 队列、WebSocket、拉起 Python 爬虫 |
| **FastAPI（可选）** | [backend/](../backend/) | **8000** | `/api/v1/*`（如 AI 分析）；OpenAPI：`/docs` |
| **Redis** | 本机 | **6379** | Bull 队列（强烈建议启动） |
| **PostgreSQL** | 本机 | 自定 | Prisma / 历史存储（按功能可选） |

浏览器开发时通常只打开：**`http://localhost:5173`**（或终端里 Vite 打印的地址）。前端会通过 [vite.config.ts](../vite.config.ts) 把请求转发到 3001 / 8000。

---

## 2. 前置条件

- **Node.js** ≥ 18  
- **npm**（与 Node 配套）  
- **Python 3**（建议 3.11+）：用于 `src/scripts/crawler/` 下的爬虫脚本（由 Node `spawn` 调用）  
- **Redis**：队列与部分逻辑依赖；未启动时可能出现连接错误或队列不可用（见 [README 常见问题](../README.md)）  
- **PostgreSQL**：若需持久化历史等且已配置 Prisma，再准备数据库  

**Python 依赖**：首次跑爬取若报缺包，按终端报错用 `pip install` 补齐（常见如 `aiohttp`、`beautifulsoup4` 等，以脚本实际 import 为准）。

---

## 3. 安装依赖（首次必做）

在 **仓库根目录**：

```bash
npm install
```

Node 网关在子目录 **server/**，需 **单独安装** 其依赖（根目录的 `npm run dev:server` 会进入该目录执行脚本，但依赖必须已存在于 `server/node_modules`）：

```bash
npm install --prefix server
```

若使用 Prisma 且修改过 schema，可在 `server/` 内执行生成客户端（按需）：

```bash
cd server && npx prisma generate && cd ..
```

---

## 4. 推荐：一条命令启动「前端 + Node 网关」

仍在 **仓库根目录**：

```bash
npm run dev
```

等价于 **并行**：

- `npm run dev:server` → [server/package.json](../server/package.json) 里的 `nodemon src/index.js`（端口默认 **3001**）  
- `npm run dev:vite` → Vite 开发服务器（默认 **5173**）  

**验证**：

1. 浏览器打开 Vite 地址（一般为 `http://localhost:5173`）。  
2. 另开终端：`curl -s http://127.0.0.1:3001/api/health`（具体响应见 [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)）。  

---

## 5. 分终端启动（便于看日志）

**终端 A — Node 网关**

```bash
npm run dev:server
```

**终端 B — 仅前端**

```bash
npm run dev:vite
```

仅前端、不启网关时，接口与 WebSocket 会失败，适合只改 UI 时使用 `npm run dev:vite`。

---

## 6. 可选：启动 FastAPI（AI 分析等）

依赖 **`/api/v1/*`** 的页面（如 AI 分析）需要 **8000** 上的 FastAPI。新开终端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env           # 按需填写数据库、REDIS、DEEPSEEK_API_KEY 等
alembic upgrade head         # 若使用数据库迁移
uvicorn app.main:app --reload --port 8000
```

- 交互式 API 文档：**http://127.0.0.1:8000/docs**  
- 开发模式下，Vite 会把 **`/api/v1`** 代理到 **127.0.0.1:8000**（见 [vite.config.ts](../vite.config.ts)）。

---

## 7. 生产构建与预览（前端）

```bash
npm run build
npm run preview
```

生产环境需配置 **`VITE_API_BASE_URL`** 指向真实 API（不要带末尾 `/api`，见 [src/config/api.ts](../src/config/api.ts)）。Node / FastAPI 的生产部署不在本文展开，请参考各目录内配置与运维习惯。

---

## 8. 环境变量速查

详细说明见 [README.md「环境变量」](../README.md#环境变量)。

| 位置 | 常见变量 |
|------|----------|
| 根目录（Vite） | `VITE_API_BASE_URL`、`VITE_ENV` |
| `server/` | `PORT`（默认 3001）、`REDIS_HOST`、`REDIS_PORT`、`DATABASE_URL`、`JWT_SECRET`、`API_KEY` |
| `backend/` | 复制 `.env.example` → `.env`：`DATABASE_URL`、`REDIS_URL`、`SECRET_KEY`、`DEEPSEEK_API_KEY` 等 |

**不要将含密钥的 `.env` 提交到 Git。**

---

## 9. 启动后对照检查清单

- [ ] Redis 已运行（若队列报错，先检查本机 6379）。  
- [ ] `curl http://127.0.0.1:3001/api/health` 正常。  
- [ ] 浏览器能打开 Vite 页面；导航 Hash 为 `#home`、`#crawler` 等（见 [Navbar](../src/components/Navbar/Navbar.tsx)）。  
- [ ] 需要 AI 时：8000 已启动且 `.env` 配置完整。  
- [ ] 爬取失败时：看 Node 终端里 Python 命令与 stderr，确认 Python 与依赖可用。  

更多故障现象见 [README「常见问题」](../README.md#常见问题)。

---

## 10. 相关 npm 脚本（根目录）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并行：Node 网关 + Vite |
| `npm run dev:vite` | 仅 Vite |
| `npm run dev:server` | 仅 `server/`（Express） |
| `npm run build` | `tsc -b` + `vite build` |
| `npm run preview` | 预览构建产物 |
| `npm run lint` / `npm run test:run` | 代码检查与测试 |

`server/` 内：`npm start` 生产启动；`npm run dev` 使用 nodemon。
