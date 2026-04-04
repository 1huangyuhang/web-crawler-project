# 生产部署与远程访问（手机 / 其他设备）

目标：在同一台机器上构建前端，由 **Node 网关（默认 3001）** 同时提供静态页面、爬虫 API、WebSocket，并把 **`/api/v1` 转发到本机 FastAPI（8000）**。外网或局域网设备通过 **`http(s)://服务器:端口`** 访问。

**环境变量清单**：根目录 [`.env.production.example`](../.env.production.example)（Vite 构建）+ [`deploy/production.env.example`](../deploy/production.env.example)（Node 运行时）。

**反向代理示例**：[`deploy/nginx-spiderx.conf.example`](../deploy/nginx-spiderx.conf.example)。

---

## 0. 分支约定（生产必须用 `main`）

- **生产环境只从 `main` 分支部署。** 合并与发版流程应在本地或 CI 上先把变更合入 `main`，再在服务器拉取。
- 服务器上固定使用：

```bash
git fetch origin
git checkout main
git pull origin main
```

- 不要在生产机长期停留在 `develop`、功能分支或 detached HEAD；避免「线上代码与仓库主线不一致」。

下文「推荐部署流程」默认你已处于 **`main`** 且与 `origin/main` 同步。

---

## 1. 推荐部署流程（最熟悉、单机一台）

这是团队里最常用的一条路径：**一台 Linux 云主机（或长期运行的机器）**、`main` 分支、同机 Node + Redis +（可选）PostgreSQL +（可选）FastAPI；对外先用 HTTP 端口，需要域名时再套 **Nginx + Let’s Encrypt**（见第 7 节）。

在服务器项目根目录依次执行（按需跳过数据库 / FastAPI）：

```bash
# 1) 代码：只用 main
git clone <你的仓库 URL> spiderx && cd spiderx
git checkout main && git pull origin main

# 2) 数据库（可选，与默认连接串一致时）
docker compose up -d postgres

# 3) 环境变量（勿提交 deploy/production.env）
cp deploy/production.env.example deploy/production.env
# 编辑 deploy/production.env：至少确认 NODE_ENV、PORT、LISTEN_HOST、DATABASE_URL、REDIS_*、JWT_SECRET、API_KEY

# 4) 同域部署时无需 .env.production；若前后端分域，先配 .env.production 再构建
npm install
npm install --prefix server

# 5) 构建静态资源
npm run build

# 6) 启动 Node 生产进程（二选一）
set -a && source deploy/production.env && set +a && npm run start:prod

# 或使用 PM2 常驻（环境变量可写在 ecosystem 或先 export）
# NODE_ENV=production PORT=3001 LISTEN_HOST=0.0.0.0 pm2 start server/src/index.js --name spiderx
# pm2 save && pm2 startup
```

**后续可选——AI / 模板页**：另开进程启动 FastAPI，与 `FASTAPI_URL` 一致：

```bash
bash backend/scripts/run_dev.sh
```

**后续可选——公网 HTTPS**：Node 仅监听 `127.0.0.1:3001`，前面加 Nginx 443，按本文 **第 7 节** 与 [`deploy/nginx-spiderx.conf.example`](../deploy/nginx-spiderx.conf.example) 配置，并用 `certbot --nginx` 申请证书。

**验证**：`curl -s http://127.0.0.1:3001/api/health` 应返回 JSON；手机局域网访问 `http://<服务器IP>:3001`（防火墙放行见第 6 节）。

---

## 2. 准备运行环境

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

## 3. 构建前端

在项目根目录：

```bash
npm install
npm run build
```

生成 `dist/`。若 API 与页面不同域，先复制 `.env.production.example` 为 `.env.production` 并填写 `VITE_*` 后再执行 `npm run build`。

---

## 4. 环境变量（汇总）

### 前端构建（Vite，仓库根目录）

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 同域部署留空；分域时填 API 根 URL，**不要**末尾 `/`，路径里已含 `/api` |
| `VITE_WS_URL` | 可选；不填则浏览器用当前页面的 `ws(s)://host/ws` |

### Node 网关（生产进程）

见 [`deploy/production.env.example`](../deploy/production.env.example)。常用项：

| 变量 | 默认 | 含义 |
|------|------|------|
| `NODE_ENV` | — | 必须为 **`production`** 才会托管 `dist`、代理 `/api/v1` |
| `PORT` | `3001` | HTTP 监听端口 |
| `LISTEN_HOST` | `0.0.0.0` | **`0.0.0.0`** 允许局域网/外网网卡访问；仅本机可设 `127.0.0.1` |
| `FASTAPI_URL` | `http://127.0.0.1:8000` | 反代 `/api/v1` 的目标 |
| `SERVE_STATIC` | — | 设为 `0` 时只跑 API，不托管 `dist` |
| `DATABASE_URL` | 见 `server/src/db.js` | PostgreSQL 连接串 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | 见 QueueService | Redis |
| `JWT_SECRET` / `API_KEY` | 开发有弱默认值 | **生产必须改为强随机串** |

从示例文件加载启动（任选其一）：

```bash
# 使用 export（bash）
set -a && source deploy/production.env && set +a && npm run start:prod

# 或 PM2 ecosystem 里写入 env 字段
```

`deploy/production.env` 已在 `.gitignore` 中，请勿把含密码的文件提交进 Git。

---

## 5. 安装依赖并启动生产进程

```bash
npm install --prefix server
npm run start:prod
```

PM2 示例：

```bash
NODE_ENV=production PORT=3001 LISTEN_HOST=0.0.0.0 pm2 start server/src/index.js --name spiderx
```

另开终端启动 FastAPI（若需要 AI/模板）：

```bash
bash backend/scripts/run_dev.sh
# 或 uvicorn，保证与 FASTAPI_URL 一致
```

---

## 6. 防火墙放行

按你的系统**放行 `PORT`（及 Nginx 的 80/443）**。爬虫控制台暴露在公网风险高，优先仅局域网或配合 VPN / 隧道。

### Linux：UFW（Ubuntu/Debian）

```bash
sudo ufw allow 3001/tcp comment 'spiderx-node'
sudo ufw allow 'Nginx Full'   # 若前面挂了 Nginx 做 HTTPS
sudo ufw reload
sudo ufw status
```

### Linux：firewalld（CentOS/RHEL/Fedora）

```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

### macOS

系统设置 → 网络 → 防火墙 → 选项：允许传入连接 **node**；或使用 **仅允许已签名软件**。开发机局域网测试时也可暂时关闭防火墙验证连通性。

### Windows

「Windows 安全中心」→ 防火墙 → 高级设置 → 入站规则 → 新建规则 → 端口 → TCP → 指定 `3001`（及 80/443）。

### 云主机（阿里云 / 腾讯云 / AWS 等）

在控制台 **安全组** 中添加入站：**TCP 3001**（若直连 Node）或 **80、443**（若仅暴露 Nginx）。

---

## 7. HTTPS（推荐：Nginx 终止 TLS + 反代 Node）

1. 将 [`deploy/nginx-spiderx.conf.example`](../deploy/nginx-spiderx.conf.example) 复制到服务器，把 `server_name` 改成你的域名，`upstream` 端口与 `PORT` 一致。
2. 安装证书（Let’s Encrypt）：

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

3. 确保证书生成的 `server { listen 443 ssl; ... }` 块里仍包含：

   - `proxy_set_header Upgrade $http_upgrade;`
   - `proxy_set_header Connection "upgrade";`

   否则 **WebSocket**（`/ws`）在 HTTPS 下会失败。

4. 浏览器通过 **`https://your.domain.com`** 访问时，前端会自动使用 **`wss://`** 连接 WebSocket。

### Caddy（更简单，自动 HTTPS）

示例 `Caddyfile`：

```text
your.domain.com {
    reverse_proxy 127.0.0.1:3001
}
```

`reverse_proxy` 默认会转发 WebSocket。安装 Caddy 后 `sudo caddy run` 或 systemd 托管即可。

---

## 8. 手机访问（局域网）

1. 手机与服务器同一 Wi‑Fi（或已打通端口映射 / 隧道）。
2. 查服务器局域网 IP：`ipconfig getifaddr en0`（macOS）或 `hostname -I`（Linux）。
3. 浏览器打开：`http://192.168.x.x:3001`（端口与 `PORT` 一致）。

前端默认走**相对路径** `/api`、`/ws`，无需在手机上写 `localhost`。

---

## 9. 常见问题

- **页面空白**：已执行 `npm run build` 且存在 `dist/index.html`；`NODE_ENV=production`。
- **AI/模板 502**：FastAPI 已监听且 `FASTAPI_URL` 正确。
- **爬虫不跑**：Python 依赖、Redis、目标站网络。
- **HTTPS 下进度不动**：检查 Nginx/Caddy 是否透传 WebSocket 头。

更多开发期启动见 [STARTUP.md](./STARTUP.md)。
