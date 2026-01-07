/**
 * MSC3575 Sliding Sync 类型定义
 * @module types/sliding-sync
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/3575
 */

/**
 * Sliding Sync 列表配置
 */
export interface MSC3575List {
  /** 滑动窗口范围，例如 [[0, 19], [50, 99]] */
  ranges: number[][]

  /** 排序字段 */
  sort?: string[]

  /** 过滤条件 */
  filters?: MSC3575Filters

  /** 需要的状态事件 */
  required_state?: string[][]

  /** 时间线限制 */
  timeline_limit?: number

  /** 列表名称（可选，用于调试） */
  name?: string
}

/**
 * Sliding Sync 过滤器
 */
export interface MSC3575Filters {
  /** 是否为直接消息 */
  is_dm?: boolean

  /** 是否加密 */
  is_encrypted?: boolean

  /** 是否为邀请 */
  is_invite?: boolean

  /** 房间名称模糊匹配 */
  room_name_like?: string

  /** 房间类型过滤 */
  room_types?: string[]

  /** 空间过滤 */
  spaces?: string[]

  /** 标签过滤 */
  tags?: string[]

  /** 排除标签 */
  not_tags?: string[]

  /** 排除房间类型 */
  not_room_types?: string[]
}

/**
 * 房间订阅配置
 */
export interface MSC3575RoomSubscription {
  /** 需要的状态事件 */
  required_state?: string[][]

  /** 时间线限制 */
  timeline_limit?: number

  /** 包含旧房间的订阅配置 */
  include_old_rooms?: MSC3575RoomSubscription
}

/**
 * 房间数据
 */
export interface MSC3575RoomData {
  /** 房间 ID（可选，SDK 不包含此字段，我们添加以便于使用） */
  room_id?: string

  /** 房间名称 */
  name?: string

  /** 房间头像 URL */
  avatar_url?: string

  /** 房间主题 */
  topic?: string

  /** 已加入成员数 */
  joined_count?: number

  /** 受邀成员数 */
  invited_count?: number

  /** 英雄成员（用于小房间显示） */
  heroes?: string[]

  /** 通知计数 */
  notification_count?: number

  /** 高亮计数 */
  highlight_count?: number

  /** 需要的状态事件 */
  required_state?: Record<string, unknown> | Array<Record<string, unknown>>

  /** 时间线事件 */
  timeline?: MSC3575Event[] | Array<Record<string, unknown>>

  /** 更新时间戳 */
  updated?: number

  /** 状态 */
  state?: string

  /** 房间类型 */
  room_type?: string

  /** 是否为直接消息 */
  is_dm?: boolean

  /** 是否加密 */
  is_encrypted?: boolean

  /** 是否在线（用于 DM 房间） */
  is_online?: boolean

  /** 房间标签 */
  tags?: string[]
}

/**
 * Sliding Sync 事件
 */
export interface MSC3575Event {
  /** 事件 ID */
  event_id: string

  /** 发送者 */
  sender: string

  /** 事件类型 */
  type: string

  /** 服务器时间戳 */
  origin_server_ts: number

  /** 事件内容 */
  content?: Record<string, unknown>

  /** 房间 ID */
  room_id?: string

  /** 用户 ID */
  user_id?: string

  /** 状态键 */
  state_key?: string
}

/**
 * 列表数据
 */
export interface SlidingListData {
  /** 列表 ID */
  listId: string

  /** 房间数据列表 */
  rooms: MSC3575RoomData[]

  /** 列表计数 */
  count: number

  /** 当前窗口范围 */
  ranges: number[][]

  /** 是否有更多数据 */
  hasMore: boolean
}

/**
 * Sliding Sync 扩展配置
 */
export interface MSC3575Extensions {
  /** E2EE 扩展 */
  e2ee?: {
    enabled: boolean
  }

  /** 回执扩展 */
  receipt?: {
    enabled: boolean
  }

  /** 输入指示器扩展 */
  typing?: {
    enabled: boolean
  }

  /** 账户数据扩展 */
  account_data?: {
    enabled: boolean
    limit?: number
  }

  /** 未读通知扩展 */
  unread_notifications?: {
    enabled: boolean
  }
}

/**
 * 生命周期状态
 */
export type SlidingSyncLifecycleState =
  | 'LOADING' // 初始加载中
  | 'READY' // 已就绪
  | 'CATCHUP' // 追赶中
  | 'SYNCING' // 同步中
  | 'ERROR' // 错误
  | 'STOPPED' // 已停止

/**
 * Sliding Sync 事件类型
 */
export interface SlidingSyncEvents {
  /** 生命周期事件 */
  LIFECYCLE: SlidingSyncLifecycleState

  /** 列表更新事件 */
  LIST: (listId: string, data: SlidingListData) => void

  /** 房间更新事件 */
  ROOM: (roomId: string, roomData: MSC3575RoomData) => void

  /** 房间数据更新事件 */
  ROOM_DATA: (roomId: string, roomData: MSC3575RoomData) => void

  /** 删除房间事件 */
  DELETE_ROOM: (roomId: string) => void
}

/**
 * 带好友信息的 DM 数据
 * 用于 Sliding Sync 的 direct_messages 列表与 FriendsClient 数据合并
 */
export interface DMWithFriendInfo extends MSC3575RoomData {
  /** 好友用户 ID */
  friend_id?: string

  /** 显示名称（从好友信息获取） */
  display_name?: string

  /** 分组 ID */
  category_id?: number

  /** 分组名称 */
  category_name?: string

  /** 分组颜色 */
  category_color?: string

  /** 是否在线 */
  is_online?: boolean

  /** 最后活跃时间 */
  last_active?: number

  /** 好友备注 */
  remark?: string
}

/**
 * Presence 状态
 */
export interface PresenceState {
  /** 用户 ID */
  user_id: string

  /** 在线状态 */
  presence: 'online' | 'offline' | 'unavailable'

  /** 当前活动 */
  currently_active?: boolean

  /** 最后活跃时间 */
  last_active_ago?: number

  /** 状态消息 */
  status_msg?: string
}

/**
 * Presence 更新回调
 */
export type PresenceUpdateCallback = (presences: Record<string, PresenceState>) => void

/**
 * 列表更新回调
 */
export type ListUpdateCallback = (listId: string, data: SlidingListData) => void

/**
 * 房间更新回调
 */
export type RoomUpdateCallback = (roomId: string, roomData: MSC3575RoomData) => void

/**
 * 生命周期回调
 */
export type LifecycleCallback = (state: SlidingSyncLifecycleState, list?: SlidingList) => void

/**
 * Sliding Sync 列表接口
 * 这是 Matrix SDK 中 SlidingList 的简化接口
 */
export interface SlidingList {
  /** 列表名称 */
  name: string

  /** 获取房间 ID 列表 */
  getRoomIds(): string[]

  /** 获取房间数据 */
  getRoomData(roomId: string): MSC3575RoomData | undefined

  /** 获取列表计数 */
  getCount(): number

  /** 获取当前范围 */
  getRanges(): number[][]

  /** 设置范围 */
  setRanges(ranges: number[][]): void

  /** 设置过滤条件 */
  setFilters(filters: MSC3575Filters): void

  /** 获取过滤条件 */
  getFilters(): MSC3575Filters
}

/**
 * Sliding Sync 接口
 * 这是 Matrix SDK 中 SlidingSync 的简化接口
 */
export interface SlidingSync {
  /** 创建列表 */
  list(name: string, config: MSC3575List): SlidingList

  /** 获取列表 */
  getList(name: string): SlidingList | undefined

  /** 设置房间订阅 */
  setRoomSubscriptions(subscriptions: Record<string, MSC3575RoomSubscription | null>): void

  /** 设置扩展 */
  setExtensions(extensions: MSC3575Extensions): void

  /** 开始同步 */
  start(): Promise<void>

  /** 停止同步 */
  stop(): void

  /** 监听事件 */
  on(eventName: string, listener: (...args: unknown[]) => void): void

  /** 移除监听 */
  removeListener(eventName: string, listener: (...args: unknown[]) => void): void

  /** Matrix 客户端 */
  client?: unknown
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = unknown> {
  /** 缓存键 */
  key: string

  /** 缓存数据 */
  data: T

  /** 时间戳 */
  timestamp: number

  /** TTL（毫秒） */
  ttl: number
}

/**
 * 统一事件数据
 */
export interface UnifiedEventData {
  /** 事件源 */
  source: string

  /** 原始事件名称 */
  originalEvent: string

  /** 事件数据 */
  data: unknown

  /** 时间戳 */
  timestamp: number
}

/**
 * 事件映射配置
 */
export type EventMapping = Map<string, string[]>

/**
 * 统一事件类型
 */
export type UnifiedEventType =
  | 'dm.updated'
  | 'friend.added'
  | 'friend.removed'
  | 'dm.request.received'
  | 'friend.accepted'
  | 'session.created'
  | 'session.deleted'
  | 'message.received'
  | 'message.sent'
  | 'room.updated'
  | 'list.updated'
  | 'presence.updated'

/**
 * Sliding Sync 配置
 */
export interface SlidingSyncConfig {
  /** 代理 URL */
  proxyBaseUrl: string

  /** 列表前缀 */
  listPrefix?: string

  /** 是否启用调试日志 */
  debug?: boolean

  /** 自动启动 */
  autoStart?: boolean

  /** 默认列表配置 */
  defaultLists?: Record<string, MSC3575List>

  /** 扩展配置 */
  extensions?: MSC3575Extensions
}

// ==================== SlidingSync Fallback Types ====================

/**
 * Sync mode type
 */
export type SyncMode = 'sliding-sync' | 'traditional' | 'hybrid'

/**
 * Server capability flags
 */
export interface ServerCapabilities {
  /** Server supports Sliding Sync (MSC3575) */
  slidingSync: boolean

  /** Server supports /sync endpoint */
  traditionalSync: boolean

  /** Server supports lazy loading */
  lazyLoading: boolean

  /** Server supports E2EE */
  e2ee: boolean

  /** Sliding Sync proxy URL (if available) */
  slidingSyncProxy?: string
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /** Auto-detect capabilities */
  autoDetect: boolean

  /** Force specific mode */
  forceMode?: SyncMode

  /** Enable hybrid mode */
  allowHybrid: boolean

  /** Fallback on error */
  fallbackOnError: boolean

  /** Max retries before fallback */
  maxRetries: number
}
