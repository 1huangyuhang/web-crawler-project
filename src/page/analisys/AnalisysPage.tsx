import { useState, useEffect, useMemo, useCallback } from 'react';

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

const TYPE_MAP: Record<string, { icon: string; label: string }> = {
  link:    { icon: '🔗', label: '链接爬虫' },
  content: { icon: '📄', label: '内容爬虫' },
  image:   { icon: '🖼️', label: '图片爬虫' },
};

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

function PreviewSidebar({ row, onClose }: { row: any; onClose: () => void }) {
  const json = JSON.stringify(row, null, 2);
  const entries = Object.entries(row || {});

  return (
    <div className="absolute inset-0 z-10 flex">
      <div className="flex-1" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="w-80 h-full flex flex-col overflow-hidden" style={{ background: 'var(--c-bg-card)', borderLeft: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between p-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>数据预览</span>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }}
              onClick={() => { navigator.clipboard.writeText(json); }}>复制 JSON</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-2">
            {entries.map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--c-text-muted)' }}>{k}</div>
                <div className="text-xs break-all leading-relaxed" style={{ color: 'var(--c-text)' }}>
                  {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel (Enterprise) ──────────────────────────────────────────────

function DetailPanel({ item, onClose }: { item: CrawlHistoryItem; onClose: () => void }) {
  const t = TYPE_MAP[item.type] || TYPE_MAP.link;
  const allData: any[] = Array.isArray(item.data) ? item.data : [];

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [depthFilter, setDepthFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
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
    <div className="card overflow-hidden h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{t.icon} {t.label}详情</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] block truncate mb-2 hover:underline" style={{ color: 'var(--color-brand-400)' }}>{item.url}</a>
        <div className="grid grid-cols-4 gap-2">
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
      <div className="px-3 py-2 border-b shrink-0 flex flex-col gap-2" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <input className="input text-[11px] flex-1" placeholder="搜索数据..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ padding: '4px 8px' }} />
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
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
          <div className="flex items-center gap-1">
            <select className="select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
              style={{ fontSize: '10px', padding: '2px 4px' }}>
              {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }}
              onClick={() => exportData('json', 'filtered')}>导出</button>
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
      <div className="flex-1 overflow-y-auto">
        {allData.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--c-text-muted)' }}>
            {item.error ? '任务执行失败，无数据' : '暂无数据'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--c-text-muted)' }}>没有匹配的数据</div>
        ) : (
          <>
            {/* Table view */}
            {viewMode === 'table' && (
              <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
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
                        <td className="px-2 py-2 truncate max-w-[160px]" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</td>
                        <td className="px-2 py-2 truncate max-w-[200px]" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</td>
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
            )}

            {/* Card view */}
            {viewMode === 'card' && (
              <div className={`p-3 grid gap-2 ${item.type === 'image' ? 'grid-cols-3' : 'grid-cols-1'}`}>
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
                          <div className="text-xs font-medium truncate" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</div>
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
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--c-border)' }}
                      onClick={() => setPreview(row)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <input type="checkbox" checked={selected.has(globalIdx)} onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(globalIdx)} style={{ accentColor: 'var(--color-brand-500)' }} />
                      <span className="text-[10px] w-6 text-center shrink-0" style={{ color: 'var(--c-text-muted)' }}>{globalIdx + 1}</span>
                      <span className="text-[11px] truncate flex-1" style={{ color: 'var(--c-text)' }}>{row.title || row.alt || '—'}</span>
                      <span className="text-[10px] truncate max-w-[180px]" style={{ color: 'var(--color-brand-400)' }}>{rowUrl}</span>
                      {row.depth != null && <span className="text-[9px] shrink-0 w-8 text-center" style={{ color: 'var(--c-text-muted)' }}>{row.depth}</span>}
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

  useEffect(() => { setHistory(loadHistory()); }, []);

  const del = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      if (selected?.id === id) setSelected(null);
      return next;
    });
  }, [selected]);

  const clearAll = useCallback(() => {
    if (!window.confirm('确定清空所有历史记录？')) return;
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
    <div className="page-enter pt-18 pb-8 px-5 h-screen flex flex-col" style={{ paddingTop: '72px' }}>
      {/* Header row */}
      <div className="mx-auto w-full max-w-7xl flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>数据分析</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>管理和分析爬取历史</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={exportJSON}>导出 JSON</button>
              <button className="btn btn-danger btn-sm" onClick={clearAll}>清空</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="mx-auto w-full max-w-7xl grid grid-cols-5 gap-3 mb-4 shrink-0">
          {[
            { l: '总任务', v: stats.total, c: 'var(--color-brand-400)' },
            { l: '成功', v: stats.success, c: 'var(--color-success)' },
            { l: '失败', v: stats.failed, c: 'var(--color-danger)' },
            { l: '总数据', v: stats.items.toLocaleString(), c: 'var(--color-accent)' },
            { l: '平均耗时', v: fmt(stats.avg), c: 'var(--color-warn)' },
          ].map(s => (
            <div key={s.l} className="card p-3 text-center">
              <div className="text-lg font-bold" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main layout */}
      <div className="mx-auto w-full max-w-7xl flex-1 min-h-0 grid gap-4" style={{ gridTemplateColumns: selected ? '380px 1fr' : '1fr' }}>
        {/* Left: list */}
        <div className="flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="card p-3 mb-3 shrink-0">
            <input className="input text-xs mb-2" placeholder="搜索 URL..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-1.5 flex-wrap">
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
              <button className="btn btn-ghost btn-sm" onClick={() => setSortAsc(p => !p)}>
                {sortAsc ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {list.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-3xl mb-3">{history.length === 0 ? '📋' : '🔍'}</div>
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
                  className="card p-3.5 cursor-pointer transition-all group"
                  style={{
                    borderColor: active ? 'var(--color-brand-500)' : undefined,
                    boxShadow: active ? '0 0 0 2px rgba(66,135,245,0.1)' : undefined,
                    borderLeft: item.error ? '3px solid var(--color-danger)' : undefined,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--color-brand-400)' }}>{t.icon} {t.label}</span>
                    <span className={`badge ${item.error ? 'badge-danger' : 'badge-success'}`}>{item.error ? '失败' : '成功'}</span>
                  </div>
                  <div className="text-xs truncate mb-2" style={{ color: 'var(--c-text-secondary)' }}>{item.url}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                      <span><strong style={{ color: 'var(--c-text)' }}>{item.items ?? 0}</strong> 条</span>
                      <span>{fmt(item.time ?? 0)}</span>
                      <span>深度 {item.depth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{fmtDate(item.timestamp)}</span>
                      <button className="opacity-0 group-hover:opacity-100 btn btn-danger btn-sm"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={e => { e.stopPropagation(); del(item.id); }}>
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        {selected && (
          <div className="min-h-0">
            <DetailPanel item={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalisysPage;
