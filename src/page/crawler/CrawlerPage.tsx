import type { ChangeEvent } from 'react';
import { useCrawler } from '../../js/useCrawler';

const TYPES = [
  { id: 'link',    label: '链接爬虫', icon: '🔗', desc: '递归爬取所有链接' },
  { id: 'content', label: '内容爬虫', icon: '📄', desc: '提取文本和关键词' },
  { id: 'image',   label: '图片爬虫', icon: '🖼️', desc: '采集图片资源' },
];

function fmt(s: number) {
  if (s < 1) return '< 1s';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const CrawlerPage = () => {
  const [state, actions] = useCrawler();
  const {
    crawlerType, targetUrl, crawlerDepth, crawlerStatus,
    crawlerResult, runningJobMeta, serviceStatus, crawlProgress, currentUrl,
    crawlWarning,
  } = state;
  const {
    setCrawlerType, setTargetUrl, setCrawlerDepth,
    handleStartCrawl, handleReset, recheckBackend,
  } = actions;

  const isRunning = crawlerStatus === 'running';

  return (
    <div className="page-enter mx-auto max-w-3xl px-5 pt-24 pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>新建爬虫任务</h1>
        <p className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>配置参数并启动爬虫</p>
      </div>

      {/* Service status */}
      {serviceStatus === 'unavailable' && (
        <div className="card p-4 mb-6 flex items-center justify-between" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: '#f87171' }}>后端未就绪</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
              请运行 npm run dev 同时启动前后端
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => void recheckBackend()}>重新检测</button>
        </div>
      )}

      {/* Type selection */}
      <div className="card p-5 mb-4">
        <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
          爬虫类型
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TYPES.map(t => {
            const active = crawlerType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setCrawlerType(t.id)}
                disabled={isRunning}
                className="card card-interactive p-4 text-left transition-all"
                style={{
                  borderColor: active ? 'var(--color-brand-500)' : undefined,
                  boxShadow: active ? '0 0 0 3px rgba(66,135,245,0.12)' : undefined,
                  opacity: isRunning ? 0.6 : 1,
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-xs font-semibold" style={{ color: active ? 'var(--color-brand-400)' : 'var(--c-text)' }}>{t.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* URL + Depth */}
      <div className="card p-5 mb-4">
        <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
          爬取参数
        </label>
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>目标 URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isRunning && handleStartCrawl()}
            disabled={isRunning}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>
            爬取深度
            <span className="ml-2 font-normal" style={{ color: 'var(--c-text-muted)' }}>
              (1-10, 越大范围越广)
            </span>
          </label>
          <input
            className="input"
            type="number"
            min={1}
            max={10}
            value={crawlerDepth}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const n = parseInt(e.target.value, 10);
              setCrawlerDepth(Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 2);
            }}
            disabled={isRunning}
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          className="btn btn-primary btn-lg flex-1"
          onClick={handleStartCrawl}
          disabled={isRunning || !targetUrl}
          style={{ opacity: isRunning || !targetUrl ? 0.5 : 1 }}
        >
          {isRunning ? '爬取中...' : '开始爬取'}
        </button>
        <button className="btn btn-secondary btn-lg" onClick={handleReset} disabled={isRunning}>
          重置
        </button>
      </div>

      {/* Inline warning (replaces alert popups) */}
      {crawlWarning && (
        <div className="card p-3 mb-4 flex items-center gap-3" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <span className="text-sm" style={{ color: 'var(--color-warn)' }}>{crawlWarning}</span>
        </div>
      )}

      {/* Progress */}
      {isRunning && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>爬取进度</span>
            <span className="text-xs font-bold" style={{ color: 'var(--color-brand-400)' }}>{crawlProgress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-bg-input)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${crawlProgress}%`,
                background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-accent))',
                animation: crawlProgress < 100 ? 'progress-pulse 2s infinite' : 'none',
              }}
            />
          </div>
          {currentUrl && (
            <p className="text-[11px] mt-2 truncate" style={{ color: 'var(--c-text-muted)' }}>
              正在爬取: {currentUrl}
            </p>
          )}
        </div>
      )}

      {/* Running job hint */}
      {isRunning && runningJobMeta && !crawlerResult && (
        <div className="card p-5 mb-4">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--c-text-secondary)' }}>
            任务已提交，正在执行中...
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span style={{ color: 'var(--c-text-muted)' }}>任务ID: </span>{runningJobMeta.id}</div>
            <div><span style={{ color: 'var(--c-text-muted)' }}>类型: </span>{TYPES.find(t => t.id === runningJobMeta.type)?.label}</div>
          </div>
        </div>
      )}

      {/* Result */}
      {crawlerResult && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>爬取结果</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { label: '目标URL', value: crawlerResult.url },
                { label: '类型', value: TYPES.find(t => t.id === crawlerResult.type)?.label || crawlerResult.type },
                { label: '深度', value: crawlerResult.depth },
                { label: '数据量', value: `${crawlerResult.items ?? 0} 条` },
                { label: '耗时', value: fmt(crawlerResult.time ?? 0) },
              ].map(r => (
                <div key={r.label} className="text-xs">
                  <span style={{ color: 'var(--c-text-muted)' }}>{r.label}: </span>
                  <span className="font-medium" style={{ color: 'var(--c-text)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {crawlerResult.error && (
              <div className="p-3 rounded-lg text-xs leading-relaxed mb-4"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
                {crawlerResult.error}
              </div>
            )}

            {!crawlerResult.error && crawlerStatus === 'completed' && (
              <a href="#analisys" className="btn btn-primary btn-sm">
                查看详细数据 →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawlerPage;
