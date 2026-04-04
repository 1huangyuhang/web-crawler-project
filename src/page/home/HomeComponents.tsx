import { useMemo } from 'react';
import { BarChart3, CheckCircle2, Database, Timer } from 'lucide-react';
import { CrawlerTypeIcon } from '../../components/CrawlerTypeIcon';

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
    { label: '总任务',   value: stats.total,   color: 'var(--color-brand-500)', Icon: BarChart3 },
    { label: '成功任务', value: stats.success,  color: 'var(--color-success)',   Icon: CheckCircle2 },
    { label: '数据量',   value: stats.items,    color: 'var(--color-accent)',    Icon: Database },
    { label: '总耗时',   value: fmt(stats.time),color: 'var(--color-warn)',      Icon: Timer },
  ];

  const FEATURES = [
    { type: 'link' as const, title: '链接爬虫', desc: '递归爬取网页链接结构，支持深度控制' },
    { type: 'content' as const, title: '内容爬虫', desc: '提取页面文本内容和关键词分析' },
    { type: 'image' as const, title: '图片爬虫', desc: '批量采集页面图片资源和元信息' },
  ];

  return (
    <div className="home-page page-shell page-enter app-layout px-5 pb-16 pt-24 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--c-text)' }}>
          欢迎使用 SpiderX
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
          专业的网页爬虫工具，支持链接、内容和图片爬取
        </p>
      </div>

      <div className="home-page__stat-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 lg:gap-6">
        {CARDS.map(c => (
          <div key={c.label} className="home-page__stat-card card flex flex-col gap-2.5 p-5 items-center text-center md:items-start md:text-left">
            <div className="home-page__stat-icon-wrap">
              <c.Icon size={22} strokeWidth={2} aria-hidden />
            </div>
            <span className="home-page__stat-value text-2xl font-bold tracking-tight w-full" style={{ color: c.color }}>
              {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
            </span>
            <span className="home-page__stat-label text-[11px] font-semibold uppercase tracking-wider w-full" style={{ color: 'var(--c-text-muted)' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-10 lg:gap-6">
        {FEATURES.map(f => (
          <div
            key={f.title}
            className="home-page__feature-card card card-interactive p-6 cursor-pointer"
            onClick={() => { window.location.hash = `crawler?type=${f.type}`; }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.hash = `crawler?type=${f.type}`;
              }
            }}
          >
            <div className="home-page__feature-icon-wrap mb-3 inline-flex">
              <CrawlerTypeIcon type={f.type} size={24} strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>{f.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>{f.desc}</p>
          </div>
        ))}
      </div>

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
              <div key={h.id} className="home-page__recent-row flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--c-bg-hover)]">
                <span className="home-page__recent-type-icon flex shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border)', width: '2.25rem', height: '2.25rem' }}>
                  <CrawlerTypeIcon type={h.type || 'link'} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate" style={{ color: 'var(--c-text)' }}>{h.url}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
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
