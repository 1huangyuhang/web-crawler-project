import { useMemo } from 'react';

function loadRecentHistory() {
  try {
    const raw = localStorage.getItem('crawlHistory');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 8).map((h: any) => ({
      ...h,
      items: h.items ?? 0,
      time: h.time ?? 0,
      data: Array.isArray(h.data) ? h.data : [],
    }));
  } catch { return []; }
}

const TYPE_ICON: Record<string, string> = { link: '🔗', content: '📄', image: '🖼️' };

function fmt(s: number) {
  if (s < 1) return '< 1s';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export const HomeContent = () => {
  const history = useMemo(loadRecentHistory, []);

  const stats = useMemo(() => {
    const all = history as any[];
    return {
      total:   all.length,
      success: all.filter((h: any) => !h.error).length,
      items:   all.reduce((s: number, h: any) => s + (h.items || 0), 0),
      time:    all.reduce((s: number, h: any) => s + (h.time || 0), 0),
    };
  }, [history]);

  const CARDS = [
    { label: '总任务',   value: stats.total,   color: 'var(--color-brand-500)', icon: '📊' },
    { label: '成功任务', value: stats.success,  color: 'var(--color-success)',   icon: '✅' },
    { label: '数据量',   value: stats.items,    color: 'var(--color-accent)',    icon: '💾' },
    { label: '总耗时',   value: fmt(stats.time),color: 'var(--color-warn)',      icon: '⏱️' },
  ];

  return (
    <div className="page-enter mx-auto max-w-5xl px-5 pt-24 pb-16">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--c-text)' }}>
          欢迎使用 SpiderX
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>
          专业的网页爬虫工具，支持链接、内容和图片爬取
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {CARDS.map(c => (
          <div key={c.label} className="card p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xl">{c.icon}</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--c-text-muted)' }}>{c.label}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: c.color }}>
              {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
            </span>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {[
          { icon: '🔗', title: '链接爬虫', desc: '递归爬取网页链接结构，支持深度控制' },
          { icon: '📄', title: '内容爬虫', desc: '提取页面文本内容和关键词分析' },
          { icon: '🖼️', title: '图片爬虫', desc: '批量采集页面图片资源和元信息' },
        ].map(f => (
          <div key={f.title} className="card card-interactive p-6 cursor-pointer" onClick={() => window.location.hash = 'crawler'}>
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>{f.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Recent tasks */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>最近任务</h2>
            <a href="#analisys" className="text-xs font-medium" style={{ color: 'var(--color-brand-400)' }}>
              查看全部 →
            </a>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
            {(history as any[]).slice(0, 5).map((h: any) => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--c-bg-hover)]">
                <span className="text-lg shrink-0">{TYPE_ICON[h.type] || '📋'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate" style={{ color: 'var(--c-text)' }}>{h.url}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                    {new Date(h.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                    {h.items ?? 0} 条
                  </span>
                  <span className={`badge ${h.error ? 'badge-danger' : 'badge-success'}`}>
                    {h.error ? '失败' : '成功'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick action */}
      <div className="mt-10 text-center">
        <a
          href="#crawler"
          className="btn btn-primary btn-lg inline-flex"
          style={{ borderRadius: '12px' }}
        >
          ＋ 新建爬虫任务
        </a>
      </div>
    </div>
  );
};
