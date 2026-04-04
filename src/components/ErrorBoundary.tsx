import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 捕获子树渲染错误，避免整页空白且无任何提示（常见于 Cursor 内置预览、受限 iframe）
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '1.5rem',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 640,
            margin: '0 auto',
            minHeight: '50vh'
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>页面渲染出错</h1>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            请打开浏览器开发者工具（F12）查看 Console 完整堆栈，或在本机终端运行{' '}
            <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem' }}>npm run dev</code>{' '}
            后用 Chrome / Edge 访问。
          </p>
          <pre
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              padding: '1rem',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
