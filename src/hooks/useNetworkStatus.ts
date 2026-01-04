import { ref } from 'vue'
import { useEventManager } from '@/composables/useEventManager'

/**
 * 网络状态监测钩子
 */
export const useNetworkStatus = () => {
  // 网络状态 - 基于浏览器navigator.onLine
  const isOnline = ref(navigator.onLine)

  // 监听浏览器网络状态变化
  const handleOnline = () => {
    isOnline.value = true
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  const { addWindowListener } = useEventManager()

  // 初始化网络状态监听（自动清理）
  const initNetworkListener = () => {
    addWindowListener('online', handleOnline)
    addWindowListener('offline', handleOffline)
  }

  // 自动初始化监听器
  initNetworkListener()

  return {
    isOnline,
    initNetworkListener
  }
}
