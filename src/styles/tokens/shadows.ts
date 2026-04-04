// 设计令牌 - 阴影系统
// 提供一致的阴影效果

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
} as const;

export type Shadows = typeof shadows;