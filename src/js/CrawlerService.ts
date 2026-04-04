/**
 * 爬虫 HTTP 调用：统一走 services/api（Axios + 与 Vite 同源代理），禁止再写死 localhost。
 */

import axios from 'axios'
import { crawlerApi } from '../services/api'

function normalizeCrawlResponse(
  raw: Record<string, unknown>,
  fallback: { type: string; url: string; depth: number }
) {
  if (raw?.success === true && raw?.status === 'queued') {
    return {
      ...raw,
      id: raw.id ?? raw.jobId,
      status: 'pending',
      url: (raw.url as string) ?? fallback.url,
      type: (raw.type as string) ?? fallback.type,
      depth: (raw.depth as number) ?? fallback.depth
    }
  }
  return {
    ...raw,
    id: raw.id ?? raw.jobId
  }
}

export class CrawlerService {
  static async startCrawling(crawlerType: string, url: string, depth: number): Promise<Record<string, unknown>> {
    try {
      const res = await crawlerApi.startCrawl({ type: crawlerType, url, depth })
      return normalizeCrawlResponse(res.data as Record<string, unknown>, {
        type: crawlerType,
        url,
        depth
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, unknown> | undefined
        const msg =
          (data?.error as string) ||
          (data?.message as string) ||
          err.message ||
          '网络或服务器错误'
        throw new Error(`爬取失败: ${msg}`)
      }
      throw new Error(
        `爬取失败: ${err instanceof Error ? err.message : '未知错误'}`
      )
    }
  }

  static async checkServiceHealth(): Promise<boolean> {
    try {
      const res = await crawlerApi.checkHealth()
      const data = res.data as { success?: boolean } | undefined
      return res.status === 200 && data?.success !== false
    } catch {
      return false
    }
  }
}
