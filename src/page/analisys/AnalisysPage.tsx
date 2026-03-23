// 爬虫历史记录页面组件

import { useState, useEffect } from 'react';
import { CrawlerService } from '../../js/CrawlerService';

/**
 * 可展开的链接列表组件
 * 用于展示和展开剩余的链接
 */
const LinkExpandable = ({ links }: { links: string[] }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  
  return (
    <div className="analysis-link-expandable">
      {!expanded ? (
        <button 
          className="analysis-link-expand-button"
          onClick={() => setExpanded(true)}
        >
          ... 还有 {links.length} 个链接 (点击展开)
        </button>
      ) : (
        <>
          {links.map((subLink: string, subIndex: number) => (
            <div key={subIndex} className="analysis-link-sub-link">
              {subLink}
            </div>
          ))}
          <button 
            className="analysis-link-collapse-button"
            onClick={() => setExpanded(false)}
          >
            (点击收起)
          </button>
        </>
      )}
    </div>
  );
};

// 爬虫历史记录类型定义
interface CrawlHistoryItem {
  id: string;
  timestamp: number;
  url: string;
  type: 'link' | 'content' | 'image';
  depth: number;
  items: number;
  time: number;
  data: any[];
  error?: string;
}

/**
 * 爬虫历史记录页面组件
 * 用于展示和排版爬虫爬取的历史数据
 */
const AnalisysPage = () => {
  // 状态管理
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CrawlHistoryItem | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'items' | 'time'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  /**
   * 加载历史记录
   * 从 localStorage 或后端加载爬取历史
   */
  const loadHistory = () => {
    try {
      const savedHistory = localStorage.getItem('crawlHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  /**
   * 保存历史记录
   * 将爬取历史保存到 localStorage
   */
  const saveHistory = (newHistory: CrawlHistoryItem[]) => {
    try {
      localStorage.setItem('crawlHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  };

  /**
   * 排序历史记录
   */
  const sortHistory = () => {
    return [...history].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'timestamp') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortBy === 'items') {
        comparison = a.items - b.items;
      } else if (sortBy === 'time') {
        comparison = a.time - b.time;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  /**
   * 删除历史记录
   */
  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    saveHistory(updatedHistory);
  };

  /**
   * 清空所有历史记录
   */
  const clearAllHistory = () => {
    if (window.confirm('确定要清空所有历史记录吗？')) {
      setHistory([]);
      saveHistory([]);
      setSelectedItem(null);
    }
  };

  // 组件挂载时加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 历史记录变化时保存到 localStorage
  useEffect(() => {
    if (history.length > 0) {
      saveHistory(history);
    }
  }, [history]);

  // 排序后的历史记录
  const sortedHistory = sortHistory();

  return (
    <div className="analysis-page">
      <div className="hero-section">
        <h1 className="hero-title">数据分析</h1>
        <div className="hero-divider"></div>
        <p className="features-description">
          查看和排版爬虫爬取的历史数据
        </p>
      </div>
      
      <div className="analysis-content">
        {/* 历史记录控制栏 */}
        <section className="analysis-overview">
          <div className="analysis-overview-header">
            <h2 className="analysis-overview-title">爬取历史</h2>
            <div className="analysis-controls">
              <div className="analysis-sort-controls">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="analysis-select"
                >
                  <option value="timestamp">按时间</option>
                  <option value="items">按数量</option>
                  <option value="time">按耗时</option>
                </select>
                <button 
                  className="analysis-sort-button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              <div className="analysis-view-controls">
                <button 
                  className={`analysis-view-button ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  列表
                </button>
                <button 
                  className={`analysis-view-button ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  网格
                </button>
              </div>
              {history.length > 0 && (
                <button 
                  className="analysis-clear-button"
                  onClick={clearAllHistory}
                >
                  清空历史
                </button>
              )}
            </div>
          </div>
          
          {history.length === 0 ? (
            <div className="analysis-empty-state">
              <div className="analysis-empty-icon">📋</div>
              <h3 className="analysis-empty-title">暂无爬取历史</h3>
              <p className="analysis-empty-description">
                当您使用爬虫功能后，历史记录会显示在这里
              </p>
            </div>
          ) : (
            <div className={`analysis-history-container ${viewMode}`}>
              {sortedHistory.map((item) => (
                <div 
                  key={item.id} 
                  className={`analysis-history-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="analysis-history-item-header">
                    <div className="analysis-history-item-info">
                      <div className="analysis-history-item-type">
                        {item.type === 'link' && '🔗 链接爬虫'}
                        {item.type === 'content' && '📄 内容爬虫'}
                        {item.type === 'image' && '🖼️ 图片爬虫'}
                      </div>
                      <div className="analysis-history-item-url">{item.url}</div>
                    </div>
                    <div className="analysis-history-item-meta">
                      <span className="analysis-history-item-time">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <button 
                        className="analysis-history-item-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="analysis-history-item-stats">
                    <span className="analysis-history-item-stat">深度: {item.depth}</span>
                    <span className="analysis-history-item-stat">数量: {item.items}</span>
                    <span className="analysis-history-item-stat">耗时: {item.time}s</span>
                    {item.error && (
                      <span className="analysis-history-item-error">失败</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        
        {/* 详细数据展示 */}
        {selectedItem && (
          <section className="analysis-section">
            <div className="analysis-section-header">
              <h2 className="analysis-section-title">
                {selectedItem.type === 'link' && '链接数据'}
                {selectedItem.type === 'content' && '内容数据'}
                {selectedItem.type === 'image' && '图片数据'}
              </h2>
              <button 
                className="analysis-close-button"
                onClick={() => setSelectedItem(null)}
              >
                关闭
              </button>
            </div>
            
            <div className="analysis-detail-content">
              {/* 基本信息 */}
              <div className="analysis-detail-info">
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">目标 URL:</span>
                  <span className="analysis-detail-info-value">{selectedItem.url}</span>
                </div>
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">爬虫类型:</span>
                  <span className="analysis-detail-info-value">
                    {selectedItem.type === 'link' && '链接爬虫'}
                    {selectedItem.type === 'content' && '内容爬虫'}
                    {selectedItem.type === 'image' && '图片爬虫'}
                  </span>
                </div>
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">爬取深度:</span>
                  <span className="analysis-detail-info-value">{selectedItem.depth}</span>
                </div>
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">爬取数量:</span>
                  <span className="analysis-detail-info-value">{selectedItem.items}</span>
                </div>
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">爬取时间:</span>
                  <span className="analysis-detail-info-value">{selectedItem.time} 秒</span>
                </div>
                <div className="analysis-detail-info-item">
                  <span className="analysis-detail-info-label">执行时间:</span>
                  <span className="analysis-detail-info-value">{new Date(selectedItem.timestamp).toLocaleString()}</span>
                </div>
                {selectedItem.error && (
                  <div className="analysis-detail-info-item error">
                    <span className="analysis-detail-info-label">错误信息:</span>
                    <span className="analysis-detail-info-value">{selectedItem.error}</span>
                  </div>
                )}
              </div>
              
              {/* 详细数据 */}
              <div className="analysis-detail-data">
                <h3 className="analysis-detail-data-title">详细数据</h3>
                <div className="analysis-detail-data-content">
                  {selectedItem.type === 'link' && (
                    <div className="analysis-link-data">
                      {selectedItem.data.map((link, index) => (
                        <div key={index} className="analysis-link-item">
                          <div className="analysis-link-title">{link.title}</div>
                          <div className="analysis-link-url">{link.url}</div>
                          <div className="analysis-link-meta">
                            深度: {link.depth} | 链接数: {link.links.length}
                          </div>
                          {link.links.length > 0 && (
                            <div className="analysis-link-sub-links">
                              {link.links.length <= 5 ? (
                                // 链接数量较少，直接显示所有链接
                                link.links.map((subLink: string, subIndex: number) => (
                                  <div key={subIndex} className="analysis-link-sub-link">
                                    {subLink}
                                  </div>
                                ))
                              ) : (
                                // 链接数量较多，添加展开/折叠功能
                                <>
                                  {link.links.slice(0, 5).map((subLink: string, subIndex: number) => (
                                    <div key={subIndex} className="analysis-link-sub-link">
                                      {subLink}
                                    </div>
                                  ))}
                                  {link.links.length > 5 && (
                                    <LinkExpandable links={link.links.slice(5)} />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedItem.type === 'content' && (
                    <div className="analysis-content-data">
                      {selectedItem.data.map((content, index) => (
                        <div key={index} className="analysis-content-item">
                          <div className="analysis-content-title">{content.title}</div>
                          <div className="analysis-content-url">{content.url}</div>
                          <div className="analysis-content-meta">
                            深度: {content.depth}
                          </div>
                          <div className="analysis-content-text">
                            {content.content}
                          </div>
                          {content.keywords && content.keywords.length > 0 && (
                            <div className="analysis-content-keywords">
                              <strong>关键词:</strong> {content.keywords.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedItem.type === 'image' && (
                    <div className="analysis-image-data">
                      {selectedItem.data.map((image, index) => (
                        <div key={index} className="analysis-image-item">
                          <div className="analysis-image-url">{image.image_url}</div>
                          <div className="analysis-image-meta">
                            深度: {image.depth} | 尺寸: {image.width}x{image.height}
                          </div>
                          {image.alt && (
                            <div className="analysis-image-alt">
                              <strong>描述:</strong> {image.alt}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AnalisysPage;