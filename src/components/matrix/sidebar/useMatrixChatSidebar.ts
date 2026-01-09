/**
 * Matrix Chat Sidebar - Composable
 *
 * 提取 MatrixChatSidebar 组件的业务逻辑
 */

import { ref, computed, type Component } from 'vue'
import { Photo, Video, Music, File as FileIcon } from '@vicons/tabler'
import { useMessage } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { matrixRoomManager } from '@/matrix/services/room/manager'
import { logger } from '@/utils/logger'
import { sanitizeHighlightHtml } from '@/utils/htmlSanitizer'
import { useUserStore } from '@/stores/user'
import type {
  MatrixMember,
  MatrixFile,
  MatrixRoom,
  SearchResult,
  SidebarTab,
  FileFilter,
  VirtualListItem,
  MemberMenuOption
} from './types'

interface Options {
  roomId: string
  onScrollToMessage?: (eventId: string) => void
  onClose?: () => void
}

export function useMatrixChatSidebar(options: Options) {
  const message = useMessage()
  const userStore = useUserStore()

  // ============ 状态管理 ============
  const activeTab = ref<SidebarTab>('members')
  const fileFilter = ref<FileFilter>('all')
  const searchQuery = ref('')
  const searching = ref(false)
  const searchResults = ref<SearchResult[]>([])
  const searchTotal = ref(0)
  const showInviteModal = ref(false)
  const showUserProfile = ref(false)
  const showPowerLevelEditor = ref(false)
  const showRoomSettingsModal = ref(false)
  const selectedMember = ref<MatrixMember | null>(null)
  const members = ref<MatrixMember[]>([])
  const files = ref<MatrixFile[]>([])
  const roomInfo = ref<MatrixRoom | null>(null)
  const loadingFiles = ref(false)
  const hasMoreFiles = ref(false)

  // 分页状态
  const memberOffset = ref(0)
  const memberLimit = ref(50)
  const loadingMoreMembers = ref(false)
  const hasMoreMembers = ref(false)

  // 搜索选项
  const _searchOptions = ref({
    scope: ['messages'],
    timeRange: 'all',
    sender: null
  })

  // 房间设置
  const _roomSettings = ref({
    encryption: true,
    allowInvites: true,
    guestCanSeeHistory: false,
    joinRule: false
  })

  const _notificationSettings = ref({
    enabled: true,
    sound: true,
    mentionAll: true
  })

  // ============ 计算属性 ============
  const memberCount = computed(() => members.value.length)
  const fileCount = computed(() => files.value.length)

  const onlineMembers = computed<MatrixMember[]>(() => members.value.filter((m) => m.presence === 'online'))

  const offlineMembers = computed<MatrixMember[]>(() =>
    members.value.filter((m) => !m.presence || m.presence !== 'online')
  )

  const virtualMemberItems = computed<VirtualListItem[]>(() => {
    const items: VirtualListItem[] = []

    if (onlineMembers.value.length > 0) {
      items.push({
        type: 'header',
        id: 'header-online',
        label: `在线 (${onlineMembers.value.length})`
      })
      for (const member of onlineMembers.value) {
        items.push({
          type: 'member',
          id: member.userId,
          data: member
        })
      }
    }

    if (offlineMembers.value.length > 0) {
      items.push({
        type: 'header',
        id: 'header-offline',
        label: `离线 (${offlineMembers.value.length})`
      })
      for (const member of offlineMembers.value) {
        items.push({
          type: 'member',
          id: member.userId,
          data: member
        })
      }
    }

    return items
  })

  const filteredFiles = computed(() => {
    if (fileFilter.value === 'all') return files.value

    const mimeTypeMap = {
      image: ['image/'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
      video: ['video/'],
      audio: ['audio/']
    }

    const mimeTypes = mimeTypeMap[fileFilter.value as keyof typeof mimeTypeMap]
    if (!mimeTypes) return files.value

    return files.value.filter((file) => mimeTypes.some((mime) => (file.mimeType || '').startsWith(mime)))
  })

  const memberOptions = computed(() =>
    members.value.map((member) => ({
      label: member.displayName || member.userId,
      value: member.userId
    }))
  )

  const isAdmin = computed(() => {
    const currentUserId = userStore.userInfo?.uid
    const currentUser = members.value.find((m) => m.userId === currentUserId)
    return currentUser?.powerLevel && currentUser.powerLevel >= 50
  })

  // ============ 成员管理 ============
  const loadMembers = async () => {
    try {
      memberOffset.value = 0
      const result = await matrixRoomManager.getRoomMembersPaginated(options.roomId, {
        limit: memberLimit.value,
        offset: 0,
        includeOffline: true
      })

      members.value = result.members
      hasMoreMembers.value = result.hasMore

      logger.info('[useMatrixChatSidebar] Loaded members', {
        count: result.members.length,
        total: result.total,
        hasMore: result.hasMore
      })
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to load members:', error)
      message.error('加载成员列表失败')
    }
  }

  const loadMoreMembers = async () => {
    if (loadingMoreMembers.value || !hasMoreMembers.value) return

    loadingMoreMembers.value = true
    try {
      const newOffset = memberOffset.value + memberLimit.value
      const result = await matrixRoomManager.getRoomMembersPaginated(options.roomId, {
        limit: memberLimit.value,
        offset: newOffset,
        includeOffline: true
      })

      members.value = [...members.value, ...result.members]
      memberOffset.value = newOffset
      hasMoreMembers.value = result.hasMore

      logger.info('[useMatrixChatSidebar] Loaded more members', {
        added: result.members.length,
        total: members.value.length
      })
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to load more members:', error)
      message.error('加载更多成员失败')
    } finally {
      loadingMoreMembers.value = false
    }
  }

  const handleMemberScroll = (e: Event) => {
    const target = e.target as HTMLElement
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight

    if (scrollBottom < 100 && hasMoreMembers.value && !loadingMoreMembers.value) {
      loadMoreMembers()
    }
  }

  const getMemberInitials = (member: MatrixMember): string => {
    const name = member.displayName || member.userId
    if (!name) return '?'

    const names = name.split(' ')
    if (names.length >= 2) {
      return (names[0]?.[0] || '') + (names[1]?.[0] || '')
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getMemberMenuOptions = (member: MatrixMember): MemberMenuOption[] => {
    const menuOptions: MemberMenuOption[] = [
      { label: '查看资料', key: 'profile' },
      { label: '发送私信', key: 'dm' }
    ]

    const currentUserId = userStore.userInfo?.uid
    if (isAdmin.value && member.userId !== currentUserId) {
      menuOptions.push({ label: '设为管理员', key: 'admin' }, { label: '移出房间', key: 'remove' })
    }

    return menuOptions
  }

  const handleMemberClick = (member: MatrixMember) => {
    selectedMember.value = member
    showUserProfile.value = true
  }

  const handleMemberAction = async (action: string, member: MatrixMember) => {
    switch (action) {
      case 'profile':
        selectedMember.value = member
        showUserProfile.value = true
        break
      case 'dm':
        await handleStartDM(member.userId)
        break
      case 'admin':
        showPowerLevelEditor.value = true
        break
      case 'remove':
        await handleKickMember(member)
        break
    }
  }

  const handleStartDM = async (userId: string) => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        message.error('Matrix 客户端未初始化')
        return
      }

      const createRoomMethod = client.createRoom as
        | ((options: Record<string, unknown>) => Promise<{ room_id: string }>)
        | undefined

      if (!createRoomMethod) {
        message.error('创建私聊功能不可用')
        return
      }

      // 检查是否已存在 DM 房间
      const getRoomsMethod = client.getRooms as (() => Record<string, unknown>[]) | undefined
      const rooms = getRoomsMethod?.() || []

      let existingRoomId: string | null = null
      for (const room of rooms) {
        const r = room as Record<string, unknown>
        const getRoomMembersMethod = r.getJoinedMembers as (() => MatrixMember[]) | undefined
        const roomMembers = getRoomMembersMethod?.() || []

        if (roomMembers.length === 2) {
          const hasTargetUser = roomMembers.some((m: MatrixMember) => m.userId === userId)
          const hasCurrentUser = roomMembers.some((m: MatrixMember) => m.userId === userStore.userInfo?.uid)
          if (hasTargetUser && hasCurrentUser) {
            const roomIdMethod = r.roomId as (() => string) | undefined
            existingRoomId = roomIdMethod?.() || null
            break
          }
        }
      }

      if (existingRoomId) {
        message.success('已打开私聊')
      } else {
        const result = await createRoomMethod({
          preset: 'trusted_private_chat',
          invite: [userId],
          is_direct: true
        })

        message.success('已创建私聊')
        logger.info('[useMatrixChatSidebar] Created DM room', {
          roomId: result.room_id,
          userId
        })
      }
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to start DM:', error)
      message.error('创建私聊失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleKickMember = async (member: MatrixMember) => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        message.error('Matrix 客户端未初始化')
        return
      }

      const kickMethod = client.kick as
        | ((roomId: string, userId: string, reason?: string) => Promise<unknown>)
        | undefined

      if (!kickMethod) {
        message.error('移除成员功能不可用')
        return
      }

      await kickMethod(options.roomId, member.userId)
      message.success(`${member.displayName || member.userId} 已被移除`)

      await loadMembers()
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to kick member:', error)
      message.error('移除成员失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleInviteMember = () => {
    showInviteModal.value = true
  }

  const handleInviteSent = () => {
    showInviteModal.value = false
    message.success('邀请已发送')
  }

  // ============ 文件管理 ============
  const loadFiles = async () => {
    try {
      loadingFiles.value = true

      // TODO: 实现文件加载逻辑
      // 这里应该从 Matrix 房间事件中获取所有文件类型的消息
      files.value = []

      logger.info('[useMatrixChatSidebar] Loaded files', {
        count: files.value.length
      })
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to load files:', error)
      message.error('加载文件列表失败')
    } finally {
      loadingFiles.value = false
    }
  }

  const getFileIcon = (mimeType?: string): Component => {
    const mt = mimeType || ''
    if (mt.startsWith('image/')) return Photo
    if (mt.startsWith('video/')) return Video
    if (mt.startsWith('audio/')) return Music
    return FileIcon
  }

  const handleFileClick = async (file: MatrixFile) => {
    try {
      if (file.url) {
        window.open(file.url, '_blank')
      } else {
        message.warning('文件链接不可用')
      }
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to open file:', error)
      message.error('打开文件失败')
    }
  }

  const handleFileDownload = async (file: MatrixFile) => {
    try {
      if (file.url) {
        const link = document.createElement('a')
        link.href = file.url
        link.download = file.name || 'download'
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success('开始下载文件')
      } else {
        message.warning('文件链接不可用')
      }
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to download file:', error)
      message.error('下载文件失败')
    }
  }

  const formatFileSize = (bytes: number | undefined): string => {
    if (bytes === undefined) return '未知大小'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatTime = (timestamp: number | undefined): string => {
    if (timestamp === undefined) return '未知时间'
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ============ 搜索功能 ============
  const searchRoom = async (query: string) => {
    if (!query.trim()) return

    searching.value = true
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        message.error('Matrix 客户端未初始化')
        return
      }

      const searchMethod = client.searchRooms as
        | ((options: {
            roomFilter?: { roomId: string }[]
            searchTerms: { rooms?: string[]; text?: string }
          }) => Promise<{
            results?: Array<{
              result?: {
                event_id?: string
                room_id?: string
                sender?: string
                origin_server_ts?: number
                type?: string
                content?: Record<string, unknown>
              }
            }>
            count?: number
          }>)
        | undefined

      if (!searchMethod) {
        message.error('搜索功能不可用')
        return
      }

      const result = await searchMethod({
        roomFilter: [{ roomId: options.roomId }],
        searchTerms: {
          rooms: [options.roomId],
          text: query
        }
      })

      searchResults.value = (result.results || []).map((r) => {
        const event = r.result || {}
        const content = (event.content || {}) as Record<string, unknown>
        const _eventType = (event.type as string) || ''

        return {
          id: (event.event_id as string) || '',
          type: 'message' as const,
          roomId: (event.room_id as string) || options.roomId,
          userId: (event.sender as string) || '',
          content: (content.body as string) || JSON.stringify(content),
          timestamp: (event.origin_server_ts as number) || 0
        }
      })

      searchTotal.value = result.count || searchResults.value.length

      logger.info('[useMatrixChatSidebar] Search completed', {
        query,
        results: searchTotal.value
      })
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Search failed:', error)
      message.error('搜索失败：' + (error instanceof Error ? error.message : String(error)))
      searchResults.value = []
      searchTotal.value = 0
    } finally {
      searching.value = false
    }
  }

  const highlightSearchText = (text: string): string => {
    if (!searchQuery.value) return text
    return sanitizeHighlightHtml(text, searchQuery.value)
  }

  const handleSearchResultClick = (result: SearchResult) => {
    if (options.onScrollToMessage) {
      options.onScrollToMessage(result.id)
    }
    if (options.onClose) {
      options.onClose()
    }
    logger.info('[useMatrixChatSidebar] Scrolling to message', { eventId: result.id })
  }

  // ============ 房间信息 ============
  const loadRoomInfo = async () => {
    try {
      const summary = matrixRoomManager.getRoomSummary(options.roomId)
      roomInfo.value = summary
        ? {
            id: summary.roomId || '',
            name: summary.name || '',
            topic: summary.topic || '',
            avatar: summary.avatar || '',
            isEncrypted: summary.encrypted || false,
            isDirect: summary.type === 'm.direct',
            memberCount: summary.memberCount || 0
          }
        : null

      logger.info('[useMatrixChatSidebar] Loaded room info', {
        roomId: options.roomId,
        name: roomInfo.value?.name
      })
    } catch (error) {
      logger.error('[useMatrixChatSidebar] Failed to load room info:', error)
    }
  }

  const handlePowerLevelsSaved = () => {
    showPowerLevelEditor.value = false
    message.success('权限设置已保存')
    loadMembers()
  }

  const handleRoomSettingsSaved = () => {
    showRoomSettingsModal.value = false
    message.success('房间设置已保存')
    loadRoomInfo()
  }

  const handleRoomSettings = () => {
    showRoomSettingsModal.value = true
  }

  // ============ 初始化和清理 ============
  const initialize = async () => {
    await Promise.all([loadMembers(), loadFiles(), loadRoomInfo()])
  }

  const cleanup = () => {
    // 清理资源
    members.value = []
    files.value = []
    searchResults.value = []
  }

  return {
    // 状态
    activeTab,
    fileFilter,
    searchQuery,
    searching,
    searchResults,
    searchTotal,
    showInviteModal,
    showUserProfile,
    showPowerLevelEditor,
    showRoomSettingsModal,
    selectedMember,
    members,
    files,
    roomInfo,
    loadingFiles,
    hasMoreFiles,
    memberOffset,
    memberLimit,
    loadingMoreMembers,
    hasMoreMembers,

    // 计算属性
    memberCount,
    fileCount,
    onlineMembers,
    offlineMembers,
    virtualMemberItems,
    filteredFiles,
    memberOptions,
    isAdmin,

    // 成员管理
    loadMembers,
    loadMoreMembers,
    handleMemberScroll,
    getMemberInitials,
    getMemberMenuOptions,
    handleMemberClick,
    handleMemberAction,
    handleInviteMember,
    handleInviteSent,

    // 文件管理
    loadFiles,
    getFileIcon,
    handleFileClick,
    handleFileDownload,
    formatFileSize,
    formatTime,

    // 搜索
    searchRoom,
    highlightSearchText,
    handleSearchResultClick,

    // 房间信息
    loadRoomInfo,
    handlePowerLevelsSaved,
    handleRoomSettingsSaved,
    handleRoomSettings,

    // 初始化和清理
    initialize,
    cleanup
  }
}
