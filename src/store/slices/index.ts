/**
 * 仅聚合 reducer，避免多个 slice 同名 action（如 clearError）从 barrel 重复导出。
 * 业务代码请从各 slice 文件直接 import actions。
 */
export { default as crawlerReducer } from './crawlerSlice'
export { default as settingsReducer } from './settingsSlice'
export { default as historyReducer } from './historySlice'
export { default as analyticsReducer } from './analyticsSlice'
