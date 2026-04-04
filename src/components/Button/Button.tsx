// Button组件主文件
// 现代化的React按钮组件，支持多种变体和尺寸

import React from 'react';
import type { ButtonProps } from './Button.types';
import { Button as StyledButton, PrimaryButton, SecondaryButton, OutlineButton, GhostButton } from './Button.styles';
import { Loader2, type LucideIcon } from 'lucide-react';

// 动态选择按钮组件
const getButtonComponent = (variant: string = 'primary') => {
  const components = {
    primary: PrimaryButton,
    secondary: SecondaryButton,
    outline: OutlineButton,
    ghost: GhostButton,
  };
  return components[variant as keyof typeof components] || PrimaryButton;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  fullWidth = false,
  iconPosition = 'left',
  className,
  ...props
}) => {
  const ButtonComponent = getButtonComponent(variant);

  // 渲染图标（如果有）
  const renderIcon = (icon: React.ReactNode) => {
    if (loading) {
      return <Loader2 className="animate-spin" size={16} />;
    }
    return icon;
  };

  // 处理children，分离图标和文本
  const childrenArray = React.Children.toArray(children);
  const icon = childrenArray.find(child =>
    React.isValidElement(child) && child.type && typeof child.type === 'function' &&
    (child.type as any).displayName === 'LucideIcon'
  );
  const text = childrenArray.filter(child => child !== icon);

  return (
    <ButtonComponent
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      type={type}
      fullWidth={fullWidth}
      className={className}
      {...props}
    >
      {iconPosition === 'left' && icon && (
        <span className="flex-shrink-0">
          {renderIcon(icon)}
        </span>
      )}

      {text.length > 0 && (
        <span className="flex-1">{text}</span>
      )}

      {iconPosition === 'right' && icon && (
        <span className="flex-shrink-0">
          {renderIcon(icon)}
        </span>
      )}
    </ButtonComponent>
  );
};

// 导出子组件
export { PrimaryButton, SecondaryButton, OutlineButton, GhostButton };

// 默认导出
export default Button;