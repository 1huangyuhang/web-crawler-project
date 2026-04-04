// Input组件主文件
// 现代化的React输入框组件，支持多种类型和状态

import React, { useState } from 'react';
import type { InputProps } from './Input.types';
import { InputBase, InputWrapper, InputLabel, HelperText } from './Input.styles';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  defaultValue,
  onChange,
  disabled = false,
  error = false,
  success = false,
  size = 'md',
  startIcon,
  endIcon,
  label,
  helperText,
  fullWidth = false,
  className,
  name,
  autoComplete,
  readOnly = false,
  required = false,
  minLength,
  maxLength,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  // 处理密码类型
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  // 处理图标
  const hasStartIcon = !!startIcon;
  const hasEndIcon = !!endIcon || isPassword;

  // 处理值
  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : internalValue;

  // 处理变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // 渲染图标
  const renderStartIcon = () => {
    if (startIcon) {
      return (
        <span className="input-icon input-icon-start">
          {startIcon}
        </span>
      );
    }
    return null;
  };

  const renderEndIcon = () => {
    if (isPassword) {
      return (
        <button
          type="button"
          className="input-icon input-icon-end"
          onClick={togglePasswordVisibility}
          tabIndex={-1}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      );
    }

    if (endIcon) {
      return (
        <span className="input-icon input-icon-end">
          {endIcon}
        </span>
      );
    }

    return null;
  };

  // 渲染状态图标
  const renderStatusIcon = () => {
    if (success) {
      return <Check size={16} color="success" />;
    }
    if (error) {
      return <AlertCircle size={16} color="error" />;
    }
    return null;
  };

  return (
    <div className={className} style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <InputLabel htmlFor={name} className={required ? 'required' : ''}>
          {label}
        </InputLabel>
      )}

      <InputWrapper
        hasStartIcon={hasStartIcon}
        hasEndIcon={hasEndIcon}
        fullWidth={fullWidth}
      >
        {renderStartIcon()}

        <InputBase
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          disabled={disabled}
          error={error}
          success={success}
          size={size}
          fullWidth={fullWidth}
          hasStartIcon={hasStartIcon}
          hasEndIcon={hasEndIcon}
          autoComplete={autoComplete}
          readOnly={readOnly}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={error}
          aria-describedby={helperText ? `${name}-helper` : undefined}
          {...props}
        />

        {renderEndIcon()}
        {renderStatusIcon()}
      </InputWrapper>

      {helperText && (
        <HelperText
          id={`${name}-helper`}
          error={error}
          success={success}
        >
          {helperText}
        </HelperText>
      )}
    </div>
  );
};

// 导出默认组件
export default Input;