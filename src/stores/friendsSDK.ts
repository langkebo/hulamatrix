/**
 * Friends Store - 基于 Friends SDK
 *
 * 使用新优化的 matrix-js-sdk Friends API 扩展
 * 提供完整的 Friends API 功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Friend,
  Category,
  FriendRequest,
  Stats,
  BlockedUser,
  SearchResultUser,
  FriendsApi,
  CategoryWithColor,
  FriendWithProfile,
  FriendRequestWithProfile
} from '@/sdk/matrix-friends'
import { getEnhancedMatrixClient } from '@/integrations/matrix/client.js'
import { logger } from '@/utils/logger'

// Re-export types for components
export type { CategoryWithColor, FriendWithProfile, FriendRequestWithProfile }

/**
 * @deprecated 旧 API 类型别名
 * 保持向后兼容性，便于组件迁移
 */
export interface FriendItem extends FriendWithProfile {
  /** 兼容字段：显示名称别名 */
  name?: string
  /** 兼容字段：状态文本（备注） */
  status_text?: string
}

export type CategoryItem = CategoryWithColor
export type NoticeItem = FriendRequestWithProfile
export type PendingItem = FriendRequest

/**
 * 将 SDK Friend 类型转换为兼容的 FriendItem 格式
 * 处理字段名称差异和可选字段
 */
function adaptFriendToFriendItem(friend: Friend): FriendItem {
  return {
    // SDK 使用 friend_id，组件期望 user_id
    user_id: friend.user_id || friend.friend_id,
    // 保留 SDK 字段
    friend_id: friend.friend_id,
    category_id: friend.category_id,
    category_name: friend.category_name,
    created_at: friend.created_at,
    status: friend.status,
    // 映射显示名称
    display_name: friend.display_name || friend.remark || friend.user_id || friend.friend_id,
    avatar_url: friend.avatar_url,
    presence: friend.presence,
    // 兼容旧字段
    name: friend.display_name || friend.remark || friend.user_id || friend.friend_id,
    status_text: friend.remark || ''
  } as FriendItem
}

export const useFriendsSDKStore = defineStore('friendsSDK', () => {
  // ==================== 辅助函数 ====================

  /**
   * 获取 Friends API 客户端
   */
  async function getFriendsClient(): Promise<FriendsApi> {
    const client = await getEnhancedMatrixClient()
    return client.friends as FriendsApi
  }

  // ==================== 状态 ====================

  const loading = ref(false)
  const error = ref<string | null>(null)
  const friends = ref<Friend[]>([])
  const categories = ref<Category[]>([])
  const pendingRequests = ref<FriendRequest[]>([])
  const blockedUsers = ref<BlockedUser[]>([])
  const stats = ref<Stats | null>(null)
  const initialized = ref(false)

  // ==================== 计算属性 ====================

  /**
   * 按分类分组的好友
   */
  const friendsByCategory = computed(() => {
    const map = new Map<string | null, Friend[]>()
    map.set(null, []) // 未分组

    // 初始化所有分组
    for (const cat of categories.value) {
      map.set(cat.id, [])
    }

    // 分组好友
    for (const friend of friends.value) {
      const key = friend.category_id || null
      const group = map.get(key) || []
      group.push(friend)
      map.set(key, group)
    }

    return map
  })

  /**
   * 在线好友数量
   */
  const onlineFriendsCount = computed(() => friends.value.filter((f) => f.status === 'accepted').length)

  /**
   * 待处理请求数量
   */
  const pendingCount = computed(() => pendingRequests.value.length)

  /**
   * 好友总数
   */
  const totalFriendsCount = computed(() => friends.value.length)

  /**
   * 黑名单用户数量
   */
  const blockedCount = computed(() => blockedUsers.value.length)

  /**
   * 已加载
   */
  const isLoaded = computed(() => !loading.value && initialized.value)

  /**
   * 适配后的好友列表（兼容旧组件）
   * 将 SDK 的 Friend 类型转换为 FriendItem 格式
   */
  const adaptedFriends = computed(() => friends.value.map(adaptFriendToFriendItem))

  /**
   * 适配后的分组好友（兼容旧组件）
   */
  const adaptedFriendsByCategory = computed(() => {
    const map = new Map<string | null, FriendItem[]>()
    map.set(null, []) // 未分组

    // 初始化所有分组
    for (const cat of categories.value) {
      map.set(cat.id, [])
    }

    // 分组好友并转换类型
    for (const friend of friends.value) {
      const adapted = adaptFriendToFriendItem(friend)
      const key = friend.category_id || null
      const group = map.get(key) || []
      group.push(adapted)
      map.set(key, group)
    }

    return map
  })

  // ==================== 辅助方法 ====================

  /**
   * 清除错误
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * 处理错误
   */
  function handleError(e: unknown, message: string): void {
    const errorMessage = e instanceof Error ? e.message : String(e)
    error.value = `${message}: ${errorMessage}`
    logger.error(`[FriendsSDKStore] ${message}`, { error: errorMessage })
  }

  // ==================== 查询操作 ====================

  /**
   * 初始化 Store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      logger.debug('[FriendsSDKStore] Already initialized')
      return
    }

    logger.info('[FriendsSDKStore] Initializing...')

    try {
      await Promise.all([fetchFriends(), fetchCategories(), fetchStats(), fetchPendingRequests()])

      initialized.value = true
      logger.info('[FriendsSDKStore] Initialized successfully', {
        friendsCount: friends.value.length,
        categoriesCount: categories.value.length,
        pendingCount: pendingRequests.value.length
      })
    } catch (e) {
      handleError(e, '初始化失败')
      throw e
    }
  }

  /**
   * 获取好友列表
   */
  async function fetchFriends(): Promise<void> {
    loading.value = true
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.list()
      friends.value = response.friends || []

      logger.debug('[FriendsSDKStore] Friends fetched', {
        count: friends.value.length
      })
    } catch (e) {
      handleError(e, '获取好友列表失败')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取分组列表
   */
  async function fetchCategories(): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.listCategories()
      categories.value = response.categories || []

      logger.debug('[FriendsSDKStore] Categories fetched', {
        count: categories.value.length
      })
    } catch (e) {
      handleError(e, '获取分组列表失败')
      throw e
    }
  }

  /**
   * 获取统计信息
   */
  async function fetchStats(): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.getStats()
      stats.value = response.stats || null

      logger.debug('[FriendsSDKStore] Stats fetched', stats.value)
    } catch (e) {
      handleError(e, '获取统计信息失败')
      throw e
    }
  }

  /**
   * 获取待处理请求
   */
  async function fetchPendingRequests(): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.listPendingRequests()
      pendingRequests.value = response.requests || []

      logger.debug('[FriendsSDKStore] Pending requests fetched', {
        count: pendingRequests.value.length
      })
    } catch (e) {
      handleError(e, '获取待处理请求失败')
      throw e
    }
  }

  /**
   * 获取黑名单
   */
  async function fetchBlocked(): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.listBlocked()
      blockedUsers.value = response.blocked || []

      logger.debug('[FriendsSDKStore] Blocked users fetched', {
        count: blockedUsers.value.length
      })
    } catch (e) {
      handleError(e, '获取黑名单失败')
      throw e
    }
  }

  /**
   * 搜索用户
   */
  async function searchUsers(query: string): Promise<SearchResultUser[]> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.searchFriends(query)

      logger.debug('[FriendsSDKStore] Users searched', {
        query,
        count: response.users?.length || 0
      })

      return response.users || []
    } catch (e) {
      handleError(e, '搜索用户失败')
      throw e
    }
  }

  // ==================== 好友操作 ====================

  /**
   * 发送好友请求
   */
  async function sendFriendRequest(
    targetId: string,
    options?: { message?: string; categoryId?: string }
  ): Promise<string> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.sendRequest(targetId, options)

      // 刷新待处理请求
      await fetchPendingRequests()

      logger.info('[FriendsSDKStore] Friend request sent', {
        targetId,
        requestId: response.request_id
      })

      return response.request_id || ''
    } catch (e) {
      handleError(e, '发送好友请求失败')
      throw e
    }
  }

  /**
   * 接受好友请求
   */
  async function acceptFriendRequest(
    requestId: string,
    options?: { categoryId?: string }
  ): Promise<{ requester_id: string; dm_room_id?: string }> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.acceptRequest(requestId, options)

      // 刷新好友列表和待处理请求
      await Promise.all([fetchFriends(), fetchPendingRequests()])

      logger.info('[FriendsSDKStore] Friend request accepted', {
        requestId,
        requesterId: response.requester_id,
        dmRoomId: response.dm_room_id
      })

      return {
        requester_id: response.requester_id || '',
        dm_room_id: response.dm_room_id
      }
    } catch (e) {
      handleError(e, '接受好友请求失败')
      throw e
    }
  }

  /**
   * 拒绝好友请求
   */
  async function rejectFriendRequest(requestId: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.rejectRequest(requestId)

      // 刷新待处理请求
      await fetchPendingRequests()

      logger.info('[FriendsSDKStore] Friend request rejected', { requestId })
    } catch (e) {
      handleError(e, '拒绝好友请求失败')
      throw e
    }
  }

  /**
   * 删除好友
   */
  async function removeFriend(friendId: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.removeFriend(friendId)

      // 刷新好友列表
      await fetchFriends()

      logger.info('[FriendsSDKStore] Friend removed', { friendId })
    } catch (e) {
      handleError(e, '删除好友失败')
      throw e
    }
  }

  // ==================== 分组操作 ====================

  /**
   * 创建分组
   */
  async function createCategory(name: string): Promise<string> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      const response = await friendsApi.createCategory(name)

      // 刷新分组列表
      await fetchCategories()

      logger.info('[FriendsSDKStore] Category created', {
        name,
        categoryId: response.category_id
      })

      return response.category_id || ''
    } catch (e) {
      handleError(e, '创建分组失败')
      throw e
    }
  }

  /**
   * 删除分组
   */
  async function deleteCategory(categoryId: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.deleteCategory(categoryId)

      // 刷新分组列表
      await fetchCategories()

      logger.info('[FriendsSDKStore] Category deleted', { categoryId })
    } catch (e) {
      handleError(e, '删除分组失败')
      throw e
    }
  }

  // ==================== 备注操作 ====================

  /**
   * 设置好友备注
   */
  async function setRemark(friendId: string, remark: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.setRemark(friendId, remark)

      // 刷新好友列表
      await fetchFriends()

      logger.info('[FriendsSDKStore] Remark set', { friendId, remark })
    } catch (e) {
      handleError(e, '设置备注失败')
      throw e
    }
  }

  // ==================== 黑名单操作 ====================

  /**
   * 拉黑用户
   */
  async function blockUser(targetId: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.blockUser(targetId)

      // 刷新黑名单
      await fetchBlocked()

      logger.info('[FriendsSDKStore] User blocked', { targetId })
    } catch (e) {
      handleError(e, '拉黑用户失败')
      throw e
    }
  }

  /**
   * 取消拉黑
   */
  async function unblockUser(targetId: string): Promise<void> {
    clearError()

    try {
      const friendsApi = await getFriendsClient()
      await friendsApi.unblockUser(targetId)

      // 刷新黑名单
      await fetchBlocked()

      logger.info('[FriendsSDKStore] User unblocked', { targetId })
    } catch (e) {
      handleError(e, '取消拉黑失败')
      throw e
    }
  }

  // ==================== 清理操作 ====================

  /**
   * 重置 Store
   */
  function reset(): void {
    friends.value = []
    categories.value = []
    pendingRequests.value = []
    blockedUsers.value = []
    stats.value = null
    initialized.value = false
    error.value = null
    loading.value = false

    logger.info('[FriendsSDKStore] Store reset')
  }

  /**
   * 刷新所有数据
   */
  async function refresh(): Promise<void> {
    await initialize()
  }

  // ==================== 兼容层方法 ====================

  /**
   * @deprecated 使用 refresh() 代替
   * 刷新所有数据（向后兼容方法）
   */
  async function refreshAll(): Promise<void> {
    await refresh()
  }

  /**
   * @deprecated 使用 sendFriendRequest() 代替
   * 发送好友请求（向后兼容方法）
   */
  async function request(target_id: string, message?: string, category_id?: string): Promise<string> {
    return await sendFriendRequest(target_id, { message, categoryId: category_id })
  }

  /**
   * @deprecated 使用 acceptFriendRequest() 代替
   * 接受好友请求（向后兼容方法）
   */
  async function accept(request_id: string, category_id?: string): Promise<{ requester_id: string; dm_room_id?: string }> {
    return await acceptFriendRequest(request_id, { categoryId: category_id })
  }

  /**
   * @deprecated 使用 rejectFriendRequest() 代替
   * 拒绝好友请求（向后兼容方法）
   */
  async function reject(request_id: string): Promise<void> {
    await rejectFriendRequest(request_id)
  }

  /**
   * 检查用户是否为好友
   */
  function isFriend(userId: string): boolean {
    if (!userId) return false
    return friends.value.some((friend) => friend.user_id === userId)
  }

  /**
   * 根据用户 ID 获取好友信息
   */
  function getFriend(userId: string): FriendWithProfile | undefined {
    if (!userId) return undefined
    return friends.value.find((friend) => friend.user_id === userId)
  }

  // ==================== Friends V2 兼容层方法 ====================

  /**
   * @deprecated 使用 request() 或 sendFriendRequest() 代替
   * 发送好友请求（friendsV2 兼容方法）
   */
  async function sendRequest(targetId: string, message?: string, categoryId?: string | number): Promise<string> {
    const categoryIdStr = categoryId !== undefined ? String(categoryId) : undefined
    return await request(targetId, message, categoryIdStr)
  }

  /**
   * @deprecated 使用 accept() 或 acceptFriendRequest() 代替
   * 接受好友请求（friendsV2 兼容方法）
   */
  async function acceptRequest(requestId: string, categoryId?: string | number): Promise<void> {
    const categoryIdStr = categoryId !== undefined ? String(categoryId) : undefined
    await accept(requestId, categoryIdStr)
  }

  /**
   * @deprecated 使用 reject() 或 rejectFriendRequest() 代替
   * 拒绝好友请求（friendsV2 兼容方法）
   */
  async function rejectRequest(requestId: string): Promise<void> {
    await reject(requestId)
  }

  // ==================== 返回 ====================

  return {
    // 状态（使用适配后的数据，向后兼容）
    loading,
    error,
    friends: adaptedFriends, // 覆盖：返回适配后的数据
    categories,
    pendingRequests,
    pending: pendingRequests, // 向后兼容别名
    blockedUsers,
    stats,
    initialized,

    // 计算属性（使用适配后的数据，向后兼容）
    friendsByCategory: adaptedFriendsByCategory, // 覆盖：返回适配后的数据
    onlineFriendsCount,
    pendingCount,
    totalFriendsCount,
    blockedCount,
    isLoaded,

    // 辅助方法
    clearError,

    // 查询操作
    initialize,
    fetchFriends,
    fetchCategories,
    fetchStats,
    fetchPendingRequests,
    fetchBlocked,
    searchUsers,

    // 好友操作
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,

    // 分组操作
    createCategory,
    deleteCategory,

    // 备注操作
    setRemark,

    // 黑名单操作
    blockUser,
    unblockUser,

    // 清理操作
    reset,
    refresh,

    // 兼容层方法（向后兼容）
    refreshAll,
    request,
    accept,
    reject,
    isFriend,
    getFriend,
    // Friends V2 兼容层方法
    sendRequest,
    acceptRequest,
    rejectRequest
  }
})

/**
 * @deprecated 使用 useFriendsSDKStore 代替
 * 向后兼容性别名，允许组件从旧 API 迁移
 */
export const useFriendsStore = useFriendsSDKStore

/**
 * @deprecated 使用 useFriendsSDKStore 代替
 * Friends V2 兼容性别名，允许从 friendsV2 迁移
 */
export const useFriendsStoreV2 = useFriendsSDKStore
