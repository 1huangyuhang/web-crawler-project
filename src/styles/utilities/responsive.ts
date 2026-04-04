// 响应式工具类
// 基于断点的媒体查询工具

import { breakpoints } from '../tokens/spacing';

export const responsive = {
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
} as const;

// 移动优先的响应式混合器
export const respondTo = {
  sm: (styles: string) => `@media (min-width: ${breakpoints.sm}) { ${styles} }`,
  md: (styles: string) => `@media (min-width: ${breakpoints.md}) { ${styles} }`,
  lg: (styles: string) => `@media (min-width: ${breakpoints.lg}) { ${styles} }`,
  xl: (styles: string) => `@media (min-width: ${breakpoints.xl}) { ${styles} }`,
} as const;

export type ResponsiveBreakpoints = keyof typeof responsive;