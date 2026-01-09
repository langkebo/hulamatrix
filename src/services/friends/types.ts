/**
 * Enhanced Friends Service - Type Definitions
 * Contains all types and interfaces for the friends service
 */

/**
 * 好友信息接口
 */
export interface Friend {
  /** 用户ID (Matrix MXID) */
  userId: string
  /** 显示名称 */
  displayName?: string | undefined
  /** 头像URL */
  avatarUrl?: string | undefined
  /** 在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 分类ID */
  categoryId?: string | undefined
  /** 关联的私聊房间ID */
  roomId?: string | undefined
  /** 状态文本 */
  statusText?: string | undefined
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
}

/**
 * Presence缓存条目接口
 * Requirement 4.4: THE Friends_Service SHALL cache last known presence status
 */
export interface PresenceCacheEntry {
  /** 在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
  /** 缓存时间戳 */
  timestamp: number
}

/**
 * Presence更新事件数据接口
 */
export interface PresenceUpdateEvent {
  /** 用户ID */
  userId: string
  /** 新的在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
}

/**
 * 事件监听器类型
 */
export type PresenceUpdateCallback = (event: PresenceUpdateEvent) => void

/**
 * 好友请求接口
 */
export interface FriendRequest {
  /** 请求ID */
  requestId: string
  /** 发送者用户ID */
  fromUserId: string
  /** 接收者用户ID */
  toUserId: string
  /** 申请消息 */
  message?: string
  /** 时间戳 */
  timestamp: number
}

/**
 * 好友分类接口
 * Requirement 5.1: THE Friends_Service SHALL support creating friend categories using room tags
 */
export interface FriendCategory {
  /** 分类ID */
  id: string
  /** 分类名称 */
  name: string
  /** 排序顺序 */
  order: number
}

/**
 * 好友分类账户数据内容接口
 */
export interface FriendCategoriesContent {
  /** 分类列表 */
  categories: FriendCategory[]
}

/**
 * Matrix m.direct 事件内容接口
 */
export interface MDirectEventContent {
  [userId: string]: string[] // roomId list for each user
}
