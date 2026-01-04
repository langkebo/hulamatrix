/**
 * 好友 Store v2.0
 * 基于 SDK v2.0.0 API 和 FriendsServiceV2
 *
 * 统一 PC 端和移动端实现
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { logger } from '@/utils/logger'
import type {
  FriendItem,
  FriendCategoryItem,
  PendingRequestItem,
  FriendStats,
  SearchedUser
} from '@/types/matrix-sdk-v2'

/**
 * 好友 Store v2.0
 * 使用 Composition API 风格
 */
export const useFriendsStoreV2 = defineStore(
  'friendsV2',
  () => {
    // ==================== 状态 ====================

    const loading = ref(false)
    const error = ref('')
    const friends = ref<FriendItem[]>([])
    const categories = ref<FriendCategoryItem[]>([])
    const pending = ref<PendingRequestItem[]>([])
    const stats = ref<FriendStats | null>(null)
    const searchResults = ref<SearchedUser[]>([])
    const initialized = ref(false)

    // ==================== 计算属性 ====================

    /**
     * 按分类分组的好友
     */
    const friendsByCategory = computed(() => {
      const map = new Map<string | null, FriendItem[]>()
      map.set(null, []) // 未分类

      // 初始化所有分类
      for (const cat of categories.value) {
        map.set(String(cat.id), [])
      }

      // 分组好友
      for (const friend of friends.value) {
        const key = friend.category_id ? String(friend.category_id) : null
        const group = map.get(key) || []
        group.push(friend)
        map.set(key, group)
      }

      return map
    })

    /**
     * 在线好友数量
     */
    const onlineFriendsCount = computed(() => friends.value.filter((f) => f.presence === 'online').length)

    /**
     * 待处理请求数量
     */
    const pendingCount = computed(() => pending.value.length)

    /**
     * 好友总数
     */
    const totalFriendsCount = computed(() => friends.value.length)

    /**
     * 已加载
     */
    const isLoaded = computed(() => !loading.value && initialized.value)

    // ==================== 操作 ====================

    /**
     * 初始化 Store
     */
    async function initialize(): Promise<void> {
      if (initialized.value) {
        logger.debug('[FriendsStoreV2] Already initialized')
        return
      }

      loading.value = true
      error.value = ''

      try {
        // 初始化服务
        await friendsServiceV2.initialize()

        // 设置服务事件监听
        setupServiceListeners()

        // 加载初始数据
        await refreshAll()

        initialized.value = true
        logger.info('[FriendsStoreV2] Initialized successfully')
      } catch (e) {
        error.value = e instanceof Error ? e.message : '初始化失败'
        logger.error('[FriendsStoreV2] Initialization failed', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 设置服务事件监听
     */
    function setupServiceListeners(): void {
      // 监听好友添加
      friendsServiceV2.on('friend.add', async (data: unknown) => {
        const eventData = data as { friendId: string }
        logger.info('[FriendsStoreV2] Friend added event received', eventData)
        await refreshFriends()
      })

      // 监听好友移除
      friendsServiceV2.on('friend.remove', async (data: unknown) => {
        const eventData = data as { friendId: string }
        logger.info('[FriendsStoreV2] Friend removed event received', eventData)
        await refreshFriends()
      })

      // 监听好友请求
      friendsServiceV2.on('request.received', async (data: unknown) => {
        const request = data as PendingRequestItem
        logger.info('[FriendsStoreV2] Friend request received', request)
        await refreshPending()
      })

      // 监听请求接受
      friendsServiceV2.on('request.accepted', async (data: unknown) => {
        const eventData = data as { requestId: string; categoryId: number }
        logger.info('[FriendsStoreV2] Friend request accepted', eventData)
        await refreshAll()
      })
    }

    /**
     * 刷新所有数据
     */
    async function refreshAll(): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        // 并行获取所有数据
        const [friendsData, categoriesData, pendingData, statsData] = await Promise.all([
          friendsServiceV2.listFriends(true).catch((e) => {
            logger.warn('[FriendsStoreV2] Failed to load friends', { error: e })
            return []
          }),
          friendsServiceV2.getCategories(true).catch((e) => {
            logger.warn('[FriendsStoreV2] Failed to load categories', { error: e })
            return []
          }),
          friendsServiceV2.getPendingRequests().catch((e) => {
            logger.warn('[FriendsStoreV2] Failed to load pending requests', { error: e })
            return []
          }),
          friendsServiceV2.getStats().catch((e) => {
            logger.warn('[FriendsStoreV2] Failed to load stats', { error: e })
            return null
          })
        ])

        friends.value = friendsData
        categories.value = categoriesData
        pending.value = pendingData
        stats.value = statsData

        logger.info('[FriendsStoreV2] Data refreshed', {
          friends: friends.value.length,
          categories: categories.value.length,
          pending: pending.value.length
        })
      } catch (e) {
        error.value = e instanceof Error ? e.message : '刷新失败'
        logger.error('[FriendsStoreV2] Failed to refresh all', { error: e })
      } finally {
        loading.value = false
      }
    }

    /**
     * 仅刷新好友列表
     */
    async function refreshFriends(): Promise<void> {
      try {
        friends.value = await friendsServiceV2.listFriends(true)
      } catch (e) {
        error.value = e instanceof Error ? e.message : '刷新好友列表失败'
        logger.error('[FriendsStoreV2] Failed to refresh friends', { error: e })
      }
    }

    /**
     * 仅刷新待处理请求
     */
    async function refreshPending(): Promise<void> {
      try {
        pending.value = await friendsServiceV2.getPendingRequests()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '刷新待处理请求失败'
        logger.error('[FriendsStoreV2] Failed to refresh pending', { error: e })
      }
    }

    /**
     * 发送好友请求
     */
    async function sendRequest(targetId: string, message?: string, categoryId?: number): Promise<string> {
      loading.value = true
      error.value = ''

      try {
        const requestId = await friendsServiceV2.sendFriendRequest(targetId, message, categoryId)
        await refreshAll()
        return requestId
      } catch (e) {
        error.value = e instanceof Error ? e.message : '发送请求失败'
        logger.error('[FriendsStoreV2] Failed to send request', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 接受好友请求
     */
    async function acceptRequest(requestId: string, categoryId?: number): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        await friendsServiceV2.acceptFriendRequest(requestId, categoryId)
        await refreshAll()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '接受请求失败'
        logger.error('[FriendsStoreV2] Failed to accept request', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 拒绝好友请求
     */
    async function rejectRequest(requestId: string): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        await friendsServiceV2.rejectFriendRequest(requestId)
        await refreshPending()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '拒绝请求失败'
        logger.error('[FriendsStoreV2] Failed to reject request', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 批量接受好友请求
     */
    async function acceptBatch(requestIds: string[], categoryId?: number): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        await Promise.all(requestIds.map((id) => friendsServiceV2.acceptFriendRequest(id, categoryId)))
        await refreshAll()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '批量接受失败'
        logger.error('[FriendsStoreV2] Failed to accept batch', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 批量拒绝好友请求
     */
    async function rejectBatch(requestIds: string[]): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        await Promise.all(requestIds.map((id) => friendsServiceV2.rejectFriendRequest(id)))
        await refreshPending()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '批量拒绝失败'
        logger.error('[FriendsStoreV2] Failed to reject batch', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 删除好友
     */
    async function removeFriend(friendId: string): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        await friendsServiceV2.removeFriend(friendId)
        await refreshFriends()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '删除好友失败'
        logger.error('[FriendsStoreV2] Failed to remove friend', { error: e })
        throw e
      } finally {
        loading.value = false
      }
    }

    /**
     * 搜索用户
     */
    async function searchUsers(query: string, limit = 20): Promise<void> {
      loading.value = true
      error.value = ''

      try {
        searchResults.value = await friendsServiceV2.searchUsers(query, limit)
      } catch (e) {
        error.value = e instanceof Error ? e.message : '搜索失败'
        logger.error('[FriendsStoreV2] Failed to search users', { error: e })
      } finally {
        loading.value = false
      }
    }

    /**
     * 清除搜索结果
     */
    function clearSearchResults(): void {
      searchResults.value = []
    }

    /**
     * 清除缓存
     */
    function invalidateCache(): void {
      friendsServiceV2.invalidateCache()
      logger.debug('[FriendsStoreV2] Cache invalidated')
    }

    /**
     * 重置 Store
     */
    function reset(): void {
      loading.value = false
      error.value = ''
      friends.value = []
      categories.value = []
      pending.value = []
      stats.value = null
      searchResults.value = []
      initialized.value = false
    }

    /**
     * 检查是否为好友
     */
    async function isFriend(userId: string): Promise<boolean> {
      try {
        return await friendsServiceV2.isFriend(userId)
      } catch {
        return false
      }
    }

    /**
     * 获取好友信息
     */
    function getFriend(userId: string): FriendItem | undefined {
      return friends.value.find((f) => f.user_id === userId)
    }

    /**
     * 获取分类信息
     */
    function getCategory(categoryId: string): FriendCategoryItem | undefined {
      return categories.value.find((c) => String(c.id) === categoryId)
    }

    /**
     * 获取分类名称
     */
    function getCategoryName(categoryId: string | undefined): string {
      if (!categoryId) return '未分类'
      const category = getCategory(categoryId)
      return category?.name || '未知分类'
    }

    return {
      // ==================== 状态 ====================
      loading,
      error,
      friends,
      categories,
      pending,
      stats,
      searchResults,
      initialized,

      // ==================== 计算属性 ====================
      friendsByCategory,
      onlineFriendsCount,
      pendingCount,
      totalFriendsCount,
      isLoaded,

      // ==================== 操作 ====================
      initialize,
      refreshAll,
      refreshFriends,
      refreshPending,
      sendRequest,
      acceptRequest,
      rejectRequest,
      acceptBatch,
      rejectBatch,
      removeFriend,
      searchUsers,
      clearSearchResults,
      invalidateCache,
      reset,
      isFriend,
      getFriend,
      getCategory,
      getCategoryName
    }
  },
  {
    // 持久化配置（可选）
    persist: {
      key: 'friendsV2',
      storage: localStorage
    }
  }
)
