// HuLa 组件相关类型定义

export interface HuLaError {
  code: number
  message: string
  type: 'error' | 'warning' | 'info'
  timestamp?: number
  details?: Record<string, unknown>
}

export interface WSMessage {
  id: string
  type: string
  data: unknown
  timestamp: number
  from?: string
  to?: string
  room_id?: string
}

export interface ImageSize {
  width: number
  height: number
  aspectRatio?: number
}

export interface ImageProps {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  fit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none'
  loading?: 'lazy' | 'eager'
  preview?: boolean
  previewSrc?: string
}

export interface RightMenu {
  label: string | Function
  icon?: string | Function
  action?: Function
  click?: Function
  disabled?: boolean | Function
  visible?: boolean | Function
  children?: RightMenu[] | Function
  type?: 'normal' | 'divider' | 'danger'
}

export interface SessionRightMenu extends RightMenu {
  sessionId?: string
  userId?: string
  isGroup?: boolean
}

export interface VirtualItem {
  index: number
  value: number
  size: number
  start: number
  end: number
}

export interface VirtualListOptions {
  containerHeight: number
  estimatedItemHeight: number
  overscan?: number
  scrollElement?: HTMLElement | Window
}

export interface DynamicListProps {
  items: Record<string, unknown>[]
  loading?: boolean
  finished?: boolean
  error?: string
  onLoad?: () => void
  onRefresh?: () => void
}

export interface LoadingProps {
  loading?: boolean
  size?: 'small' | 'medium' | 'large'
  description?: string
}

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  showSizePicker?: boolean
  showQuickJumper?: boolean
  pageSizes?: number[]
}

export interface AvatarProps {
  src?: string
  fallbackSrc?: string
  name?: string
  size?: number | 'small' | 'medium' | 'large'
  round?: boolean
  online?: boolean
}

export interface MessageItem {
  id: string
  type: string
  content: unknown
  sender: string
  timestamp: number
  status?: 'sending' | 'sent' | 'failed' | 'read'
  room_id: string
}

export interface MessageTypeEnum {
  TEXT: 'text'
  IMAGE: 'image'
  VIDEO: 'video'
  AUDIO: 'audio'
  FILE: 'file'
  EMOJI: 'emoji'
  LOCATION: 'location'
  SYSTEM: 'system'
}

export interface RTCState {
  isActive: boolean
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  participants: string[]
  roomId?: string
}

export interface KeyBackupState {
  enabled: boolean
  version?: number
  algorithm?: string
  lastBackupTime?: number
  backupInfo?: Record<string, unknown>
}

export interface MatrixRoom {
  id: string
  name: string
  topic?: string
  avatar?: string
  type: 'private' | 'public' | 'direct'
  members: string[]
  encryption?: boolean
  isSpace?: boolean
}

export interface MatrixUser {
  id: string
  displayName?: string
  avatar?: string
  presence?: 'online' | 'offline' | 'unavailable'
  lastActive?: number
  devices?: DeviceInfo[]
}

export interface FileUploadOptions {
  file: File
  roomId?: string
  onProgress?: (progress: number) => void
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}

export interface FormRule {
  key: string
  required?: boolean
  message?: string
  pattern?: RegExp
  validator?: (value: unknown) => boolean | string
}

export interface TableColumn {
  key: string
  title: string
  width?: number
  sortable?: boolean
  render?: (value: unknown, record: Record<string, unknown>) => unknown
}

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ThemeColor = string

export interface DeviceInfo {
  deviceId: string
  displayName: string
  lastSeen?: number
  isCurrentDevice?: boolean
  isVerified?: boolean
}

export interface NotificationItem {
  id: string
  type: 'message' | 'friend' | 'group' | 'system'
  title: string
  content: string
  timestamp: number
  read: boolean
  action?: {
    label: string
    callback: () => void
  }
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  category: 'memory' | 'cpu' | 'network' | 'render'
}
