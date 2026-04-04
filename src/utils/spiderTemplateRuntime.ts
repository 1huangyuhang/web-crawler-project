/** 与后端 anti_crawl_config 及 Node crawlRuntime 对齐 */

export type CrawlRuntimePayload = {
  maxConcurrent?: number
  requestDelay?: number
  timeout?: number
  maxRetries?: number
  userAgent?: string
}

export type ApplySpiderTemplateDetail = {
  id: string
  name: string
  anti_crawl_config?: Record<string, unknown> | null
}

const CRAWLER_TYPES = new Set(['link', 'content', 'image'])

export function antiCrawlToRuntime(
  ac: Record<string, unknown> | null | undefined
): CrawlRuntimePayload | undefined {
  if (!ac || typeof ac !== 'object') return undefined
  const o: CrawlRuntimePayload = {}
  if (typeof ac.max_concurrent === 'number' && Number.isFinite(ac.max_concurrent)) {
    o.maxConcurrent = Math.min(20, Math.max(1, Math.floor(ac.max_concurrent)))
  }
  if (typeof ac.request_delay === 'number' && Number.isFinite(ac.request_delay)) {
    o.requestDelay = Math.min(60, Math.max(0, ac.request_delay))
  }
  if (typeof ac.timeout === 'number' && Number.isFinite(ac.timeout)) {
    o.timeout = Math.min(120, Math.max(5, Math.floor(ac.timeout)))
  }
  if (typeof ac.max_retries === 'number' && Number.isFinite(ac.max_retries)) {
    o.maxRetries = Math.min(15, Math.max(0, Math.floor(ac.max_retries)))
  }
  if (typeof ac.user_agent === 'string' && ac.user_agent.trim()) {
    o.userAgent = ac.user_agent.trim().slice(0, 512)
  }
  return Object.keys(o).length ? o : undefined
}

export function pickRecommendedType(
  ac: Record<string, unknown> | null | undefined
): 'link' | 'content' | 'image' | undefined {
  if (!ac || typeof ac !== 'object') return undefined
  const t = ac.recommended_type
  if (typeof t === 'string' && CRAWLER_TYPES.has(t)) {
    return t as 'link' | 'content' | 'image'
  }
  return undefined
}

export function pickRecommendedDepth(
  ac: Record<string, unknown> | null | undefined
): number | undefined {
  if (!ac || typeof ac !== 'object') return undefined
  const d = ac.recommended_depth
  if (typeof d === 'number' && Number.isFinite(d)) {
    const n = Math.floor(d)
    if (n >= 1 && n <= 10) return n
  }
  return undefined
}
