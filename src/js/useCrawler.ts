/**
 * 爬虫 hooks
 * 用于处理爬虫相关的逻辑
 */

import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  createElement,
  type ReactNode
} from 'react';
import { CrawlerService } from './CrawlerService';
import { crawlerApi, type CrawlRuntimeClient } from '../services/api';
import { websocketService } from '../services/websocket';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import { useBackendHealth } from '../hooks/useBackendHealth';
import {
  antiCrawlToRuntime,
  pickRecommendedDepth,
  pickRecommendedType,
  type ApplySpiderTemplateDetail
} from '../utils/spiderTemplateRuntime';

/**
 * 前端估算进度（与 server crawlRunner 的渐近思路一致，时间常数略短以便 WS 未到时条仍能动起来）
 */
function clientQueueEstimatedPercent(elapsedSec: number, cap = 88): number {
  return Math.min(cap, Math.round(95 * (1 - Math.exp(-elapsedSec / 16))));
}

function clientSyncEstimatedPercent(elapsedSec: number, cap = 88): number {
  return Math.min(cap, Math.round(94 * (1 - Math.exp(-elapsedSec / 28))));
}

/** 队列执行中、尚未拿到最终结果时的展示用元数据 */
export interface RunningJobMeta {
  id: string;
  url: string;
  type: string;
  depth: number;
}

/**
 * 爬虫状态接口
 */
export interface AppliedSpiderTemplate {
  id: string;
  name: string;
  runtime?: CrawlRuntimeClient;
}

export interface CrawlerState {
  crawlerType: string;
  targetUrl: string;
  crawlerDepth: number;
  crawlerStatus: 'idle' | 'running' | 'completed' | 'error';
  crawlerResult: any;
  /** 排队/异步执行中：有任务信息但尚无 items/time 等最终结果 */
  runningJobMeta: RunningJobMeta | null;
  serviceStatus: 'checking' | 'available' | 'unavailable';
  crawlProgress: number;
  currentUrl: string;
  crawlWarning: string | null;
  /** 从模板库应用的建议策略（并发、延迟等会传给 Node 爬虫） */
  appliedSpiderTemplate: AppliedSpiderTemplate | null;
}

/**
 * 爬虫操作接口
 */
export interface CrawlerActions {
  setCrawlerType: (type: string) => void;
  setTargetUrl: (url: string) => void;
  setCrawlerDepth: (depth: number) => void;
  handleStartCrawl: () => Promise<void>;
  handleReset: () => void;
  /** 手动再探测后端（开发时 nodemon 重启后可点） */
  recheckBackend: () => Promise<boolean>;
  clearAppliedSpiderTemplate: () => void;
}

const CrawlerContext = createContext<[CrawlerState, CrawlerActions] | null>(null);

/**
 * 挂在 App 上，使爬虫状态在切换导航时保留，WebSocket 订阅不会在离开爬虫页时被误取消。
 */
export function CrawlerProvider({ children }: { children: ReactNode }) {
  const tuple = useCrawlerStore();
  return createElement(CrawlerContext.Provider, { value: tuple }, children);
}

export function useCrawler(): [CrawlerState, CrawlerActions] {
  const ctx = useContext(CrawlerContext);
  if (!ctx) {
    throw new Error('useCrawler 必须在 <CrawlerProvider> 内使用（请在 App 中包裹 CrawlerProvider）');
  }
  return ctx;
}

/**
 * 爬虫状态与逻辑（仅由 CrawlerProvider 挂载一次）
 */
function useCrawlerStore(): [CrawlerState, CrawlerActions] {
  // 爬虫类型
  const [crawlerType, setCrawlerType] = useState(() => {
    return safeGetItem('crawlerType', 'link') || 'link';
  });

  const [targetUrl, setTargetUrl] = useState(() => {
    return safeGetItem('crawlerTargetUrl', '') || '';
  });

  const [crawlerDepth, setCrawlerDepth] = useState(() => {
    const raw = safeGetItem('crawlerDepth', '2') || '2';
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 2;
  });

  // 爬取状态
  const [crawlerStatus, setCrawlerStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  // 爬取结果（仅在有最终数据或错误时写入，避免排队响应冒充「结果」）
  const [crawlerResult, setCrawlerResult] = useState<any>(null);

  const [runningJobMeta, setRunningJobMeta] = useState<RunningJobMeta | null>(null);

  const { status: serviceStatus, recheck: recheckBackend } = useBackendHealth({
    pollWhenDownMs: 4000,
    heartbeatMs: 25000
  });

  // 爬取进度
  const [crawlProgress, setCrawlProgress] = useState(0);

  // 当前正在爬取的URL
  const [currentUrl, setCurrentUrl] = useState('');

  const activeCrawlIdRef = useRef<string | null>(null);
  const activeRunMetaRef = useRef<RunningJobMeta | null>(null);
  const crawlerStatusRef = useRef(crawlerStatus);
  crawlerStatusRef.current = crawlerStatus;

  /** 同步模式下模拟进度的定时器 */
  const syncProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearSyncProgress = () => {
    if (syncProgressTimerRef.current) {
      clearInterval(syncProgressTimerRef.current);
      syncProgressTimerRef.current = null;
    }
  };

  /** 队列模式：WS 未推送时仍驱动进度条（与 WS 取 max，不替代真实完成态） */
  const queueSimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueSimStartedAtRef = useRef(0);
  const clearQueueSimProgress = () => {
    if (queueSimTimerRef.current) {
      clearInterval(queueSimTimerRef.current);
      queueSimTimerRef.current = null;
    }
  };

  /** 队列任务：轮询 GET /api/history 兜底收口（WS 丢消息时） */
  const historyPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearHistoryPoll = () => {
    if (historyPollTimerRef.current) {
      clearInterval(historyPollTimerRef.current);
      historyPollTimerRef.current = null;
    }
  };

  useEffect(() => {
    safeSetItem('crawlerType', crawlerType);
  }, [crawlerType]);

  useEffect(() => {
    safeSetItem('crawlerTargetUrl', targetUrl);
  }, [targetUrl]);

  useEffect(() => {
    safeSetItem('crawlerDepth', crawlerDepth.toString());
  }, [crawlerDepth]);

  /**
   * 保存爬取历史记录
   * @param result 爬取结果
   */
  const saveCrawlHistory = (result: any) => {
    try {
      // 创建历史记录对象
      const historyItem = {
        id: result.id || `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: result.timestamp || Date.now(),
        url: result.url,
        type: result.type,
        depth: result.depth,
        items: result.items || 0,
        time: result.time || 0,
        data: result.data || [],
        error: result.error || null,
        status: result.status || (result.error ? 'failed' : 'completed')
      };

      const savedHistory = safeGetItem('crawlHistory', null);
      const existingHistory = savedHistory ? JSON.parse(savedHistory) : [];

      const updatedHistory = [historyItem, ...existingHistory].slice(0, 50);

      safeSetItem('crawlHistory', JSON.stringify(updatedHistory));
      try {
        window.dispatchEvent(new CustomEvent('crawlHistoryUpdated'));
      } catch {
        /* ignore */
      }
      console.log('爬取历史记录已保存');
    } catch (error) {
      console.error('保存爬取历史记录失败:', error);
    }
  };

  const saveCrawlHistoryRef = useRef(saveCrawlHistory);
  saveCrawlHistoryRef.current = saveCrawlHistory;

  // 用于存储WebSocket取消订阅函数
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const handleWsMessageRef = useRef<(data: any) => void>(() => {});

  /** 稳定引用：subscribe/unsubscribe 始终针对同一函数实例 */
  const wsHandlerWrapperRef = useRef<(data: any) => void>((data: any) => {
    handleWsMessageRef.current(data);
  });

  handleWsMessageRef.current = (data: any) => {
    const crawlId = data.crawlId as string | undefined;
    if (!crawlId || activeCrawlIdRef.current !== crawlId) {
      return;
    }

    const type = data.type as string;
    const payload = data.data;

    const finishAndUnsub = () => {
      clearQueueSimProgress();
      clearHistoryPoll();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      activeCrawlIdRef.current = null;
      activeRunMetaRef.current = null;
      setRunningJobMeta(null);
    };

    if (type === 'crawl:progress' && payload && typeof payload === 'object') {
      if (payload.progress !== undefined) {
        const n = Number(payload.progress);
        if (Number.isFinite(n)) {
          setCrawlProgress((prev) => {
            if (n <= 0) return prev;
            if (n >= 100) return 100;
            return Math.max(prev, Math.min(99, n));
          });
        }
      }
      if (payload.currentUrl) {
        setCurrentUrl(payload.currentUrl);
      }

      const stats = payload.stats || {};
      if (stats.result && typeof stats.result === 'object') {
        const r = stats.result as Record<string, unknown>;
        const merged = { ...r, id: crawlId };
        const hasErr = r.error != null && String(r.error).trim() !== '';
        if (hasErr) {
          setCrawlerStatus('error');
          setCrawlProgress(0);
          const meta = activeRunMetaRef.current;
          const errResult = {
            id: crawlId,
            url: meta?.url,
            type: meta?.type,
            depth: meta?.depth,
            items: (r.items as number) ?? 0,
            time: (r.time as number) ?? 0,
            error: String(r.error)
          };
          setCrawlerResult(errResult);
          finishAndUnsub();
          saveCrawlHistoryRef.current(errResult);
          return;
        }
        setCrawlerResult(merged);
        setCrawlerStatus('completed');
        setCrawlProgress(100);
        finishAndUnsub();
        saveCrawlHistoryRef.current(merged);
        return;
      }
      if (stats.error != null && stats.message === '爬虫任务失败') {
        setCrawlerStatus('error');
        setCrawlProgress(0);
        const meta = activeRunMetaRef.current;
        const errResult = {
          id: crawlId,
          url: meta?.url,
          type: meta?.type,
          depth: meta?.depth,
          items: 0,
          time: 0,
          error: String(stats.error)
        };
        setCrawlerResult(errResult);
        finishAndUnsub();
        saveCrawlHistoryRef.current(errResult);
        return;
      }
    }

    if (type === 'crawl:completed' && payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      let inner: unknown = p.result ?? payload;
      if (
        inner &&
        typeof inner === 'object' &&
        !Array.isArray(inner) &&
        'result' in (inner as object) &&
        (inner as { result?: unknown }).result != null &&
        typeof (inner as { result: unknown }).result === 'object'
      ) {
        inner = (inner as { result: Record<string, unknown> }).result;
      }
      const merged =
        typeof inner === 'object' && inner !== null
          ? { ...(inner as Record<string, unknown>), id: crawlId }
          : { id: crawlId, raw: inner };
      const errVal =
        typeof inner === 'object' && inner !== null
          ? (inner as Record<string, unknown>).error
          : undefined;
      const hasErr = errVal != null && String(errVal).trim() !== '';
      if (hasErr) {
        setCrawlerStatus('error');
        setCrawlProgress(0);
        const meta = activeRunMetaRef.current;
        const errResult = {
          id: crawlId,
          url: (merged as { url?: string }).url ?? meta?.url,
          type: (merged as { type?: string }).type ?? meta?.type,
          depth: (merged as { depth?: number }).depth ?? meta?.depth,
          items: (merged as { items?: number }).items ?? 0,
          time: (merged as { time?: number }).time ?? 0,
          error: String(errVal)
        };
        setCrawlerResult(errResult);
        finishAndUnsub();
        saveCrawlHistoryRef.current(errResult);
        return;
      }
      setCrawlerResult(merged);
      setCrawlerStatus('completed');
      setCrawlProgress(100);
      finishAndUnsub();
      saveCrawlHistoryRef.current(merged);
      return;
    }

    if (type === 'crawl:failed') {
      const err =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : '爬取失败';
      setCrawlerStatus('error');
      setCrawlProgress(0);
      const meta = activeRunMetaRef.current;
      const errResult = {
        id: crawlId,
        url: meta?.url,
        type: meta?.type,
        depth: meta?.depth,
        items: 0,
        time: 0,
        error: err
      };
      setCrawlerResult(errResult);
      finishAndUnsub();
      saveCrawlHistoryRef.current(errResult);
    }
  };

  // 重连后若仍在爬取，重新 subscribe:crawl（用 ref 避免陈旧闭包）
  useEffect(() => {
    const unsubscribeConnection = websocketService.onConnectionChange((connected) => {
      if (!connected) return;
      if (crawlerStatusRef.current !== 'running' || !activeCrawlIdRef.current) return;
      const crawlId = activeCrawlIdRef.current;
      void (async () => {
        await websocketService.ensureAuthenticatedWithRecovery().catch(() => {});
        if (crawlerStatusRef.current !== 'running' || activeCrawlIdRef.current !== crawlId) return;
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        unsubscribeRef.current = websocketService.subscribeToCrawl(
          crawlId,
          wsHandlerWrapperRef.current
        );
      })();
    });

    return () => {
      unsubscribeConnection();
      // 不在卸载时 unsubscribe 爬取频道：离开爬虫页后任务仍应继续收进度/结果
    };
  }, []);

  /** 从 API 返回的结果中提取 items/time，兼容嵌套与扁平格式 */
  const normalizeResult = (raw: Record<string, unknown>, id: string) => {
    const items = (raw.items as number) ?? 0;
    const time = (raw.time as number) ?? 0;
    const data = Array.isArray(raw.data) ? raw.data : [];
    return { ...raw, id, items, time, data };
  };

  const cleanupWs = () => {
    clearQueueSimProgress();
    clearHistoryPoll();
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    activeCrawlIdRef.current = null;
    activeRunMetaRef.current = null;
    setRunningJobMeta(null);
  };

  const [crawlWarning, setCrawlWarning] = useState<string | null>(null);

  const [appliedSpiderTemplate, setAppliedSpiderTemplate] = useState<AppliedSpiderTemplate | null>(null);

  useEffect(() => {
    const onApply = (ev: Event) => {
      const ce = ev as CustomEvent<ApplySpiderTemplateDetail>;
      const d = ce.detail;
      if (!d?.id || !d.name) return;
      const ac = d.anti_crawl_config;
      const runtime =
        ac && typeof ac === 'object' ? antiCrawlToRuntime(ac as Record<string, unknown>) : undefined;
      setAppliedSpiderTemplate({
        id: d.id,
        name: d.name,
        ...(runtime && Object.keys(runtime).length ? { runtime } : {})
      });
      if (ac && typeof ac === 'object') {
        const rec = ac as Record<string, unknown>;
        const rt = pickRecommendedType(rec);
        if (rt) setCrawlerType(rt);
        const dep = pickRecommendedDepth(rec);
        if (dep != null) setCrawlerDepth(dep);
      }
    };
    window.addEventListener('applySpiderTemplate', onApply as EventListener);
    return () => window.removeEventListener('applySpiderTemplate', onApply as EventListener);
  }, []);

  const clearAppliedSpiderTemplate = () => setAppliedSpiderTemplate(null);

  const handleStartCrawl = async () => {
    setCrawlWarning(null);
    if (!targetUrl) {
      setCrawlWarning('请输入目标 URL');
      return;
    }

    if (serviceStatus !== 'available') {
      const ok = await recheckBackend();
      if (!ok) {
        setCrawlWarning('后端暂时不可用，请稍等几秒自动重连，或运行 npm run dev 启动后端。');
        return;
      }
    }

    // 清理旧状态
    cleanupWs();
    clearSyncProgress();
    clearQueueSimProgress();
    setCrawlerStatus('running');
    setCrawlProgress(0);
    setCurrentUrl(targetUrl);
    setCrawlerResult(null);

    // 同步模式：HTTP 阻塞期间渐近估算进度（非真实百分比）
    const syncStartedAt = Date.now();
    syncProgressTimerRef.current = setInterval(() => {
      const elapsedSec = (Date.now() - syncStartedAt) / 1000;
      setCrawlProgress(clientSyncEstimatedPercent(elapsedSec));
    }, 450);

    try {
      const result = (await CrawlerService.startCrawling(
        crawlerType,
        targetUrl,
        crawlerDepth,
        appliedSpiderTemplate?.runtime
      )) as Record<string, unknown>;

      // 同步模式下 HTTP 已返回，停掉模拟进度
      clearSyncProgress();

      const id = String(
        (result.id as string) || `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );

      const st = result.status as string | undefined;

      if (st === 'pending' || st === 'queued') {
        // --- 队列模式：等 WS 推送 ---
        activeCrawlIdRef.current = id;
        const meta = { id, url: targetUrl, type: crawlerType, depth: crawlerDepth };
        activeRunMetaRef.current = meta;
        setRunningJobMeta(meta);
        setCrawlerResult(null);
        setCrawlProgress(6);

        const wsOk = await websocketService.ensureAuthenticatedWithRecovery();
        if (!wsOk) {
          setCrawlWarning(
            '实时进度连接或认证未就绪，已启用服务端历史轮询兜底；若长时间仍停在「爬取中」，请打开数据分析页点刷新。'
          );
        }
        unsubscribeRef.current = websocketService.subscribeToCrawl(id, wsHandlerWrapperRef.current);

        // WS 消息可能因网络/代理未到，用本地估算与推送取 max，避免长时间卡在初始百分比
        clearQueueSimProgress();
        queueSimStartedAtRef.current = Date.now();
        const tickQueueSim = () => {
          if (crawlerStatusRef.current !== 'running' || activeCrawlIdRef.current !== id) {
            clearQueueSimProgress();
            return;
          }
          const elapsedSec = (Date.now() - queueSimStartedAtRef.current) / 1000;
          const local = clientQueueEstimatedPercent(elapsedSec);
          setCrawlProgress((prev) => Math.max(prev, local));
        };
        tickQueueSim();
        queueSimTimerRef.current = setInterval(tickQueueSim, 480);

        clearHistoryPoll();
        const pollStarted = Date.now();
        const pollMaxMs = 3 * 60 * 1000;
        const pollEveryMs = 4000;
        historyPollTimerRef.current = setInterval(() => {
          if (activeCrawlIdRef.current !== id || crawlerStatusRef.current !== 'running') {
            clearHistoryPoll();
            return;
          }
          if (Date.now() - pollStarted > pollMaxMs) {
            clearHistoryPoll();
            setCrawlWarning(
              (w) =>
                w ||
                '超过 3 分钟未收到完成推送；若后端已跑完，请在数据分析页刷新或检查 WebSocket。'
            );
            return;
          }
          void (async () => {
            try {
              const res = await crawlerApi.getHistory(80);
              const body = res.data as { data?: unknown };
              const list = Array.isArray(body.data) ? body.data : [];
              const row = list.find(
                (x: { id?: string }) => x && String(x.id) === id
              ) as Record<string, unknown> | undefined;
              if (!row) return;
              clearHistoryPoll();
              clearQueueSimProgress();
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
              activeCrawlIdRef.current = null;
              activeRunMetaRef.current = null;
              setRunningJobMeta(null);
              const stLower = String(row.status || '').toLowerCase();
              const errStr =
                row.error != null && String(row.error).trim() !== ''
                  ? String(row.error)
                  : '';
              if (errStr || stLower === 'failed') {
                setCrawlerStatus('error');
                setCrawlProgress(0);
                const meta = { id, url: targetUrl, type: crawlerType, depth: crawlerDepth };
                const errResult = {
                  id,
                  url: (row.url as string) || meta.url,
                  type: (row.type as string) || meta.type,
                  depth: (row.depth as number) ?? meta.depth,
                  items: (row.items as number) ?? 0,
                  time: (row.time as number) ?? 0,
                  error: errStr || '爬取失败'
                };
                setCrawlerResult(errResult);
                saveCrawlHistoryRef.current(errResult);
              } else {
                const merged = normalizeResult(row, id);
                setCrawlerResult(merged);
                setCrawlProgress(100);
                setCrawlerStatus('completed');
                saveCrawlHistoryRef.current(merged);
              }
            } catch {
              /* 下一轮继续 */
            }
          })();
        }, pollEveryMs);
      } else if (result.error || st === 'failed') {
        // --- 失败 ---
        const normalized = normalizeResult(result, id);
        setCrawlerStatus('error');
        setCrawlProgress(0);
        setCrawlerResult(normalized);
        saveCrawlHistory(normalized);
      } else {
        // --- 同步成功：立即展示结果 ---
        const normalized = normalizeResult(result, id);
        setCrawlerResult(normalized);
        setCrawlProgress(100);
        setCrawlerStatus('completed');
        saveCrawlHistory(normalized);
      }
    } catch (error) {
      clearSyncProgress();
      clearQueueSimProgress();
      console.error('爬取失败:', error);
      cleanupWs();
      setCrawlerStatus('error');
      const errorResult = {
        url: targetUrl,
        type: crawlerType,
        depth: crawlerDepth,
        items: 0,
        time: 0,
        error: error instanceof Error ? error.message : '未知错误'
      };
      setCrawlerResult(errorResult);
      setCrawlProgress(0);
      saveCrawlHistory(errorResult);
    }
  };

  // 处理重置
  const handleReset = () => {
    clearSyncProgress();
    clearQueueSimProgress();
    clearHistoryPoll();
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    activeCrawlIdRef.current = null;
    activeRunMetaRef.current = null;
    setCrawlWarning(null);
    setCrawlerType('link');
    setTargetUrl('');
    setCrawlerDepth(2);
    setAppliedSpiderTemplate(null);
    setCrawlerStatus('idle');
    setCrawlerResult(null);
    setRunningJobMeta(null);
    setCrawlProgress(0);
    setCurrentUrl('');
  };

  // 状态对象
  const state: CrawlerState = {
    crawlerType,
    targetUrl,
    crawlerDepth,
    crawlerStatus,
    crawlerResult,
    runningJobMeta,
    serviceStatus,
    crawlProgress,
    currentUrl,
    crawlWarning,
    appliedSpiderTemplate,
  };

  // 操作对象
  const actions: CrawlerActions = {
    setCrawlerType,
    setTargetUrl,
    setCrawlerDepth,
    handleStartCrawl,
    handleReset,
    recheckBackend,
    clearAppliedSpiderTemplate
  };

  return [state, actions];
};
