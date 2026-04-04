// 设计令牌 - 主题统一导出
// 所有设计令牌的聚合点

import { colors } from './colors';
import { spacing, breakpoints } from './spacing';
import { fonts, fontSizes, fontWeights, lineHeights } from './typography';
import { shadows } from './shadows';

export { colors } from './colors';
export { spacing, breakpoints } from './spacing';
export { fonts, fontSizes, fontWeights, lineHeights } from './typography';
export { shadows } from './shadows';

export type { Colors } from './colors';
export type { Spacing, Breakpoints } from './spacing';
export type { Fonts, FontSizes, FontWeights, LineHeights } from './typography';
export type { Shadows } from './shadows';

// 默认主题对象
export const theme = {
  colors,
  spacing,
  breakpoints,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  shadows,
} as const;

export type Theme = typeof theme;