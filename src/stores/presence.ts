import { defineStore } from 'pinia'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixClient } from '@/composables'
import { useUserStore } from './user'
import { logger } from '@/utils/logger'

type PresenceState = 'online' | 'offline' | 'unavailable' | 'unknown'

const PRESENCE_CACHE_KEY = 'hula-presence-cache'
const PRESENCE_CACHE_VERSION = 1

interface PresenceCacheData {
  version: number
  map: Record<string, PresenceState>
  timestamp: number
}

interface PresenceContent {
  presence: PresenceState
  status_msg?: string
  last_active_ago?: number
}

/** Matrix 房间成员事件接口 */
interface MatrixMemberEvent {
  userId?: string
  event?: {
    sender?: string
    content?: {
      membership?: string
    }
  }
  membership?: string
}

/** Matrix 客户端接口 */
interface MatrixClientLike {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  setPresence: (userId: string, content: PresenceContent) => Promise<void>
}

/** Matrix 客户端服务接口 */
interface MatrixClientServiceLike {
  client?: MatrixClientLike
  getClient?: () => MatrixClientLike | null
}

/**
 * 从 localStorage 恢复缓存的 Presence 数据
 */
function loadPresenceFromCache(): Record<string, PresenceState> {
  try {
    const cached = localStorage.getItem(PRESENCE_CACHE_KEY)
    if (!cached) return {}
    const data: PresenceCacheData = JSON.parse(cached)
    // 检查版本和时效性（24小时过期）
    if (data.version !== PRESENCE_CACHE_VERSION || Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      return {}
    }
    return data.map || {}
  } catch {
    return {}
  }
}

/**
 * 保存 Presence 数据到 localStorage
 */
function savePresenceToCache(map: Record<string, PresenceState>) {
  try {
    const data: PresenceCacheData = {
      version: PRESENCE_CACHE_VERSION,
      map,
      timestamp: Date.now()
    }
    localStorage.setItem(PRESENCE_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

export const usePresenceStore = defineStore('presence', {
  state: () => ({
    map: loadPresenceFromCache() as Record<string, PresenceState>,
    // 存储用户最后活跃时间戳
    lastActiveMap: {} as Record<string, number>,
    initialized: false as boolean,
    setupAttempts: 0 as number,
    maxSetupAttempts: 5 as number,
    _saveTimeout: null as number | null,
    // 当前用户的 Presence 状态
    myPresence: 'online' as PresenceState,
    myStatusMsg: '' as string
  }),

  getters: {
    /**
     * 获取用户的 Presence 状态
     */
    getPresence:
      (state) =>
      (uid: string): PresenceState => {
        return state.map[uid] || 'unknown'
      },

    /**
     * 获取用户最后活跃时间戳
     */
    getLastActive:
      (state) =>
      (uid: string): number | undefined => {
        return state.lastActiveMap[uid]
      },

    /**
     * 检查用户是否在线
     */
    isOnline:
      (state) =>
      (uid: string): boolean => {
        return (state.map[uid] || 'unknown') === 'online'
      },

    /**
     * 统计在线用户数
     */
    onlineCount:
      (state) =>
      (uids: string[]): number => {
        return uids.filter((u) => (state.map[u] || 'unknown') === 'online').length
      },

    /**
     * 获取所有在线用户
     */
    onlineUsers: (state) => (): string[] => {
      return Object.entries(state.map)
        .filter(([, state]) => state === 'online')
        .map(([uid]) => uid)
    }
  },

  actions: {
    /**
     * 初始化 Presence 监听器
     * 支持延迟初始化和自动重试
     * 监听 Matrix SDK 的同步流 Presence 事件
     */
    setup() {
      if (this.initialized) {
        return true
      }

      this.setupAttempts++

      const service = matrixClientService as unknown as MatrixClientServiceLike
      const client: MatrixClientLike | null = service.client || service.getClient?.() || null

      if (!client) {
        // 客户端未就绪，记录日志并返回 false
        // 在 Matrix 客户端初始化后会再次调用 setup()
        return false
      }

      try {
        // SDK Integration: Use ClientEvent.Presence for presence notifications
        // According to SDK docs: client.on('Presence', (event) => {...})
        client.on('Presence', (...args: unknown[]) => {
          const event = args[0] as {
            getSender?: () => string
            getContent?: () => { presence?: string; status_msg?: string; last_active_ago?: number }
          }
          const sender = event?.getSender?.()
          const content = event?.getContent?.()
          if (!sender || !content?.presence) return

          const p = content.presence as PresenceState
          this.map[sender] = p

          // 计算最后活跃时间
          if (content.last_active_ago !== undefined) {
            this.lastActiveMap[sender] = Date.now() - content.last_active_ago
          }

          logger.debug('[PresenceStore] Presence event', { userId: sender, presence: p })
          // 持久化缓存（防抖）
          this.debouncedSaveCache()
        })

        // 监听房间成员变化事件
        client.on('RoomMember.membership', (...args: unknown[]) => {
          const member = args[1] as MatrixMemberEvent | undefined
          const uid = member?.userId || member?.event?.sender
          const m = member?.membership || member?.event?.content?.membership
          if (!uid || !m) return
          if (m === 'join') {
            this.map[uid] = 'online'
            this.debouncedSaveCache()
          }
          if (m === 'leave' || m === 'ban') {
            this.map[uid] = 'offline'
            this.debouncedSaveCache()
          }
        })

        this.initialized = true
        this.setupAttempts = 0

        logger.info('[PresenceStore] Presence listeners initialized')
        return true
      } catch (error) {
        logger.warn('[PresenceStore] Failed to setup Presence listeners:', error)
        // 初始化失败，允许重试
        return false
      }
    },

    /**
     * 设置当前用户的 Presence 状态
     * @param presence - 在线状态
     * @param statusMsg - 状态消息
     */
    async setMyPresence(presence: PresenceState, statusMsg?: string): Promise<void> {
      try {
        const userStore = useUserStore()
        const myUserId = userStore.userInfo?.uid

        if (!myUserId) {
          logger.warn('[PresenceStore] Cannot set presence: user not logged in')
          return
        }

        const { client } = useMatrixClient()
        if (!client.value) {
          logger.warn('[PresenceStore] Cannot set presence: Matrix client not available')
          return
        }

        // 设置 Presence 内容
        const content: PresenceContent = {
          presence,
          ...(statusMsg && { status_msg: statusMsg })
        }

        // 调用 Matrix API 设置 Presence
        const matrixClient = client.value as unknown as MatrixClientLike
        await matrixClient.setPresence(myUserId, content)

        // 更新本地状态
        this.myPresence = presence
        this.myStatusMsg = statusMsg || ''
        this.map[myUserId] = presence

        logger.info('[PresenceStore] Set my presence', { userId: myUserId, presence, statusMsg })
      } catch (error) {
        logger.error('[PresenceStore] Failed to set my presence:', error)
        throw error
      }
    },

    /**
     * 设置为在线状态
     */
    async setOnline(statusMsg?: string): Promise<void> {
      await this.setMyPresence('online', statusMsg)
    },

    /**
     * 设置为忙碌/离开状态
     */
    async setUnavailable(statusMsg?: string): Promise<void> {
      await this.setMyPresence('unavailable', statusMsg)
    },

    /**
     * 设置为离线状态
     */
    async setOffline(): Promise<void> {
      await this.setMyPresence('offline')
    },

    /**
     * 延迟保存缓存（防抖）
     */
    debouncedSaveCache() {
      // 使用简单的防抖机制
      if (this._saveTimeout) {
        clearTimeout(this._saveTimeout)
      }
      this._saveTimeout = setTimeout(() => {
        savePresenceToCache(this.map)
        this._saveTimeout = null
      }, 1000) as unknown as number
    },

    /**
     * 重置 Presence 状态（用于登出）
     */
    reset() {
      this.map = {}
      this.lastActiveMap = {}
      this.initialized = false
      this.setupAttempts = 0
      this.myPresence = 'online'
      this.myStatusMsg = ''
      try {
        localStorage.removeItem(PRESENCE_CACHE_KEY)
      } catch {}
    },

    /**
     * 手动设置用户 Presence（用于测试或强制更新）
     */
    setPresence(uid: string, state: PresenceState) {
      this.map[uid] = state
      this.debouncedSaveCache()
    },

    /**
     * 批量设置 Presence
     */
    setPresenceBatch(presences: Record<string, PresenceState>) {
      Object.assign(this.map, presences)
      this.debouncedSaveCache()
    }
  }
})
