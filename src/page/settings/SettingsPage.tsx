// 设置页面组件

import { useState } from 'react';

/**
 * 设置页面组件
 * 用于配置爬虫工具的相关设置
 */
const SettingsPage = () => {
  // 爬虫设置
  const [crawlerSettings, setCrawlerSettings] = useState({
    timeout: 30,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    maxConcurrent: 5,
    retryCount: 3
  });

  // 处理设置变化
  const handleSettingChange = (key: string, value: string | number) => {
    setCrawlerSettings({
      ...crawlerSettings,
      [key]: value
    });
  };

  // 处理保存设置
  const handleSaveSettings = () => {
    // 模拟保存设置
    alert('设置已保存');
    console.log('保存的设置:', crawlerSettings);
  };

  // 处理重置设置
  const handleResetSettings = () => {
    setCrawlerSettings({
      timeout: 30,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      maxConcurrent: 5,
      retryCount: 3
    });
  };

  return (
    <div className="settings-page">
      <div className="hero-section">
        <h1 className="hero-title">爬虫设置</h1>
        <div className="hero-divider"></div>
        <p className="features-description">
          配置爬虫工具的相关参数和设置
        </p>
      </div>
      
      <div className="settings-content">
        {/* 爬虫设置 */}
        <section className="settings-section">
          <h2 className="settings-section-title">爬虫参数设置</h2>
          
          <div className="settings-form">
            <div className="settings-form-item">
              <label htmlFor="timeout">请求超时时间 (秒):</label>
              <input
                type="number"
                id="timeout"
                min="5"
                max="120"
                value={crawlerSettings.timeout}
                onChange={(e) => handleSettingChange('timeout', parseInt(e.target.value))}
              />
            </div>
            
            <div className="settings-form-item">
              <label htmlFor="user-agent">User-Agent:</label>
              <input
                type="text"
                id="user-agent"
                value={crawlerSettings.userAgent}
                onChange={(e) => handleSettingChange('userAgent', e.target.value)}
              />
            </div>
            
            <div className="settings-form-item">
              <label htmlFor="max-concurrent">最大并发数:</label>
              <input
                type="number"
                id="max-concurrent"
                min="1"
                max="20"
                value={crawlerSettings.maxConcurrent}
                onChange={(e) => handleSettingChange('maxConcurrent', parseInt(e.target.value))}
              />
            </div>
            
            <div className="settings-form-item">
              <label htmlFor="retry-count">重试次数:</label>
              <input
                type="number"
                id="retry-count"
                min="0"
                max="10"
                value={crawlerSettings.retryCount}
                onChange={(e) => handleSettingChange('retryCount', parseInt(e.target.value))}
              />
            </div>
          </div>
        </section>
        
        {/* 设置操作 */}
        <section className="settings-actions">
          <button 
            className="settings-save-button"
            onClick={handleSaveSettings}
          >
            保存设置
          </button>
          <button 
            className="settings-reset-button"
            onClick={handleResetSettings}
          >
            重置默认值
          </button>
        </section>
        
        {/* 关于信息 */}
        <section className="settings-about">
          <h2 className="settings-about-title">关于</h2>
          <div className="settings-about-content">
            <p className="settings-about-text">
              网页爬虫工具 v1.0.0
            </p>
            <p className="settings-about-text">
              一个功能强大的网页爬虫工具，支持多种爬虫功能和数据分析
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;