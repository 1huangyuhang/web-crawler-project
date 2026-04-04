// Button组件类型定义

export interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';

  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';

  /** 按钮内容 */
  children: React.ReactNode;

  /** 点击事件 */
  onClick?: () => void;

  /** 禁用状态 */
  disabled?: boolean;

  /** 加载状态 */
  loading?: boolean;

  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';

  /** 完整宽度 */
  fullWidth?: boolean;

  /** 图标位置 */
  iconPosition?: 'left' | 'right';

  /** 自定义类名 */
  className?: string;
}