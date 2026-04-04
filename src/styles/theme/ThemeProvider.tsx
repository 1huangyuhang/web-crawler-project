// 主题提供者组件
// 提供深色模式支持和主题管理

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '../tokens/theme';
import type { Theme } from '../tokens/theme';

// 定义上下文类型
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

// 创建上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者属性
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultDarkMode?: boolean;
  persistKey?: string;
}

// 主题提供者组件
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultDarkMode = false,
  persistKey = 'app-theme',
}) => {
  const [isDarkMode, setIsDarkMode] = useState(defaultDarkMode);

  // 从localStorage加载主题设置
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(persistKey);
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      } else {
        // 检查系统偏好
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(mediaQuery.matches);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, [persistKey]);

  // 监听系统主题变化
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (event: MediaQueryListEvent) => {
        // 只在用户没有手动设置主题时响应系统变化
        const savedTheme = localStorage.getItem(persistKey);
        if (savedTheme === null) {
          setIsDarkMode(event.matches);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      console.warn('Failed to setup system theme listener:', error);
    }
  }, [persistKey]);

  // 应用主题到document
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }

      // 保存用户选择
      localStorage.setItem(persistKey, JSON.stringify(isDarkMode));
    } catch (error) {
      console.warn('Failed to apply theme to document:', error);
    }
  }, [isDarkMode, persistKey]);

  // 切换主题
  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // 直接设置主题
  const setTheme = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };

  const currentTheme = {
    ...theme,
    colors: {
      ...theme.colors,
      ...(isDarkMode && {
        background: {
          primary: '#111827',
          secondary: '#1f2937',
          tertiary: '#374151',
        },
        text: {
          primary: '#f9fafb',
          secondary: '#e5e7eb',
          tertiary: '#9ca3af',
          disabled: '#6b7280',
        },
        border: {
          primary: '#374151',
          secondary: '#4b5563',
          focus: '#60a5fa',
        },
      }),
    },
  } as Theme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setTheme }}>
      <StyledThemeProvider theme={currentTheme}>
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
};

// 使用主题钩子
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 导出默认主题提供者
export default ThemeProvider;