/**
 * 应用状态管理 Store
 * 统一管理应用的初始化、登录和就绪状态
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AppState } from '@/enums'
import { logger } from '@/utils/logger'

export const useAppStateStore = defineStore(
  'appState',
  () => {
    /** 当前应用状态 */
    const state = ref<AppState>(AppState.INITIALIZING)

    /** 错误消息 (当状态为 ERROR 时) */
    const error = ref<string | null>(null)

    // ==================== 计算属性 ====================

    /** 是否正在初始化 */
    const isInitializing = computed(() => state.value === AppState.INITIALIZING)

    /** 是否已登录 (包括登录中和已登录) */
    const isLoggedIn = computed(() => [AppState.LOGGING_IN, AppState.LOGGED_IN, AppState.READY].includes(state.value))

    /** 是否已完全登录 (已登录和就绪) */
    const isFullyLoggedIn = computed(() => [AppState.LOGGED_IN, AppState.READY].includes(state.value))

    /** 是否应用就绪 */
    const isReady = computed(() => state.value === AppState.READY)

    /** 是否需要登录 */
    const needsLogin = computed(() => [AppState.NOT_LOGGED_IN, AppState.ERROR].includes(state.value))

    /** 是否处于错误状态 */
    const isError = computed(() => state.value === AppState.ERROR)

    /** 是否正在登录 */
    const isLoggingIn = computed(() => state.value === AppState.LOGGING_IN)

    // ==================== 方法 ====================

    /**
     * 设置应用状态
     */
    function setState(newState: AppState, errorMessage?: string) {
      const oldState = state.value
      state.value = newState
      error.value = errorMessage || null

      logger.info('[AppState] State transition:', {
        from: oldState,
        to: newState,
        error: errorMessage
      })
    }

    /**
     * 重置为未登录状态
     */
    function reset() {
      setState(AppState.NOT_LOGGED_IN)
    }

    /**
     * 设置错误状态
     */
    function setError(errorMessage: string) {
      setState(AppState.ERROR, errorMessage)
    }

    /**
     * 获取当前状态的描述
     */
    function getStateDescription(): string {
      switch (state.value) {
        case AppState.INITIALIZING:
          return '应用初始化中...'
        case AppState.NOT_LOGGED_IN:
          return '未登录'
        case AppState.LOGGING_IN:
          return '登录中...'
        case AppState.LOGGED_IN:
          return '已登录，正在初始化客户端...'
        case AppState.READY:
          return '应用就绪'
        case AppState.ERROR:
          return `错误: ${error.value || '未知错误'}`
        default:
          return '未知状态'
      }
    }

    return {
      // 状态
      state,
      error,

      // 计算属性
      isInitializing,
      isLoggedIn,
      isFullyLoggedIn,
      isReady,
      needsLogin,
      isError,
      isLoggingIn,

      // 方法
      setState,
      reset,
      setError,
      getStateDescription
    }
  },
  {
    // 持久化配置 - 不持久化应用状态，每次启动重新初始化
    persist: false
  }
)
