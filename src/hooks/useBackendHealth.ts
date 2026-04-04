import { useCallback, useEffect, useState } from 'react'
import { CrawlerService } from '../js/CrawlerService'

export type BackendHealthStatus = 'checking' | 'available' | 'unavailable'

export interface UseBackendHealthOptions {
  /** 后端不可用时多久再探测一次（ms） */
  pollWhenDownMs?: number
  /** 后端可用时多久做一次心跳，发现 nodemon 重启等（ms），0 表示不做 */
  heartbeatMs?: number
}

/**
 * 后端可达性：解决「只检一次永久不可用」、nodemon 重启、前后端启动竞态等问题。
 */
export function useBackendHealth(options: UseBackendHealthOptions = {}) {
  const pollWhenDownMs = options.pollWhenDownMs ?? 4000
  const heartbeatMs = options.heartbeatMs ?? 25000

  const [status, setStatus] = useState<BackendHealthStatus>('checking')

  const probe = useCallback(async (): Promise<boolean> => {
    const ok = await CrawlerService.checkServiceHealth()
    setStatus(ok ? 'available' : 'unavailable')
    return ok
  }, [])

  /** 用户操作前调用：先置为 checking 再探测 */
  const recheck = useCallback(async (): Promise<boolean> => {
    setStatus('checking')
    return probe()
  }, [probe])

  useEffect(() => {
    void recheck()
  }, [recheck])

  // 按状态轮询 / 心跳
  useEffect(() => {
    if (status === 'checking') return

    const intervalMs =
      status === 'unavailable' ? pollWhenDownMs : heartbeatMs > 0 ? heartbeatMs : 0
    if (!intervalMs) return

    const id = setInterval(() => {
      probe()
    }, intervalMs)
    return () => clearInterval(id)
  }, [status, pollWhenDownMs, heartbeatMs, probe])

  // 切回标签页或窗口聚焦时再探一次
  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === 'visible') {
        probe()
      }
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [probe])

  return { status, recheck }
}
