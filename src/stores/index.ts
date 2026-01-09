import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { PiniaSharedState } from 'pinia-shared-state' // 标签页共享存储状态

export const pinia = createPinia()

// 默认开启持久化存储
pinia
  .use(
    createPersistedState({
      auto: true,
      // 为新的Core Store配置特殊的持久化策略
      serializer: {
        serialize: JSON.stringify,
        deserialize: JSON.parse
      }
    })
  )
  .use(
    PiniaSharedState({
      // 为所有存储启用插件。默认为true。
      enable: false,
      // 如果设置为true，此选项卡将尝试立即从另一个选项卡恢复共享状态。默认为true。
      initialize: false,
      // 强制一个类型。native、idb、localstorage或node中的一个。默认为本地。
      // native使用new BroadcastChannel来进行广播通信
      type: 'native'
    })
  )

// 导出核心Store
export { useAppStore } from './core'

// 为了兼容性，暂时导出旧的Store（逐步迁移）
export * from './matrixAuth'
export * from './chat'
export * from './userStatus'
export * from './friendsSDK' // 使用新的 Friends SDK
export * from './rtc'
export * from './search'
export * from './setting'
export * from './global'
