// Button组件样式
// 使用styled-components实现现代化按钮样式

import styled, { css } from 'styled-components';
import { colors } from '../../styles/tokens/colors';
import { spacing } from '../../styles/tokens/spacing';
import { fontSizes, fontWeights } from '../../styles/tokens/typography';
import { shadows } from '../../styles/tokens/shadows';
import { responsive } from '../../styles/utilities/responsive';

// 基础按钮样式
export const ButtonBase = styled.button<{
  variant: string;
  size: string;
  fullWidth: boolean;
  loading: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.sm};
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-weight: ${fontWeights.medium};
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  user-select: none;
  position: relative;
  overflow: hidden;
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  opacity: ${props => props.disabled || props.loading ? 0.6 : 1};
  pointer-events: ${props => props.disabled || props.loading ? 'none' : 'auto'};

  &:focus-visible {
    outline: 2px solid ${colors.primary[500]};
    outline-offset: 2px;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* 加载状态样式 */
  ${props => props.loading && css`
    color: transparent !important;

    &::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      top: 50%;
      left: 50%;
      margin-left: -8px;
      margin-top: -8px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spinner 0.8s linear infinite;
    }
  `}

  @keyframes spinner {
    to { transform: rotate(360deg); }
  }
`;

// 尺寸样式
const buttonSizes = {
  sm: css`
    padding: ${spacing.xs} ${spacing.sm};
    font-size: ${fontSizes.sm};
    min-height: 32px;
  `,
  md: css`
    padding: ${spacing.sm} ${spacing.lg};
    font-size: ${fontSizes.md};
    min-height: 40px;
  `,
  lg: css`
    padding: ${spacing.md} ${spacing.xl};
    font-size: ${fontSizes.lg};
    min-height: 48px;
  `,
};

// 变体样式
const buttonVariants = {
  primary: css`
    background: ${colors.primary[500]};
    color: white;
    box-shadow: ${shadows.sm};

    &:hover:not(:disabled) {
      background: ${colors.primary[600]};
      box-shadow: ${shadows.md};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      background: ${colors.primary[700]};
      transform: translateY(0);
    }
  `,
  secondary: css`
    background: ${colors.secondary[100]};
    color: ${colors.text.primary};

    &:hover:not(:disabled) {
      background: ${colors.secondary[200]};
    }

    &:active:not(:disabled) {
      background: ${colors.secondary[300]};
    }
  `,
  outline: css`
    background: transparent;
    color: ${colors.primary[500]};
    border: 1px solid ${colors.border.primary};

    &:hover:not(:disabled) {
      background: ${colors.primary[50]};
      border-color: ${colors.primary[500]};
    }

    &:active:not(:disabled) {
      background: ${colors.primary[100]};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${colors.text.primary};

    &:hover:not(:disabled) {
      background: ${colors.secondary[100]};
    }

    &:active:not(:disabled) {
      background: ${colors.secondary[200]};
    }
  `,
};

// 主按钮样式
const sizeKey = (size: string | undefined) =>
  (size && size in buttonSizes ? size : 'md') as keyof typeof buttonSizes;

export const PrimaryButton = styled(ButtonBase).attrs({ variant: 'primary' })`
  ${props => buttonVariants.primary}
  ${props => buttonSizes[sizeKey(props.size)]}
`;

// 次要按钮样式
export const SecondaryButton = styled(ButtonBase).attrs({ variant: 'secondary' })`
  ${props => buttonVariants.secondary}
  ${props => buttonSizes[sizeKey(props.size)]}
`;

// 轮廓按钮样式
export const OutlineButton = styled(ButtonBase).attrs({ variant: 'outline' })`
  ${props => buttonVariants.outline}
  ${props => buttonSizes[sizeKey(props.size)]}
`;

// 幽灵按钮样式
export const GhostButton = styled(ButtonBase).attrs({ variant: 'ghost' })`
  ${props => buttonVariants.ghost}
  ${props => buttonSizes[sizeKey(props.size)]}
`;

// 通用按钮组件（根据variant prop动态渲染）
export const Button = styled(ButtonBase)<{ variant: string }>`
  ${props => buttonVariants[props.variant as keyof typeof buttonVariants]}
  ${props => buttonSizes[sizeKey(props.size)]}
`;