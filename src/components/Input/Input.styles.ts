// Input组件样式
// 使用styled-components实现现代化输入框样式

import styled, { css } from 'styled-components';
import { colors } from '../../styles/tokens/colors';
import { spacing } from '../../styles/tokens/spacing';
import { fontSizes, fontWeights } from '../../styles/tokens/typography';
import { shadows } from '../../styles/tokens/shadows';
import { responsive } from '../../styles/utilities/responsive';

// 基础输入框样式
export const InputBase = styled.input<{
  size: string;
  error: boolean;
  success: boolean;
  fullWidth: boolean;
  hasStartIcon: boolean;
  hasEndIcon: boolean;
}>`
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  border: 1px solid ${colors.border.primary};
  border-radius: 8px;
  font-family: inherit;
  font-size: ${fontSizes.md};
  font-weight: ${fontWeights.normal};
  color: ${colors.text.primary};
  background: ${colors.background.primary};
  transition: all 0.2s ease-in-out;
  outline: none;
  position: relative;

  /* 根据状态改变边框颜色 */
  ${props => props.error && css`
    border-color: ${colors.error} !important;
  `}

  ${props => props.success && css`
    border-color: ${colors.success} !important;
  `}

  /* 基础输入框样式 */
  padding: ${props => {
    const hasIcon = props.hasStartIcon || props.hasEndIcon;
    switch (props.size) {
      case 'sm':
        return hasIcon ? `${spacing.xs} ${spacing.sm}` : `${spacing.xs} ${spacing.sm}`;
      case 'md':
        return hasIcon ? `${spacing.sm} ${spacing.md}` : `${spacing.sm} ${spacing.md}`;
      case 'lg':
        return hasIcon ? `${spacing.md} ${spacing.lg}` : `${spacing.md} ${spacing.lg}`;
      default:
        return `${spacing.sm} ${spacing.md}`;
    }
  }};

  /* 输入框尺寸 */
  min-height: ${props => {
    switch (props.size) {
      case 'sm':
        return '32px';
      case 'md':
        return '40px';
      case 'lg':
        return '48px';
      default:
        return '40px';
    }
  }};

  /* 交互状态 */
  &:hover:not(:disabled) {
    border-color: ${colors.primary[500]};
  }

  &:focus:not(:disabled) {
    border-color: ${colors.primary[500]};
    box-shadow: 0 0 0 3px ${colors.primary[100]};
  }

  &:disabled {
    background: ${colors.background.secondary};
    color: ${colors.text.disabled};
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${colors.text.tertiary};
    opacity: 1;
  }

  &:read-only {
    background: ${colors.background.secondary};
    cursor: default;
  }
`;

// 输入框包装器（用于图标支持）
export const InputWrapper = styled.div<{ hasStartIcon: boolean; hasEndIcon: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;

  /* 图标样式 */
  .input-icon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${colors.text.tertiary};
    transition: color 0.2s ease;
    pointer-events: none;
    z-index: 1;
  }

  .input-icon-start {
    left: ${spacing.sm};
  }

  .input-icon-end {
    right: ${spacing.sm};
  }

  /* 调整输入框的padding以容纳图标 */
  ${props => props.hasStartIcon && css`
    ${InputBase} {
      padding-left: ${spacing.lg};
    }
  `}

  ${props => props.hasEndIcon && css`
    ${InputBase} {
      padding-right: ${spacing.lg};
    }
  `}

  /* 图标颜色变化 */
  &:focus-within .input-icon {
    color: ${colors.primary[500]};
  }

  ${props => props.hasStartIcon && css`
    ${InputBase}:focus:not(:disabled) {
      padding-left: ${spacing.lg};
    }
  `}
`;

// 标签样式
export const InputLabel = styled.label`
  display: block;
  margin-bottom: ${spacing.xs};
  font-size: ${fontSizes.sm};
  font-weight: ${fontWeights.medium};
  color: ${colors.text.primary};
  cursor: pointer;

  &.required::after {
    content: ' *';
    color: ${colors.error};
  }
`;

// 帮助文本样式
export const HelperText = styled.p<{ error: boolean; success: boolean }>`
  margin-top: ${spacing.xs};
  margin-bottom: 0;
  font-size: ${fontSizes.sm};
  color: ${colors.text.secondary};

  ${props => props.error && css`
    color: ${colors.error};
  `}

  ${props => props.success && css`
    color: ${colors.success};
  `}
`;