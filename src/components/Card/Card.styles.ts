// Card组件样式
// 使用styled-components实现现代化卡片样式

import styled, { css } from 'styled-components';
import { colors } from '../../styles/tokens/colors';
import { spacing } from '../../styles/tokens/spacing';
import { fontSizes, fontWeights } from '../../styles/tokens/typography';
import { shadows } from '../../styles/tokens/shadows';
import { responsive } from '../../styles/utilities/responsive';

// 基础卡片样式
export const CardBase = styled.div<{
  variant: string;
  size: string;
  fullWidth: boolean;
  disabled: boolean;
}>`
  display: flex;
  flex-direction: column;
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  min-width: 0;
  background: ${colors.background.primary};
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};

  /* 卡片变体 */
  ${props => props.variant === 'default' && css`
    box-shadow: ${shadows.sm};
    border: 1px solid ${colors.border.primary};
  `}

  ${props => props.variant === 'elevated' && css`
    box-shadow: ${shadows.lg};
    border: none;
  `}

  ${props => props.variant === 'outlined' && css`
    box-shadow: none;
    border: 1px solid ${colors.border.primary};
  `}

  /* 卡片尺寸 */
  ${props => props.size === 'sm' && css`
    min-height: 120px;
  `}

  ${props => props.size === 'md' && css`
    min-height: 160px;
  `}

  ${props => props.size === 'lg' && css`
    min-height: 200px;
  `}

  /* 交互效果 */
  &:hover:not(:disabled) {
    ${props => props.variant === 'default' && css`
      box-shadow: ${shadows.md};
      transform: translateY(-2px);
    `}

    ${props => props.variant === 'elevated' && css`
      box-shadow: ${shadows.xl};
      transform: translateY(-4px);
    `}

    ${props => props.variant === 'outlined' && css`
      box-shadow: ${shadows.sm};
      border-color: ${colors.primary[500]};
    `}
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  /* 响应式调整 */
  ${responsive.md} {
    border-radius: 16px;
  }
`;

// 卡片头部样式
export const CardHeader = styled.div<{ borderBottom: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing.lg};
  padding-bottom: ${props => props.borderBottom ? spacing.md : spacing.lg};
  border-bottom: ${props => props.borderBottom ? `1px solid ${colors.border.primary}` : 'none'};
  background: transparent;
`;

// 卡片标题样式
export const CardTitle = styled.h3<{ as: string }>`
  margin: 0;
  font-size: ${fontSizes.xl};
  font-weight: ${fontWeights.semiBold};
  color: ${colors.text.primary};
  line-height: 1.3;

  ${props => props.as === 'h1' && css`
    font-size: ${fontSizes['4xl']};
  `}

  ${props => props.as === 'h2' && css`
    font-size: ${fontSizes['3xl']};
  `}

  ${props => props.as === 'h3' && css`
    font-size: ${fontSizes['2xl']};
  `}

  ${props => props.as === 'h4' && css`
    font-size: ${fontSizes.xl};
  `}

  ${props => props.as === 'h5' && css`
    font-size: ${fontSizes.lg};
  `}

  ${props => props.as === 'h6' && css`
    font-size: ${fontSizes.md};
  `}
`;

// 卡片副标题样式
export const CardSubtitle = styled.p`
  margin: ${spacing.xs} 0 0;
  font-size: ${fontSizes.md};
  font-weight: ${fontWeights.normal};
  color: ${colors.text.secondary};
`;

// 卡片内容样式
export const CardContent = styled.div<{ padded: boolean }>`
  flex: 1 1 auto;
  padding: ${props => props.padded ? spacing.lg : 0};
  color: ${colors.text.secondary};
  line-height: 1.6;

  /* 如果内容直接是文本，确保良好的排版 */
  > p {
    margin: 0 0 ${spacing.md} 0;

    &:last-child {
      margin-bottom: 0;
    }
  }

  /* 链接样式 */
  a {
    color: ${colors.primary[500]};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  /* 列表样式 */
  ul, ol {
    margin: ${spacing.md} 0;
    padding-left: ${spacing.lg};
  }

  li {
    margin-bottom: ${spacing.xs};
  }

  /* 代码样式 */
  code {
    background: ${colors.background.secondary};
    padding: ${spacing.xs} ${spacing.sm};
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: ${fontSizes.sm};
  }

  pre {
    background: ${colors.background.secondary};
    padding: ${spacing.md};
    border-radius: 8px;
    overflow-x: auto;
    margin: ${spacing.md} 0;

    code {
      background: transparent;
      padding: 0;
    }
  }
`;

// 卡片页脚样式
export const CardFooter = styled.div<{ borderTop: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing.lg};
  padding-top: ${props => props.borderTop ? spacing.md : spacing.lg};
  border-top: ${props => props.borderTop ? `1px solid ${colors.border.primary}` : 'none'};
  background: ${colors.background.secondary};
  border-radius: 0 0 12px 12px;
`;

// 卡片操作区域样式
export const CardActions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
`;

// 卡片媒体样式（用于图片、视频等）
export const CardMedia = styled.div<{ aspectRatio: string }>`
  position: relative;
  width: 100%;
  padding-top: ${props => props.aspectRatio === '16/9' ? '56.25%' :
                     props.aspectRatio === '4/3' ? '75%' :
                     props.aspectRatio === '1/1' ? '100%' : '56.25%'};
  overflow: hidden;
  border-radius: 12px 12px 0 0;

  > img,
  > video,
  > iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: none;
  }
`;

// 卡片头像样式
export const CardAvatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: ${colors.background.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${fontSizes.lg};
  font-weight: ${fontWeights.medium};
  color: ${colors.text.primary};

  > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  ${responsive.md} {
    width: 56px;
    height: 56px;
  }
`;

// 卡片文本样式
export const CardText = styled.p`
  margin: 0;
  color: ${colors.text.secondary};
  line-height: 1.6;

  &.muted {
    color: ${colors.text.tertiary};
    font-size: ${fontSizes.sm};
  }

  &.small {
    font-size: ${fontSizes.sm};
  }

  &.large {
    font-size: ${fontSizes.lg};
  }
`;