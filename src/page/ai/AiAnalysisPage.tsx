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

interface AiStatus {
  db_connected: boolean;
  db_error: string | null;
  stored_providers: number;
  env_llm_configured: boolean;
  llm_ready: boolean;
}

interface AiProviderRow {
  id: string;
  display_name: string;
  base_url: string;
  model_id: string;
  is_default: boolean;
}

const LS_PROVIDER_ID = 'ai_analysis_provider_id';

function formatApiError(data: { detail?: unknown; message?: string }): string {
  const d = data.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join('; ');
  }
  if (data.message) return String(data.message);
  return '请求失败';
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
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [providers, setProviders] = useState<AiProviderRow[]>([]);
  const [providerId, setProviderId] = useState<string>(() => {
    try { return localStorage.getItem(LS_PROVIDER_ID) || ''; } catch { return ''; }
  });
  const [showProviders, setShowProviders] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('https://api.deepseek.com/v1');
  const [newModelId, setNewModelId] = useState('deepseek-chat');
  const [newApiKey, setNewApiKey] = useState('');
  const [newAsDefault, setNewAsDefault] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHistory(loadQueryHistory()); }, []);

  const refreshAiMeta = async () => {
    try {
      const [st, pr] = await Promise.all([
        fetch('/api/v1/ai/status').then(r => r.json()),
        fetch('/api/v1/ai/providers').then(r => r.json()),
      ]);
      setAiStatus(st);
      if (Array.isArray(pr)) setProviders(pr);
    } catch {
      setAiStatus({
        db_connected: false,
        db_error: '无法连接 AI 后端（请确认 FastAPI 已启动且已执行数据库迁移）',
        stored_providers: 0,
        env_llm_configured: false,
        llm_ready: false,
      });
    }
  };

  useEffect(() => { void refreshAiMeta(); }, []);

  useEffect(() => {
    try {
      if (providerId) localStorage.setItem(LS_PROVIDER_ID, providerId);
      else localStorage.removeItem(LS_PROVIDER_ID);
    } catch { /* ignore */ }
  }, [providerId]);

  const runQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setShowSqlEditor(false);

    try {
      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          ...(providerId ? { provider_id: providerId } : {}),
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setResult({
          question: q, sql: '', columns: [], rows: [], total: 0,
          chart: null, duration_ms: 0,
          error: formatApiError(data),
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
        setResult(prev => prev ? { ...prev, error: formatApiError(data) } : null);
      } else {
        setResult(prev => prev ? { ...prev, ...data, error: undefined } : data);
      }
    } catch (err) {
      setResult(prev => prev ? { ...prev, error: '执行失败' } : null);
    } finally {
      setLoading(false);
    }
  };

  const submitNewProvider = async () => {
    if (!newName.trim() || !newBaseUrl.trim() || !newModelId.trim() || !newApiKey.trim()) return;
    setSavingProvider(true);
    try {
      const resp = await fetch('/api/v1/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newName.trim(),
          base_url: newBaseUrl.trim(),
          model_id: newModelId.trim(),
          api_key: newApiKey.trim(),
          set_as_default: newAsDefault,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(formatApiError(data));
        return;
      }
      setNewApiKey('');
      setNewName('');
      await refreshAiMeta();
      if (data.id) setProviderId(String(data.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingProvider(false);
    }
  };

  const removeProvider = async (id: string) => {
    if (!confirm('确定删除该供应商配置？')) return;
    const resp = await fetch(`/api/v1/ai/providers/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      const data = await resp.json();
      alert(formatApiError(data));
      return;
    }
    if (providerId === id) setProviderId('');
    await refreshAiMeta();
  };

  const makeDefault = async (id: string) => {
    const resp = await fetch(`/api/v1/ai/providers/${id}/set-default`, { method: 'POST' });
    if (!resp.ok) {
      const data = await resp.json();
      alert(formatApiError(data));
      return;
    }
    await refreshAiMeta();
  };

  return (
    <div className="page-shell page-enter app-layout px-5 pb-16 pt-24 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>
          AI 智能分析
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>
          用自然语言查询爬取数据，AI 自动生成 SQL 并返回结果
        </p>
      </div>

      {/* Backend / DB / LLM connectivity */}
      {aiStatus && (
        <div
          className="card p-3 mb-4 text-[11px] leading-relaxed"
          style={{
            borderColor: aiStatus.db_connected ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
            background: aiStatus.db_connected ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span style={{ color: 'var(--c-text)' }}>
              <strong>数据库</strong>：{aiStatus.db_connected ? '已连接' : '未连接'}
              {!aiStatus.db_connected && aiStatus.db_error && (
                <span style={{ color: 'var(--c-text-secondary)' }}> — {aiStatus.db_error}</span>
              )}
            </span>
            <span style={{ color: 'var(--c-text-secondary)' }}>
              已存供应商 {aiStatus.stored_providers} 个 · .env 中 DEEPSEEK {aiStatus.env_llm_configured ? '已配置' : '未配置'}
            </span>
            <span style={{ color: aiStatus.llm_ready ? '#34d399' : '#fbbf24' }}>
              {aiStatus.llm_ready ? '可进行自然语言生成 SQL' : '需配置 API Key（界面或 .env）'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}
              onClick={() => void refreshAiMeta()}>刷新状态</button>
          </div>
        </div>
      )}

      {/* Model providers */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>模型供应商</div>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
              OpenAI 兼容接口（DeepSeek、OpenAI 等）。密钥在服务端用 SECRET_KEY 加密后写入数据库。
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => setShowProviders(!showProviders)}>
            {showProviders ? '收起配置' : '管理供应商'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
          <label className="text-[11px] shrink-0" style={{ color: 'var(--c-text-secondary)' }}>本次查询使用</label>
          <select
            className="input text-xs flex-1 max-w-xl"
            value={providerId}
            onChange={e => setProviderId(e.target.value)}
            disabled={loading}
          >
            <option value="">自动（数据库中的「默认」供应商，若无则使用 .env 的 DeepSeek）</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.display_name} {p.is_default ? '（默认）' : ''} — {p.model_id}
              </option>
            ))}
          </select>
        </div>

        {showProviders && (
          <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: 'var(--c-border)' }}>
            {providers.length > 0 && (
              <ul className="space-y-2">
                {providers.map(p => (
                  <li key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11px]"
                    style={{ background: 'var(--c-bg-hover)' }}>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--c-text)' }}>{p.display_name}</span>
                      {p.is_default && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px]" style={{
                          background: 'var(--color-brand-500)', color: '#fff',
                        }}>默认</span>
                      )}
                      <div style={{ color: 'var(--c-text-muted)' }}>{p.base_url} · {p.model_id}</div>
                    </div>
                    <div className="flex gap-1">
                      {!p.is_default && (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                          onClick={() => void makeDefault(p.id)}>设为默认</button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: '#f87171' }}
                        onClick={() => void removeProvider(p.id)}>删除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input text-xs" placeholder="显示名称，如 公司 DeepSeek"
                value={newName} onChange={e => setNewName(e.target.value)} />
              <input className="input text-xs" placeholder="Base URL"
                value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} />
              <input className="input text-xs" placeholder="模型 ID，如 deepseek-chat"
                value={newModelId} onChange={e => setNewModelId(e.target.value)} />
              <input className="input text-xs" type="password" autoComplete="off" placeholder="API Key"
                value={newApiKey} onChange={e => setNewApiKey(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: 'var(--c-text-secondary)' }}>
              <input type="checkbox" checked={newAsDefault} onChange={e => setNewAsDefault(e.target.checked)} />
              保存为默认供应商（未指定时将优先于 .env）
            </label>
            <button type="button" className="btn btn-primary btn-sm" disabled={savingProvider}
              onClick={() => void submitNewProvider()}>
              {savingProvider ? '保存中…' : '保存供应商'}
            </button>
          </div>
        )}
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
