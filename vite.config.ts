import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://127.0.0.1:3001',
          ws: true,
          changeOrigin: true
        }
      }
    }
  }
})
