// Card组件类型定义

export interface CardProps {
  /** 卡片内容 */
  children: React.ReactNode;

  /** 卡片变体 */
  variant?: 'default' | 'elevated' | 'outlined';

  /** 卡片尺寸 */
  size?: 'sm' | 'md' | 'lg';

  /** 完整宽度 */
  fullWidth?: boolean;

  /** 自定义类名 */
  className?: string;

  /** 点击事件 */
  onClick?: () => void;

  /** 禁用状态 */
  disabled?: boolean;
}

export interface CardHeaderProps {
  /** 标题内容 */
  children: React.ReactNode;

  /** 自定义类名 */
  className?: string;

  /** 底部边框 */
  borderBottom?: boolean;
}

export interface CardTitleProps {
  /** 标题文本 */
  children: React.ReactNode;

  /** 自定义类名 */
  className?: string;

  /** 标题级别 */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export interface CardContentProps {
  /** 内容 */
  children: React.ReactNode;

  /** 自定义类名 */
  className?: string;
}

export interface CardFooterProps {
  /** 页脚内容 */
  children: React.ReactNode;

  /** 自定义类名 */
  className?: string;

  /** 顶部边框 */
  borderTop?: boolean;
}