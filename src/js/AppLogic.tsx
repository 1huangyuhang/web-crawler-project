import { useState, useEffect } from 'react'

/**
 * 应用逻辑管理
 * 负责处理应用的路由状态和页面切换
 */

/**
 * 路由状态接口
 */
export interface AppState {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

/**
 * 使用应用逻辑钩子
 * 处理页面路由状态和哈希变化监听
 */
export const useAppLogic = (): AppState => {
  // 当前页面状态
  const [currentPage, setCurrentPage] = useState('home')

  // 监听页面加载和路由变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1) || 'home'
      setCurrentPage(hash)
    }

    // 初始加载
    handleHashChange()

    // 监听哈希变化
    window.addEventListener('hashchange', handleHashChange)

    // 清理函数
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  return {
    currentPage,
    setCurrentPage
  }
}

/**
 * 页面配置接口
 */
export interface PageConfig {
  path: string;
  showNavbar: boolean;
  showFooter: boolean;
}

/**
 * 页面配置
 */
export const pageConfigs: Record<string, PageConfig> = {
  home: {
    path: 'home',
    showNavbar: true,
    showFooter: true
  },
  analisys: {
    path: 'analisys',
    showNavbar: true,
    showFooter: true
  },
  crawler: {
    path: 'crawler',
    showNavbar: true,
    showFooter: true
  },
  templates: {
    path: 'templates',
    showNavbar: true,
    showFooter: true
  },
  ai: {
    path: 'ai',
    showNavbar: true,
    showFooter: true
  },
  settings: {
    path: 'settings',
    showNavbar: true,
    showFooter: true
  }
}

/**
 * 获取页面配置
 * @param page 页面路径
 * @returns 页面配置对象
 */
export const getPageConfig = (page: string): PageConfig => {
  return pageConfigs[page] || pageConfigs.home
}
