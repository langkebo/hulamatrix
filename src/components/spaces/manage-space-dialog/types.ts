/**
 * Manage Space Dialog - 类型定义
 */

import type { Ref, ComputedRef } from 'vue'

/** 角色预设 */
export interface RolePreset {
  name: string
  label: string
  description: string
  permissions: string[]
}

/** 成员 */
export interface Member {
  userId?: string
  id?: string
  name?: string
  avatar?: string
  role?: string
  status?: string
  joinedAt?: number
  isOnline?: boolean
  powerLevel?: number
  membership?: string
  displayname?: string
  avatarUrl?: string
}

/** 空间接口 (对话框兼容) */
export interface Space {
  id: string
  name: string
  topic?: string
  description?: string
  avatar?: string
  memberCount?: number
  roomCount?: number
  created?: number
  lastActivity?: number
  members?: readonly unknown[]
  canAdmin?: boolean
  isPublic?: boolean
  isArchived?: boolean
  tags?: readonly string[]
  notifications?: {
    highlightCount: number
    notificationCount: number
  }
  settings?: {
    allowGuests?: boolean
    historyVisibility?: string
    joinRule?: string
  }
  joinRule?: string
}

/** 基本信息表单 */
export interface BasicForm {
  name: string
  topic: string
  description: string
  tags: string[]
}

/** 隐私设置表单 */
export interface PrivacyForm {
  visibility: 'public' | 'private'
  joinRule: 'open' | 'approval' | 'invite'
  allowSearch: boolean
  showMemberList: boolean
}

/** 权限设置表单 */
export interface PermissionsForm {
  defaultPermissions: {
    canRead: boolean
    canPost: boolean
    canUpload: boolean
    canInvite: boolean
    canCreateRoom: boolean
  }
  advancedPermissions: {
    canModerate: boolean
    canManageRooms: boolean
    canManageSpace: boolean
  }
}

/** 通知设置表单 */
export interface NotificationsForm {
  space: {
    newMembers: boolean
    memberLeft: boolean
    spaceUpdated: boolean
    roomCreated: boolean
  }
  messages: {
    level: string
    mentions: boolean
    keywords: boolean
    keywordList: string[]
  }
  delivery: {
    inApp: boolean
    email: boolean
    push: boolean
    sound: boolean
  }
}

/** 高级设置表单 */
export interface AdvancedForm {
  contentModeration: {
    enabled: boolean
    requireApproval: boolean
    autoModerate: boolean
    blockedWords: string[]
  }
  dataManagement: {
    messageRetention: string
    fileRetention: string
    allowExport: boolean
  }
}

/** 邀请表单 */
export interface InviteForm {
  emails: string[]
  message: string
  permissions: string
}

/** 删除确认表单 */
export interface DeleteForm {
  confirm: string
}

/** 对话框标签页 */
export type DialogTab = 'basic' | 'privacy' | 'permissions' | 'members' | 'notifications' | 'advanced'

/** Composable 返回值 */
export interface UseManageSpaceDialogReturn {
  // 状态
  activeTab: Ref<string>
  memberSearchQuery: Ref<string>
  showInviteDialog: Ref<boolean>
  showDeleteConfirm: Ref<boolean>
  selectedMembers: Ref<string[]>
  selectedRole: Ref<string>
  isSaving: Ref<boolean>
  isInviting: Ref<boolean>
  isDeleting: Ref<boolean>

  // 表单引用
  basicFormRef: Ref<any>
  inviteFormRef: Ref<any>
  deleteFormRef: Ref<any>

  // 表单数据
  basicForm: BasicForm
  privacyForm: PrivacyForm
  permissionsForm: PermissionsForm
  notificationsForm: NotificationsForm
  advancedForm: AdvancedForm
  inviteForm: InviteForm
  deleteForm: DeleteForm

  // 选项数据
  notificationLevels: { label: string; value: string }[]
  messageRetentionOptions: { label: string; value: string }[]
  fileRetentionOptions: { label: string; value: string }[]
  permissionPresets: { label: string; value: string }[]
  rolePresets: RolePreset[]
  bulkActions: { label: string; key: string }[]

  // 计算属性
  filteredMembers: ComputedRef<Member[]>

  // 方法
  formatDate: (timestamp?: number) => string
  getRoleType: (role: string) => string
  getRoleLabel: (role: string) => string
  getPermissionLabel: (permission: string) => string
  toggleMemberSelection: (userId: string) => void
  handleMemberAction: (key: string) => void
  handleBulkAction: (key: string) => void
  applyRolePreset: (role: RolePreset) => void
  handleCancel: () => void
  handleSave: () => Promise<void>
  handleSendInvites: () => Promise<void>
  handleArchiveSpace: () => void
  handleDeleteSpace: () => Promise<void>
  loadFormData: () => void

  // 验证规则
  basicRules: Record<string, any>
  inviteRules: Record<string, any>
  deleteRules: Record<string, any>
}
