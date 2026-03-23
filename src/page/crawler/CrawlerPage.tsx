// 爬虫功能页面组件

import type { ChangeEvent } from 'react';
import { useCrawler } from '../../js/useCrawler';

/**
 * 爬虫功能页面组件
 * 用于配置爬虫参数和启动爬虫
 */
const CrawlerPage = () => {
  // 使用爬虫 hooks
  const [state, actions] = useCrawler();
  
  // 解构状态和操作
  const {
    crawlerType,
    targetUrl,
    crawlerDepth,
    crawlerStatus,
    crawlerResult,
    serviceStatus,
    crawlProgress,
    currentUrl
  } = state;
  
  const {
    setCrawlerType,
    setTargetUrl,
    setCrawlerDepth,
    handleStartCrawl,
    handleReset
  } = actions;

  // 处理爬虫类型变化
  const handleCrawlerTypeChange = (type: string) => {
    setCrawlerType(type);
  };

  // 处理URL输入变化
  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTargetUrl(e.target.value);
  };

  // 处理深度变化
  const handleDepthChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCrawlerDepth(parseInt(e.target.value));
  };

  return (
    <div className="crawler-page">
      <div className="hero-section">
        <h1 className="hero-title">爬虫功能</h1>
        <div className="hero-divider"></div>
        <p className="features-description">
          配置爬虫参数并启动爬虫
        </p>
      </div>
      
      <div className="crawler-config">
        {/* 服务状态 */}
        <section className="crawler-config-section">
          <h2 className="crawler-config-title">服务状态</h2>
          <div className="crawler-service-status">
            {serviceStatus === 'checking' && (
              <span className="service-status checking">检查服务状态中...</span>
            )}
            {serviceStatus === 'available' && (
              <span className="service-status available">后端服务可用</span>
            )}
            {serviceStatus === 'unavailable' && (
              <span className="service-status unavailable">后端服务不可用，请启动后端服务</span>
            )}
          </div>
        </section>
        
        {/* 爬虫类型选择 */}
        <section className="crawler-config-section">
          <h2 className="crawler-config-title">爬虫类型</h2>
          <div className="crawler-type-options">
            <div className="crawler-type-option">
              <input
                type="radio"
                id="crawler-type-link"
                name="crawler-type"
                value="link"
                checked={crawlerType === 'link'}
                onChange={() => handleCrawlerTypeChange('link')}
              />
              <label htmlFor="crawler-type-link">链接爬虫</label>
            </div>
            <div className="crawler-type-option">
              <input
                type="radio"
                id="crawler-type-content"
                name="crawler-type"
                value="content"
                checked={crawlerType === 'content'}
                onChange={() => handleCrawlerTypeChange('content')}
              />
              <label htmlFor="crawler-type-content">内容爬虫</label>
            </div>
            <div className="crawler-type-option">
              <input
                type="radio"
                id="crawler-type-image"
                name="crawler-type"
                value="image"
                checked={crawlerType === 'image'}
                onChange={() => handleCrawlerTypeChange('image')}
              />
              <label htmlFor="crawler-type-image">图片爬虫</label>
            </div>
          </div>
        </section>
        
        {/* 爬虫参数配置 */}
        <section className="crawler-config-section">
          <h2 className="crawler-config-title">爬虫参数</h2>
          <div className="crawler-params">
            <div className="crawler-param-item">
              <label htmlFor="target-url">目标URL:</label>
              <input
                type="text"
                id="target-url"
                value={targetUrl}
                onChange={handleUrlChange}
                placeholder="https://example.com"
                disabled={crawlerStatus === 'running'}
              />
            </div>
            <div className="crawler-param-item">
              <div className="crawler-param-label-container">
                <label htmlFor="crawler-depth">爬取深度:</label>
                <div className="crawler-tooltip">
                  <span className="crawler-tooltip-icon">?</span>
                  <span className="crawler-tooltip-text">
                    爬取深度指的是爬虫从起始URL开始，递归跟随链接的层级数。
                    深度越大，爬取的范围越广，但耗时也越长。
                    建议设置为2-3，适合大多数爬取需求。
                  </span>
                </div>
              </div>
              <input
                type="number"
                id="crawler-depth"
                min="1"
                max="10"
                value={crawlerDepth}
                onChange={handleDepthChange}
                disabled={crawlerStatus === 'running'}
              />
            </div>
          </div>
        </section>
        
        {/* 爬虫控制 */}
        <section className="crawler-control">
          <button
            className="crawler-start-button"
            onClick={handleStartCrawl}
            disabled={crawlerStatus === 'running' || !targetUrl}
          >
            {crawlerStatus === 'running' ? '爬取中...' : '开始爬取'}
          </button>
          <button
            className="crawler-reset-button"
            onClick={handleReset}
            disabled={crawlerStatus === 'running'}
          >
            重置
          </button>
        </section>
        
        {/* 爬取进度 */}
        {crawlerStatus === 'running' && (
          <section className="crawler-progress">
            <h2 className="crawler-progress-title">爬取进度</h2>
            <div className="crawler-progress-content">
              <div className="crawler-progress-bar-container">
                <div 
                  className="crawler-progress-bar"
                  style={{ width: `${crawlProgress}%` }}
                ></div>
              </div>
              <div className="crawler-progress-info">
                <span className="crawler-progress-percentage">{crawlProgress}%</span>
                {currentUrl && (
                  <span className="crawler-progress-url">{currentUrl}</span>
                )}
              </div>
            </div>
          </section>
        )}
        
        {/* 爬取结果 */}
        <section className="crawler-result">
          <h2 className="crawler-result-title">爬取结果</h2>
          <div className="crawler-result-content">
            {crawlerResult ? (
              <>
                <div className="crawler-result-item">
                  <span className="crawler-result-label">目标URL:</span>
                  <span className="crawler-result-value">{crawlerResult.url}</span>
                </div>
                <div className="crawler-result-item">
                  <span className="crawler-result-label">爬虫类型:</span>
                  <span className="crawler-result-value">
                    {crawlerResult.type === 'link' ? '链接爬虫' : 
                     crawlerResult.type === 'content' ? '内容爬虫' : '图片爬虫'}
                  </span>
                </div>
                <div className="crawler-result-item">
                  <span className="crawler-result-label">爬取深度:</span>
                  <span className="crawler-result-value">{crawlerResult.depth}</span>
                </div>
                <div className="crawler-result-item">
                  <span className="crawler-result-label">爬取数量:</span>
                  <span className="crawler-result-value">{crawlerResult.items} 个</span>
                </div>
                <div className="crawler-result-item">
                  <span className="crawler-result-label">爬取时间:</span>
                  <span className="crawler-result-value">{crawlerResult.time} 秒</span>
                </div>
                {crawlerResult.error && (
                  <div className="crawler-result-item crawler-result-error">
                    <span className="crawler-result-label">错误信息:</span>
                    <span className="crawler-result-value error">{crawlerResult.error}</span>
                  </div>
                )}
                {!crawlerResult.error && (
                  <div className="crawler-result-action">
                    <button 
                      className="crawler-analyze-button"
                      onClick={() => window.location.hash = 'analisys'}
                    >
                      分析结果
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="crawler-result-empty">
                <p>暂无爬取结果</p>
                <p className="crawler-result-empty-hint">请配置爬虫参数并点击"开始爬取"按钮</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CrawlerPage;
