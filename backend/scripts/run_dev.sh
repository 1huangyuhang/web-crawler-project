#!/usr/bin/env bash
# FastAPI 开发启动：创建 venv、安装依赖、执行 Alembic、监听 8000
set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[fastapi] 未找到 python3，无法启动 AI 后端。请安装 Python 3.11+。"
  exit 1
fi

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  echo "[fastapi] 已从 .env.example 创建 backend/.env，请按需填写 DATABASE_URL / DEEPSEEK_API_KEY。"
fi

if [[ ! -d .venv ]]; then
  echo "[fastapi] 创建虚拟环境 .venv …"
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "[fastapi] 安装 Python 依赖（首次可能稍慢）…"
pip install -q -e .

echo "[fastapi] 执行数据库迁移 alembic upgrade head …"
alembic upgrade head

echo "[fastapi] 启动 uvicorn http://127.0.0.1:8000 …"
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
