/**
 * Store迁移工具
 * 帮助从旧的分散式Store迁移到统一的Core Store
 */

import { useAppStore } from './index'
import { logger } from '@/utils/logger'

/** 认证数据接口 */
interface AuthData {
  isAuthenticated: boolean
  accessToken?: string
  deviceId?: string
  userId?: string
  homeserver?: string
  loginHistory?: Array<{ timestamp: number; userId: string }>
}

/** 用户数据接口 */
interface UserData {
  userId: string
  profile?: {
    displayName?: string
    avatarUrl?: string
    presence?: string
  }
  lastActive?: number
}

/** 好友数据接口 */
interface FriendsData {
  friends: Array<string | { userId: string }>
}

/** 房间数据接口 */
interface RoomData {
  id: string
  name?: string
  topic?: string
  avatar?: string
  isDirect?: boolean
  members?: unknown[]
  unreadCount?: number
  highlightCount?: number
  notifications?: string
  isEncrypted?: boolean
  lastMessage?: unknown
  tags?: string[]
  creationTime?: number
  joinRule?: string
}

/** 聊天数据接口 */
interface ChatData {
  rooms?: RoomData[]
  messages?: Record<string, unknown>
  currentRoomId?: string
}

/** 搜索数据接口 */
interface SearchData {
  query?: string
  results?: unknown[]
  filters?: Record<string, unknown>
  loading?: boolean
  history?: unknown[]
}

/** 设置数据接口 */
interface SettingsData {
  theme?: string
  language?: string
  fontSize?: string
  messageDensity?: string
  autoPlayGifs?: boolean
  showReadReceipts?: boolean
  showTypingNotifications?: boolean
  enableEncryption?: boolean
  backupFrequency?: string
  cache?: Record<string, unknown>
  notifications?: Record<string, unknown>
}

/** 推送规则数据接口 */
interface PushRulesData {
  global?: {
    enabled?: boolean
    soundEnabled?: boolean
    doNotDisturb?: boolean
  }
  room?: Record<string, unknown>
  rules?: unknown[]
}

/** 旧Store数据联合类型 */
type OldStoreData =
  | AuthData
  | UserData
  | FriendsData
  | ChatData
  | SearchData
  | SettingsData
  | PushRulesData
  | Record<string, unknown>

// 旧的Store映射
const STORE_MIGRATION_MAP = {
  // 认证相关
  matrixAuth: 'app.auth',
  user: 'app.currentUser',
  userStatus: 'app.users',
  loginHistory: 'app.auth.loginHistory',

  // 聊天相关
  chat: 'app.rooms',
  privateChat: 'app.rooms', // DM房间
  sessionUnread: 'app.unreadCount',
  group: 'app.rooms', // 群组房间

  // 媒体和文件
  file: 'app.mediaFiles',
  fileDownload: 'app.downloadQueue',
  thumbnailCache: 'app.cache',

  // 通知
  pushRules: 'app.notifications',

  // RTC
  rtc: 'app.callState',

  // 搜索
  search: 'app.search',

  // 缓存
  cache: 'app.cache',
  cacheConfig: 'app.cacheSettings',
  cacheMetrics: 'app.cacheMetrics',

  // 好友和联系人
  friends: 'app.friends',

  // 设置
  setting: 'app.settings',
  global: 'app.settings',

  // 其他
  emoji: 'app.settings.emoji',
  announcement: 'app.notifications.announcements'
}

/**
 * 迁移特定Store的数据到Core Store
 */
export const migrateStoreData = (oldStoreName: string, data: OldStoreData) => {
  const appStore = useAppStore()
  const migrationPath = (STORE_MIGRATION_MAP as Record<string, string>)[oldStoreName]

  if (!migrationPath) {
    logger.warn(`No migration path defined for store: ${oldStoreName}`)
    return false
  }

  try {
    switch (oldStoreName) {
      case 'matrixAuth': {
        const authData = data as AuthData
        if (authData.isAuthenticated) {
          appStore.auth.auth.value = {
            isAuthenticated: true,
            accessToken: authData.accessToken,
            deviceId: authData.deviceId,
            userId: authData.userId,
            homeserver: authData.homeserver,
            // 转换 loginHistory: { timestamp, userId } -> { timestamp, deviceId }
            loginHistory:
              authData.loginHistory?.map((entry) => ({
                timestamp: entry.timestamp,
                deviceId: entry.userId // 迁移：将 userId 作为 deviceId
              })) || []
          }
        }
        break
      }

      case 'user': {
        const userData = data as UserData
        if (userData.profile) {
          appStore.auth.currentUser.value = {
            userId: userData.userId,
            displayName: userData.profile.displayName || '',
            avatarUrl: userData.profile.avatarUrl || '',
            presence: (userData.profile.presence || 'offline') as 'offline' | 'online' | 'away' | 'busy',
            lastActive: userData.lastActive
          }
        }
        break
      }

      case 'friends': {
        const friendsData = data as FriendsData
        // 转换好友列表：(string | { userId: string })[] -> string[]
        appStore.auth.friends.value = friendsData.friends?.map((f) => (typeof f === 'string' ? f : f.userId || '')) || []
        break
      }

      case 'chat': {
        // 迁移房间数据
        const chatData = data as ChatData
        if (chatData.rooms) {
          const roomsMap = new Map()
          chatData.rooms.forEach((room: RoomData) => {
            roomsMap.set(room.id, {
              id: room.id,
              name: room.name,
              topic: room.topic,
              avatar: room.avatar,
              type: room.isDirect ? 'dm' : 'group',
              members: room.members || [],
              unreadCount: room.unreadCount || 0,
              highlightCount: room.highlightCount || 0,
              notifications: room.notifications || 'all',
              isEncrypted: room.isEncrypted || false,
              lastMessage: room.lastMessage,
              tags: room.tags,
              creationTime: room.creationTime,
              joinRule: room.joinRule
            })
          })
          appStore.room.rooms.value = roomsMap
        }

        // 迁移消息数据
        if (chatData.messages) {
          const messagesMap = new Map()
          Object.entries(chatData.messages).forEach(([roomId, roomMessages]: [string, unknown]) => {
            messagesMap.set(roomId, roomMessages)
          })
          appStore.room.messages.value = messagesMap
        }

        // 设置当前房间
        if (chatData.currentRoomId) {
          appStore.room.currentRoomId.value = chatData.currentRoomId
        }
        break
      }

      case 'search': {
        const searchData = data as SearchData
        appStore.search.search.value = {
          query: searchData.query || '',
          results:
            (searchData.results as {
              id: string
              type: 'message' | 'user' | 'room'
              title: string
              content: string
              roomId: string
              timestamp: number
              highlights?: string[]
            }[]) || [],
          filters: searchData.filters || {},
          loading: searchData.loading || false,
          history: (searchData.history as string[]) || []
        }
        break
      }

      case 'settings': {
        const settingsData = data as SettingsData
        appStore.settings.settings.value = {
          theme: (settingsData.theme || 'auto') as 'light' | 'dark' | 'auto',
          language: settingsData.language || 'zh-CN',
          fontSize: (settingsData.fontSize || 'medium') as 'small' | 'medium' | 'large',
          messageDensity: (settingsData.messageDensity || 'comfortable') as 'compact' | 'comfortable' | 'spacious',
          autoPlayGifs: settingsData.autoPlayGifs !== false,
          showReadReceipts: settingsData.showReadReceipts !== false,
          showTypingNotifications: settingsData.showTypingNotifications !== false,
          enableEncryption: settingsData.enableEncryption !== false,
          backupFrequency: (settingsData.backupFrequency || 'weekly') as 'daily' | 'weekly' | 'monthly',
          cache: (settingsData.cache || appStore.cache.cacheSettings.value) as unknown as import('./types').CacheSettings,
          notifications: (settingsData.notifications ||
            appStore.notification.notifications.value) as unknown as import('./types').NotificationSettings
        }
        break
      }

      case 'pushRules': {
        const pushRulesData = data as PushRulesData
        appStore.notification.notifications.value = {
          global: {
            enabled: pushRulesData.global?.enabled ?? true,
            soundEnabled: pushRulesData.global?.soundEnabled ?? true,
            doNotDisturb: pushRulesData.global?.doNotDisturb ?? false
          },
          room:
            (pushRulesData.room as Record<string, { enabled: boolean; mentionsOnly: boolean; keywords: string[] }>) ||
            {},
          rules: (pushRulesData.rules as import('./types').NotificationRule[]) || []
        }
        break
      }

      default:
        logger.warn(`Migration not implemented for store: ${oldStoreName}`)
        return false
    }

    logger.debug(`✅ Successfully migrated store: ${oldStoreName}`)
    return true
  } catch (error) {
    logger.error(`❌ Failed to migrate store: ${oldStoreName}`, error)
    return false
  }
}

/**
 * 批量迁移多个Store
 */
export const migrateAllStores = (storesData: Record<string, OldStoreData>) => {
  const results: Record<string, boolean> = {}
  let successCount = 0
  const totalCount = Object.keys(storesData).length

  for (const [storeName, data] of Object.entries(storesData)) {
    results[storeName] = migrateStoreData(storeName, data)
    if (results[storeName]) {
      successCount++
    }
  }

  return {
    results,
    successCount,
    totalCount,
    successRate: (successCount / totalCount) * 100
  }
}

/**
 * 获取Store迁移映射
 */
export const getMigrationMap = () => STORE_MIGRATION_MAP

/**
 * 验证迁移数据完整性
 */
export const validateMigrationData = (oldStoreName: string, data: OldStoreData): boolean => {
  const requiredFields: Record<string, string[]> = {
    matrixAuth: ['isAuthenticated'],
    user: ['userId'],
    friends: ['friends'],
    chat: ['rooms'],
    search: [],
    settings: [],
    pushRules: []
  }

  const fields = requiredFields[oldStoreName]
  if (!fields) return true // 可选验证

  for (const field of fields) {
    if (!(field in data)) {
      logger.warn(`Missing required field '${field}' in store '${oldStoreName}'`)
      return false
    }
  }

  return true
}

/**
 * 备份当前Core Store数据
 */
export const backupCoreStore = () => {
  const appStore = useAppStore()
  const backup = {
    auth: appStore.auth,
    currentUser: appStore.auth.currentUser.value,
    friends: appStore.auth.friends.value,
    rooms: Array.from(appStore.room.rooms.value.entries()),
    messages: Array.from(appStore.room.messages.value.entries()),
    settings: appStore.settings.settings.value,
    notifications: appStore.notification.notifications.value,
    search: appStore.search.search.value,
    cacheSettings: appStore.cache.cacheSettings.value,
    cacheMetrics: appStore.cache.cacheMetrics.value,
    timestamp: Date.now()
  }

  localStorage.setItem('hula-core-store-backup', JSON.stringify(backup))
  return backup
}

/**
 * 恢复Core Store数据
 */
export const restoreCoreStore = () => {
  try {
    const backupJson = localStorage.getItem('hula-core-store-backup')
    if (!backupJson) {
      logger.warn('No backup data found')
      return false
    }

    const backup = JSON.parse(backupJson)
    const appStore = useAppStore()

    // 恢复数据
    appStore.auth.auth.value = backup.auth || { isAuthenticated: false, loginHistory: [] }
    appStore.auth.currentUser.value = backup.currentUser
    appStore.auth.friends.value = backup.friends || []

    if (backup.rooms) {
      appStore.room.rooms.value = new Map(backup.rooms)
    }

    if (backup.messages) {
      appStore.room.messages.value = new Map(backup.messages)
    }

    appStore.settings.settings.value = backup.settings || appStore.settings.settings.value
    appStore.notification.notifications.value = backup.notifications || appStore.notification.notifications.value
    appStore.search.search.value = backup.search || { query: '', results: [], filters: {}, loading: false, history: [] }

    return true
  } catch (error) {
    logger.error('❌ Failed to restore core store data:', error)
    return false
  }
}

/**
 * 清理旧的Store数据
 */
export const cleanupOldStores = () => {
  const oldStoreKeys = Object.keys(STORE_MIGRATION_MAP)
  let cleanedCount = 0

  oldStoreKeys.forEach((storeKey) => {
    const localStorageKey = `hula-store-${storeKey}`
    if (localStorage.getItem(localStorageKey)) {
      localStorage.removeItem(localStorageKey)
      cleanedCount++
    }
  })

  return cleanedCount
}
