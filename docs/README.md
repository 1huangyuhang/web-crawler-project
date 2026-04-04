# SpiderX 文档索引

| 文档 | 用途 |
|---|---|
| [README.md](../README.md) | **主入口**：安装、启动命令、端口、环境变量、双后端、**完整结构+技术栈+架构一图**、功能地图、常见问题 |
| [STARTUP.md](STARTUP.md) | **启动说明**：前后端与可选 FastAPI 的安装步骤、端口、分终端启动、健康检查与排错清单 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | **生产部署**：构建、`npm run start:prod`、防火墙、HTTPS（Nginx/Caddy）、环境变量、手机访问 |
| [deploy/production.env.example](../deploy/production.env.example) | Node 生产环境变量模板（复制为 `deploy/production.env`，勿提交） |
| [deploy/nginx-spiderx.conf.example](../deploy/nginx-spiderx.conf.example) | Nginx 反代 + WebSocket 配置示例 |
| [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) | **全项目架构蓝图**：目录职责、功能矩阵、技术栈、Mermaid 系统图与 Hash 路由图、数据流与主要源文件索引（新手优先） |
| [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) | Node 网关 HTTP 接口说明（基础 URL `http://localhost:3001/api`） |
| [ARCHITECTURE_DOCUMENT.md](../ARCHITECTURE_DOCUMENT.md) | 系统分层、模块职责、数据流等深度架构说明 |

开发时代理行为以项目根目录 [vite.config.ts](../vite.config.ts) 为准。
