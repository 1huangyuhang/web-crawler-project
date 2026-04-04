import { configureStore, combineReducers } from '@reduxjs/toolkit'
import crawlerReducer from './store/slices/crawlerSlice'
import settingsReducer from './store/slices/settingsSlice'
import historyReducer from './store/slices/historySlice'
import analyticsReducer from './store/slices/analyticsSlice'

// 配置 Redux store - 使用模块化reducers
export const store = configureStore({
  reducer: combineReducers({
    crawler: crawlerReducer,
    settings: settingsReducer,
    history: historyReducer,
    analytics: analyticsReducer
  }),

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
        ignoredPaths: ['register'],
        warnAfter: 128
      },
      immutableCheck: { warnAfter: 128 }
    }),

  // 部分预览环境未注入 import.meta.env，避免读取时报错导致整站无法挂载
  devTools: Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV)
})

// 导出类型
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// 导出模块化reducers
export {
  crawlerReducer,
  settingsReducer,
  historyReducer,
  analyticsReducer
} from './store/slices'