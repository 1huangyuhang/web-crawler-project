// Input组件类型定义

export interface InputProps {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';

  /** 占位符文本 */
  placeholder?: string;

  /** 输入值 */
  value?: string;

  /** 默认值 */
  defaultValue?: string;

  /** 变化事件 */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  /** 禁用状态 */
  disabled?: boolean;

  /** 错误状态 */
  error?: boolean;

  /** 成功状态 */
  success?: boolean;

  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg';

  /** 前缀图标 */
  startIcon?: React.ReactNode;

  /** 后缀图标 */
  endIcon?: React.ReactNode;

  /** 标签文本 */
  label?: string;

  /** 帮助文本 */
  helperText?: string;

  /** 完整宽度 */
  fullWidth?: boolean;

  /** 自定义类名 */
  className?: string;

  /** 输入框名称 */
  name?: string;

  /** 自动完成 */
  autoComplete?: string;

  /** 只读状态 */
  readOnly?: boolean;

  /** 必填字段 */
  required?: boolean;

  /** 最小长度 */
  minLength?: number;

  /** 最大长度 */
  maxLength?: number;
}