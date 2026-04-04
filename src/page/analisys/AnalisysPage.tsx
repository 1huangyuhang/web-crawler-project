import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ClipboardList, Copy, Search, Trash2, X } from 'lucide-react';
import { crawlerApi } from '../../services/api';
import { CrawlerTypeIcon } from '../../components/CrawlerTypeIcon';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CrawlHistoryItem {
  id: string;
  timestamp: number;
  url: string;
  type: 'link' | 'content' | 'image';
  depth: number;
  items: number;
  time: number;
  data?: any[];
  error?: string;
}

type SortField = 'timestamp' | 'items' | 'time';
type FilterType = 'all' | 'link' | 'content' | 'image';

const TYPE_MAP: Record<string, { label: string }> = {
  link:    { label: '链接爬虫' },
  content: { label: '内容爬虫' },
  image:   { label: '图片爬虫' },
};

/** 与 mobile-ui.css 断点一致 */
function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function fmt(s: number) { return s < 1 ? '< 1s' : s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`; }
function fmtDate(ts: number) { return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }

function loadHistory(): CrawlHistoryItem[] {
  try {
    const r = localStorage.getItem('crawlHistory');
    if (!r) return [];
    const parsed = JSON.parse(r);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => ({
      id: item.id || String(Math.random()),
      timestamp: item.timestamp || 0,
      url: item.url || '',
      type: item.type || 'link',
      depth: item.depth ?? 0,
      items: item.items ?? 0,
      time: item.time ?? 0,
      data: Array.isArray(item.data) ? item.data : [],
      error: item.error || undefined,
    }));
  } catch { return []; }
}
function saveHistory(items: CrawlHistoryItem[]) {
  try { localStorage.setItem('crawlHistory', JSON.stringify(items)); } catch {}
}

function mapServerRowToItem(row: Record<string, unknown>): CrawlHistoryItem {
  const t = String(row.type || 'link').toLowerCase();
  const type: CrawlHistoryItem['type'] =
    t === 'content' || t === 'image' ? t : 'link';
  return {
    id: String(row.id || ''),
    timestamp: typeof row.timestamp === 'number' ? row.timestamp : 0,
    url: String(row.url || ''),
    type,
    depth: typeof row.depth === 'number' ? row.depth : 0,
    items: typeof row.items === 'number' ? row.items : 0,
    time: typeof row.time === 'number' ? row.time : 0,
    data: Array.isArray(row.data) ? row.data : [],
    error: row.error != null && String(row.error).trim() !== '' ? String(row.error) : undefined,
  };
}

/** 按 id 合并；同 id 保留时间戳更新的那条（队列落库后通常比本地新） */
function mergeHistory(local: CrawlHistoryItem[], server: CrawlHistoryItem[]): CrawlHistoryItem[] {
  const m = new Map<string, CrawlHistoryItem>();
  const newer = (a: CrawlHistoryItem, b: CrawlHistoryItem) =>
    (b.timestamp || 0) >= (a.timestamp || 0) ? b : a;
  for (const h of local) {
    if (h.id) m.set(h.id, h);
  }
  for (const h of server) {
    if (!h.id) continue;
    const ex = m.get(h.id);
    m.set(h.id, ex ? newer(ex, h) : h);
  }
  return [...m.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
}

type ViewMode = 'table' | 'card' | 'list';

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function getRowUrl(row: any): string {
  return row.link_url || row.image_url || row.url || '';
}

// ─── Pagination ─────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end_ = Math.min(page * pageSize, total);
  const [jumpVal, setJumpVal] = useState('');

  const btns: (number | '...')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) btns.push(i);
  } else {
    btns.push(1);
    if (page > 3) btns.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) btns.push(i);
    if (page < pages - 2) btns.push('...');
    btns.push(pages);
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-1 py-2">
      <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
        显示 {total > 0 ? start : 0}-{end_} / 共 {total} 条
      </span>
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}
          style={{ padding: '3px 8px', fontSize: '11px' }}>‹</button>
        {btns.map((b, i) =>
          b === '...' ? <span key={`e${i}`} className="px-1 text-[11px]" style={{ color: 'var(--c-text-muted)' }}>…</span> :
          <button key={b} onClick={() => onChange(b as number)}
            className="btn btn-sm" style={{
              padding: '3px 8px', fontSize: '11px', minWidth: 28,
              background: b === page ? 'var(--color-brand-500)' : 'transparent',
              color: b === page ? '#fff' : 'var(--c-text-secondary)',
            }}>{b}</button>
        )}
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}
          style={{ padding: '3px 8px', fontSize: '11px' }}>›</button>
        {pages > 7 && (
          <form className="flex items-center gap-1 ml-2" onSubmit={e => {
            e.preventDefault();
            const n = parseInt(jumpVal);
            if (n >= 1 && n <= pages) { onChange(n); setJumpVal(''); }
          }}>
            <input className="input" value={jumpVal} onChange={e => setJumpVal(e.target.value)}
              placeholder="页码" style={{ width: 48, padding: '3px 6px', fontSize: '11px' }} />
            <button type="submit" className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', fontSize: '11px' }}>跳转</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Preview Sidebar ────────────────────────────────────────────────────────

const PREVIEW_KEY_ORDER = [
  'url', 'link_url', 'image_url', 'title', 'alt', 'depth', 'content', 'keywords', 'meta', 'description', 'body', 'text',
];

const PREVIEW_LABELS: Record<string, string> = {
  url: '链接',
  link_url: '链接',
  image_url: '图片地址',
  title: '标题',
  alt: '说明',
  depth: '深度',
  content: '正文',
  body: '正文',
  text: '文本',
  description: '描述',
  keywords: '关键词',
  meta: '元数据',
};

function previewEntrySortKey(k: string): number {
  const i = PREVIEW_KEY_ORDER.indexOf(k);
  return i === -1 ? 500 + k.charCodeAt(0) : i;
}

function PreviewFieldBlock({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const label = PREVIEW_LABELS[fieldKey] || fieldKey.replace(/_/g, ' ');
  const str = typeof value === 'string' ? value : null;
  const isHttpUrl =
    str &&
    /^https?:\/\//i.test(str) &&
    (fieldKey === 'url' || fieldKey === 'link_url' || fieldKey === 'image_url' || fieldKey.endsWith('_url'));
  const isLongPlain =
    str &&
    (fieldKey === 'content' || fieldKey === 'body' || fieldKey === 'text' || fieldKey === 'description') &&
    str.length > 80;

  let inner: ReactNode;
  if (isHttpUrl && str) {
    inner = (
      <div className="preview-sidebar__link-box">
        <a
          href={str}
          target="_blank"
          rel="noopener noreferrer"
          className="preview-sidebar__link font-medium break-all"
          style={{ color: 'var(--color-brand-400)' }}
        >
          {str}
        </a>
      </div>
    );
  } else if (isLongPlain && str) {
    inner = <div className="preview-sidebar__content-scroll">{str}</div>;
  } else if (value !== null && typeof value === 'object') {
    inner = <pre className="preview-sidebar__pre">{JSON.stringify(value, null, 2)}</pre>;
  } else {
    inner = <p className="preview-sidebar__plain break-words m-0">{String(value ?? '')}</p>;
  }

  return (
    <section className="preview-sidebar__field" data-preview-field={fieldKey}>
      <h3 className="preview-sidebar__label">{label}</h3>
      <div className="preview-sidebar__value">{inner}</div>
    </section>
  );
}

const PREVIEW_GROUP_PRIMARY = new Set(['url', 'link_url', 'image_url', 'title', 'alt', 'depth']);
const PREVIEW_GROUP_BODY = new Set(['content', 'body', 'text', 'description']);
const PREVIEW_GROUP_META = new Set(['keywords', 'meta']);

/** Web：在预览遮罩（红框外）上滚轮时，把位移作用到预览抽屉内的滚动区（红框内正文列表） */
function applyWheelToPreviewBody(bodyEl: HTMLElement | null, deltaY: number): void {
  if (!bodyEl) return;
  const { scrollTop, scrollHeight, clientHeight } = bodyEl;
  const max = scrollHeight - clientHeight;
  if (max <= 1) return;
  bodyEl.scrollTop = Math.max(0, Math.min(max, scrollTop + deltaY));
}

function groupPreviewEntries(sorted: [string, unknown][]) {
  const primary: [string, unknown][] = [];
  const body: [string, unknown][] = [];
  const meta: [string, unknown][] = [];
  const other: [string, unknown][] = [];
  for (const e of sorted) {
    const k = e[0];
    if (PREVIEW_GROUP_PRIMARY.has(k)) primary.push(e);
    else if (PREVIEW_GROUP_BODY.has(k)) body.push(e);
    else if (PREVIEW_GROUP_META.has(k)) meta.push(e);
    else other.push(e);
  }
  return { primary, body, meta, other };
}

function PreviewSidebar({ row, onClose }: { row: any; onClose: () => void }) {
  const json = JSON.stringify(row, null, 2);
  const [copied, setCopied] = useState(false);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sortedEntries = useMemo(() => {
    return Object.entries(row || {}).sort(
      ([a], [b]) => previewEntrySortKey(a) - previewEntrySortKey(b) || a.localeCompare(b),
    );
  }, [row]);

  const groups = useMemo(() => groupPreviewEntries(sortedEntries), [sortedEntries]);

  const headline = useMemo(() => {
    const t = row?.title;
    const a = row?.alt;
    if (typeof t === 'string' && t.trim()) return t.trim();
    if (typeof a === 'string' && a.trim()) return a.trim();
    return null;
  }, [row]);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [json]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const syncBody = () => {
      if (mq.matches) document.body.style.overflow = 'hidden';
      else document.body.style.overflow = '';
    };
    syncBody();
    mq.addEventListener('change', syncBody);
    return () => {
      mq.removeEventListener('change', syncBody);
      document.body.style.overflow = '';
    };
  }, []);

  /**
   * 移动端：顶部拖条 + 左右边缘窄条上「下滑」关闭 Bottom Sheet（同一套阻尼与阈值）
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = panel.querySelectorAll<HTMLElement>('.preview-sidebar__sheet-drag');
    if (nodes.length === 0) return;

    let startY = 0;
    let active = false;

    const isMobile = () => window.matchMedia('(max-width: 767.98px)').matches;

    const onStart = (e: TouchEvent) => {
      if (!isMobile() || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      active = true;
      setSheetDragging(true);
    };

    const onMove = (e: TouchEvent) => {
      if (!active || !isMobile() || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        const rubber = Math.min(dy * 0.72, window.innerHeight * 0.45);
        setSheetDragY(rubber);
        e.preventDefault();
      }
    };

    const finish = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      setSheetDragging(false);
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      const shouldClose = isMobile() && dy > 96;
      setSheetDragY(0);
      if (shouldClose) onClose();
    };

    nodes.forEach((el) => {
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', finish);
      el.addEventListener('touchcancel', finish);
    });
    return () => {
      nodes.forEach((el) => {
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', finish);
        el.removeEventListener('touchcancel', finish);
      });
    };
  }, [onClose, row]);

  /**
   * Web：捕获阶段 + non-passive，保证滚轮只进预览正文区或被我方消费，绝不链式滚动背后页面
   *（React 合成 onWheel 常为 passive，无法可靠 preventDefault）
   */
  useEffect(() => {
    const root = previewRootRef.current;
    if (!root) return;

    const onWheelCapture = (e: WheelEvent) => {
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      const body = previewBodyRef.current;
      if (!body) return;
      const t = e.target;
      if (t instanceof Node && body.contains(t)) return;
      applyWheelToPreviewBody(body, e.deltaY);
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
    return () => root.removeEventListener('wheel', onWheelCapture, true);
  }, [row]);

  const renderChunk = (title: string, id: string, entries: [string, unknown][], grid: boolean) => {
    if (entries.length === 0) return null;
    return (
      <section className="preview-sidebar__chunk" aria-labelledby={id}>
        <h3 id={id} className="preview-sidebar__chunk-title">
          {title}
        </h3>
        <div className={grid ? 'preview-sidebar__summary-grid' : 'preview-sidebar__chunk-fields'}>
          {entries.map(([k, v]) => (
            <PreviewFieldBlock key={k} fieldKey={k} value={v} />
          ))}
        </div>
      </section>
    );
  };

  const panelMotionStyle: CSSProperties = {
    transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
    transition: sheetDragging ? 'none' : 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
    willChange: sheetDragging ? 'transform' : undefined,
  };

  const shell = (
    <div ref={previewRootRef} className="preview-sidebar" role="presentation">
      <button
        type="button"
        className="preview-sidebar__backdrop"
        onClick={onClose}
        aria-label="关闭预览"
      />
      <div
        ref={panelRef}
        className="preview-sidebar__panel relative"
        style={panelMotionStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-sidebar-title"
        aria-describedby={headline ? 'preview-sidebar-desc' : undefined}
      >
        <div className="preview-sidebar__sheet-handle preview-sidebar__sheet-drag md:hidden" aria-hidden>
          <span className="preview-sidebar__sheet-pill" />
        </div>
        <div className="preview-sidebar__sheet-edge preview-sidebar__sheet-edge--left preview-sidebar__sheet-drag md:hidden" aria-hidden />
        <div className="preview-sidebar__sheet-edge preview-sidebar__sheet-edge--right preview-sidebar__sheet-drag md:hidden" aria-hidden />
        <header
          className="preview-sidebar__header relative z-[6] flex w-full shrink-0 items-start gap-3 border-b px-4 py-3 md:z-auto md:px-5 md:py-4"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2 md:gap-3">
            {/* 移动端 Bottom Sheet：左侧单一关闭（向下箭头暗示收起），避免与 ✕ 重复 */}
            <button
              type="button"
              className="preview-sidebar__btn-close-sheet btn btn-ghost inline-flex shrink-0 items-center justify-center md:hidden"
              onClick={onClose}
              aria-label="关闭预览"
            >
              <ChevronDown size={22} strokeWidth={2} aria-hidden />
            </button>
            <div className="preview-sidebar__header-lead min-w-0 flex-1">
              <h2
                id="preview-sidebar-title"
                className="text-sm font-semibold tracking-tight md:text-base"
                style={{ color: 'var(--c-text)' }}
              >
                数据预览
              </h2>
              {headline ? (
                <p id="preview-sidebar-desc" className="preview-sidebar__header-kicker mt-1 line-clamp-2 text-xs leading-snug md:text-[13px]" style={{ color: 'var(--c-text-secondary)' }}>
                  {headline}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <button type="button" className="preview-sidebar__btn-copy btn btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => void copyJson()}>
              <Copy size={16} strokeWidth={2} aria-hidden />
              {copied ? '已复制' : '复制 JSON'}
            </button>
            <button
              type="button"
              className="preview-sidebar__btn-close preview-sidebar__btn-close--desktop btn btn-ghost hidden items-center justify-center md:flex"
              onClick={onClose}
              aria-label="关闭"
            >
              <X size={22} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </header>
        <div
          ref={previewBodyRef}
          className="preview-sidebar__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 md:px-5 md:py-4"
        >
          {renderChunk('概要', 'preview-sec-summary', groups.primary, true)}
          {renderChunk('正文与摘要', 'preview-sec-body', groups.body, false)}
          {renderChunk('结构化数据', 'preview-sec-meta', groups.meta, false)}
          {renderChunk('其他字段', 'preview-sec-other', groups.other, false)}
        </div>
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}

// ─── Detail Panel (Enterprise) ──────────────────────────────────────────────

function DetailPanel({ item, onClose }: { item: CrawlHistoryItem; onClose: () => void }) {
  const t = TYPE_MAP[item.type] || TYPE_MAP.link;
  const allData: any[] = Array.isArray(item.data) ? item.data : [];
  const isNarrow = useMatchMedia('(max-width: 767.98px)');

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [depthFilter, setDepthFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches ? 'list' : 'table',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<any>(null);

  const domains = useMemo(() => {
    const set = new Set<string>();
    allData.forEach(d => { const dm = getDomain(getRowUrl(d)); if (dm) set.add(dm); });
    return Array.from(set).sort();
  }, [allData]);

  const depths = useMemo(() => {
    const set = new Set<number>();
    allData.forEach(d => { if (typeof d.depth === 'number') set.add(d.depth); });
    return Array.from(set).sort();
  }, [allData]);

  const filtered = useMemo(() => {
    let r = allData;
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(d => JSON.stringify(d).toLowerCase().includes(q)); }
    if (domainFilter !== 'all') r = r.filter(d => getDomain(getRowUrl(d)) === domainFilter);
    if (depthFilter !== 'all') r = r.filter(d => d.depth === depthFilter);
    return r;
  }, [allData, search, domainFilter, depthFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allOnPageSelected = paged.length > 0 && paged.every((_, i) => selected.has((safePage - 1) * pageSize + i));
  const toggleAll = () => {
    const next = new Set(selected);
    const base = (safePage - 1) * pageSize;
    if (allOnPageSelected) { paged.forEach((_, i) => next.delete(base + i)); }
    else { paged.forEach((_, i) => next.add(base + i)); }
    setSelected(next);
  };
  const toggleOne = (globalIdx: number) => {
    const next = new Set(selected);
    next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx);
    setSelected(next);
  };

  const exportData = (format: 'json' | 'csv', scope: 'selected' | 'filtered') => {
    const rows = scope === 'selected' ? Array.from(selected).sort().map(i => filtered[i]).filter(Boolean) : filtered;
    if (rows.length === 0) return;
    if (format === 'json') {
      downloadBlob(JSON.stringify(rows, null, 2), `data-${Date.now()}.json`, 'application/json');
    } else {
      const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      const lines = [keys.join(','), ...rows.map(r => keys.map(k => String(r[k] ?? '').replace(/,/g, ' ')).join(','))];
      downloadBlob(lines.join('\n'), `data-${Date.now()}.csv`, 'text/csv');
    }
  };

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, domainFilter, depthFilter, pageSize]);

  return (
    <div className="detail-panel card relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
        <h2 className="text-sm font-semibold min-w-0 truncate inline-flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
          <span className="inline-flex shrink-0 items-center justify-center rounded-md" style={{ width: '1.75rem', height: '1.75rem', background: 'var(--c-bg-input)', border: '1px solid var(--c-border)' }}>
            <CrawlerTypeIcon type={item.type} size={14} />
          </span>
          <span className="truncate">{t.label}详情</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" className="detail-panel__back btn btn-secondary btn-sm text-xs" onClick={onClose}>← 返回</button>
          <button type="button" className="detail-panel__close-x btn btn-ghost btn-sm px-3" onClick={onClose} aria-label="关闭">✕</button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="detail-panel__summary-link text-[11px] mb-2 block truncate hover:underline" style={{ color: 'var(--color-brand-400)' }}>{item.url}</a>
        <div className="detail-panel__summary-grid grid grid-cols-4 gap-2">
          {[
            { l: '状态', v: item.error ? '失败' : '成功', cls: item.error ? 'text-red-400' : 'text-emerald-400' },
            { l: '数据量', v: `${(item.items ?? 0).toLocaleString()}` },
            { l: '耗时', v: fmt(item.time ?? 0) },
            { l: '深度', v: `${item.depth}` },
          ].map(s => (
            <div key={s.l}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>{s.l}</div>
              <div className={'text-xs font-bold ' + ((s as any).cls || '')} style={(s as any).cls ? {} : { color: 'var(--c-text)' }}>{s.v}</div>
            </div>
          ))}
        </div>
        {item.error && (
          <div className="mt-2 p-2 rounded text-[11px] leading-relaxed max-h-20 overflow-y-auto"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171' }}>{item.error}</div>
        )}
      </div>

      {/* Toolbar */}
      <div className="detail-panel__toolbar px-3 py-2 border-b shrink-0 flex flex-col gap-2" style={{ borderColor: 'var(--c-border)' }}>
        <div className="detail-panel__toolbar-row flex items-center gap-2">
          <input className="input flex-1 text-[11px]" placeholder="搜索数据..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ padding: '4px 8px' }} />
          <div className="detail-panel__toolbar-domains flex flex-wrap gap-2">
          {domains.length > 1 && (
            <select className="select" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}
              style={{ fontSize: '11px', padding: '4px 6px', maxWidth: 140 }}>
              <option value="all">全部域名</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {depths.length > 1 && (
            <select className="select" value={String(depthFilter)}
              onChange={e => setDepthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{ fontSize: '11px', padding: '4px 6px', width: 72 }}>
              <option value="all">深度</option>
              {depths.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          </div>
        </div>
        <div className="detail-panel__toolbar-actions flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {(['table', 'card', 'list'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className="btn btn-sm" style={{
                  padding: '2px 8px', fontSize: '10px',
                  background: viewMode === v ? 'rgba(66,135,245,0.1)' : 'transparent',
                  color: viewMode === v ? 'var(--color-brand-400)' : 'var(--c-text-muted)',
                  border: viewMode === v ? '1px solid var(--color-brand-500)' : '1px solid transparent',
                }}>
                {{ table: '表格', card: '卡片', list: '列表' }[v]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <select className="select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
              style={{ fontSize: '10px', padding: '2px 4px' }}>
              {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => exportData('json', 'filtered')}>导出</button>
          </div>
        </div>
      </div>

      {/* Batch actions bar */}
      {selected.size > 0 && (
        <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2" style={{ borderColor: 'var(--c-border)', background: 'rgba(66,135,245,0.04)' }}>
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-brand-400)' }}>已选 {selected.size} 项</span>
          <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--color-brand-400)' }}
            onClick={() => exportData('json', 'selected')}>导出 JSON</button>
          <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--color-brand-400)' }}
            onClick={() => exportData('csv', 'selected')}>导出 CSV</button>
          <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--c-text-muted)' }}
            onClick={() => setSelected(new Set())}>取消选择</button>
        </div>
      )}

      {/* Data area */}
      <div className="detail-panel__data-scroll min-h-0 flex-1 overflow-y-auto">
        {allData.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--c-text-muted)' }}>
            {item.error ? '任务执行失败，无数据' : '暂无数据'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--c-text-muted)' }}>没有匹配的数据</div>
        ) : (
          <>
            {/* Table view：桌面为宽表；窄屏为卡片行，避免横向裁切 */}
            {viewMode === 'table' && !isNarrow && (
              <div className="detail-table-wrap overflow-x-auto">
              <table className="detail-table w-full min-w-[36rem] text-[11px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--c-bg-raised)' }}>
                    <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', width: 32 }}>
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll}
                        style={{ accentColor: 'var(--color-brand-500)' }} />
                    </th>
                    <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)', width: 36 }}>#</th>
                    <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>标题</th>
                    <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>URL</th>
                    {item.type !== 'image' && <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)', width: 48 }}>深度</th>}
                    {item.type === 'image' && <th className="px-2 py-2 text-left" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)', width: 48 }}>预览</th>}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => {
                    const globalIdx = (safePage - 1) * pageSize + i;
                    const rowUrl = getRowUrl(row);
                    return (
                      <tr key={globalIdx}
                        className="cursor-pointer transition-colors"
                        onClick={() => setPreview(row)}
                        style={{ borderBottom: '1px solid var(--c-border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(globalIdx)}
                            onChange={() => toggleOne(globalIdx)} style={{ accentColor: 'var(--color-brand-500)' }} />
                        </td>
                        <td className="px-2 py-2" style={{ color: 'var(--c-text-muted)' }}>{globalIdx + 1}</td>
                        <td className="detail-table__title max-w-[160px] truncate px-2 py-2" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</td>
                        <td className="detail-table__url max-w-[200px] truncate px-2 py-2 text-[11px]" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</td>
                        {item.type !== 'image' && <td className="px-2 py-2" style={{ color: 'var(--c-text-muted)' }}>{row.depth ?? '—'}</td>}
                        {item.type === 'image' && (
                          <td className="px-2 py-1">
                            <div className="w-8 h-8 rounded overflow-hidden" style={{ background: 'var(--c-bg-input)' }}>
                              <img src={rowUrl} alt="" loading="lazy" className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}

            {viewMode === 'table' && isNarrow && (
              <div className="detail-mobile-stack flex flex-col gap-2 px-1 pb-2">
                <div
                  className="detail-mobile-stack__bulk card flex items-center gap-3 px-3 py-2.5"
                  style={{ borderColor: 'var(--c-border)' }}
                >
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--color-brand-500)', width: '1.125rem', height: '1.125rem' }}
                    aria-label="全选本页"
                  />
                  <span className="text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>全选本页</span>
                </div>
                {paged.map((row, i) => {
                  const globalIdx = (safePage - 1) * pageSize + i;
                  const rowUrl = getRowUrl(row);
                  return (
                    <div
                      key={globalIdx}
                      role="button"
                      tabIndex={0}
                      className="detail-mobile-row card cursor-pointer p-3 transition-colors active:scale-[0.99]"
                      style={{ borderColor: 'var(--c-border)' }}
                      onClick={() => setPreview(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreview(row);
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(globalIdx)}
                            onChange={() => toggleOne(globalIdx)}
                            style={{ accentColor: 'var(--color-brand-500)', width: '1.125rem', height: '1.125rem' }}
                            aria-label={`选择第 ${globalIdx + 1} 条`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                              #{globalIdx + 1}
                            </span>
                            {item.type === 'image' && rowUrl && (
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--c-bg-input)' }}>
                                <img
                                  src={rowUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>
                          <p className="detail-mobile-row__title mt-1 text-sm font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>
                            {row.title || row.alt || '—'}
                          </p>
                          {rowUrl ? (
                            <a
                              href={rowUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="detail-mobile-row__url mt-2 block text-xs leading-relaxed"
                              style={{ color: 'var(--color-brand-400)' }}
                              onClick={e => e.stopPropagation()}
                            >
                              {rowUrl}
                            </a>
                          ) : null}
                          {item.type !== 'image' && (
                            <p className="mt-2 text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                              深度 <span style={{ color: 'var(--c-text-secondary)' }}>{row.depth ?? '—'}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Card view */}
            {viewMode === 'card' && (
              <div className={`detail-panel__card-grid grid gap-2 p-3 ${item.type === 'image' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {paged.map((row, i) => {
                  const globalIdx = (safePage - 1) * pageSize + i;
                  const rowUrl = getRowUrl(row);
                  return (
                    <div key={globalIdx} className="card p-3 cursor-pointer transition-all hover:border-[var(--c-border-strong)]"
                      onClick={() => setPreview(row)}>
                      {item.type === 'image' && (
                        <div className="aspect-square mb-2 rounded overflow-hidden flex items-center justify-center" style={{ background: 'var(--c-bg-input)' }}>
                          <img src={rowUrl} alt={row.alt || ''} loading="lazy" className="max-w-full max-h-full object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={selected.has(globalIdx)} onClick={e => e.stopPropagation()}
                          onChange={() => toggleOne(globalIdx)} style={{ accentColor: 'var(--color-brand-500)', marginTop: 2 }} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-medium" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</div>
                          <div className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</div>
                          {row.content && <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--c-text-secondary)' }}>{String(row.content).substring(0, 120)}</p>}
                          {row.depth != null && <span className="text-[9px] mt-1 inline-block" style={{ color: 'var(--c-text-muted)' }}>深度 {row.depth}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div className="flex flex-col">
                {paged.map((row, i) => {
                  const globalIdx = (safePage - 1) * pageSize + i;
                  const rowUrl = getRowUrl(row);
                  return (
                    <div key={globalIdx}
                      className="detail-list__row flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors"
                      style={{ borderBottom: '1px solid var(--c-border)' }}
                      onClick={() => setPreview(row)}>
                      <input type="checkbox" checked={selected.has(globalIdx)} onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(globalIdx)} style={{ accentColor: 'var(--color-brand-500)' }} />
                      <span className="w-6 shrink-0 text-center text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{globalIdx + 1}</span>
                      <span className="detail-list__row-title min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</span>
                      <span className="detail-list__url max-w-[180px] shrink-0 truncate text-[10px]" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</span>
                      {row.depth != null && <span className="w-8 shrink-0 text-center text-[9px]" style={{ color: 'var(--c-text-muted)' }}>{row.depth}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="border-t shrink-0 px-3" style={{ borderColor: 'var(--c-border)' }}>
          <Pagination page={safePage} total={filtered.length} pageSize={pageSize} onChange={setPage} />
        </div>
      )}

      {/* Preview sidebar */}
      {preview && <PreviewSidebar row={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const AnalisysPage = () => {
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [selected, setSelected] = useState<CrawlHistoryItem | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshHistory = useCallback(async () => {
    setRefreshing(true);
    const local = loadHistory();
    try {
      const res = await crawlerApi.getHistory(100);
      const env = res.data as { data?: unknown[] };
      const rows = Array.isArray(env.data) ? env.data : [];
      const serverItems = rows.map((r) =>
        mapServerRowToItem(r as Record<string, unknown>)
      );
      const merged = mergeHistory(local, serverItems);
      setHistory(merged);
      saveHistory(merged.slice(0, 50));
    } catch {
      setHistory(local);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const run = () => {
      void refreshHistory();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('crawlHistoryUpdated', run);
    window.addEventListener('storage', run);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('crawlHistoryUpdated', run);
      window.removeEventListener('storage', run);
    };
  }, [refreshHistory]);

  const del = useCallback((id: string) => {
    if (!window.confirm('确定删除这条记录？')) return;
    void crawlerApi.deleteHistory(id).catch(() => {});
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      return next;
    });
    setSelected(s => (s?.id === id ? null : s));
  }, []);

  const clearAll = useCallback(() => {
    if (!window.confirm('确定清空所有历史记录？')) return;
    void crawlerApi.clearHistory().catch(() => {});
    setHistory([]); setSelected(null); saveHistory([]);
  }, []);

  const list = useMemo(() => {
    let r = [...history];
    if (filter !== 'all') r = r.filter(h => h.type === filter);
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(h => h.url.toLowerCase().includes(q)); }
    r.sort((a, b) => { const d = (a[sortBy] ?? 0) - (b[sortBy] ?? 0); return sortAsc ? d : -d; });
    return r;
  }, [history, filter, search, sortBy, sortAsc]);

  // Stats
  const stats = useMemo(() => {
    const t = history.length;
    const s = history.filter(h => !h.error).length;
    const items = history.reduce((a, h) => a + (h.items || 0), 0);
    const avg = t > 0 ? history.reduce((a, h) => a + (h.time || 0), 0) / t : 0;
    return { total: t, success: s, failed: t - s, items, avg };
  }, [history]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `crawl-history-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`analytics-page page-enter app-layout flex min-h-0 w-full flex-1 flex-col overflow-hidden px-5 pb-8 lg:h-screen lg:px-8 ${selected ? 'analytics-page--detail-open' : ''}`}
      style={{
        paddingTop: 'calc(72px + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Header（桌面：标题与按钮横排；手机见 mobile-ui.css） */}
      <div className="analytics-page__header-row mb-4 flex w-full shrink-0 items-center justify-between">
        <div>
          <h1 className="analytics-page__title text-2xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>数据分析</h1>
          <p className="analytics-page__subtitle mt-0.5 text-sm" style={{ color: 'var(--c-text-muted)' }}>管理和分析爬取历史</p>
        </div>
        <div className="analytics-page__header-actions flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
            onClick={() => void refreshHistory()}
          >
            {refreshing ? '刷新中…' : '刷新'}
          </button>
          {history.length > 0 && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={exportJSON}>导出 JSON</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>清空</button>
            </>
          )}
        </div>
      </div>

      {/* Stats（桌面：一行 5 格） */}
      {stats.total > 0 && (
        <div className="analytics-page__stats mb-4 grid w-full shrink-0 grid-cols-5 gap-3">
          {[
            { l: '总任务', v: stats.total, c: 'var(--color-brand-400)' },
            { l: '成功', v: stats.success, c: 'var(--color-success)' },
            { l: '失败', v: stats.failed, c: 'var(--color-danger)' },
            { l: '总数据', v: stats.items.toLocaleString(), c: 'var(--color-accent)' },
            { l: '平均耗时', v: fmt(stats.avg), c: 'var(--color-warn)' },
          ].map((s) => (
            <div key={s.l} className="analytics-page__stat-card card p-3 text-center">
              <div className="analytics-page__stat-value text-lg font-bold tabular-nums" style={{ color: s.c }}>{s.v}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* 主区：桌面双栏 grid；手机由 mobile-ui.css 改为纵向 flex */}
      <div
        className="analytics-page__main-grid grid w-full min-h-0 flex-1 gap-4"
        style={{ gridTemplateColumns: selected ? 'minmax(0,min(360px,32%)) minmax(0,1fr)' : '1fr' }}
      >
        <div className="analytics-page__list-column flex h-full min-h-0 min-w-0 flex-col">
          <div className="analytics-page__toolbar card mb-3 shrink-0 p-3">
            <input className="input mb-2 text-xs" placeholder="搜索 URL..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="analytics-page__toolbar-filters flex flex-wrap items-center gap-1.5">
              <select className="select" value={filter} onChange={e => setFilter(e.target.value as FilterType)}>
                <option value="all">全部类型</option>
                <option value="link">链接</option>
                <option value="content">内容</option>
                <option value="image">图片</option>
              </select>
              <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value as SortField)}>
                <option value="timestamp">时间</option>
                <option value="items">数量</option>
                <option value="time">耗时</option>
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSortAsc(p => !p)}>
                {sortAsc ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="analytics-page__list-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {list.length === 0 ? (
              <div className="text-center py-16">
                <div className="mb-3 flex justify-center" style={{ color: 'var(--c-text-muted)' }}>
                  {history.length === 0 ? <ClipboardList size={40} strokeWidth={1.25} aria-hidden /> : <Search size={40} strokeWidth={1.25} aria-hidden />}
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--c-text)' }}>
                  {history.length === 0 ? '暂无爬取历史' : '没有匹配结果'}
                </p>
                <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                  {history.length === 0 ? '完成爬取任务后会显示在这里' : '调整筛选条件试试'}
                </p>
              </div>
            ) : list.map(item => {
              const t = TYPE_MAP[item.type] || TYPE_MAP.link;
              const active = selected?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="history-card group flex min-w-0 cursor-pointer items-stretch gap-3 p-3.5 card transition-all"
                  style={{
                    borderColor: active ? 'var(--color-brand-500)' : undefined,
                    boxShadow: active ? '0 0 0 2px rgba(66,135,245,0.1)' : undefined,
                    borderLeft: item.error ? '3px solid var(--color-danger)' : undefined,
                  }}
                >
                  <div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col">
                    <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-brand-400)' }}>
                      <CrawlerTypeIcon type={item.type} size={14} className="shrink-0 opacity-90" />
                      {t.label}
                    </div>
                    <div className="history-card__url mb-2 truncate text-xs" style={{ color: 'var(--c-text-secondary)' }}>{item.url}</div>
                    <div className="history-card__meta-row mt-auto flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                      <span><strong style={{ color: 'var(--c-text)' }}>{item.items ?? 0}</strong> 条</span>
                      <span>{fmt(item.time ?? 0)}</span>
                      <span>深度 {item.depth}</span>
                    </div>
                  </div>
                  {/* 右侧轨：状态（上）— 删除（中）— 时间（下），便于 iPad 触控与扫视 */}
                  <div className="history-card__rail flex w-11 shrink-0 flex-col items-center justify-between gap-1 border-l pl-3" style={{ borderColor: 'var(--c-border)' }}>
                    <span className={`badge shrink-0 ${item.error ? 'badge-danger' : 'badge-success'}`}>{item.error ? '失败' : '成功'}</span>
                    <button
                      type="button"
                      className="history-card__delete flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
                      style={{
                        color: 'var(--color-danger)',
                        background: 'transparent',
                      }}
                      title="删除此记录"
                      aria-label="删除此记录"
                      onClick={e => { e.stopPropagation(); del(item.id); }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Trash2 size={20} strokeWidth={2} aria-hidden />
                    </button>
                    <span className="max-w-[3.25rem] shrink-0 text-center text-[10px] leading-tight" style={{ color: 'var(--c-text-muted)' }}>
                      {fmtDate(item.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail（手机全宽；桌面与左侧列表并排） */}
        {selected && (
          <div className="analytics-page__detail-column flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DetailPanel item={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalisysPage;
