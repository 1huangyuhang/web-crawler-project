// 爬虫首页组件

/**
 * 爬虫首页组件
 * 用于展示爬虫工具的主要功能和使用说明
 */
export const HomeContent = () => {
  return (
    <div className="crawler-home">
      <div className="hero-section">
        <h1 className="hero-title">网页爬虫工具</h1>
        <div className="hero-divider"></div>
        <p className="features-description">
          一个功能强大的网页爬虫工具，支持多种爬虫功能和数据分析
        </p>
      </div>
      
      <div className="crawler-features">
        {/* 爬虫功能介绍 */}
        <section className="crawler-feature-section">
          <h2 className="crawler-feature-title">主要功能</h2>
          <div className="crawler-feature-list">
            <div className="crawler-feature-item">
              <div className="crawler-feature-icon">🔗</div>
              <div className="crawler-feature-content">
                <h3 className="crawler-feature-name">链接爬虫</h3>
                <p className="crawler-feature-description">爬取网页中的所有链接，支持深度遍历和过滤</p>
              </div>
            </div>
            
            <div className="crawler-feature-item">
              <div className="crawler-feature-icon">📄</div>
              <div className="crawler-feature-content">
                <h3 className="crawler-feature-name">内容爬虫</h3>
                <p className="crawler-feature-description">爬取网页中的文本、图片、视频等内容</p>
              </div>
            </div>
            
            <div className="crawler-feature-item">
              <div className="crawler-feature-icon">📊</div>
              <div className="crawler-feature-content">
                <h3 className="crawler-feature-name">数据分析</h3>
                <p className="crawler-feature-description">对爬取的数据进行分析和可视化展示</p>
              </div>
            </div>
            
            <div className="crawler-feature-item">
              <div className="crawler-feature-icon">⚙️</div>
              <div className="crawler-feature-content">
                <h3 className="crawler-feature-name">自定义规则</h3>
                <p className="crawler-feature-description">支持自定义爬虫规则和过滤条件</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 使用说明 */}
        <section className="crawler-instructions">
          <h2 className="crawler-instructions-title">使用说明</h2>
          <div className="crawler-instructions-list">
            <div className="crawler-instruction-item">
              <span className="crawler-instruction-step">1</span>
              <p className="crawler-instruction-text">点击 "爬虫功能" 进入爬虫配置页面</p>
            </div>
            <div className="crawler-instruction-item">
              <span className="crawler-instruction-step">2</span>
              <p className="crawler-instruction-text">选择爬虫类型并配置相关参数</p>
            </div>
            <div className="crawler-instruction-item">
              <span className="crawler-instruction-step">3</span>
              <p className="crawler-instruction-text">输入目标网址并启动爬虫</p>
            </div>
            <div className="crawler-instruction-item">
              <span className="crawler-instruction-step">4</span>
              <p className="crawler-instruction-text">爬取完成后，点击 "数据分析" 查看结果</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// 导出组件
