import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'

export enum LoginStatus {
  Init,
  Waiting,
  Success
}

export const useWebSocketStore = defineStore('websocket', () => {
  // 状态
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref<string | null>(null)
  const lastConnectedTime = ref<number | null>(null)
  const reconnectAttempts = ref(0)

  // Login State
  const loginQrCode = ref<string>()
  const loginStatus = ref(LoginStatus.Init)

  function resetLoginState() {
    loginQrCode.value = undefined
    loginStatus.value = LoginStatus.Init
  }

  // 更新连接状态
  function setConnected(status: boolean) {
    connected.value = status
    connecting.value = false
    error.value = null

    if (status) {
      lastConnectedTime.value = Date.now()
      reconnectAttempts.value = 0
    } else {
    }
  }

  // 更新连接中状态
  function setConnecting(status: boolean) {
    connecting.value = status
    if (status) {
      error.value = null
    }
  }

  // 设置错误状态
  function setError(err: string) {
    error.value = err
    connecting.value = false
    connected.value = false
  }

  // 增加重连次数
  function incrementReconnectAttempts() {
    reconnectAttempts.value++
  }

  // 重置状态
  function reset() {
    connected.value = false
    connecting.value = false
    error.value = null
    lastConnectedTime.value = null
    reconnectAttempts.value = 0
  }

  // 获取连接状态文本
  const statusText = computed(() => {
    if (connecting.value) return '连接中...'
    if (connected.value) return '已连接'
    if (error.value) return `连接错误: ${error.value}`
    return '未连接'
  })

  return {
    // 状态
    connected: readonly(connected),
    connecting: readonly(connecting),
    error: readonly(error),
    lastConnectedTime: readonly(lastConnectedTime),
    reconnectAttempts: readonly(reconnectAttempts),

    // 计算属性
    statusText,

    // 方法
    setConnected,
    setConnecting,
    setError,
    incrementReconnectAttempts,
    reset,

    // Login
    loginQrCode,
    loginStatus,
    resetLoginState
  }
})
