import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/app.css'
import './styles/mobile-ui.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="padding:1rem;font-family:system-ui,sans-serif">错误：找不到 #root 节点</p>'
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    rootEl.innerHTML = `<div style="padding:1.5rem;font-family:system-ui,sans-serif"><h1 style="font-size:1.1rem">入口执行失败</h1><pre style="color:#b91c1c;white-space:pre-wrap">${msg}</pre></div>`
    console.error(err)
  }
}