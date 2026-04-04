import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../hooks/useTheme';
import { useCrawler } from '../../js/useCrawler';

interface NavbarProps {
  currentPage: string;
}

const NAV_ITEMS = [
  { id: 'home',      label: '首页',     hash: '#home' },
  { id: 'crawler',   label: '新建任务', hash: '#crawler' },
  { id: 'templates', label: '模板库',   hash: '#templates' },
  { id: 'analisys',  label: '数据分析', hash: '#analisys' },
  { id: 'ai',        label: 'AI 分析', hash: '#ai' },
  { id: 'settings',  label: '设置',     hash: '#settings' },
];

export default function Navbar({ currentPage }: NavbarProps) {
  const { theme, toggle } = useTheme();
  const [{ crawlerStatus, crawlProgress }] = useCrawler();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPage]);

  return (
    <header
      className="glass fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,0px)]"
      style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
    >
      <div
        className="app-layout flex h-14 w-full items-center justify-between px-5 lg:px-8"
        style={{
          paddingLeft: 'max(1.25rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1.25rem, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Logo */}
        <a href="#home" className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-accent))' }}
          >
            Sx
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
            SpiderX
          </span>
        </a>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.id;
            return (
              <a
                key={item.id}
                href={item.hash}
                className="relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200"
                style={{
                  color: active ? 'var(--color-brand-400)' : 'var(--c-text-secondary)',
                  background: active ? 'rgba(66,135,245,0.08)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget.style.color = 'var(--c-text)');
                  if (!active) (e.currentTarget.style.background = 'var(--c-bg-hover)');
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget.style.color = 'var(--c-text-secondary)');
                  if (!active) (e.currentTarget.style.background = 'transparent');
                }}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full"
                    style={{ background: 'var(--color-brand-500)' }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {crawlerStatus === 'running' && (
            <span
              className="badge badge-info text-[11px] animate-pulse"
              title="爬取任务进行中"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-brand-400)]" />
              爬取中 · 约 {Math.round(crawlProgress)}%
            </span>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="btn btn-ghost btn-sm"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            style={{ fontSize: '16px', padding: '6px 8px' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Mobile menu */}
          <button
            type="button"
            className="btn btn-ghost btn-sm md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            style={{ fontSize: '18px', padding: '6px 8px' }}
          >
            ☰
          </button>
        </div>
      </div>

      {mobileMenuOpen &&
        createPortal(
          <button
            type="button"
            className="fixed inset-0 z-[45] cursor-default border-0 p-0 md:hidden"
            style={{
              background: 'rgba(0,0,0,0.45)',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="关闭菜单"
            onClick={() => setMobileMenuOpen(false)}
          />,
          document.body,
        )}

      {/* Mobile nav dropdown（高于遮罩 z-45，与顶栏同属 z-50 上下文） */}
      <div
        id="mobile-nav"
        className={`relative z-[55] md:hidden border-t ${mobileMenuOpen ? '' : 'hidden'}`}
        style={{
          borderColor: 'var(--c-border)',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex flex-col p-3 gap-1">
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href={item.hash}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: currentPage === item.id ? 'var(--color-brand-400)' : 'var(--c-text-secondary)',
                background: currentPage === item.id ? 'rgba(66,135,245,0.08)' : 'transparent',
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
