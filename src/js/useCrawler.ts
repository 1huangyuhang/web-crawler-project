/**
 * 爬虫 hooks
 * 用于处理爬虫相关的逻辑
 */

import { useState, useEffect } from 'react';
import { CrawlerService } from './CrawlerService';

/**
 * 爬虫状态接口
 */
export interface CrawlerState {
  crawlerType: string;
  targetUrl: string;
  crawlerDepth: number;
  crawlerStatus: 'idle' | 'running' | 'completed' | 'error';
  crawlerResult: any;
  serviceStatus: 'checking' | 'available' | 'unavailable';
  crawlProgress: number; // 爬取进度 (0-100)
  currentUrl: string; // 当前正在爬取的URL
}

/**
 * 爬虫操作接口
 */
export interface CrawlerActions {
  setCrawlerType: (type: string) => void;
  setTargetUrl: (url: string) => void;
  setCrawlerDepth: (depth: number) => void;
  handleStartCrawl: () => Promise<void>;
  handleReset: () => void;
}

/**
 * 爬虫 hooks
 * @returns 爬虫状态和操作
 */
export const useCrawler = (): [CrawlerState, CrawlerActions] => {
  // 爬虫类型
  const [crawlerType, setCrawlerType] = useState(() => {
    return localStorage.getItem('crawlerType') || 'link';
  });
  
  // 目标URL
  const [targetUrl, setTargetUrl] = useState(() => {
    return localStorage.getItem('crawlerTargetUrl') || '';
  });
  
  // 爬虫深度
  const [crawlerDepth, setCrawlerDepth] = useState(() => {
    return parseInt(localStorage.getItem('crawlerDepth') || '2');
  });
  
  // 爬取状态
  const [crawlerStatus, setCrawlerStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  
  // 爬取结果
  const [crawlerResult, setCrawlerResult] = useState<any>(null);
  
  // 后端服务状态
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  
  // 爬取进度
  const [crawlProgress, setCrawlProgress] = useState(0);
  
  // 当前正在爬取的URL
  const [currentUrl, setCurrentUrl] = useState('');

  // 检查后端服务状态
  useEffect(() => {
    const checkServiceHealth = async () => {
      setServiceStatus('checking');
      const isAvailable = await CrawlerService.checkServiceHealth();
      setServiceStatus(isAvailable ? 'available' : 'unavailable');
    };
    
    checkServiceHealth();
  }, []);

  // 保存用户输入到localStorage
  useEffect(() => {
    localStorage.setItem('crawlerType', crawlerType);
  }, [crawlerType]);

  useEffect(() => {
    localStorage.setItem('crawlerTargetUrl', targetUrl);
  }, [targetUrl]);

  useEffect(() => {
    localStorage.setItem('crawlerDepth', crawlerDepth.toString());
  }, [crawlerDepth]);

  /**
   * 保存爬取历史记录
   * @param result 爬取结果
   */
  const saveCrawlHistory = (result: any) => {
    try {
      // 创建历史记录对象
      const historyItem = {
        id: `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        url: result.url,
        type: result.type,
        depth: result.depth,
        items: result.items,
        time: result.time,
        data: result.data || [],
        error: result.error
      };

      // 读取现有历史记录
      const savedHistory = localStorage.getItem('crawlHistory');
      const existingHistory = savedHistory ? JSON.parse(savedHistory) : [];

      // 添加新记录到开头
      const updatedHistory = [historyItem, ...existingHistory].slice(0, 50); // 只保留最近50条记录

      // 保存更新后的历史记录
      localStorage.setItem('crawlHistory', JSON.stringify(updatedHistory));
      console.log('爬取历史记录已保存');
    } catch (error) {
      console.error('保存爬取历史记录失败:', error);
    }
  };

  // 处理开始爬取
  const handleStartCrawl = async () => {
    if (!targetUrl) {
      alert('请输入目标URL');
      return;
    }

    // 检查后端服务状态
    if (serviceStatus !== 'available') {
      alert('后端服务不可用，请先启动后端服务');
      return;
    }

    // 重置状态
    setCrawlerStatus('running');
    setCrawlProgress(0);
    setCurrentUrl(targetUrl);
    
    // 进度模拟计时器
    let progressTimer: number | null = null;
    
    try {
      // 启动进度模拟
      let progress = 0;
      progressTimer = setInterval(() => {
        progress += 5;
        if (progress < 95) {
          setCrawlProgress(progress);
          // 模拟当前爬取的URL变化
          if (Math.random() > 0.7) {
            setCurrentUrl(`正在爬取: ${targetUrl.split('/').slice(0, 3).join('/')}/...`);
          }
        }
      }, 500);

      // 根据选中的爬虫类型调用对应的爬虫服务
      const result = await CrawlerService.startCrawling(crawlerType, targetUrl, crawlerDepth);
      
      // 清除计时器
      clearInterval(progressTimer);
      
      // 设置完成状态
      setCrawlProgress(100);
      setCrawlerStatus('completed');
      setCrawlerResult(result);
      
      // 保存爬取历史记录
      saveCrawlHistory(result);
    } catch (error) {
      console.error('爬取失败:', error);
      
      // 清除计时器
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      
      // 设置错误状态
      setCrawlerStatus('error');
      const errorResult = {
        url: targetUrl,
        type: crawlerType,
        depth: crawlerDepth,
        items: 0,
        time: 0,
        error: error instanceof Error ? error.message : '未知错误'
      };
      setCrawlerResult(errorResult);
      
      // 保存失败的爬取历史记录
      saveCrawlHistory(errorResult);
    }
  };

  // 处理重置
  const handleReset = () => {
    setCrawlerType('link');
    setTargetUrl('');
    setCrawlerDepth(2);
    setCrawlerStatus('idle');
    setCrawlerResult(null);
    setCrawlProgress(0);
    setCurrentUrl('');
  };

  // 状态对象
  const state: CrawlerState = {
    crawlerType,
    targetUrl,
    crawlerDepth,
    crawlerStatus,
    crawlerResult,
    serviceStatus,
    crawlProgress,
    currentUrl
  };

  // 操作对象
  const actions: CrawlerActions = {
    setCrawlerType,
    setTargetUrl,
    setCrawlerDepth,
    handleStartCrawl,
    handleReset
  };

  return [state, actions];
};
