import { useState, useEffect } from 'react';
import type { ApplySpiderTemplateDetail } from '../../utils/spiderTemplateRuntime';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  url_patterns: string[];
  headers: Record<string, string>;
  parse_rules: Record<string, string>;
  anti_crawl_config: Record<string, unknown>;
  pagination_config?: Record<string, unknown> | null;
  data_clean_rules?: Record<string, unknown> | null;
  is_builtin: boolean;
  version: number;
  created_at: string;
  updated_at?: string;
}

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  general: { icon: '🌐', label: '通用' },
  ecommerce: { icon: '🛒', label: '电商' },
  news: { icon: '📰', label: '新闻' },
  social: { icon: '💬', label: '社交' },
  recruitment: { icon: '💼', label: '招聘' },
  docs: { icon: '📚', label: '文档' },
  code_host: { icon: '📦', label: '代码托管' },
  forum: { icon: '💭', label: '论坛问答' },
  gov: { icon: '🏛️', label: '政务' },
  media: { icon: '🖼️', label: '图库' },
};

function dispatchApplyTemplate(t: Template) {
  const detail: ApplySpiderTemplateDetail = {
    id: t.id,
    name: t.name,
    anti_crawl_config: t.anti_crawl_config,
  };
  window.dispatchEvent(new CustomEvent('applySpiderTemplate', { detail }));
  window.location.hash = 'crawler';
}

function fmtKv(obj: Record<string, unknown> | null | undefined, max = 12) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .slice(0, max)
    .map(([k, v]) => ({
      k,
      v: typeof v === 'object' ? JSON.stringify(v) : String(v),
    }));
}

const TemplatesPage = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [matchUrl, setMatchUrl] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchHint, setMatchHint] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/templates')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered =
    filterCategory === 'all' ? templates : templates.filter((t) => t.category === filterCategory);

  const runMatch = () => {
    const u = matchUrl.trim();
    if (!u) {
      setMatchHint('请输入完整 URL（含 https://）');
      return;
    }
    setMatchLoading(true);
    setMatchHint(null);
    const q = new URLSearchParams({ url: u });
    fetch(`/api/v1/templates/match?${q}`)
      .then((r) => r.json())
      .then((data: { matched?: boolean; template?: Template | null }) => {
        setMatchLoading(false);
        if (data.matched && data.template) {
          setSelected(data.template);
          setMatchHint(`已匹配：${data.template.name}`);
        } else {
          setMatchHint('未命中专项模板，将使用「通用网站」策略（若库中已同步）。');
        }
      })
      .catch(() => {
        setMatchLoading(false);
        setMatchHint('匹配请求失败，请确认 FastAPI 已启动（/api/v1 代理到 8000）。');
      });
  };

  return (
    <div className="page-shell page-enter app-layout px-5 pb-16 pt-24 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>
          爬虫模板库
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>
          预置行业常见站点的解析与反爬策略；选中模板后一键带到爬虫页，运行时参数会下发至 Node/Python 爬虫。
        </p>
      </div>

      <div
        className="card mb-6 p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap"
        style={{ borderColor: 'var(--c-border)' }}
      >
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--c-text-muted)' }}>
            按 URL 试匹配
          </label>
          <input
            type="url"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              border: '1px solid var(--c-border)',
              background: 'var(--c-bg-input)',
              color: 'var(--c-text)',
            }}
            placeholder="https://github.com/..."
            value={matchUrl}
            onChange={(e) => setMatchUrl(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0"
          disabled={matchLoading}
          onClick={() => runMatch()}
        >
          {matchLoading ? '匹配中…' : '匹配模板'}
        </button>
        {matchHint && (
          <p className="text-xs w-full sm:ml-0" style={{ color: 'var(--c-text-secondary)' }}>
            {matchHint}
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'all', label: '全部', icon: '📋' },
          ...Object.entries(CATEGORY_LABELS).map(([id, v]) => ({ id, ...v })),
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilterCategory(cat.id)}
            className="btn btn-sm transition-all"
            style={{
              background: filterCategory === cat.id ? 'rgba(66,135,245,0.1)' : 'var(--c-bg-card)',
              color: filterCategory === cat.id ? 'var(--color-brand-400)' : 'var(--c-text-secondary)',
              border: `1px solid ${filterCategory === cat.id ? 'var(--color-brand-500)' : 'var(--c-border)'}`,
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {filtered.map((tmpl) => {
            const cat = CATEGORY_LABELS[tmpl.category] || CATEGORY_LABELS.general;
            return (
              <div
                key={tmpl.id}
                className="card card-interactive p-5 cursor-pointer"
                onClick={() => setSelected(tmpl)}
                style={{
                  borderColor: selected?.id === tmpl.id ? 'var(--color-brand-500)' : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex items-center gap-2">
                    {tmpl.is_builtin && <span className="badge badge-info">内置</span>}
                    <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>
                      v{tmpl.version}
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>
                  {tmpl.name}
                </h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--c-text-secondary)' }}>
                  {tmpl.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {tmpl.url_patterns.slice(0, 3).map((p, i) => (
                    <span
                      key={i}
                      className="inline-block px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: 'var(--c-bg-hover)', color: 'var(--c-text-muted)' }}
                    >
                      {p.length > 22 ? `${p.slice(0, 22)}…` : p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="card mt-6 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
              {(CATEGORY_LABELS[selected.category] || CATEGORY_LABELS.general).icon} {selected.name}
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
              关闭
            </button>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--c-text-secondary)' }}>
            {selected.description}
          </p>

          <div className="grid gap-4 lg:grid-cols-2 text-xs">
            <div>
              <div className="font-semibold mb-2" style={{ color: 'var(--c-text)' }}>
                解析字段（CSS 选择器）
              </div>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {fmtKv(selected.parse_rules as Record<string, unknown>).map(({ k, v }) => (
                  <div key={k} className="flex gap-2">
                    <code
                      className="shrink-0 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: 'var(--c-bg-hover)', color: 'var(--color-brand-400)' }}
                    >
                      {k}
                    </code>
                    <span className="break-all" style={{ color: 'var(--c-text-secondary)' }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2" style={{ color: 'var(--c-text)' }}>
                运行时 / 反爬建议
              </div>
              <ul className="space-y-1" style={{ color: 'var(--c-text-secondary)' }}>
                {fmtKv(selected.anti_crawl_config as Record<string, unknown>, 20).map(({ k, v }) => (
                  <li key={k}>
                    <span className="font-medium" style={{ color: 'var(--c-text)' }}>
                      {k}:
                    </span>{' '}
                    {v}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-2" style={{ color: 'var(--c-text)' }}>
                翻页与列表（规划用）
              </div>
              {selected.pagination_config && Object.keys(selected.pagination_config).length > 0 ? (
                <ul className="space-y-1 break-words" style={{ color: 'var(--c-text-secondary)' }}>
                  {fmtKv(selected.pagination_config as Record<string, unknown>).map(({ k, v }) => (
                    <li key={k}>
                      <span className="font-medium" style={{ color: 'var(--c-text)' }}>
                        {k}:
                      </span>{' '}
                      {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--c-text-muted)' }}>无</p>
              )}
            </div>
            <div>
              <div className="font-semibold mb-2" style={{ color: 'var(--c-text)' }}>
                清洗规则（规划用）
              </div>
              {selected.data_clean_rules && Object.keys(selected.data_clean_rules).length > 0 ? (
                <pre
                  className="text-[11px] p-3 rounded-lg overflow-x-auto"
                  style={{ background: 'var(--c-bg-input)', color: 'var(--c-text-secondary)' }}
                >
                  {JSON.stringify(selected.data_clean_rules, null, 2)}
                </pre>
              ) : (
                <p style={{ color: 'var(--c-text-muted)' }}>无</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatchApplyTemplate(selected)}>
              使用此模板（前往爬虫页）
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
              仅关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
