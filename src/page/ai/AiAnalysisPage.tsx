import { useState, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QueryResult {
  question: string;
  sql: string;
  columns: string[];
  rows: Record<string, any>[];
  total: number;
  chart: { type: string; labelField: string; valueField: string } | null;
  duration_ms: number;
  error?: string;
}

interface HistoryEntry {
  question: string;
  timestamp: number;
}

const PRESET_QUESTIONS = [
  '最近7天每天爬取了多少条数据',
  '爬取成功和失败的任务各有多少',
  '哪个域名的爬取数据最多',
  '平均爬取耗时是多少秒',
  '最近10个完成的任务',
  '爬取深度分布统计',
];

function loadQueryHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('ai_query_history');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueryHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem('ai_query_history', JSON.stringify(entries.slice(0, 50))); } catch {}
}

// ─── Simple Bar/Pie Chart (pure CSS, no Chart.js dependency) ────────────────

function SimpleChart({ chart, rows }: { chart: QueryResult['chart']; rows: Record<string, any>[] }) {
  if (!chart || rows.length === 0) return null;
  const { type, labelField, valueField } = chart;
  const values = rows.map(r => Number(r[valueField]) || 0);
  const maxVal = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const colors = ['#4287f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  if (type === 'pie') {
    let cumAngle = 0;
    const segments = rows.map((r, i) => {
      const val = Number(r[valueField]) || 0;
      const pct = total > 0 ? val / total : 0;
      const start = cumAngle;
      cumAngle += pct * 360;
      return { label: String(r[labelField] ?? ''), val, pct, color: colors[i % colors.length], start, end: cumAngle };
    });

    return (
      <div className="flex items-start gap-6 py-4">
        <svg width="140" height="140" viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((s, i) => {
            const startAngle = (s.start / 360) * Math.PI * 2;
            const endAngle = (s.end / 360) * Math.PI * 2;
            const largeArc = s.pct > 0.5 ? 1 : 0;
            const x1 = Math.cos(startAngle);
            const y1 = Math.sin(startAngle);
            const x2 = Math.cos(endAngle);
            const y2 = Math.sin(endAngle);
            return (
              <path key={i} d={`M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={s.color} opacity={0.85} />
            );
          })}
        </svg>
        <div className="flex flex-col gap-1.5">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span style={{ color: 'var(--c-text-secondary)' }}>{s.label}</span>
              <span className="font-semibold" style={{ color: 'var(--c-text)' }}>{s.val}</span>
              <span style={{ color: 'var(--c-text-muted)' }}>({(s.pct * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Bar / line chart
  return (
    <div className="py-4">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {rows.slice(0, 20).map((r, i) => {
          const val = Number(r[valueField]) || 0;
          const height = Math.max(4, (val / maxVal) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${r[labelField]}: ${val}`}>
              <span className="text-[9px] font-medium" style={{ color: 'var(--c-text-muted)' }}>{val}</span>
              <div className="w-full rounded-t" style={{
                height: `${height}%`, background: colors[i % colors.length], opacity: 0.8,
                minHeight: 4, transition: 'height 0.3s ease',
              }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {rows.slice(0, 20).map((r, i) => (
          <div key={i} className="flex-1 text-center text-[8px] truncate" style={{ color: 'var(--c-text-muted)' }}>
            {String(r[labelField] ?? '').substring(0, 8)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const AiAnalysisPage = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [editingSql, setEditingSql] = useState('');
  const [showSqlEditor, setShowSqlEditor] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHistory(loadQueryHistory()); }, []);

  const runQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setShowSqlEditor(false);

    try {
      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setResult({
          question: q, sql: '', columns: [], rows: [], total: 0,
          chart: null, duration_ms: 0,
          error: data.detail || data.message || '查询失败',
        });
      } else {
        setResult({ ...data, error: undefined });
        setEditingSql(data.sql);
      }
    } catch (err) {
      setResult({
        question: q, sql: '', columns: [], rows: [], total: 0,
        chart: null, duration_ms: 0,
        error: err instanceof Error ? err.message : '网络请求失败',
      });
    } finally {
      setLoading(false);
      const entry: HistoryEntry = { question: q, timestamp: Date.now() };
      const updated = [entry, ...history.filter(h => h.question !== q)].slice(0, 50);
      setHistory(updated);
      saveQueryHistory(updated);
    }
  };

  const executeSql = async () => {
    if (!editingSql.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: editingSql }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setResult(prev => prev ? { ...prev, error: data.detail || '执行失败' } : null);
      } else {
        setResult(prev => prev ? { ...prev, ...data, error: undefined } : data);
      }
    } catch (err) {
      setResult(prev => prev ? { ...prev, error: '执行失败' } : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-5xl px-5 pt-24 pb-16">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>
          AI 智能分析
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>
          用自然语言查询爬取数据，AI 自动生成 SQL 并返回结果
        </p>
      </div>

      {/* Input area */}
      <div className="card p-4 mb-4">
        <form onSubmit={e => { e.preventDefault(); runQuery(question); }} className="flex gap-2">
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder="用自然语言描述你想查询的数据..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
            {loading ? '查询中...' : '查询'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)}
            title="查询历史" style={{ fontSize: 16 }}>
            {showHistory ? '✕' : '🕐'}
          </button>
        </form>

        {/* Preset questions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {PRESET_QUESTIONS.map(q => (
            <button key={q} onClick={() => { setQuestion(q); runQuery(q); }}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer transition-all"
              style={{
                background: 'var(--c-bg-hover)', color: 'var(--c-text-secondary)',
                border: '1px solid var(--c-border)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-500)'; e.currentTarget.style.color = 'var(--color-brand-400)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-secondary)'; }}
              disabled={loading}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: showHistory ? '1fr 240px' : '1fr' }}>
        {/* Results */}
        <div>
          {/* Loading */}
          {loading && (
            <div className="card p-8 text-center">
              <div className="inline-block w-6 h-6 rounded-full border-2 animate-spin mb-3"
                style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--color-brand-500)' }} />
              <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>AI 正在分析...</p>
            </div>
          )}

          {/* Error */}
          {result?.error && (
            <div className="card p-4 mb-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="text-sm font-medium mb-1" style={{ color: '#f87171' }}>查询失败</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>{result.error}</div>
            </div>
          )}

          {/* Success result */}
          {result && !result.error && !loading && (
            <>
              {/* SQL display */}
              <div className="card mb-4 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>生成的 SQL</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{result.duration_ms}ms</span>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => { navigator.clipboard.writeText(result.sql); }}>复制</button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => setShowSqlEditor(!showSqlEditor)}>
                      {showSqlEditor ? '收起' : '编辑'}
                    </button>
                  </div>
                </div>
                {showSqlEditor ? (
                  <div className="p-3">
                    <textarea className="input w-full font-mono text-xs" rows={4}
                      value={editingSql} onChange={e => setEditingSql(e.target.value)}
                      style={{ resize: 'vertical', lineHeight: 1.6 }} />
                    <button className="btn btn-primary btn-sm mt-2" onClick={executeSql} disabled={loading}>
                      执行修改后的 SQL
                    </button>
                  </div>
                ) : (
                  <pre className="px-4 py-3 text-xs font-mono leading-relaxed overflow-x-auto"
                    style={{ color: 'var(--color-brand-400)', background: 'var(--c-bg-card)' }}>
                    {result.sql}
                  </pre>
                )}
              </div>

              {/* Chart */}
              {result.chart && (
                <div className="card p-4 mb-4">
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--c-text)' }}>数据可视化</div>
                  <SimpleChart chart={result.chart} rows={result.rows} />
                </div>
              )}

              {/* Results table */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>
                    查询结果 ({result.total} 条)
                  </span>
                  <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => {
                      const content = JSON.stringify(result.rows, null, 2);
                      const blob = new Blob([content], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ai-query-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                    }}>导出 JSON</button>
                </div>

                {result.rows.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: 'var(--c-text-muted)' }}>查询无结果</div>
                ) : (
                  <div className="overflow-x-auto" style={{ maxHeight: '50vh' }}>
                    <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-bg-raised)' }}>
                          <th className="px-3 py-2 text-left font-semibold" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)', width: 36 }}>#</th>
                          {result.columns.map(col => (
                            <th key={col} className="px-3 py-2 text-left font-semibold"
                              style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i}
                            className="transition-colors"
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                            style={{ borderBottom: '1px solid var(--c-border)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--c-text-muted)' }}>{i + 1}</td>
                            {result.columns.map(col => (
                              <td key={col} className="px-3 py-2 max-w-[300px] truncate" style={{ color: 'var(--c-text)' }}>
                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <div className="card p-16 text-center">
              <div className="text-4xl mb-4 opacity-30">🤖</div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--c-text)' }}>输入问题开始查询</p>
              <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                试试 "最近爬取了多少条数据" 或点击上方预设问题
              </p>
            </div>
          )}
        </div>

        {/* History sidebar */}
        {showHistory && (
          <div className="card p-3 h-fit" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>查询历史</span>
              {history.length > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '9px' }}
                  onClick={() => { setHistory([]); saveQueryHistory([]); }}>清空</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-[11px] text-center py-4" style={{ color: 'var(--c-text-muted)' }}>暂无历史记录</p>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((h, i) => (
                  <button key={i} onClick={() => { setQuestion(h.question); runQuery(h.question); }}
                    className="text-left px-2 py-1.5 rounded transition-colors text-[11px]"
                    style={{ color: 'var(--c-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div className="truncate">{h.question}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      {new Date(h.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiAnalysisPage;
