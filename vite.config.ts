import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** 与 server/src/devListen.js 写入的文件一致，便于后端端口被占用时自动顺延 */
function readDevBackendPort(fallback = 3001): number {
  const file = path.join(process.cwd(), '.dev-backend-port')
  try {
    const raw = fs.readFileSync(file, 'utf8').trim()
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0 && n < 65536) return n
  } catch {
    /* 文件尚未创建或无效 */
  }
  return fallback
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [tailwindcss(), react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
      'import.meta.env.VITE_ENV': JSON.stringify(env.VITE_ENV)
    },
    server: {
      host: true,
      proxy: {
        // FastAPI 版本化 API（如 AI）；需先于通用 /api 匹配
        '/api/v1': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true
        },
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          router: () => `http://127.0.0.1:${readDevBackendPort()}`
        },
        '/ws': {
          target: 'ws://127.0.0.1:3001',
          ws: true,
          changeOrigin: true,
          router: () => `ws://127.0.0.1:${readDevBackendPort()}`
        }
      }
    }
  }
})
