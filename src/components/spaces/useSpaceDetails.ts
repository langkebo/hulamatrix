/**
 * Space Details - 通用逻辑 Composable
 */

import { ref, computed, type Component, type Ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import type {
  Room,
  Member,
  Activity,
  BasicSettingsForm,
  PrivacySettingsForm,
  NotificationSettingsForm,
  CreateRoomForm,
  SpaceTabType,
  SpaceAction,
  RoomAction,
  MemberAction,
  NaiveType
} from './types'
import type { Space } from '@/hooks/useMatrixSpaces'

export function useSpaceDetails(space: Ref<Space | null>, emit: any) {
  // ==================== Composables ====================
  const dialog = useDialog()
  const message = useMessage()

  // ==================== 状态 ====================
  const activeTab = ref<SpaceTabType>('overview')
  const roomSearchQuery = ref('')
  const memberSearchQuery = ref('')
  const showCreateRoomDialog = ref(false)
  const isJoining = ref(false)
  const isSaving = ref(false)
  const isCreatingRoom = ref(false)

  // ==================== 表单 ====================
  const basicForm = ref<BasicSettingsForm>({
    name: '',
    topic: '',
    description: '',
    avatar: ''
  })

  const privacyForm = ref<PrivacySettingsForm>({
    isPublic: false,
    guestAllowed: false,
    historyVisible: false
  })

  const notificationForm = ref<NotificationSettingsForm>({
    allRooms: false,
    keywords: [],
    ignoreMentions: false
  })

  const roomForm = ref<CreateRoomForm>({
    name: '',
    topic: '',
    type: 'room',
    isPublic: false
  })

  const basicFormRef = ref()
  const roomFormRef = ref()

  // ==================== 常量 ====================
  const roomTypeOptions = [
    { label: '普通房间', value: 'room' },
    { label: '空间', value: 'space' }
  ]

  // ==================== 计算属性 ====================
  const safeSpace = computed(() => {
    if (!space.value) {
      return {
        id: '',
        name: '未知空间',
        topic: '',
        description: '',
        avatar: '',
        isPublic: false,
        isArchived: false,
        isFavorite: false,
        isJoined: false,
        isAdmin: false,
        isOwner: false,
        memberCount: 0,
        roomCount: 0,
        created: Date.now(),
        lastActivity: Date.now(),
        notifications: {
          notificationCount: 0,
          highlightCount: 0
        },
        tags: [],
        canonicalAlias: ''
      }
    }

    return {
      ...space.value,
      avatar: space.value?.avatar || '',
      name: space.value?.name || '未知空间',
      memberCount: space.value?.memberCount || 0,
      roomCount: space.value?.roomCount || 0,
      created: space.value?.created || Date.now(),
      lastActivity: space.value?.lastActivity || Date.now(),
      tags: space.value?.tags || [],
      isPublic: space.value?.isPublic || false,
      isArchived: space.value?.isArchived || false,
      isFavorite: space.value?.isFavorite || false,
      isJoined: space.value?.isJoined || false,
      isAdmin: space.value?.isAdmin || false,
      isOwner: space.value?.isOwner || false
    }
  })

  // 过滤后的房间列表
  const filteredRooms = computed<Room[]>(() => {
    if (!roomSearchQuery.value) return []

    const query = roomSearchQuery.value.toLowerCase()
    // 这里应该从实际的房间列表中过滤
    return []
  })

  // 过滤后的成员列表
  const filteredMembers = computed<Member[]>(() => {
    if (!memberSearchQuery.value) return []

    const query = memberSearchQuery.value.toLowerCase()
    // 这里应该从实际的成员列表中过滤
    return []
  })

  // 模拟最近活动
  const recentActivities = ref<Activity[]>([
    {
      id: '1',
      type: 'room_created',
      description: '创建了新房间',
      timestamp: Date.now() - 3600000
    },
    {
      id: '2',
      type: 'member_joined',
      description: '新成员加入',
      timestamp: Date.now() - 7200000
    }
  ])

  // ==================== 格式化函数 ====================
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatLastActivity = (): string => {
    if (!safeSpace.value.lastActivity) return '未知'

    const now = Date.now()
    const diff = now - safeSpace.value.lastActivity

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

    return formatDate(safeSpace.value.lastActivity)
  }

  const formatActivityTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

    return formatDate(timestamp)
  }

  const formatLastMessage = (message: { content?: string } | string): string => {
    if (typeof message === 'string') return message
    return message.content || '无消息'
  }

  // ==================== 辅助函数 ====================
  const getActiveMembersCount = (): number => {
    // 这里应该计算活跃成员数量
    return 0
  }

  const getRoomIcon = (type: string): Component => {
    // 这里应该返回对应的图标组件
    return {} as Component
  }

  const getRoleType = (role: string): NaiveType => {
    const roleMap: Record<string, NaiveType> = {
      admin: 'error',
      moderator: 'warning',
      member: 'default'
    }
    return roleMap[role] || 'default'
  }

  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      moderator: '版主',
      member: '成员'
    }
    return roleMap[role] || '成员'
  }

  // ==================== 动作配置 ====================
  const getSpaceActions = () => {
    return [
      {
        label: '空间设置',
        key: 'settings',
        disabled: !safeSpace.value.isAdmin
      },
      {
        label: '邀请成员',
        key: 'invite',
        disabled: !safeSpace.value.isJoined
      },
      {
        label: safeSpace.value.isFavorite ? '取消收藏' : '收藏空间',
        key: 'toggle_favorite'
      },
      {
        label: '复制空间链接',
        key: 'copy_link'
      },
      {
        label: safeSpace.value.isArchived ? '取消归档' : '归档空间',
        key: safeSpace.value.isArchived ? 'unarchive' : 'archive'
      },
      {
        label: '退出空间',
        key: 'leave',
        disabled: !safeSpace.value.isJoined
      }
    ]
  }

  const getRoomActions = (room: Room) => {
    return [
      {
        label: '查看房间',
        key: 'view'
      },
      {
        label: room.isFavorite ? '取消收藏' : '收藏',
        key: 'favorite'
      },
      {
        label: '房间设置',
        key: 'settings',
        disabled: !safeSpace.value.isAdmin
      },
      {
        label: '离开房间',
        key: 'leave',
        disabled: !room.isJoined
      }
    ]
  }

  const getMemberActions = (member: Member) => {
    return [
      {
        label: '发送消息',
        key: 'message'
      },
      {
        label: member.role === 'admin' ? '降级为版主' : '提升为管理员',
        key: 'promote',
        disabled: !safeSpace.value.isAdmin || member.id === safeSpace.value.id
      },
      {
        label: '移除成员',
        key: 'remove',
        disabled: !safeSpace.value.isAdmin || member.id === safeSpace.value.id
      }
    ]
  }

  // ==================== 事件处理 ====================
  const handleJoin = async () => {
    isJoining.value = true
    try {
      emit('join', safeSpace.value.id)
      message.success('已加入空间')
    } catch (error) {
      message.error('加入空间失败')
    } finally {
      isJoining.value = false
    }
  }

  const handleSpaceAction = async (action: SpaceAction) => {
    switch (action) {
      case 'settings':
        activeTab.value = 'settings'
        break
      case 'invite':
        emit('invite', safeSpace.value.id)
        break
      case 'archive':
        handleArchiveSpace()
        break
      case 'unarchive':
        handleUnarchiveSpace()
        break
      case 'leave':
        handleLeaveSpace()
        break
      case 'copy_link':
        await copySpaceLink()
        break
      case 'toggle_favorite':
        emit('toggle-favorite', safeSpace.value.id)
        break
    }
  }

  const handleViewRoom = (room: Room) => {
    emit('view-room', room.id)
  }

  const handleRoomAction = (action: RoomAction, _option: unknown) => {
    // 处理房间动作
    emit('room-action', { action, room: _option })
  }

  const handleCreateRoom = () => {
    showCreateRoomDialog.value = true
  }

  const handleCreateRoomConfirm = async () => {
    isCreatingRoom.value = true
    try {
      emit('create-room', {
        spaceId: safeSpace.value.id,
        ...roomForm.value
      })
      showCreateRoomDialog.value = false
      roomForm.value = {
        name: '',
        topic: '',
        type: 'room',
        isPublic: false
      }
      message.success('房间创建成功')
    } catch (error) {
      message.error('创建房间失败')
    } finally {
      isCreatingRoom.value = false
    }
  }

  const handleInviteMembers = () => {
    emit('invite-members', safeSpace.value.id)
  }

  const handleMemberAction = (action: MemberAction, _option: unknown) => {
    emit('member-action', { action, member: _option })
  }

  const handleSaveSettings = async () => {
    isSaving.value = true
    try {
      emit('save-settings', {
        spaceId: safeSpace.value.id,
        basic: basicForm.value,
        privacy: privacyForm.value,
        notification: notificationForm.value
      })
      message.success('设置已保存')
    } catch (error) {
      message.error('保存设置失败')
    } finally {
      isSaving.value = false
    }
  }

  const handleResetSettings = () => {
    basicForm.value = {
      name: safeSpace.value.name,
      topic: safeSpace.value.topic || '',
      description: safeSpace.value.description || '',
      avatar: safeSpace.value.avatar
    }
  }

  const copySpaceLink = async () => {
    const link = `${window.location.origin}/#/space/${safeSpace.value.id}`
    try {
      await navigator.clipboard.writeText(link)
      message.success('链接已复制到剪贴板')
    } catch (error) {
      message.error('复制链接失败')
    }
  }

  const handleArchiveSpace = async () => {
    dialog.warning({
      title: '归档空间',
      content: `确定要归档空间 "${safeSpace.value.name}" 吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          emit('archive', safeSpace.value.id)
          message.success('空间已归档')
        } catch (error) {
          message.error('归档空间失败')
        }
      }
    })
  }

  const handleUnarchiveSpace = async () => {
    try {
      emit('unarchive', safeSpace.value.id)
      message.success('空间已取消归档')
    } catch (error) {
      message.error('取消归档失败')
    }
  }

  const handleLeaveSpace = async () => {
    dialog.warning({
      title: '退出空间',
      content: `确定要退出空间 "${safeSpace.value.name}" 吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          emit('leave', safeSpace.value.id)
          message.success('已退出空间')
        } catch (error) {
          message.error('退出空间失败')
        }
      }
    })
  }

  const handleClose = () => {
    emit('close')
  }

  // ==================== 表单验证规则 ====================
  const basicRules = {
    name: {
      required: true,
      message: '请输入空间名称',
      trigger: 'blur'
    }
  }

  const roomRules = {
    name: {
      required: true,
      message: '请输入房间名称',
      trigger: 'blur'
    }
  }

  // ==================== 返回 ====================
  return {
    // 状态
    activeTab,
    roomSearchQuery,
    memberSearchQuery,
    showCreateRoomDialog,
    isJoining,
    isSaving,
    isCreatingRoom,

    // 表单
    basicForm,
    privacyForm,
    notificationForm,
    roomForm,
    basicFormRef,
    roomFormRef,

    // 常量
    roomTypeOptions,

    // 计算属性
    safeSpace,
    filteredRooms,
    filteredMembers,
    recentActivities,

    // 格式化函数
    formatDate,
    formatLastActivity,
    formatActivityTime,
    formatLastMessage,

    // 辅助函数
    getActiveMembersCount,
    getRoomIcon,
    getRoleType,
    getRoleLabel,

    // 动作配置
    getSpaceActions,
    getRoomActions,
    getMemberActions,

    // 事件处理
    handleJoin,
    handleSpaceAction,
    handleViewRoom,
    handleRoomAction,
    handleCreateRoom,
    handleCreateRoomConfirm,
    handleInviteMembers,
    handleMemberAction,
    handleSaveSettings,
    handleResetSettings,
    copySpaceLink,
    handleArchiveSpace,
    handleUnarchiveSpace,
    handleLeaveSpace,
    handleClose,

    // 表单验证
    basicRules,
    roomRules
  }
}
