/**
 * Matrix Chat Sidebar - 类型定义
 */

import type { ComputedRef, VNodeChild } from 'vue'
import type { MatrixMember as BaseMatrixMember } from '@/types/matrix'

/** Matrix 成员 - 扩展类型 */
export interface MatrixMember extends BaseMatrixMember {
  // Inherits all properties from BaseMatrixMember including presence?: string
}

/** Matrix 文件 - 侧边栏专用类型（属性均为可选） */
export interface MatrixFile {
  eventId?: string
  id?: string
  name?: string
  url?: string
  mimeType?: string
  size?: number
  uploaderId?: string
  uploaderName?: string
  timestamp?: number
  type?: 'image' | 'video' | 'audio' | 'file'
  thumbnailUrl?: string
  roomId?: string
  senderId?: string
  content?: string
}

/** Matrix 房间 */
export interface MatrixRoom {
  id: string
  name: string
  topic?: string
  avatar?: string
  isEncrypted?: boolean
  isDirect?: boolean
  memberCount?: number
  createdBy?: string
  createdAt?: number
}

/** 虚拟列表项 */
export interface VirtualListItem {
  id: string
  type: 'header' | 'member'
  label?: string
  data?: MatrixMember
}

/** 搜索结果 */
export interface SearchResult {
  id: string
  type: 'message' | 'member' | 'file'
  roomId?: string
  userId?: string
  content?: string
  timestamp?: number
}

/** 房间设置 */
export interface RoomSettings {
  name: string
  topic: string
  avatar: string
  isPublic: boolean
  guestAccess: boolean
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
}

/** 通知设置 */
export interface NotificationSettings {
  allMessages: boolean
  mentionsOnly: boolean
  mute: boolean
}

/** 侧边栏标签页 */
export type SidebarTab = 'members' | 'files' | 'search' | 'info'

/** 文件过滤器 */
export type FileFilter = 'all' | 'image' | 'video' | 'audio' | 'file'

/** 成员分组 */
export interface MemberGroup {
  id: string
  label: string
  members: MatrixMember[]
}

/** 成员操作 */
export type MemberAction = 'message' | 'mention' | 'kick' | 'ban' | 'unban' | 'promote' | 'demote' | 'profile'

/** 成员菜单选项 */
export interface MemberMenuOption {
  label: string
  key: string
  type?: string
  disabled?: boolean
  icon?: () => VNodeChild
  [key: string]: unknown
}

/** 侧边栏状态 */
export interface SidebarState {
  activeTab: SidebarTab
  fileFilter: FileFilter
  searchQuery: string
  searching: boolean
  searchResults: SearchResult[]
  searchTotal: number
  showInviteModal: boolean
  showUserProfile: boolean
  showPowerLevelEditor: boolean
  showRoomSettingsModal: boolean
  selectedMember: MatrixMember | null
  members: MatrixMember[]
  files: MatrixFile[]
  roomInfo: MatrixRoom | null
  loadingFiles: boolean
  hasMoreFiles: boolean
  memberOffset: number
  memberLimit: number
  loadingMoreMembers: boolean
  hasMoreMembers: boolean
}

/** 加载状态 */
export interface LoadingState {
  loadingMembers: boolean
  loadingFiles: boolean
  searching: boolean
}

/** 分页状态 */
export interface PaginationState {
  memberOffset: number
  memberLimit: number
  hasMoreMembers: boolean
}

/** Composable 返回值 */
export interface UseMatrixChatSidebarReturn {
  // 状态
  state: SidebarState

  // 计算属性
  memberCount: ComputedRef<number>
  fileCount: ComputedRef<number>
  onlineMembers: ComputedRef<MatrixMember[]>
  offlineMembers: ComputedRef<MatrixMember[]>
  virtualMemberItems: ComputedRef<VirtualListItem[]>
  filteredFiles: ComputedRef<MatrixFile[]>
  memberOptions: ComputedRef<MemberMenuOption[]>
  isAdmin: ComputedRef<boolean>

  // 方法
  initialize: () => Promise<void>
  loadMoreMembers: () => Promise<void>
  loadFiles: () => Promise<void>
  searchRoom: (query: string) => Promise<void>
  handleMemberClick: (member: MatrixMember) => void
  handleMemberAction: (action: string, member: MatrixMember) => void
  handleInviteMember: () => void
  handleFileDownload: (file: MatrixFile) => void
  updateRoomSettings: (settings: Partial<RoomSettings>) => Promise<void>
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>

  // 清理
  cleanup: () => void
}
