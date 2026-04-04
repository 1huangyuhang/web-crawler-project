import { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  url_patterns: string[];
  is_builtin: boolean;
  version: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  general:     { icon: '🌐', label: '通用' },
  ecommerce:   { icon: '🛒', label: '电商' },
  news:        { icon: '📰', label: '新闻' },
  social:      { icon: '💬', label: '社交' },
  recruitment: { icon: '💼', label: '招聘' },
};

const TemplatesPage = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetch('/api/v1/templates')
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filterCategory === 'all'
    ? templates
    : templates.filter(t => t.category === filterCategory);

  return (
    <div className="page-enter mx-auto max-w-5xl px-5 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>爬虫模板库</h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>预置主流网站爬虫策略，输入 URL 自动匹配最优模板</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ id: 'all', label: '全部', icon: '📋' }, ...Object.entries(CATEGORY_LABELS).map(([id, v]) => ({ id, ...v }))].map(cat => (
          <button
            key={cat.id}
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

      {/* Template grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tmpl => {
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
                    <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>v{tmpl.version}</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>{tmpl.name}</h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--c-text-secondary)' }}>{tmpl.description}</p>
                <div className="flex flex-wrap gap-1">
                  {tmpl.url_patterns.slice(0, 3).map((p, i) => (
                    <span key={i} className="inline-block px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: 'var(--c-bg-hover)', color: 'var(--c-text-muted)' }}>
                      {p.length > 20 ? p.slice(0, 20) + '...' : p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="card mt-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
              {(CATEGORY_LABELS[selected.category] || CATEGORY_LABELS.general).icon} {selected.name}
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>关闭</button>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--c-text-secondary)' }}>{selected.description}</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold mb-1" style={{ color: 'var(--c-text)' }}>URL 匹配模式</div>
              <div className="flex flex-col gap-1">
                {selected.url_patterns.map((p, i) => (
                  <code key={i} className="px-2 py-1 rounded text-[11px]" style={{ background: 'var(--c-bg-input)', color: 'var(--color-brand-400)' }}>{p}</code>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1" style={{ color: 'var(--c-text)' }}>模板信息</div>
              <div style={{ color: 'var(--c-text-secondary)' }}>
                <div>类型: {selected.category}</div>
                <div>版本: v{selected.version}</div>
                <div>内置: {selected.is_builtin ? '是' : '否'}</div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <a href="#crawler" className="btn btn-primary btn-sm">使用此模板创建任务</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
