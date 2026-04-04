/**
 * 爬取模板选择器组件
 * 提供预配置的爬取模板，简化用户操作
 */

import React, { useState } from 'react';

interface CrawlTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    headers: Record<string, string>;
    delay: number; // 请求延迟（毫秒）
    timeout: number; // 超时时间（毫秒）
    retry: number; // 重试次数
    userAgent?: string;
    followRedirects: boolean;
  };
  recommendedDepth: number;
  targetUrlExamples: string[];
}

interface CrawlTemplateSelectorProps {
  onTemplateSelect?: (template: CrawlTemplate) => void;
  onConfigChange?: (config: any) => void;
  currentDepth?: number;
  className?: string;
}

const CrawlTemplateSelector: React.FC<CrawlTemplateSelectorProps> = ({
  onTemplateSelect,
  onConfigChange,
  currentDepth = 2,
  className = ""
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<CrawlTemplate | null>(null);
  const [customConfig, setCustomConfig] = useState<Partial<CrawlTemplate['config']>>({});

  // 预定义爬取模板
  const templates: CrawlTemplate[] = [
    {
      id: 'news',
      name: '新闻网站',
      description: '针对新闻、资讯类网站的优化配置',
      icon: '📰',
      config: {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        delay: 1000,
        timeout: 30000,
        retry: 3,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        followRedirects: true
      },
      recommendedDepth: 2,
      targetUrlExamples: ['https://news.sina.com.cn', 'https://www.163.com', 'https://news.qq.com']
    },
    {
      id: 'ecommerce',
      name: '电商平台',
      description: '针对电商网站的商品爬取优化',
      icon: '🛒',
      config: {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        delay: 2000, // 电商网站反爬较严，延迟更大
        timeout: 45000,
        retry: 5,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        followRedirects: true
      },
      recommendedDepth: 3,
      targetUrlExamples: ['https://www.taobao.com', 'https://www.jd.com', 'https://www.amazon.com']
    },
    {
      id: 'social',
      name: '社交媒体',
      description: '针对社交媒体内容的爬取配置',
      icon: '💬',
      config: {
        headers: {
          'Accept': '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        delay: 3000, // 社交媒体反爬最严
        timeout: 60000,
        retry: 5,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        followRedirects: true
      },
      recommendedDepth: 1, // 社交媒体通常深度不宜太大
      targetUrlExamples: ['https://weibo.com', 'https://twitter.com', 'https://www.reddit.com']
    },
    {
      id: 'enterprise',
      name: '企业官网',
      description: '针对企业官网的友好爬取配置',
      icon: '🏢',
      config: {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        delay: 500, // 企业官网通常限制较少
        timeout: 20000,
        retry: 2,
        userAgent: 'Mozilla/5.0 (compatible; CrawlBot/1.0; +http://example.com/bot)',
        followRedirects: true
      },
      recommendedDepth: 3,
      targetUrlExamples: ['https://www.microsoft.com', 'https://www.google.com', 'https://www.ibm.com']
    },
    {
      id: 'forum',
      name: '论坛社区',
      description: '针对论坛、社区类网站的爬取配置',
      icon: '👥',
      config: {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        delay: 1500,
        timeout: 30000,
        retry: 3,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        followRedirects: true
      },
      recommendedDepth: 2,
      targetUrlExamples: ['https://stackoverflow.com', 'https://v2ex.com', 'https://segmentfault.com']
    },
    {
      id: 'custom',
      name: '自定义配置',
      description: '使用自定义的高级配置',
      icon: '⚙️',
      config: {
        headers: {},
        delay: 1000,
        timeout: 30000,
        retry: 3,
        followRedirects: true
      },
      recommendedDepth: currentDepth,
      targetUrlExamples: ['任意网站']
    }
  ];

  // 模板选择处理
  const handleTemplateSelect = (template: CrawlTemplate) => {
    setSelectedTemplate(template);
    onTemplateSelect?.(template);

    // 应用模板配置
    if (template.id !== 'custom') {
      setCustomConfig(template.config);
      onConfigChange?.(template.config);
    }
  };

  // 自定义配置变化处理
  const handleConfigChange = (field: keyof CrawlTemplate['config'], value: any) => {
    const newConfig = { ...customConfig, [field]: value };
    setCustomConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  // 保存自定义模板
  const saveCustomTemplate = () => {
    if (!selectedTemplate || selectedTemplate.id !== 'custom') return;

    try {
      const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
      const newTemplate: CrawlTemplate = {
        ...selectedTemplate,
        id: `custom_${Date.now()}`,
        name: `自定义_${new Date().toLocaleString()}`,
        config: customConfig as CrawlTemplate['config']
      };

      savedTemplates.push(newTemplate);
      localStorage.setItem('customTemplates', JSON.stringify(savedTemplates));

      alert('自定义模板保存成功！');
    } catch (error) {
      console.error('保存自定义模板失败:', error);
      alert('保存失败，请重试');
    }
  };

  return (
    <div className={`crawl-template-selector ${className}`}>
      <div className="templates-grid">
        {templates.map(template => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => handleTemplateSelect(template)}
          >
            <div className="template-header">
              <span className="template-icon">{template.icon}</span>
              <h3 className="template-name">{template.name}</h3>
            </div>
            <p className="template-description">{template.description}</p>
            <div className="template-config">
              <div className="config-item">
                <span className="config-label">延迟:</span>
                <span className="config-value">{template.config.delay}ms</span>
              </div>
              <div className="config-item">
                <span className="config-label">超时:</span>
                <span className="config-value">{template.config.timeout / 1000}s</span>
              </div>
              <div className="config-item">
                <span className="config-label">重试:</span>
                <span className="config-value">{template.config.retry}次</span>
              </div>
              <div className="config-item">
                <span className="config-label">推荐深度:</span>
                <span className="config-value">{template.recommendedDepth}层</span>
              </div>
            </div>
            {template.targetUrlExamples && (
              <div className="template-examples">
                <small className="examples-title">示例网站:</small>
                {template.targetUrlExamples.map((example, index) => (
                  <small key={index} className="example-url">{example}</small>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 自定义配置面板 */}
      {selectedTemplate?.id === 'custom' && (
        <div className="custom-config-panel">
          <h4 className="panel-title">自定义配置</h4>
          <div className="config-form">
            <div className="form-group">
              <label className="form-label" htmlFor="crawl-template-delay">请求延迟 (ms):</label>
              <input
                id="crawl-template-delay"
                type="number"
                min="100"
                max="10000"
                step="100"
                value={customConfig.delay || 1000}
                onChange={(e) => handleConfigChange('delay', parseInt(e.target.value))}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crawl-template-timeout">超时时间 (ms):</label>
              <input
                id="crawl-template-timeout"
                type="number"
                min="5000"
                max="120000"
                step="1000"
                value={customConfig.timeout || 30000}
                onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crawl-template-retry">重试次数:</label>
              <input
                id="crawl-template-retry"
                type="number"
                min="0"
                max="10"
                value={customConfig.retry || 3}
                onChange={(e) => handleConfigChange('retry', parseInt(e.target.value))}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crawl-template-ua">User Agent:</label>
              <input
                id="crawl-template-ua"
                type="text"
                value={customConfig.userAgent || ''}
                onChange={(e) => handleConfigChange('userAgent', e.target.value)}
                className="form-input"
                placeholder="自定义User Agent"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={customConfig.followRedirects !== false}
                  onChange={(e) => handleConfigChange('followRedirects', e.target.checked)}
                  className="form-checkbox"
                />
                跟随重定向
              </label>
            </div>
            <button onClick={saveCustomTemplate} className="save-button">
              💾 保存为模板
            </button>
          </div>
        </div>
      )}

      {/* 当前配置摘要 */}
      {selectedTemplate && selectedTemplate.id !== 'custom' && (
        <div className="config-summary">
          <h4 className="summary-title">当前配置摘要</h4>
          <div className="summary-content">
            <div className="summary-item">
              <span className="summary-label">模板类型:</span>
              <span className="summary-value">{selectedTemplate.name}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">请求延迟:</span>
              <span className="summary-value">{selectedTemplate.config.delay}ms</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">超时时间:</span>
              <span className="summary-value">{selectedTemplate.config.timeout / 1000}s</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">推荐深度:</span>
              <span className="summary-value">{selectedTemplate.recommendedDepth}层</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawlTemplateSelector;