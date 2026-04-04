# 生产部署与远程访问（手机 / 其他设备）

目标：在同一台机器上构建前端，由 **Node 网关（默认 3001）** 同时提供静态页面、爬虫 API、WebSocket，并把 **`/api/v1` 转发到本机 FastAPI（8000）**。外网或局域网设备通过 **`http://服务器IP:端口`** 访问即可。

---

## 1. 准备运行环境

在同一台服务器上需要：

| 组件 | 说明 |
|------|------|
| Node.js | ≥ 18，`npm install` 根目录与 `server/` |
| Redis | Bull 队列（与开发一致） |
| PostgreSQL | 与 `server` Prisma、`backend` 连接串一致时可用 |
| Python 3 | 供 `crawlRunner` 拉起 `src/scripts/crawler/async_crawler_manager.py` |
| FastAPI（可选） | AI 分析、模板等 `/api/v1`；不启动则相关页会报错 |

数据库可用：

```bash
docker compose up -d postgres
```

---

## 2. 构建前端

在项目根目录：

```bash
npm install
npm run build
```

生成 `dist/`。若 API 与页面不同域，先按根目录 `.env.production.example` 配置 `VITE_API_BASE_URL` 等再构建。

---

## 3. 安装网关依赖并启动生产进程

```bash
npm install --prefix server
```

环境变量（按需）：

| 变量 | 默认值 | 含义 |
|------|--------|------|
| `NODE_ENV` | — | 必须为 `production` 才会托管 `dist`、代理 `/api/v1` |
| `PORT` | `3001` | 对外 HTTP 端口 |
| `LISTEN_HOST` | `0.0.0.0` | 绑定所有网卡，手机才能用局域网 IP 访问 |
| `FASTAPI_URL` | `http://127.0.0.1:8000` | 生产时代理 `/api/v1` 的目标 |
| `SERVE_STATIC` | — | 设为 `0` 时只跑 API，不托管 `dist` |

启动（项目根目录）：

```bash
npm run start:prod
```

或使用 PM2 等常驻：

```bash
NODE_ENV=production PORT=3001 LISTEN_HOST=0.0.0.0 pm2 start server/src/index.js --name spiderx
```

另开终端启动 FastAPI（若需要 AI/模板）：

```bash
# 示例：在 backend 目录按你现有方式启动，监听 8000
bash backend/scripts/run_dev.sh
# 或 uvicorn / gunicorn，保证与 FASTAPI_URL 一致
```

---

## 4. 防火墙与路由器

- **本机防火墙**：放行 `PORT`（如 3001）。
- **云服务器**：在安全组中放行该 TCP 端口。
- **家庭宽带**：若要从公网访问，通常需端口映射或使用内网穿透（frp、Cloudflare Tunnel 等）；**公网暴露爬虫能力存在安全风险**，建议至少加反向代理、HTTPS 与访问控制。

---

## 5. 手机访问方式

1. 确保手机与服务器在同一局域网（或已打通公网端口）。
2. 在服务器上查看 IP，例如 macOS/Linux：`ipconfig getifaddr en0` 或 `hostname -I`。
3. 手机浏览器打开：`http://192.168.x.x:3001`（端口与 `PORT` 一致）。

前端默认使用**相对路径**调用 `/api` 与 `/ws`，WebSocket 会使用 `ws://当前页面主机:端口/ws`，无需再改手机上的 localhost。

---

## 6. HTTPS 与域名（推荐）

生产环境建议在 Node 前加 **Nginx / Caddy**：

- 终止 TLS（`https`），证书可用 Let’s Encrypt。
- 反代到 `http://127.0.0.1:3001`。
- 配置 `proxy_set_header Upgrade` / `Connection` 以支持 **WebSocket**。

浏览器走 `https` 时，前端会自动使用 `wss://` 连接 WebSocket。

---

## 7. 常见问题

- **页面空白**：确认已执行 `npm run build` 且 `dist/index.html` 存在。
- **AI/模板 502**：确认 FastAPI 已监听，且 `FASTAPI_URL` 正确。
- **爬虫不跑**：检查 Python 依赖、Redis、以及服务器是否能访问目标网站。

更多启动细节见 [STARTUP.md](./STARTUP.md)。
