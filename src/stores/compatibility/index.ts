/**
 * Store 兼容层
 * 支持新旧 Store 并存期间的平滑过渡
 *
 * 用途:
 * 1. 为旧 Store 提供兼容接口
 * 2. 代理到新的 Core Store
 * 3. 支持渐进式迁移
 *
 * @migration 从旧 Store 迁移到 Core Store 的过渡层
 */

import { computed, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from '@/stores/core'
import { logger } from '@/utils/logger'

// ========== 类型定义 ==========

/**
 * 兼容层配置
 */
interface CompatConfig {
  /** 旧 Store 名称 */
  oldStoreName: string
  /** Core Store 中的路径 (如 'auth', 'settings.theme') */
  corePath: string
  /** 是否启用开发模式警告 */
  enableWarning?: boolean
}

// App Store interface (minimal for compatibility)
interface AppStoreLike {
  settings?: {
    theme?: string
    language?: string
    fontSize?: string
    messageDensity?: string
    autoPlayGifs?: boolean
    showReadReceipts?: boolean
    showTypingNotifications?: boolean
    enableEncryption?: boolean
  }
  currentUser?: {
    userId?: string
    [key: string]: unknown
  }
  users?: Array<{ userId: string; presence?: string; [key: string]: unknown }>
  auth?: {
    isAuthenticated?: boolean
    [key: string]: unknown
  }
  rooms?: Map<string, RoomLike>
  messages?: Map<string, unknown[]>
  currentRoomId?: string
  friends?: FriendLike[]
  friendRequests?: unknown[]
  updateSettings?(settings: Record<string, unknown>): void
  [key: string]: unknown
}

interface RoomLike {
  id: string
  type?: 'dm' | 'group' | 'space'
  members: unknown[]
  [key: string]: unknown
}

interface FriendLike {
  userId: string
  [key: string]: unknown
}

// Settings update type
type SettingsUpdate = Record<string, unknown>

// User profile type
type UserProfile = Partial<AppStoreLike['currentUser']>

// Room updates type
type RoomUpdates = Partial<RoomLike>

// Friend type
type Friend = FriendLike

// ========== 工具函数 ==========

/**
 * 从 Core Store 获取嵌套属性
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let value: unknown = obj
  for (const key of keys) {
    if (typeof value === 'object' && value !== null && key in value) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return value
}

/**
 * 设置 Core Store 嵌套属性（如果有更新方法）
 */
function setNestedValue(appStore: AppStoreLike, path: string, value: unknown): void {
  // 尝试找到对应的更新方法
  const pathParts = path.split('.')
  const methodName = 'update' + pathParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')

  const method = (appStore as Record<string, unknown>)[methodName]
  if (typeof method === 'function') {
    ;(method as (val: unknown) => void)(value)
  } else {
    logger.warn(`[Compatibility] No update method found for path: ${path}`)
  }
}

/**
 * 创建兼容性警告日志
 */
function logCompatUsage(oldStoreName: string, detail?: string) {
  if (import.meta.env.DEV) {
    const message = detail
      ? `[Compatibility] Using legacy store: ${oldStoreName} - ${detail}`
      : `[Compatibility] Using legacy store: ${oldStoreName}`
    logger.warn(message)
  }
}

// ========== 兼容层工厂 ==========

/**
 * 创建兼容代理
 * @param config 兼容层配置
 * @returns 计算属性代理
 */
export function createCompatProxy<T>(config: CompatConfig): ComputedRef<T> {
  return computed(() => {
    const appStore = useAppStore()
    const value = getNestedValue(appStore, config.corePath)

    if (config.enableWarning !== false) {
      logCompatUsage(config.oldStoreName, `reading from ${config.corePath}`)
    }

    return value as T
  })
}

/**
 * 创建可写兼容代理
 * @param config 兼容层配置
 * @returns 带有 getter 和 setter 的计算属性
 */
export function createWritableCompatProxy<T>(config: CompatConfig) {
  return computed({
    get: () => {
      const appStore = useAppStore()
      const value = getNestedValue(appStore, config.corePath)
      logCompatUsage(config.oldStoreName, `reading from ${config.corePath}`)
      return value as T
    },
    set: (value: T) => {
      const appStore = useAppStore()
      logCompatUsage(config.oldStoreName, `writing to ${config.corePath}`)
      setNestedValue(appStore, config.corePath, value)
    }
  })
}

// ========== 具体兼容 Store ==========

/**
 * useSettingStore 兼容层
 * 迁移目标: app.settings
 */
export const useSettingStoreCompat = defineStore('setting-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const theme = computed(() => appStore.settings?.theme ?? 'auto')
  const language = computed(() => appStore.settings?.language ?? 'zh-CN')
  const fontSize = computed(() => appStore.settings?.fontSize ?? 'medium')
  const messageDensity = computed(() => appStore.settings?.messageDensity ?? 'comfortable')
  const autoPlayGifs = computed(() => appStore.settings?.autoPlayGifs !== false)
  const showReadReceipts = computed(() => appStore.settings?.showReadReceipts !== false)
  const showTypingNotifications = computed(() => appStore.settings?.showTypingNotifications !== false)
  const enableEncryption = computed(() => appStore.settings?.enableEncryption !== false)

  // 动作代理
  const setTheme = (newTheme: string) => {
    logCompatUsage('useSettingStore', 'setTheme')
    appStore.updateSettings?.({ theme: newTheme })
  }

  const setLanguage = (newLanguage: string) => {
    logCompatUsage('useSettingStore', 'setLanguage')
    appStore.updateSettings?.({ language: newLanguage })
  }

  const setFontSize = (newFontSize: string) => {
    logCompatUsage('useSettingStore', 'setFontSize')
    appStore.updateSettings?.({ fontSize: newFontSize })
  }

  const updateSettings = (newSettings: SettingsUpdate) => {
    logCompatUsage('useSettingStore', 'updateSettings')
    appStore.updateSettings?.(newSettings)
  }

  return {
    theme,
    language,
    fontSize,
    messageDensity,
    autoPlayGifs,
    showReadReceipts,
    showTypingNotifications,
    enableEncryption,
    setTheme,
    setLanguage,
    setFontSize,
    updateSettings
  }
})

/**
 * useUserStore 兼容层
 * 迁移目标: app.currentUser, app.users
 */
export const useUserStoreCompat = defineStore('user-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const userId = computed(() => appStore.currentUser?.userId ?? '')
  const profile = computed(() => appStore.currentUser)
  const users = computed(() => appStore.users)
  const isLoggedIn = computed(() => appStore.auth?.isAuthenticated ?? false)

  // 动作代理
  const setProfile = (newProfile: UserProfile) => {
    logCompatUsage('useUserStore', 'setProfile')
    if (appStore.currentUser) {
      Object.assign(appStore.currentUser, newProfile)
    }
  }

  const updatePresence = (targetUserId: string, presence: string) => {
    logCompatUsage('useUserStore', 'updatePresence')
    // 实现存在状态更新
    if (appStore.users) {
      const user = appStore.users.find((u) => u.userId === targetUserId)
      if (user) {
        user.presence = presence
      }
    }
  }

  const setUser = (user: UserProfile) => {
    logCompatUsage('useUserStore', 'setUser')
    const typedAppStore = appStore as { currentUser?: { [key: string]: unknown; userId?: string } }
    typedAppStore.currentUser = user as { [key: string]: unknown; userId?: string }
  }

  return {
    userId,
    profile,
    users,
    isLoggedIn,
    setProfile,
    updatePresence,
    setUser
  }
})

/**
 * useChatStore 兼容层
 * 迁移目标: app.rooms, app.messages
 */
export const useChatStoreCompat = defineStore('chat-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const rooms = computed(() => Array.from(appStore.rooms?.values() ?? []))
  const roomsMap = computed(() => appStore.rooms ?? new Map())
  const messages = computed(() => appStore.messages ?? new Map())
  const currentRoomId = computed(() => appStore.currentRoomId ?? '')
  const currentRoom = computed(() => {
    if (!appStore.currentRoomId) return null
    return appStore.rooms?.get(appStore.currentRoomId) ?? null
  })
  const currentSessionRoomId = computed(() => appStore.currentRoomId ?? '')

  // 计算属性
  const activeRooms = computed(() => rooms.value.filter((r) => r.members.length > 0))

  const directRooms = computed(() => rooms.value.filter((r) => r.type === 'dm'))

  const groupRooms = computed(() => rooms.value.filter((r) => r.type === 'group'))

  // 动作代理
  const setCurrentRoom = (roomId: string) => {
    logCompatUsage('useChatStore', 'setCurrentRoom')
    appStore.currentRoomId = roomId
  }

  const addMessage = (roomId: string, message: unknown) => {
    logCompatUsage('useChatStore', 'addMessage')
    const roomMessages = appStore.messages?.get(roomId) || []
    roomMessages.push(message)
    if (appStore.messages) {
      appStore.messages.set(roomId, roomMessages)
    }
  }

  const updateRoom = (roomId: string, updates: RoomUpdates) => {
    logCompatUsage('useChatStore', 'updateRoom')
    const room = appStore.rooms?.get(roomId)
    if (room && appStore.rooms) {
      appStore.rooms.set(roomId, { ...room, ...updates })
    }
  }

  const addRoom = (room: RoomLike) => {
    logCompatUsage('useChatStore', 'addRoom')
    if (appStore.rooms) {
      appStore.rooms.set(room.id, room)
    }
  }

  const removeRoom = (roomId: string) => {
    logCompatUsage('useChatStore', 'removeRoom')
    appStore.rooms?.delete(roomId)
  }

  return {
    rooms,
    roomsMap,
    messages,
    currentRoomId,
    currentRoom,
    currentSessionRoomId,
    activeRooms,
    directRooms,
    groupRooms,
    setCurrentRoom,
    addMessage,
    updateRoom,
    addRoom,
    removeRoom
  }
})

/**
 * useGroupStore 兼容层
 * 迁移目标: app.rooms (type='group')
 */
export const useGroupStoreCompat = defineStore('group-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const groups = computed(() => Array.from(appStore.rooms?.values() ?? []).filter((r) => r.type === 'group'))

  const getGroup = (groupId: string) => {
    return appStore.rooms?.get(groupId)
  }

  const updateGroup = (groupId: string, updates: RoomUpdates) => {
    logCompatUsage('useGroupStore', 'updateGroup')
    const group = appStore.rooms?.get(groupId)
    if (group && appStore.rooms) {
      appStore.rooms.set(groupId, { ...group, ...updates })
    }
  }

  return {
    groups,
    getGroup,
    updateGroup
  }
})

/**
 * useRoomStore 兼容层
 * 迁移目标: app.rooms
 */
export const useRoomStoreCompat = defineStore('room-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const rooms = computed(() => Array.from(appStore.rooms?.values() ?? []))
  const roomsMap = computed(() => appStore.rooms ?? new Map())

  const getRoom = (roomId: string) => {
    return appStore.rooms?.get(roomId)
  }

  const updateRoom = (roomId: string, updates: RoomUpdates) => {
    logCompatUsage('useRoomStore', 'updateRoom')
    const room = appStore.rooms?.get(roomId)
    if (room && appStore.rooms) {
      appStore.rooms.set(roomId, { ...room, ...updates })
    }
  }

  return {
    rooms,
    roomsMap,
    getRoom,
    updateRoom
  }
})

/**
 * useFriendsStore 兼容层
 * 迁移目标: app.friends
 */
export const useFriendsStoreCompat = defineStore('friends-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射
  const friends = computed(() => appStore.friends ?? [])
  const friendRequests = computed(() => appStore.friendRequests ?? [])

  const getFriend = (userId: string) => {
    return friends.value.find((f) => f.userId === userId)
  }

  const addFriend = (friend: Friend) => {
    logCompatUsage('useFriendsStore', 'addFriend')
    if (appStore.friends) {
      appStore.friends.push(friend)
    }
  }

  const removeFriend = (userId: string) => {
    logCompatUsage('useFriendsStore', 'removeFriend')
    if (appStore.friends) {
      const index = appStore.friends.findIndex((f) => f.userId === userId)
      if (index > -1) {
        appStore.friends.splice(index, 1)
      }
    }
  }

  return {
    friends,
    friendRequests,
    getFriend,
    addFriend,
    removeFriend
  }
})

/**
 * useGlobalStore 兼容层
 * 迁移目标: app.settings
 */
export const useGlobalStoreCompat = defineStore('global-compat', () => {
  const appStore = useAppStore() as unknown as AppStoreLike

  // 状态映射 - 复用 setting 的配置
  const theme = computed(() => appStore.settings?.theme ?? 'auto')
  const language = computed(() => appStore.settings?.language ?? 'zh-CN')

  const updateSettings = (newSettings: SettingsUpdate) => {
    logCompatUsage('useGlobalStore', 'updateSettings')
    appStore.updateSettings?.(newSettings)
  }

  return {
    theme,
    language,
    updateSettings
  }
})

// ========== 导出所有兼容 Store ==========

/**
 * 兼容 Store 映射表
 * 用于快速查找和替换旧 Store
 */
export const COMPAT_STORES_MAP = {
  useSettingStore: 'useSettingStoreCompat',
  useUserStore: 'useUserStoreCompat',
  useChatStore: 'useChatStoreCompat',
  useGroupStore: 'useGroupStoreCompat',
  useRoomStore: 'useRoomStoreCompat',
  useFriendsStore: 'useFriendsStoreCompat',
  useGlobalStore: 'useGlobalStoreCompat',
  useMenuTopStore: 'useMenuTopStoreCompat'
} as const

export type CompatStoreName = keyof typeof COMPAT_STORES_MAP

// 导出具体的兼容 Store
export { useMenuTopStoreCompat, type MenuTopItem } from './menuTop'

/**
 * 检查 Store 是否已迁移到 Core Store
 */
export function isStoreMigrated(storeName: string): boolean {
  return Object.keys(COMPAT_STORES_MAP).includes(storeName)
}

/**
 * 获取兼容 Store
 */
export function getCompatStore(storeName: CompatStoreName) {
  const compatName = COMPAT_STORES_MAP[storeName]
  // 这里需要动态导入相应的兼容 Store
  // 由于 defineStore 的限制，实际使用时需要直接导入
  return { compatName }
}
