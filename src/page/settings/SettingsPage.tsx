import { useState } from 'react';
import { Bug, Cog, Globe, Info, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

type Section = 'general' | 'crawler' | 'network' | 'about';

const SECTIONS: { id: Section; label: string; Icon: typeof Cog }[] = [
  { id: 'general', label: '基本设置', Icon: Cog },
  { id: 'crawler', label: '爬虫参数', Icon: Bug },
  { id: 'network', label: '网络设置', Icon: Globe },
  { id: 'about',   label: '关于',     Icon: Info },
];

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState<Section>('general');
  const { theme, toggle } = useTheme();

  const [settings, setSettings] = useState({
    timeout: 30,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    maxConcurrent: 5,
    retryCount: 3,
    requestDelay: 0.5,
    proxyEnabled: false,
    proxyUrl: '',
  });

  const update = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    try {
      localStorage.setItem('crawlerSettings', JSON.stringify(settings));
      alert('设置已保存');
    } catch {
      alert('保存失败');
    }
  };

  return (
    <div className="page-shell page-enter app-layout px-5 pb-16 pt-24 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--c-text)' }}>系统设置</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>配置爬虫工具的参数和偏好</p>
      </div>

      <div className="settings-page grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,auto)_minmax(0,1fr)]">
        <nav className="settings-page__nav flex flex-col gap-1" aria-label="设置分区">
          {SECTIONS.map(s => {
            const on = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className="settings-page__nav-item flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left text-sm font-medium transition-all"
                style={{
                  color: on ? 'var(--color-brand-400)' : 'var(--c-text-secondary)',
                  background: on ? 'rgba(66,135,245,0.08)' : 'transparent',
                  border: on ? '1px solid rgba(66,135,245,0.2)' : '1px solid transparent',
                }}
              >
                <s.Icon size={18} strokeWidth={2} aria-hidden className="shrink-0 opacity-90" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-page__panel card p-6">
          {activeSection === 'general' && (
            <div>
              <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--c-text)' }}>基本设置</h2>
              <div className="settings-page__field-row flex items-center justify-between gap-4 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>外观主题</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>
                    当前：{theme === 'dark' ? '深色模式' : '浅色模式'}
                  </div>
                </div>
                <button type="button" className="settings-page__field-control btn btn-secondary btn-sm inline-flex items-center justify-center gap-2 shrink-0" onClick={toggle}>
                  {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
                  <span className="whitespace-nowrap">{theme === 'dark' ? '切换到浅色' : '切换到深色'}</span>
                </button>
              </div>
              <div className="settings-page__field-row flex items-center justify-between gap-4 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>语言</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>界面显示语言</div>
                </div>
                <select className="settings-page__field-control select shrink-0" defaultValue="zh-CN" aria-label="界面语言">
                  <option value="zh-CN">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === 'crawler' && (
            <div>
              <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--c-text)' }}>爬虫参数</h2>
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>请求超时时间 (秒)</label>
                  <input className="input" type="number" min={5} max={120} value={settings.timeout}
                    onChange={e => update('timeout', Number(e.target.value))} style={{ maxWidth: 200 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>最大并发数</label>
                  <input className="input" type="number" min={1} max={20} value={settings.maxConcurrent}
                    onChange={e => update('maxConcurrent', Number(e.target.value))} style={{ maxWidth: 200 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>重试次数</label>
                  <input className="input" type="number" min={0} max={10} value={settings.retryCount}
                    onChange={e => update('retryCount', Number(e.target.value))} style={{ maxWidth: 200 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>请求间隔 (秒)</label>
                  <input className="input" type="number" min={0} max={10} step={0.1} value={settings.requestDelay}
                    onChange={e => update('requestDelay', Number(e.target.value))} style={{ maxWidth: 200 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>User-Agent</label>
                  <input className="input" type="text" value={settings.userAgent}
                    onChange={e => update('userAgent', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'network' && (
            <div>
              <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--c-text)' }}>网络设置</h2>
              <div className="settings-page__field-row flex items-center justify-between gap-4 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>启用代理</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>通过代理服务器发送请求</div>
                </div>
                <button
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: settings.proxyEnabled ? 'var(--color-brand-500)' : 'var(--c-border)' }}
                  onClick={() => update('proxyEnabled', !settings.proxyEnabled)}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ left: settings.proxyEnabled ? '22px' : '2px' }} />
                </button>
              </div>
              {settings.proxyEnabled && (
                <div className="mt-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-secondary)' }}>代理地址</label>
                  <input className="input" type="text" placeholder="http://127.0.0.1:7890" value={settings.proxyUrl}
                    onChange={e => update('proxyUrl', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {activeSection === 'about' && (
            <div>
              <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--c-text)' }}>关于 SpiderX</h2>
              <div className="flex flex-col gap-4 text-sm" style={{ color: 'var(--c-text-secondary)' }}>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
                  <span>版本</span>
                  <span className="font-medium" style={{ color: 'var(--c-text)' }}>1.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
                  <span>技术栈</span>
                  <span className="font-medium" style={{ color: 'var(--c-text)' }}>React + Express + Python</span>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
                  <span>爬虫引擎</span>
                  <span className="font-medium" style={{ color: 'var(--c-text)' }}>asyncio + aiohttp</span>
                </div>
                <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--c-text-muted)' }}>
                  SpiderX 是一款专业的网页爬虫工具，支持链接爬取、内容提取和图片采集，
                  提供实时进度追踪和数据分析功能。
                </p>
              </div>
            </div>
          )}

          {/* Save button */}
          {(activeSection === 'crawler' || activeSection === 'network') && (
            <div className="settings-page__save-row mt-8 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={handleSave}>保存设置</button>
              <button type="button" className="btn btn-secondary" onClick={() => setSettings({
                timeout: 30, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                maxConcurrent: 5, retryCount: 3, requestDelay: 0.5, proxyEnabled: false, proxyUrl: '',
              })}>恢复默认</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
