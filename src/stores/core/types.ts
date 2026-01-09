/**
 * Core Store - Type Definitions
 * All type definitions for the core application store
 */

import type { MatrixClient } from 'matrix-js-sdk'

// ========== UI 相关类型 ==========
/**
 * MenuItem 类型定义
 */
export interface MenuItem {
  url: string
  icon: string
  iconAction?: string
  state?: string
  isAdd?: boolean
  dot?: boolean
  progress?: number
  miniShow?: boolean
  title?: string
  shortTitle?: string
}

// ========== 用户和认证相关 ==========
export interface UserProfile {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'away' | 'busy'
  lastActive?: number
}

export interface AuthState {
  isAuthenticated: boolean
  accessToken?: string
  deviceId?: string
  userId?: string
  homeserver?: string
  loginHistory: Array<{
    timestamp: number
    deviceId: string
    ipAddress?: string
  }>
}

export interface MatrixLoginResponse {
  access_token: string
  user_id: string
  device_id: string
  home_server?: string
  refresh_token?: string
  [key: string]: unknown
}

export interface MatrixUpdateTokenParams {
  token: string
  refresh_token?: string
  [key: string]: unknown
}

export interface MatrixUserStore {
  userInfo?: {
    value: {
      uid?: string
      name?: string
      avatar?: string
    }
  }
}

// ========== 聊天和消息相关 ==========
export interface ChatMessage {
  id: string
  roomId: string
  sender: string
  content: Record<string, unknown>
  timestamp: number
  type: 'text' | 'image' | 'file' | 'audio' | 'video'
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  reactions?: Record<string, string[]>
  isEncrypted?: boolean
}

export interface Room {
  id: string
  name: string
  topic?: string
  avatar?: string
  type: 'dm' | 'group' | 'space'
  members: string[]
  unreadCount: number
  highlightCount: number
  notifications: 'all' | 'mentions' | 'none'
  isEncrypted: boolean
  lastMessage?: ChatMessage
  tags?: string[]
  creationTime?: number
  joinRule?: string
}

// ========== 媒体和文件相关 ==========
export interface MediaFile {
  id: string
  name: string
  type: string
  size: number
  url?: string
  thumbnailUrl?: string
  uploadProgress?: number
  downloadProgress?: number
  encryptionInfo?: Record<string, unknown>
  metadata?: {
    width?: number
    height?: number
    duration?: number
    mimeType?: string
  }
}

export interface DownloadQueue {
  pending: MediaFile[]
  active: MediaFile[]
  completed: MediaFile[]
  failed: MediaFile[]
  paused: boolean
}

export interface MatrixUploadResponse {
  content_uri: string
  [key: string]: unknown
}

export interface MatrixFileProgress {
  loaded: number
  total: number
}

export interface MatrixContentInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  [key: string]: unknown
}

// ========== 通知和推送相关 ==========
export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  conditions: Record<string, unknown>[]
  actions: Record<string, unknown>[]
  priority: number
}

export interface NotificationSettings {
  global: {
    enabled: boolean
    soundEnabled: boolean
    doNotDisturb: boolean
    doNotDisturbStart?: string
    doNotDisturbEnd?: string
  }
  room: Record<
    string,
    {
      enabled: boolean
      mentionsOnly: boolean
      keywords: string[]
    }
  >
  rules: NotificationRule[]
}

// ========== RTC通话相关 ==========
export interface CallState {
  isInCall: boolean
  callType?: 'audio' | 'video'
  remoteUserId?: string
  roomId?: string
  isMuted: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  callStats?: {
    duration: number
    bitrate: number
    packetLoss: number
  }
}

// ========== E2EE设备相关 ==========
export interface Device {
  deviceId: string
  displayName: string
  avatar?: string
  lastSeen?: number
  lastActive?: number
  firstRegistered?: number
  userId?: string
  keys?: {
    ed25519?: string
    curve25519?: string
  }
  algorithms?: string[]
  verified?: boolean
  blocked?: boolean
  currentDevice?: boolean
  roomIds?: string[]
}

// ========== 缓存相关 ==========
export interface CacheSettings {
  maxSize: number // MB
  ttl: number // hours
  compressionEnabled: boolean
  paths: {
    cache: string
    temp: string
    downloads: string
  }
}

export interface CacheMetrics {
  totalSize: number
  itemCount: number
  hitRate: number
  lastCleanup: number
}

export type CacheClearType = 'all' | 'messages' | 'rooms' | 'users' | 'media'

export interface CacheClearOptions {
  type?: CacheClearType
  roomId?: string
}

// ========== 搜索相关 ==========
export interface SearchState {
  query: string
  results: Array<{
    id: string
    type: 'message' | 'room' | 'user'
    title: string
    content: string
    roomId: string
    timestamp: number
    highlights?: string[]
  }>
  filters: {
    roomIds?: string[]
    userIds?: string[]
    dateRange?: [number, number]
    messageTypes?: string[]
  }
  loading: boolean
  history: string[]
}

export interface MatrixSearchResult {
  result: {
    event_id: string
    room_id: string
    sender: string
    type: string
    content: {
      body?: string
      url?: string
      info?: MatrixContentInfo
      [key: string]: unknown
    }
    origin_server_ts: number
    [key: string]: unknown
  }
  rank?: number
  [key: string]: unknown
}

export interface MatrixSearchResponse {
  results?: MatrixSearchResult[]
  [key: string]: unknown
}

export interface MatrixUserDirectoryResult {
  user_id: string
  display_name?: string
  avatar_url?: string
  [key: string]: unknown
}

export interface MatrixUserDirectoryResponse {
  results?: MatrixUserDirectoryResult[]
  limited?: boolean
  [key: string]: unknown
}

export interface MatrixPublicRoom {
  room_id: string
  name?: string
  avatar_url?: string
  topic?: string
  num_joined_members?: number
  world_readable?: boolean
  guest_can_join?: boolean
  [key: string]: unknown
}

export interface MatrixPublicRoomsResponse {
  chunk?: MatrixPublicRoom[]
  next_batch?: string
  prev_batch?: string
  total_room_count_estimate?: number
  [key: string]: unknown
}

export interface RoomSearchResult {
  id: string
  name: string
  avatar: string
  type: 'public' | 'private' | 'dm' | 'group' | 'space'
  memberCount: number
  topic: string
  lastMessage: unknown | null
  unreadCount: number
}

// ========== 系统设置相关 ==========
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  fontSize: 'small' | 'medium' | 'large'
  messageDensity: 'compact' | 'comfortable' | 'spacious'
  autoPlayGifs: boolean
  showReadReceipts: boolean
  showTypingNotifications: boolean
  enableEncryption: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  cache: CacheSettings
  notifications: NotificationSettings
}

// ========== LRU 缓存常量 ==========
export const MAX_RECENT_ROOMS = 50 // 保留最近使用的 50 个房间
export const PRELOAD_ROOMS_COUNT = 5 // 预加载最近 5 个活跃房间的消息

// ========== 登录凭证类型 ==========
export interface LoginCredentials {
  username: string
  password: string
  homeserver: string
}

// ========== Store状态类型 ==========
export interface CoreStoreState {
  client: MatrixClient | null
  isInitialized: boolean
  isLoading: boolean
  auth: AuthState
  currentUser: UserProfile | null
  users: Map<string, UserProfile>
  friends: string[]
  blockedUsers: string[]
  rooms: Map<string, Room>
  messages: Map<string, ChatMessage[]>
  currentRoomId: string | null
  typingUsers: Map<string, Set<string>>
  recentRooms: string[]
  mediaFiles: Map<string, MediaFile>
  downloadQueue: DownloadQueue
  notifications: NotificationSettings
  callState: CallState
  cacheSettings: CacheSettings
  cacheMetrics: CacheMetrics
  search: SearchState
  settings: AppSettings
  menuTop: MenuItem[]
}
