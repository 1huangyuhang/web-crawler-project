/**
 * 前端 API 基址约定（与 Vite 代理、环境变量一致）
 * - 开发：默认空字符串 → 请求当前页面源的 /api/*，由 Vite 转发到后端，避免 localhost / 127.0.0.1 混用导致 Failed to fetch
 * - 生产：在 .env.production 设置 VITE_API_BASE_URL，例如 https://api.example.com（不要带末尾 /api，路径里已含 /api）
 */
export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
  }
  return ''
}
