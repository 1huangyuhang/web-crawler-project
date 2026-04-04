/**
 * 智能URL输入组件
 * 提供URL自动补全、历史记录、网站可达性检测等功能
 */

import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';

interface UrlSuggestion {
  url: string;
  label: string;
  favicon?: string;
  type: 'history' | 'template' | 'suggestion';
  timestamp?: number;
}

interface SmartUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SmartUrlInput: React.FC<SmartUrlInputProps> = ({
  value,
  onChange,
  onEnter,
  placeholder = "https://example.com",
  disabled = false,
  className = ""
}) => {
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid' | 'checking'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 常用网站模板
  const commonWebsites: UrlSuggestion[] = [
    { url: 'https://news.sina.com.cn', label: '新浪新闻', type: 'template' },
    { url: 'https://www.163.com', label: '网易新闻', type: 'template' },
    { url: 'https://www.taobao.com', label: '淘宝', type: 'template' },
    { url: 'https://www.jd.com', label: '京东', type: 'template' },
    { url: 'https://github.com', label: 'GitHub', type: 'template' },
    { url: 'https://stackoverflow.com', label: 'Stack Overflow', type: 'template' },
  ];

  // 加载历史记录
  const loadHistory = (): UrlSuggestion[] => {
    try {
      const history = localStorage.getItem('urlHistory');
      if (history) {
        const parsed = JSON.parse(history);
        return parsed.map((item: any) => ({
          ...item,
          type: 'history'
        }));
      }
    } catch (error) {
      console.error('加载URL历史记录失败:', error);
    }
    return [];
  };

  // 保存历史记录
  const saveHistory = (url: string) => {
    try {
      const history = loadHistory();
      const timestamp = Date.now();
      const newItem: UrlSuggestion = {
        url,
        label: url,
        type: 'history',
        timestamp
      };

      // 去重并添加到开头
      const filtered = history.filter(item => item.url !== url);
      const updated = [newItem, ...filtered].slice(0, 20); // 最多保存20条记录

      localStorage.setItem('urlHistory', JSON.stringify(updated));
    } catch (error) {
      console.error('保存URL历史记录失败:', error);
    }
  };

  
  // 检测URL可达性（模拟）
  const checkUrlReachability = async (): Promise<boolean> => {
    // 这里可以集成实际的检测逻辑
    // 现在使用模拟检测
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟90%的成功率
        resolve(Math.random() > 0.1);
      }, 500);
    });
  };

  // 生成建议列表
  const generateSuggestions = async (input: string): Promise<UrlSuggestion[]> => {
    const result: UrlSuggestion[] = [];

    if (!input.trim()) {
      // 空输入时显示历史记录和常用网站
      result.push(...loadHistory());
      result.push(...commonWebsites);
      return result.slice(0, 8);
    }

    // 过滤历史记录
    const history = loadHistory();
    const filteredHistory = history.filter(item =>
      item.url.toLowerCase().includes(input.toLowerCase())
    );
    result.push(...filteredHistory);

    // 过滤常用网站
    const filteredWebsites = commonWebsites.filter(item =>
      item.label.toLowerCase().includes(input.toLowerCase()) ||
      item.url.toLowerCase().includes(input.toLowerCase())
    );
    result.push(...filteredWebsites);

    // 如果输入看起来像URL，添加为建议
    if (input.match(/^https?:\/\/.+/)) {
      result.unshift({
        url: input,
        label: `打开 "${input}"`,
        type: 'suggestion'
      } as UrlSuggestion);
    }

    return result.slice(0, 8);
  };

  // 处理输入变化
  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (newValue.trim()) {
      setShowSuggestions(true);
      setIsValidating(true);
      setValidationStatus('checking');

      const reachable = await checkUrlReachability(newValue);
      setValidationStatus(reachable ? 'valid' : 'invalid');
      setIsValidating(false);

      const newSuggestions = await generateSuggestions(newValue);
      setSuggestions(newSuggestions);
    } else {
      setShowSuggestions(false);
      setValidationStatus('idle');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex];
          onChange(selected.url);
          saveHistory(selected.url);
          setShowSuggestions(false);
          setSelectedIndex(-1);
          onEnter?.(selected.url);
        } else if (value.trim()) {
          saveHistory(value);
          onEnter?.(value);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // 处理建议点击
  const handleSuggestionClick = (suggestion: UrlSuggestion) => {
    onChange(suggestion.url);
    saveHistory(suggestion.url);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 清除历史记录
  const clearHistory = () => {
    localStorage.removeItem('urlHistory');
    setSuggestions(prev => prev.filter(item => item.type !== 'history'));
  };

  return (
    <div ref={containerRef} className={`smart-url-input ${className}`}>
      <div className="input-container">
        <input
          ref={inputRef}
          id="target-url"
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim() && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`url-input ${validationStatus === 'valid' ? 'valid' : ''} ${validationStatus === 'invalid' ? 'invalid' : ''}`}
          autoComplete="off"
        />
        {isValidating && (
          <div className="validation-indicator checking">
            <span className="spinner"></span>
          </div>
        )}
        {validationStatus === 'valid' && (
          <div className="validation-indicator valid">✓</div>
        )}
        {validationStatus === 'invalid' && (
          <div className="validation-indicator invalid">✕</div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          <div className="suggestions-header">
            <span className="suggestions-title">URL建议</span>
            <button className="clear-history" onClick={clearHistory}>
              清除历史
            </button>
          </div>
          <ul className="suggestions-list">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.url}-${index}`}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''} ${suggestion.type}`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="suggestion-content">
                  {suggestion.type === 'history' && <span className="suggestion-icon">🕒</span>}
                  {suggestion.type === 'template' && <span className="suggestion-icon">📑</span>}
                  {suggestion.type === 'suggestion' && <span className="suggestion-icon">🔗</span>}
                  <span className="suggestion-label">{suggestion.label}</span>
                  <span className="suggestion-url">{suggestion.url}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="suggestions-footer">
            <span className="suggestions-hint">使用 ↑ ↓ 键选择，Enter 确认</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartUrlInput;