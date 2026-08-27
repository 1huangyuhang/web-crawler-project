#!/usr/bin/env bash
# ============================================================
# SpiderX 本地开发一键启动脚本
#
# 用法:
#   ./dev.sh            # 启动 Go 后端 + 前端（幂等：已在运行则跳过）
#   ./dev.sh start      # 同上
#   ./dev.sh stop       # 停止由本脚本启动的 Go 后端与前端
#   ./dev.sh status     # 查看各服务运行状态
#   ./dev.sh restart    # 先 stop 再 start
#
# 设计说明:
#   - 幂等：重复执行不会重复拉起进程，端口已占用则复用。
#   - 依赖 PostgreSQL(5432) 与 Redis(6379)，本脚本仅检测不代管
#     （二者通常常驻或由 docker compose 提供）。
#   - 前端固定端口 5173，与 Go 后端 CORS 白名单一致，避免端口顺延。
#   - 日志集中写入 logs/（已在 .gitignore 忽略）。
# ============================================================
set -euo pipefail

# 脚本所在目录即项目根目录，保证任意路径调用都能正确定位
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend-go"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$LOG_DIR/pids"

FRONTEND_PORT=5173
BACKEND_PORT=8080
PG_PORT=5432
REDIS_PORT=6379

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

mkdir -p "$LOG_DIR" "$PID_DIR"

# ---- 终端着色输出（无 TTY 时自动降级为纯文本）----
if [ -t 1 ]; then
  C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_RED='\033[0;31m'; C_CYAN='\033[0;36m'; C_RESET='\033[0m'
else
  C_GREEN=''; C_YELLOW=''; C_RED=''; C_CYAN=''; C_RESET=''
fi
info()  { printf "${C_CYAN}[dev]${C_RESET} %s\n" "$1"; }
ok()    { printf "${C_GREEN}[ok]${C_RESET}  %s\n" "$1"; }
warn()  { printf "${C_YELLOW}[warn]${C_RESET} %s\n" "$1"; }
err()   { printf "${C_RED}[err]${C_RESET} %s\n" "$1"; }

# 检查端口是否已被监听（LISTEN 状态）
port_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# 检查 HTTP 端点是否返回 200
http_ok() {
  [ "$(curl -s -m 2 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null)" = "200" ]
}

# 校验依赖服务（PostgreSQL / Redis）是否就绪，未就绪只告警不阻断
check_dependencies() {
  if port_listening "$PG_PORT"; then
    ok "PostgreSQL 已在运行 (:$PG_PORT)"
  else
    warn "未检测到 PostgreSQL (:$PG_PORT)，Go 后端可能无法连接数据库。"
    warn "  请先启动本地 PostgreSQL，或运行: docker compose up -d postgres redis"
  fi
  if port_listening "$REDIS_PORT"; then
    ok "Redis 已在运行 (:$REDIS_PORT)"
  else
    warn "未检测到 Redis (:$REDIS_PORT)，队列/缓存功能将不可用。"
    warn "  请先启动本地 Redis，或运行: docker compose up -d postgres redis"
  fi
}

# 启动 Go 后端（幂等：健康检查通过则跳过）
start_backend() {
  if http_ok "http://localhost:$BACKEND_PORT/api/health"; then
    ok "Go 后端已在运行 (:$BACKEND_PORT)，跳过启动"
    return 0
  fi
  if port_listening "$BACKEND_PORT"; then
    warn "端口 $BACKEND_PORT 已被占用但健康检查未通过，跳过启动（请手动检查）"
    return 0
  fi

  info "启动 Go 后端 (go run ./cmd/api)..."
  ( cd "$BACKEND_DIR" && APP_ENV=development \
      nohup go run ./cmd/api --config configs/config.yaml >"$BACKEND_LOG" 2>&1 & echo $! >"$BACKEND_PID_FILE" )

  # 等待健康检查通过（首次含编译，最多约 60s）
  local i
  for i in $(seq 1 60); do
    if http_ok "http://localhost:$BACKEND_PORT/api/health"; then
      ok "Go 后端就绪 (:$BACKEND_PORT) — 用时约 ${i}s"
      return 0
    fi
    sleep 1
  done
  err "Go 后端启动超时，请查看日志: $BACKEND_LOG"
  tail -n 20 "$BACKEND_LOG" || true
  return 1
}

# 启动前端 Vite（幂等：端口已监听则跳过，固定 5173 不顺延）
start_frontend() {
  if port_listening "$FRONTEND_PORT"; then
    ok "前端已在运行 (:$FRONTEND_PORT)，跳过启动"
    return 0
  fi

  info "启动前端 Vite (:$FRONTEND_PORT)..."
  ( cd "$ROOT_DIR" && \
      nohup npx vite --port "$FRONTEND_PORT" --strictPort >"$FRONTEND_LOG" 2>&1 & echo $! >"$FRONTEND_PID_FILE" )

  local i
  for i in $(seq 1 30); do
    if http_ok "http://localhost:$FRONTEND_PORT/"; then
      ok "前端就绪 (:$FRONTEND_PORT) — 用时约 ${i}s"
      return 0
    fi
    sleep 1
  done
  err "前端启动超时，请查看日志: $FRONTEND_LOG"
  tail -n 20 "$FRONTEND_LOG" || true
  return 1
}

# 根据 PID 文件优雅停止进程（go run 会派生子进程，故按进程组 kill）
stop_by_pidfile() {
  local name="$1" pidfile="$2"
  if [ ! -f "$pidfile" ]; then
    return 0
  fi
  local pid
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
    info "停止 $name (PID $pid)..."
    # 先尝试杀整个进程组（负号），失败再退回单进程，最后强制
    kill -TERM -- "-$pid" >/dev/null 2>&1 || kill -TERM "$pid" >/dev/null 2>&1 || true
    sleep 1
    kill -KILL -- "-$pid" >/dev/null 2>&1 || kill -KILL "$pid" >/dev/null 2>&1 || true
    ok "$name 已停止"
  fi
  rm -f "$pidfile"
}

do_start() {
  info "项目根目录: $ROOT_DIR"
  check_dependencies
  start_backend
  start_frontend
  echo
  ok "启动完成！"
  printf "  前端:    ${C_GREEN}http://localhost:%s${C_RESET}\n" "$FRONTEND_PORT"
  printf "  Go API:  ${C_GREEN}http://localhost:%s/api/health${C_RESET}\n" "$BACKEND_PORT"
  printf "  Swagger: ${C_GREEN}http://localhost:%s/swagger/index.html${C_RESET}\n" "$BACKEND_PORT"
  echo
  info "查看日志: tail -f $BACKEND_LOG  /  tail -f $FRONTEND_LOG"
  info "停止服务: ./dev.sh stop"
}

do_stop() {
  stop_by_pidfile "前端" "$FRONTEND_PID_FILE"
  stop_by_pidfile "Go 后端" "$BACKEND_PID_FILE"
  ok "已停止本脚本启动的服务（PostgreSQL/Redis 未受影响）"
}

do_status() {
  info "服务状态："
  http_ok "http://localhost:$FRONTEND_PORT/"            && ok "前端        :$FRONTEND_PORT 运行中" || warn "前端        :$FRONTEND_PORT 未运行"
  http_ok "http://localhost:$BACKEND_PORT/api/health"   && ok "Go 后端     :$BACKEND_PORT 运行中" || warn "Go 后端     :$BACKEND_PORT 未运行"
  port_listening "$PG_PORT"                             && ok "PostgreSQL  :$PG_PORT 运行中" || warn "PostgreSQL  :$PG_PORT 未运行"
  port_listening "$REDIS_PORT"                          && ok "Redis       :$REDIS_PORT 运行中" || warn "Redis       :$REDIS_PORT 未运行"
}

case "${1:-start}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; echo; do_start ;;
  status)  do_status ;;
  *)
    err "未知命令: $1"
    echo "用法: ./dev.sh [start|stop|status|restart]"
    exit 1
    ;;
esac
