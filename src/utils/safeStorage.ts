/** 在隐私模式、禁用存储或 SSR 下避免 localStorage 抛错导致整页白屏 */

export function safeGetItem(key: string, fallback: string | null = null): string | null {
  try {
    if (typeof localStorage === 'undefined') return fallback
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
