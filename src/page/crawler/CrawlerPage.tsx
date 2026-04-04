import { useEffect, type ChangeEvent } from 'react';
import { Gauge, Globe, Keyboard, Sparkles } from 'lucide-react';
import { useCrawler } from '../../js/useCrawler';
import { CrawlerTypeIcon } from '../../components/CrawlerTypeIcon';

const CRAWLER_TYPE_IDS = new Set(['link', 'content', 'image']);

const TYPES = [
  { id: 'link',    label: '链接爬虫', desc: '递归爬取所有链接' },
  { id: 'content', label: '内容爬虫', desc: '提取文本和关键词' },
  { id: 'image',   label: '图片爬虫', desc: '采集图片资源' },
] as const;

function fmt(s: number) {
  if (s < 1) return '< 1s';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** 无真实总量时的阶段文案，减轻「百分比卡住」的焦虑感 */
function crawlPhaseLabel(p: number): string {
  if (p < 10) return '正在启动任务…';
  if (p < 35) return '连接目标并抓取页面…';
  if (p < 72) return '按深度展开链接与采集…';
  return '汇总数据，即将完成…';
}

const CrawlerPage = () => {
  const [state, actions] = useCrawler();
  const {
    crawlerType, targetUrl, crawlerDepth, crawlerStatus,
    crawlerResult, runningJobMeta, serviceStatus, crawlProgress, currentUrl,
    crawlWarning, appliedSpiderTemplate,
  } = state;
  const {
    setCrawlerType, setTargetUrl, setCrawlerDepth,
    handleStartCrawl, handleReset, recheckBackend, clearAppliedSpiderTemplate,
  } = actions;

  useEffect(() => {
    const raw = window.location.hash.slice(1) || '';
    const q = raw.split('?')[1];
    if (!q) return;
    const type = new URLSearchParams(q).get('type');
    if (!type || !CRAWLER_TYPE_IDS.has(type)) return;
    setCrawlerType(type);
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${base}#crawler`);
  }, [setCrawlerType]);

  const isRunning = crawlerStatus === 'running';
  const currentTypeMeta = TYPES.find(t => t.id === crawlerType) ?? TYPES[1];

  return (
    <div className="crawler-page page-enter app-layout px-5 pb-16 pt-24 lg:px-8">
      <div className="crawler-page__workspace grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="crawler-page__main min-w-0 space-y-6 lg:space-y-7">
          {/* 页眉：与数据分析等页同一信息层级 */}
          <header
            className="crawler-page__hero relative overflow-hidden rounded-2xl border px-5 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
            style={{
              borderColor: 'var(--c-border)',
              background: 'linear-gradient(145deg, var(--c-bg-card) 0%, var(--c-bg-raised) 42%, var(--c-bg-card) 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
            }}
          >
            <div className="relative flex flex-wrap items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl lg:h-14 lg:w-14"
                style={{
                  background: 'rgba(66,135,245,0.1)',
                  border: '1px solid rgba(66,135,245,0.22)',
                  color: 'var(--color-brand-400)',
                }}
                aria-hidden
              >
                <Sparkles size={22} strokeWidth={1.75} className="lg:h-6 lg:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] lg:text-xs" style={{ color: 'var(--color-brand-400)' }}>
                  SpiderX · 新建任务
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight lg:mt-2 lg:text-3xl" style={{ color: 'var(--c-text)' }}>
                  新建爬虫任务
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed lg:text-[0.9375rem]" style={{ color: 'var(--c-text-secondary)' }}>
                  配置参数并启动爬虫。选择类型、填写目标地址与深度即可开始。
                </p>
              </div>
            </div>
          </header>

          {/* Service status */}
          {serviceStatus === 'unavailable' && (
            <div className="crawler-page__backend-banner card mb-6 flex items-center justify-between p-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: '#f87171' }}>后端未就绪</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                  请运行 npm run dev 同时启动前后端
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void recheckBackend()}>重新检测</button>
            </div>
          )}

          {appliedSpiderTemplate && (
            <div
              className="card mb-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'rgba(66,135,245,0.35)', background: 'rgba(66,135,245,0.06)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-brand-400)' }}>
                  已应用模板：{appliedSpiderTemplate.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-secondary)' }}>
                  已根据模板调整爬虫类型与深度；启动任务时将附带并发、延迟、超时等运行时参数。
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm shrink-0"
                disabled={isRunning}
                onClick={() => clearAppliedSpiderTemplate()}
              >
                清除模板
              </button>
            </div>
          )}

          {/* Type selection */}
          <div className="crawler-page__type-section card p-5 lg:p-6">
            <label className="crawler-page__type-section-label block text-xs font-semibold mb-3 uppercase tracking-wider lg:mb-4" style={{ color: 'var(--c-text-muted)' }}>
              爬虫类型
            </label>
            <div className="crawler-page__type-grid grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {TYPES.map(t => {
                const active = crawlerType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setCrawlerType(t.id)}
                    disabled={isRunning}
                    className="crawler-page__type-option card card-interactive p-4 text-left transition-all lg:p-5"
                    style={{
                      borderColor: active ? 'var(--color-brand-500)' : undefined,
                      boxShadow: active ? '0 0 0 3px rgba(66,135,245,0.12)' : undefined,
                      opacity: isRunning ? 0.6 : 1,
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div className="crawler-page__type-option-inner flex gap-3 items-start min-w-0">
                      <span
                        className="crawler-page__type-icon-wrap flex shrink-0 items-center justify-center rounded-xl"
                        style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          background: active ? 'rgba(66,135,245,0.12)' : 'var(--c-bg-input)',
                          border: `1px solid ${active ? 'rgba(66,135,245,0.35)' : 'var(--c-border)'}`,
                          color: active ? 'var(--color-brand-400)' : 'var(--c-text-secondary)',
                        }}
                      >
                        <CrawlerTypeIcon type={t.id} size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold leading-snug lg:text-sm" style={{ color: active ? 'var(--color-brand-400)' : 'var(--c-text)' }}>{t.label}</div>
                        <div className="text-[11px] mt-1 leading-snug lg:text-xs lg:mt-1.5" style={{ color: 'var(--c-text-muted)' }}>{t.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL + Depth */}
          <div className="card p-5 lg:p-6 crawler-page__params-card">
            <div className="mb-4 flex items-center gap-3 lg:mb-5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl lg:h-10 lg:w-10"
                style={{
                  background: 'var(--c-bg-input)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--color-brand-400)',
                }}
                aria-hidden
              >
                <Globe size={18} strokeWidth={1.75} />
              </span>
              <label className="text-xs font-semibold uppercase tracking-wider lg:text-[0.8125rem]" style={{ color: 'var(--c-text-muted)' }}>
                爬取参数
              </label>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-12">
                <label className="mb-1.5 block text-xs font-medium lg:text-sm" style={{ color: 'var(--c-text-secondary)' }}>目标 URL</label>
                <input
                  className="input w-full"
                  type="url"
                  placeholder="https://example.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isRunning && handleStartCrawl()}
                  disabled={isRunning}
                />
              </div>
              <div className="min-w-0 xl:col-span-4">
                <label className="mb-1.5 block text-xs font-medium lg:text-sm" style={{ color: 'var(--c-text-secondary)' }}>
                  爬取深度
                </label>
                <input
                  className="input w-full max-w-[8.5rem]"
                  type="number"
                  min={1}
                  max={10}
                  value={crawlerDepth}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const n = parseInt(e.target.value, 10);
                    setCrawlerDepth(Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 2);
                  }}
                  disabled={isRunning}
                />
                <p className="mt-2 text-[11px] leading-relaxed lg:text-xs" style={{ color: 'var(--c-text-muted)' }}>
                  范围 1–10，数值越大抓取范围越广、耗时越久。
                </p>
              </div>
              <div className="flex min-w-0 items-stretch xl:col-span-8">
                <div
                  className="flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 lg:px-5 lg:py-4"
                  style={{
                    borderColor: 'var(--c-border)',
                    background: 'var(--c-bg-input)',
                  }}
                >
                  <Gauge size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" style={{ color: 'var(--c-text-muted)' }} aria-hidden />
                  <p className="text-[11px] leading-relaxed lg:text-xs" style={{ color: 'var(--c-text-secondary)' }}>
                    与「数据分析」页相同任务卡片逻辑：完成后可在历史中查看条目、导出或单条删除。建议先在小深度试跑，确认站点可访问再加大深度。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="crawler-page__actions flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="btn btn-primary btn-lg w-full sm:flex-1"
              onClick={handleStartCrawl}
              disabled={isRunning || !targetUrl}
              style={{ opacity: isRunning || !targetUrl ? 0.5 : 1 }}
            >
              {isRunning ? '爬取中...' : '开始爬取'}
            </button>
            <button type="button" className="btn btn-secondary btn-lg w-full shrink-0 sm:w-auto sm:min-w-[7.5rem]" onClick={handleReset} disabled={isRunning}>
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
            <div className="card p-5 lg:p-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold lg:text-sm" style={{ color: 'var(--c-text)' }}>爬取进度</span>
                <span className="text-xs font-bold tabular-nums lg:text-sm" style={{ color: 'var(--color-brand-400)' }}>
                  约 {Math.round(crawlProgress)}%
                </span>
              </div>
              <p className="text-[11px] mb-2 leading-snug lg:text-xs" style={{ color: 'var(--c-text-muted)' }}>
                {crawlPhaseLabel(crawlProgress)}
                <span className="opacity-80"> · 耗时因站点与深度而异，进度为估算</span>
              </p>
              <div
                className="relative h-2.5 rounded-full overflow-hidden crawl-progress-track"
                style={{ background: 'var(--c-bg-input)' }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(crawlProgress)}
                aria-valuetext={`${crawlPhaseLabel(crawlProgress)}，约 ${Math.round(crawlProgress)}%`}
                aria-busy="true"
              >
                <div
                  className="pointer-events-none absolute inset-0 crawl-progress-track-shimmer opacity-40"
                  aria-hidden
                />
                <div
                  className="relative z-[1] h-full rounded-full crawl-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, crawlProgress))}%`,
                    background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-accent))',
                  }}
                />
              </div>
              {currentUrl && (
                <p className="text-[11px] mt-2 truncate lg:text-xs" style={{ color: 'var(--c-text-muted)' }}>
                  当前页面: {currentUrl}
                </p>
              )}
            </div>
          )}

          {/* Running job hint */}
          {isRunning && runningJobMeta && !crawlerResult && (
            <div className="card p-5 lg:p-6">
              <p className="text-xs font-medium mb-3 lg:text-sm" style={{ color: 'var(--c-text-secondary)' }}>
                任务已提交，正在执行中...
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs lg:gap-4 lg:text-sm">
                <div><span style={{ color: 'var(--c-text-muted)' }}>任务ID: </span>{runningJobMeta.id}</div>
                <div><span style={{ color: 'var(--c-text-muted)' }}>类型: </span>{TYPES.find(t => t.id === runningJobMeta.type)?.label}</div>
              </div>
            </div>
          )}

          {/* Result */}
          {crawlerResult && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b lg:p-5" style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg-raised)' }}>
                <h2 className="text-sm font-semibold lg:text-base" style={{ color: 'var(--c-text)' }}>爬取结果</h2>
              </div>
              <div className="p-5 lg:p-6">
                <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
                  {[
                    { label: '目标URL', value: crawlerResult.url },
                    { label: '类型', value: TYPES.find(t => t.id === crawlerResult.type)?.label || crawlerResult.type },
                    { label: '深度', value: crawlerResult.depth },
                    { label: '数据量', value: `${crawlerResult.items ?? 0} 条` },
                    { label: '耗时', value: fmt(crawlerResult.time ?? 0) },
                  ].map(r => (
                    <div key={r.label} className="text-xs lg:text-sm">
                      <span style={{ color: 'var(--c-text-muted)' }}>{r.label}: </span>
                      <span className="font-medium break-all" style={{ color: 'var(--c-text)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {crawlerResult.error && (
                  <div className="p-3 rounded-lg text-xs leading-relaxed mb-4 lg:text-sm"
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

        {/* 桌面侧栏：与数据分析列表卡右侧「轨」同一节奏 — 上状态 / 中图标区 / 下辅助信息 */}
        <aside
          className="crawler-page__aside hidden lg:flex lg:flex-col"
          aria-label="当前任务概览"
        >
          <div
            className="card crawler-page__aside-rail sticky flex max-h-[calc(100vh-6.5rem)] flex-col overflow-hidden p-0"
            style={{
              top: 'calc(4.5rem + env(safe-area-inset-top, 0px))',
              borderLeft: '3px solid var(--color-brand-500)',
              boxShadow: '0 0 0 1px var(--c-border)',
            }}
          >
            <div className="border-b px-4 pb-4 pt-5 text-center" style={{ borderColor: 'var(--c-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
                当前类型
              </p>
              <div
                className="mx-auto mt-3 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(66,135,245,0.1)',
                  border: '1px solid rgba(66,135,245,0.28)',
                  color: 'var(--color-brand-400)',
                }}
              >
                <CrawlerTypeIcon type={crawlerType} size={26} />
              </div>
              <p className="mt-3 text-sm font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>
                {currentTypeMeta.label}
              </p>
              <p className="mt-1 px-1 text-[11px] leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>
                {currentTypeMeta.desc}
              </p>
            </div>

            <div className="flex flex-1 flex-col justify-between gap-5 px-4 py-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--c-bg-input)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-text-secondary)',
                  }}
                  aria-hidden
                >
                  <Gauge size={22} strokeWidth={1.75} />
                </div>
                <span className="text-[11px] leading-snug" style={{ color: 'var(--c-text-muted)' }}>
                  深度 <strong style={{ color: 'var(--c-text)' }}>{crawlerDepth}</strong>
                  <span className="opacity-80"> / 10</span>
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 border-t pt-4 text-center" style={{ borderColor: 'var(--c-border)' }}>
                <Keyboard size={20} strokeWidth={1.75} style={{ color: 'var(--c-text-muted)' }} aria-hidden />
                <span className="text-[10px] leading-snug" style={{ color: 'var(--c-text-muted)' }}>
                  在 URL 输入框按 Enter 可快速开始爬取
                </span>
              </div>

              <a
                href="#templates"
                className="block rounded-lg py-2.5 text-center text-xs font-medium transition-colors"
                style={{ color: 'var(--color-brand-400)', background: 'rgba(66,135,245,0.06)' }}
              >
                浏览模板库 →
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CrawlerPage;
