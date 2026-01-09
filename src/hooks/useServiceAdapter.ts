/**
 * 服务适配器 Hook
 * 提供 Vue 组件中使用的服务适配器功能
 */

import { ref, computed, readonly, onMounted, onUnmounted, type Ref } from 'vue'
import { adapterManager } from '@/adapters/adapter-manager'
import type { MessageAdapter, AuthAdapter, RoomAdapter, FileAdapter, SyncAdapter } from '@/adapters/service-adapter'
import {
  adapterFactory,
  getBestMessageAdapter,
  getBestAuthAdapter,
  getBestRoomAdapter,
  getBestFileAdapter,
  getBestSyncAdapter
} from '@/adapters/adapter-factory'
import { logger } from '@/utils/logger'

/**
 * 服务适配器状态
 */
export interface ServiceAdapterState {
  message: MessageAdapter | null
  auth: AuthAdapter | null
  room: RoomAdapter | null
  file: FileAdapter | null
  sync: SyncAdapter | null
  initialized: boolean
  ready: boolean
}

/**
 * 使用服务适配器
 */
export function useServiceAdapter(autoInitialize = true) {
  const state = ref<ServiceAdapterState>({
    message: null,
    auth: null,
    room: null,
    file: null,
    sync: null,
    initialized: false,
    ready: false
  }) as Ref<ServiceAdapterState>

  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isInitialized = computed(() => state.value.initialized)
  const isReady = computed(() => state.value.ready)
  const hasMessageAdapter = computed(() => !!state.value.message)
  const hasAuthAdapter = computed(() => !!state.value.auth)
  const hasRoomAdapter = computed(() => !!state.value.room)
  const hasFileAdapter = computed(() => !!state.value.file)
  const hasSyncAdapter = computed(() => !!state.value.sync)

  /**
   * 初始化所有适配器
   */
  const initialize = async () => {
    if (loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useServiceAdapter] Initializing adapters...')

      // 初始化适配器工厂
      await adapterFactory.initialize()

      // 获取最佳适配器
      state.value.message = await getBestMessageAdapter()
      state.value.auth = await getBestAuthAdapter()
      state.value.room = await getBestRoomAdapter()
      state.value.file = await getBestFileAdapter()
      state.value.sync = await getBestSyncAdapter()

      state.value.initialized = true

      // 检查是否所有适配器都就绪
      await checkReadiness()

      logger.info('[useServiceAdapter] All adapters initialized successfully')
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      logger.error('[useServiceAdapter] Initialization failed:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 检查适配器就绪状态
   */
  const checkReadiness = async () => {
    const checkPromises = []

    if (state.value.message) {
      checkPromises.push(state.value.message.isReady())
    }
    if (state.value.auth) {
      checkPromises.push(state.value.auth.isReady())
    }
    if (state.value.room) {
      checkPromises.push(state.value.room.isReady())
    }
    if (state.value.file) {
      checkPromises.push(state.value.file.isReady())
    }
    if (state.value.sync) {
      checkPromises.push(state.value.sync.isReady())
    }

    try {
      const results = await Promise.all(checkPromises)
      state.value.ready = results.every((r: boolean) => r)
    } catch (err) {
      state.value.ready = false
      logger.error('[useServiceAdapter] Readiness check failed:', err)
    }
  }

  /**
   * 重新加载适配器
   */
  const reload = async (type?: 'message' | 'auth' | 'room' | 'file' | 'sync') => {
    if (!type) {
      // 重新加载所有适配器
      state.value.initialized = false
      await initialize()
      return
    }

    // 重新加载特定类型的适配器
    loading.value = true
    error.value = null

    try {
      let adapter = null
      switch (type) {
        case 'message':
          adapter = await getBestMessageAdapter()
          state.value.message = adapter
          break
        case 'auth':
          adapter = await getBestAuthAdapter()
          state.value.auth = adapter
          break
        case 'room':
          adapter = await getBestRoomAdapter()
          state.value.room = adapter
          break
        case 'file':
          adapter = await getBestFileAdapter()
          state.value.file = adapter
          break
        case 'sync':
          adapter = await getBestSyncAdapter()
          state.value.sync = adapter
          break
      }

      await checkReadiness()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      logger.error(`[useServiceAdapter] Failed to reload ${type} adapter:`, err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取适配器列表
   */
  const getAdapterList = (type?: string) => {
    return adapterManager.listAdapters(type)
  }

  /**
   * 清理资源
   */
  const cleanup = async () => {
    try {
      await adapterManager.cleanup()
      logger.info('[useServiceAdapter] Cleanup completed')
    } catch (err) {
      logger.error('[useServiceAdapter] Cleanup failed:', err)
    }
  }

  // 监听适配器状态变化
  let statusTimer: number | null = null

  onMounted(async () => {
    if (autoInitialize) {
      await initialize()
    }

    // 定期检查适配器状态
    statusTimer = window.setInterval(async () => {
      if (isInitialized.value) {
        await checkReadiness()
      }
    }, 10000) // 10 seconds
  })

  onUnmounted(() => {
    if (statusTimer) {
      clearInterval(statusTimer)
      statusTimer = null
    }
  })

  return {
    // 状态
    state: readonly(state),
    loading: readonly(loading),
    error: readonly(error),

    // 计算属性
    isInitialized,
    isReady,
    hasMessageAdapter,
    hasAuthAdapter,
    hasRoomAdapter,
    hasFileAdapter,
    hasSyncAdapter,

    // 方法
    initialize,
    reload,
    checkReadiness,
    getAdapterList,
    cleanup
  }
}

/**
 * 使用消息适配器
 */
export function useMessageAdapter() {
  const { state, isReady, reload } = useServiceAdapter()

  const sendMessage = async (params: { roomId: string; content: unknown; type?: string; encrypted?: boolean }) => {
    if (!state.value.message || !isReady.value) {
      throw new Error('Message adapter not ready')
    }

    return await state.value.message.sendMessage(params)
  }

  const getHistoryMessages = async (params: { roomId: string; limit?: number; from?: string }) => {
    if (!state.value.message || !isReady.value) {
      throw new Error('Message adapter not ready')
    }

    return await state.value.message.getHistoryMessages(params)
  }

  const markAsRead = async (params: { roomId: string; messageId: string }) => {
    if (!state.value.message || !isReady.value) {
      throw new Error('Message adapter not ready')
    }

    return await state.value.message.markAsRead(params)
  }

  return {
    state,
    isReady,
    sendMessage,
    getHistoryMessages,
    markAsRead,
    reload: () => reload('message')
  }
}

/**
 * 使用认证适配器
 */
export function useAuthAdapter() {
  const { state, isReady, reload } = useServiceAdapter()

  const login = async (params: { username: string; password: string; deviceName?: string }) => {
    if (!state.value.auth) {
      throw new Error('Auth adapter not available')
    }

    return await state.value.auth.login(params)
  }

  const logout = async () => {
    if (!state.value.auth) {
      throw new Error('Auth adapter not available')
    }

    return await state.value.auth.logout()
  }

  const validateToken = async () => {
    if (!state.value.auth || !state.value.auth.validateToken) {
      return false
    }

    return await state.value.auth.validateToken()
  }

  const refreshToken = async () => {
    if (!state.value.auth || !state.value.auth.refreshToken) {
      throw new Error('Token refresh not supported')
    }

    return await state.value.auth.refreshToken()
  }

  return {
    state,
    isReady,
    login,
    logout,
    validateToken,
    refreshToken,
    reload: () => reload('auth')
  }
}

/**
 * 使用房间适配器
 */
export function useRoomAdapter() {
  const { state, isReady, reload } = useServiceAdapter()

  const createRoom = async (params: { name: string; type?: 'private' | 'public'; topic?: string; avatar?: string }) => {
    if (!state.value.room || !isReady.value) {
      throw new Error('Room adapter not ready')
    }

    return await state.value.room.createRoom(params)
  }

  const joinRoom = async (params: { roomId: string; reason?: string; viaServers?: string[] }) => {
    if (!state.value.room || !isReady.value) {
      throw new Error('Room adapter not ready')
    }

    return await state.value.room.joinRoom(params)
  }

  const leaveRoom = async (params: { roomId: string; reason?: string }) => {
    if (!state.value.room || !isReady.value) {
      throw new Error('Room adapter not ready')
    }

    return await state.value.room.leaveRoom(params)
  }

  const getRooms = async () => {
    if (!state.value.room || !isReady.value) {
      throw new Error('Room adapter not ready')
    }

    return await state.value.room.getRooms()
  }

  const getRoomInfo = async (roomId: string) => {
    if (!state.value.room || !isReady.value) {
      throw new Error('Room adapter not ready')
    }

    return await state.value.room.getRoomInfo(roomId)
  }

  return {
    state,
    isReady,
    createRoom,
    joinRoom,
    leaveRoom,
    getRooms,
    getRoomInfo,
    reload: () => reload('room')
  }
}

/**
 * 使用文件适配器
 */
export function useFileAdapter() {
  const { state, isReady, reload } = useServiceAdapter()

  const uploadFile = async (params: {
    file: File | Blob
    roomId?: string
    onProgress?: (progress: number) => void
  }) => {
    if (!state.value.file || !isReady.value) {
      throw new Error('File adapter not ready')
    }

    return await state.value.file.uploadFile(params)
  }

  const downloadFile = async (params: {
    fileId: string
    savePath?: string
    onProgress?: (progress: number) => void
  }) => {
    if (!state.value.file || !isReady.value) {
      throw new Error('File adapter not ready')
    }

    return await state.value.file.downloadFile(params)
  }

  const getPreview = async (fileId: string) => {
    if (!state.value.file || !isReady.value) {
      throw new Error('File adapter not ready')
    }

    return await state.value.file.getPreview(fileId)
  }

  return {
    state,
    isReady,
    uploadFile,
    downloadFile,
    getPreview,
    reload: () => reload('file')
  }
}

/**
 * 使用同步适配器
 */
export function useSyncAdapter() {
  const { state, isReady, reload } = useServiceAdapter()

  const startSync = async (params?: { roomId?: string; fromToken?: string }) => {
    if (!state.value.sync || !isReady.value) {
      throw new Error('Sync adapter not ready')
    }

    return await state.value.sync.startSync(params)
  }

  const stopSync = async () => {
    if (!state.value.sync || !isReady.value) {
      throw new Error('Sync adapter not ready')
    }

    return await state.value.sync.stopSync()
  }

  const getSyncStatus = async () => {
    if (!state.value.sync || !isReady.value) {
      throw new Error('Sync adapter not ready')
    }

    return await state.value.sync.getSyncStatus()
  }

  return {
    state,
    isReady,
    startSync,
    stopSync,
    getSyncStatus,
    reload: () => reload('sync')
  }
}
