/**
 * Matrix Spaces Composable
 * 提供Matrix Spaces功能的Vue集成
 */

import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'

import { createLogger } from '@/utils/logger'

const logger = createLogger('MatrixSpaces')

/** Space 权限接口 */
interface SpacePermissions {
  canEdit?: boolean
  canInvite?: boolean
  canRemove?: boolean
  canManageRooms?: boolean
}

/** Space 子房间接口 */
export interface SpaceChild {
  roomId: string
  name?: string
  notifications?: {
    highlightCount: number
    notificationCount: number
  }
  memberCount?: number
  order?: string
  isJoined?: boolean
  [key: string]: unknown
}

// Space 接口定义
export interface Space {
  id: string
  room_id?: string
  roomId?: string
  name: string
  topic?: string
  avatar?: string
  isPublic?: boolean
  notifications?: {
    highlightCount: number
    notificationCount: number
  }
  memberCount?: number | undefined // Keep as optional for flexibility
  joinedAt?: number
  joined?: boolean
  canonicalAlias?: string
  canAdmin?: boolean
  permissions?: SpacePermissions
  children?: readonly SpaceChild[]
  // Additional properties for UI components
  isArchived?: boolean
  isActive?: boolean
  isFavorite?: boolean
  isAdmin?: boolean
  roomCount?: number
  lastActivity?: number
  tags?: readonly string[]
  theme?: {
    gradient?: string
    [key: string]: unknown
  }
  created?: number
  description?: string
  rooms?: readonly unknown[]
  members?: readonly unknown[]
  isJoined?: boolean
  memberStatus?: 'joined' | 'invited' | 'left'
  encrypted?: boolean // E2EE encryption status
  [key: string]: unknown
}

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  getClient?: () => unknown
  createRoom?: (options: Record<string, unknown>) => Promise<unknown>
}

/** Spaces 管理器接口 */
interface SpacesManager {
  createSpace: (options: Record<string, unknown>) => Promise<Space>
  joinSpace: (spaceId: string, viaServers?: string[]) => Promise<void>
  leaveSpace: (spaceId: string) => Promise<void>
  getUserSpaces: () => Promise<Space[]>
  getSpace: (spaceId: string) => Promise<Space>
  addChildToSpace: (spaceId: string, childRoomId: string, options?: Record<string, unknown>) => Promise<void>
  insertChildWithOrder: (spaceId: string, childRoomId: string) => Promise<void>
  removeChildFromSpace: (spaceId: string, childRoomId: string) => Promise<void>
  inviteToSpace: (spaceId: string, userId: string) => Promise<void>
  removeFromSpace: (spaceId: string, userId: string, reason?: string) => Promise<void>
  getSpaceMembers: (spaceId: string) => Promise<unknown[]>
  searchSpaces: (query: string, options?: Record<string, unknown>) => Promise<Space[]>
  updateSpaceSettings: (spaceId: string, settings: Partial<Space>) => Promise<void>
  getSpaceStats: (spaceId: string) => Promise<unknown>
  getSpaceActivity: (spaceId: string, options?: Record<string, unknown>) => Promise<unknown[]>
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void
  removeEventListener?: (event: string, handler: (...args: unknown[]) => void) => void
  destroy: () => void
}

/** 创建 Spaces 管理器函数类型 */
type CreateMatrixSpacesManager = (client: unknown) => SpacesManager

/** 房间创建选项接口 */
interface CreateRoomOptions {
  name: string
  topic?: string
  preset?: string
  visibility?: string
  invite?: string[]
  initial_state?: Array<{
    type: string
    state_key: string
    content: Record<string, unknown>
  }>
}

/** 房间创建响应接口 */
interface CreateRoomResponse {
  room_id?: string
  roomId?: string
}

/** 房间配置状态事件接口 */
interface ConfigStateEvent {
  type: string
  state_key: string
  content: {
    type?: string
    maxMembers?: number | null
    protected?: boolean
  }
}

/** 创建的房间接口 */
interface CreatedRoom {
  id: string
  name: string
  type: string
  topic: string
  memberCount: number
  unreadCount: number
}

/** Dynamic imports to avoid module resolution issues */
let matrixClientService: MatrixClientExtended | null = null
let createMatrixSpacesManager: CreateMatrixSpacesManager | null = null

const loadMatrixModules = async () => {
  try {
    const clientModule = await import('@/integrations/matrix/client')
    const spacesModule = await import('@/integrations/matrix/spaces')

    matrixClientService = clientModule.matrixClientService as MatrixClientExtended
    createMatrixSpacesManager = spacesModule.createMatrixSpacesManager as unknown as CreateMatrixSpacesManager
  } catch (error) {
    logger.error('Failed to load Matrix modules:', error as Error)
    throw error
  }
}

export function useMatrixSpaces() {
  const spacesManager = ref<SpacesManager | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const modulesLoaded = ref(false)

  // Get the matrix client
  const client = computed(() => {
    if (!matrixClientService) return null
    return matrixClientService.getClient?.() || null
  })

  // 响应式状态
  const spaces = ref<Map<string, Space>>(new Map())
  const currentSpaceId = ref<string | null>(null)
  const searchResults = ref<Space[]>([])
  const isSearching = ref(false)

  // Load modules before any operations
  const ensureModulesLoaded = async () => {
    if (!modulesLoaded.value) {
      await loadMatrixModules()
      modulesLoaded.value = true
    }
  }

  // 计算属性
  const currentSpace = computed(() => (currentSpaceId.value ? spaces.value.get(currentSpaceId.value) : null))

  const userSpaces = computed(() => Array.from(spaces.value.values()))

  const publicSpaces = computed(() => userSpaces.value.filter((space) => space.isPublic))

  const privateSpaces = computed(() => userSpaces.value.filter((space) => !space.isPublic))

  const spacesWithUnread = computed(() =>
    userSpaces.value.filter(
      (space: Space) =>
        (space.notifications?.highlightCount ?? 0) > 0 || (space.notifications?.notificationCount ?? 0) > 0
    )
  )

  const totalUnreadCount = computed(() =>
    userSpaces.value.reduce(
      (total, space) =>
        total + (space.notifications?.highlightCount ?? 0) + (space.notifications?.notificationCount ?? 0),
      0
    )
  )

  // ========== Space管理方法 ==========

  /**
   * 初始化Spaces管理器
   */
  const initializeSpaces = async () => {
    await ensureModulesLoaded()

    if (!client.value) {
      error.value = 'Matrix客户端未初始化'
      return
    }

    try {
      isLoading.value = true
      error.value = null

      if (createMatrixSpacesManager) {
        spacesManager.value = createMatrixSpacesManager(client.value)
      }

      // 设置事件监听器
      setupEventListeners()

      // 加载用户的Spaces
      await refreshSpaces()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `Spaces初始化失败: ${errorMessage}`
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 创建新的Space
   */
  const createSpace = async (options: {
    name: string
    topic?: string
    isPublic?: boolean
    avatar?: string
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
    roomAlias?: string
    invite?: string[]
  }): Promise<Space | null> => {
    if (!spacesManager.value) {
      error.value = 'Spaces管理器未初始化'
      return null
    }

    try {
      isLoading.value = true
      const space = await spacesManager.value.createSpace(options)

      // 更新本地缓存
      spaces.value.set(space.id, space)

      return space
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `创建Space失败: ${errorMessage}`
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加入Space
   */
  const joinSpace = async (spaceId: string, viaServers?: string[]) => {
    if (!spacesManager.value) return false

    try {
      isLoading.value = true
      await spacesManager.value.joinSpace(spaceId, viaServers)

      // 刷新本地缓存
      const space = await spacesManager.value.getSpace(spaceId)
      spaces.value.set(spaceId, space)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `加入Space失败: ${errorMessage}`
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 离开Space
   */
  const leaveSpace = async (spaceId: string) => {
    if (!spacesManager.value) return false

    try {
      isLoading.value = true
      await spacesManager.value.leaveSpace(spaceId)

      // 从本地缓存移除
      spaces.value.delete(spaceId)

      if (currentSpaceId.value === spaceId) {
        currentSpaceId.value = null
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `离开Space失败: ${errorMessage}`
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 刷新Spaces列表
   */
  const refreshSpaces = async () => {
    if (!spacesManager.value) return

    try {
      isLoading.value = true
      const userSpacesList = await spacesManager.value.getUserSpaces()

      // 更新本地缓存
      spaces.value.clear()
      userSpacesList.forEach((space: Space) => {
        spaces.value.set(space.id, space)
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `刷新Spaces失败: ${errorMessage}`
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 在指定Space中创建房间
   */
  const createRoomInSpace = async (
    spaceId: string,
    room: { name: string; type?: string; description?: string; maxMembers?: number; password?: string }
  ): Promise<CreatedRoom> => {
    if (!client.value || !spacesManager.value) {
      throw new Error('Spaces管理器或客户端未初始化')
    }

    const roomType = room.type || 'text'
    const opts: CreateRoomOptions = {
      name: room.name,
      topic: room.description || '',
      preset: 'private_chat',
      initial_state: []
    }

    // 可选配置：最大人数/密码保护（以自定义状态事件记录配置）
    const configState: ConfigStateEvent = {
      type: 'io.foxchat.room.config',
      state_key: '',
      content: {
        type: roomType,
        maxMembers: room.maxMembers || null,
        protected: !!room.password
      }
    }
    opts.initial_state = [...(opts.initial_state || []), configState]

    const resp = (await matrixClientService?.createRoom?.(opts as unknown as Record<string, unknown>)) as
      | CreateRoomResponse
      | string
      | undefined
    const roomId = typeof resp === 'string' ? resp : (resp?.room_id ?? resp?.roomId ?? '')
    if (!roomId) throw new Error('创建房间失败: 未返回roomId')

    await spacesManager.value.addChildToSpace(spaceId, roomId)

    const createdRoom: CreatedRoom = {
      id: roomId,
      name: room.name,
      type: roomType,
      topic: room.description || '',
      memberCount: 1,
      unreadCount: 0
    }

    await updateSpaceCache(spaceId)
    return createdRoom
  }

  /**
   * 邀请多个成员到Space
   */
  const inviteMembersToSpace = async (spaceId: string, userIds: string[]): Promise<boolean> => {
    if (!spacesManager.value) return false
    const results = await Promise.all(
      userIds.map((id) =>
        spacesManager
          .value!.inviteToSpace(spaceId, id)
          .then(() => true)
          .catch(() => false)
      )
    )
    return results.every(Boolean)
  }

  /**
   * 设置当前Space
   */
  const setCurrentSpace = (spaceId: string | null) => {
    currentSpaceId.value = spaceId
  }

  // ========== 子房间管理 ==========

  /**
   * 添加子房间到Space
   */
  const addChildToSpace = async (
    spaceId: string,
    childRoomId: string,
    options: {
      order?: string
      suggested?: boolean
      via?: string[]
    } = {}
  ) => {
    if (!spacesManager.value) return false

    try {
      await spacesManager.value.addChildToSpace(spaceId, childRoomId, options)

      // 更新本地Space缓存
      await updateSpaceCache(spaceId)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `添加子房间失败: ${errorMessage}`
      return false
    }
  }

  const insertChildOrdered = async (spaceId: string, childRoomId: string) => {
    if (!spacesManager.value) return false
    try {
      await spacesManager.value.insertChildWithOrder(spaceId, childRoomId)
      await updateSpaceCache(spaceId)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `添加子房间失败: ${errorMessage}`
      return false
    }
  }

  /**
   * 从Space移除子房间
   */
  const removeChildFromSpace = async (spaceId: string, childRoomId: string) => {
    if (!spacesManager.value) return false

    try {
      await spacesManager.value.removeChildFromSpace(spaceId, childRoomId)

      // 更新本地Space缓存
      await updateSpaceCache(spaceId)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = `移除子房间失败: ${errorMessage}`
      return false
    }
  }

  const setChildOrder = async (spaceId: string, childRoomId: string, order: string) => {
    return addChildToSpace(spaceId, childRoomId, { order })
  }

  const setChildSuggested = async (spaceId: string, childRoomId: string, suggested: boolean) => {
    return addChildToSpace(spaceId, childRoomId, { suggested })
  }

  // ========== 成员管理 ==========

  /**
   * 邀请用户到Space
   */
  const inviteToSpace = async (spaceId: string, userId: string) => {
    if (!spacesManager.value) return false

    try {
      await spacesManager.value.inviteToSpace(spaceId, userId)
      return true
    } catch (err) {
      error.value = `邀请用户失败: ${err instanceof Error ? err.message : String(err)}`
      return false
    }
  }

  /**
   * 从Space移除用户
   */
  const removeFromSpace = async (spaceId: string, userId: string, reason?: string) => {
    if (!spacesManager.value) return false

    try {
      await spacesManager.value.removeFromSpace(spaceId, userId, reason)
      return true
    } catch (err) {
      error.value = `移除用户失败: ${err instanceof Error ? err.message : String(err)}`
      return false
    }
  }

  /**
   * 获取Space成员
   */
  const getSpaceMembers = async (spaceId: string): Promise<unknown[]> => {
    if (!spacesManager.value) return []

    try {
      return await spacesManager.value.getSpaceMembers(spaceId)
    } catch (err) {
      error.value = `获取Space成员失败: ${err instanceof Error ? err.message : String(err)}`
      return []
    }
  }

  // ========== 搜索功能 ==========

  /**
   * 搜索Spaces
   */
  const searchSpaces = async (
    query: string,
    options: {
      limit?: number
      includePublic?: boolean
      includeJoined?: boolean
    } = {}
  ) => {
    if (!spacesManager.value) return

    try {
      isSearching.value = true
      searchResults.value = await spacesManager.value.searchSpaces(query, options)
    } catch (err) {
      error.value = `搜索Spaces失败: ${err instanceof Error ? err.message : String(err)}`
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * 清空搜索结果
   */
  const clearSearchResults = () => {
    searchResults.value = []
  }

  // ========== 设置管理 ==========

  /**
   * 更新Space设置
   */
  const updateSpaceSettings = async (spaceId: string, settings: Partial<Omit<Space, 'id' | 'notifications'>>) => {
    if (!spacesManager.value) return false

    try {
      await spacesManager.value.updateSpaceSettings(spaceId, settings)

      // 更新本地缓存
      await updateSpaceCache(spaceId)

      return true
    } catch (err) {
      error.value = `更新Space设置失败: ${err instanceof Error ? err.message : String(err)}`
      return false
    }
  }

  // ========== 统计和分析 ==========

  /**
   * 获取Space统计信息
   */
  const getSpaceStats = async (spaceId: string) => {
    if (!spacesManager.value) return null

    try {
      return await spacesManager.value.getSpaceStats(spaceId)
    } catch (err) {
      error.value = `获取Space统计失败: ${err instanceof Error ? err.message : String(err)}`
      return null
    }
  }

  /**
   * 获取Space活动日志
   */
  const getSpaceActivity = async (
    spaceId: string,
    options: {
      limit?: number
      from?: string
      filter?: string[]
    } = {}
  ) => {
    if (!spacesManager.value) return []

    try {
      return await spacesManager.value.getSpaceActivity(spaceId, options)
    } catch (err) {
      error.value = `获取Space活动日志失败: ${err instanceof Error ? err.message : String(err)}`
      return []
    }
  }

  // ========== 工具方法 ==========

  /**
   * 检查用户是否有Space管理权限
   */
  const canManageSpace = (spaceId: string): boolean => {
    const space = spaces.value.get(spaceId)
    return space ? (space.permissions?.canEdit ?? false) : false
  }

  /**
   * 检查用户是否可以邀请到Space
   */
  const canInviteToSpace = (spaceId: string): boolean => {
    const space = spaces.value.get(spaceId)
    return space ? (space.permissions?.canInvite ?? false) : false
  }

  /**
   * 获取Space的未读数量 (聚合子房间)
   */
  const getSpaceUnreadCount = (spaceId: string) => {
    const space = spaces.value.get(spaceId) as Space
    if (!space) return { highlight: 0, notification: 0 }

    let highlight = space.notifications?.highlightCount ?? 0
    let notification = space.notifications?.notificationCount ?? 0

    if (space.children && Array.isArray(space.children)) {
      space.children.forEach((child: SpaceChild) => {
        if (child.notifications) {
          highlight += child.notifications.highlightCount || 0
          notification += child.notifications.notificationCount || 0
        }
      })
    }

    return {
      highlight,
      notification
    }
  }

  /**
   * 根据ID获取Space
   */
  const getSpaceById = (spaceId: string): Space | undefined => {
    return spaces.value.get(spaceId)
  }

  /**
   * 根据名称搜索Space
   */
  const findSpaceByName = (name: string): Space | undefined => {
    const nameLower = name.toLowerCase()
    return userSpaces.value.find(
      (space: Space) =>
        space.name.toLowerCase().includes(nameLower) || (space.topic && space.topic.toLowerCase().includes(nameLower))
    )
  }

  // ========== 私有辅助方法 ==========

  /**
   * 设置事件监听器
   */
  const setupEventListeners = () => {
    if (!spacesManager.value) return

    // Space创建事件
    spacesManager.value.addEventListener('space:created', (...args: unknown[]) => {
      const space = args[0] as Space
      spaces.value.set(space.id, space)
    })

    // Space加入事件
    spacesManager.value.addEventListener('space:joined', (...args: unknown[]) => {
      const space = args[0] as Space
      spaces.value.set(space.id, space)
    })

    // Space离开事件
    spacesManager.value.addEventListener('space:left', (...args: unknown[]) => {
      const { spaceId } = args[0] as { spaceId: string }
      spaces.value.delete(spaceId)
      if (currentSpaceId.value === spaceId) {
        currentSpaceId.value = null
      }
    })

    // Space状态变化事件
    spacesManager.value.addEventListener('space:state_changed', async (...args: unknown[]) => {
      const { spaceId } = args[0] as { spaceId: string }
      await updateSpaceCache(spaceId)
    })

    // 子房间添加事件
    spacesManager.value.addEventListener('space:child_added', async (...args: unknown[]) => {
      const { spaceId } = args[0] as { spaceId: string }
      await updateSpaceCache(spaceId)
    })

    // 子房间移除事件
    spacesManager.value.addEventListener('space:child_removed', async (...args: unknown[]) => {
      const { spaceId } = args[0] as { spaceId: string }
      await updateSpaceCache(spaceId)
    })
  }

  /**
   * 更新Space本地缓存
   */
  const updateSpaceCache = async (spaceId: string) => {
    if (!spacesManager.value) return

    try {
      const updatedSpace = await spacesManager.value.getSpace(spaceId)
      spaces.value.set(spaceId, updatedSpace)
    } catch (error) {
      logger.warn(`Failed to update space cache for ${spaceId}:`, error)
    }
  }

  // ========== 生命周期 ==========

  onMounted(() => {
    // 当客户端可用时自动初始化
    if (client.value) {
      initializeSpaces()
    }
  })

  onUnmounted(() => {
    // 清理资源
    if (spacesManager.value) {
      spacesManager.value.destroy()
      spacesManager.value = null
    }
  })

  // 返回响应式状态和方法
  return {
    // 状态
    isLoading: readonly(isLoading),
    error: readonly(error),
    spaces: readonly(spaces),
    currentSpaceId: readonly(currentSpaceId),
    searchResults: readonly(searchResults),
    isSearching: readonly(isSearching),

    // 计算属性
    currentSpace,
    userSpaces,
    publicSpaces,
    privateSpaces,
    spacesWithUnread,
    totalUnreadCount,

    // Space管理
    initializeSpaces,
    createSpace,
    joinSpace,
    leaveSpace,
    refreshSpaces,
    setCurrentSpace,
    createRoomInSpace,

    // 子房间管理
    addChildToSpace,
    removeChildFromSpace,
    insertChildOrdered,
    setChildOrder,
    setChildSuggested,

    // 成员管理
    inviteToSpace,
    inviteMembersToSpace,
    removeFromSpace,
    getSpaceMembers,

    // 搜索
    searchSpaces,
    clearSearchResults,

    // 设置管理
    updateSpaceSettings,

    // 统计和分析
    getSpaceStats,
    getSpaceActivity,

    // 工具方法
    canManageSpace,
    canInviteToSpace,
    getSpaceUnreadCount,
    getSpaceById,
    findSpaceByName
  }
}
