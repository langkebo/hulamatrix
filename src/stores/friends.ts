import { defineStore } from 'pinia'
import {
  listCategories,
  listFriends,
  listPendingRequests,
  stats,
  sendRequest,
  acceptRequest,
  rejectRequest
} from '@/integrations/synapse/friends'
import { enhancedFriendsService, type Friend } from '@/services/enhancedFriendsService'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import type { NoticeItem } from '@/services/types'
import { RequestNoticeAgreeStatus } from '@/services/types'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { logger } from '@/utils/logger'

// Type definitions for API responses
interface ListCategoriesResponse {
  categories?: CategoryItem[]
  [key: string]: unknown
}

interface ListPendingRequestsResponse {
  requests?: PendingItem[]
  [key: string]: unknown
}

interface StatsResponse {
  accepted?: number
  groups?: number
  recent_added?: number
  [key: string]: unknown
}

interface ListFriendsResponse {
  friends?: FriendItem[]
  [key: string]: unknown
}

interface NoticeItemRaw {
  applyId: string
  senderId: string
  operateId?: string
  receiverId: string
  type: string
  eventType?: string
  roomId?: string
  content?: Record<string, unknown>
  status?: RequestNoticeAgreeStatus
  createTime: number
  [key: string]: unknown
}

interface SendRequestPayload {
  requester_id: string
  target_id: string
  message?: string
  category_id?: string
}

interface AcceptRequestPayload {
  request_id: string
  user_id: string
  category_id?: string
}

interface RejectRequestPayload {
  request_id: string
  user_id: string
}

export type FriendItem = {
  user_id: string
  category_id?: string
  category_name?: string
  category_color?: string
  created_at?: string
  avatar_url?: string
  display_name?: string
  status_text?: string
  name?: string
  presence?: 'online' | 'offline' | 'unavailable' | 'away'
  roomId?: string
}
export type CategoryItem = { id: string; name: string; color?: string }
export type PendingItem = {
  request_id: string
  requester_id: string
  target_id: string
  message?: string
  category_id?: string
  created_at?: string
}
export type Stats = { accepted?: number; groups?: number; recent_added?: number }

/**
 * 将增强服务的Friend转换为FriendItem
 */
function mapEnhancedFriendToItem(friend: Friend): FriendItem {
  const result: FriendItem = {
    user_id: friend.userId,
    presence: friend.presence
  }
  if (friend.displayName !== undefined) result.display_name = friend.displayName
  if (friend.avatarUrl !== undefined) result.avatar_url = friend.avatarUrl
  if (friend.statusText !== undefined) result.status_text = friend.statusText
  if (friend.roomId !== undefined) result.roomId = friend.roomId
  if (friend.categoryId !== null && friend.categoryId !== undefined) {
    result.category_id = friend.categoryId
  }
  return result
}

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    loading: false as boolean,
    error: '' as string,
    friends: [] as FriendItem[],
    categories: [] as CategoryItem[],
    pending: [] as PendingItem[],
    pendingGroups: [] as NoticeItem[],
    stats: {} as Stats,
    /** 是否使用增强服务 */
    useEnhancedService: true as boolean
  }),
  actions: {
    /**
     * 刷新所有好友数据
     * 使用增强服务获取好友列表，支持Synapse扩展和m.direct fallback
     *
     * Requirement 3.1, 3.5: 使用enhancedFriendsService并保持向后兼容性
     */
    async refreshAll() {
      this.loading = true
      this.error = ''
      try {
        // 并行获取分类、待处理请求和统计信息
        const [cats, pend, st] = await Promise.all([
          listCategories().catch(() => ({ categories: [] }) as ListCategoriesResponse),
          listPendingRequests().catch(() => ({ requests: [] }) as ListPendingRequestsResponse),
          stats().catch(() => ({}) as StatsResponse)
        ])

        this.categories = (cats?.categories || (Array.isArray(cats) ? cats : [])) as CategoryItem[]
        this.pending = (pend?.requests || (Array.isArray(pend) ? pend : [])) as PendingItem[]
        this.stats = st || {}

        // 使用增强服务获取好友列表（带presence同步）
        if (this.useEnhancedService) {
          try {
            const enhancedFriends = await enhancedFriendsService.listFriendsWithPresence()
            this.friends = enhancedFriends.map(mapEnhancedFriendToItem)
            logger.info('[FriendsStore] Loaded friends via enhanced service', {
              count: this.friends.length
            })
          } catch (enhancedError) {
            // 如果增强服务失败，回退到原始API
            logger.warn('[FriendsStore] Enhanced service failed, falling back to Synapse API', {
              error: enhancedError
            })
            const frs = (await listFriends()) as ListFriendsResponse | undefined
            this.friends = (frs?.friends || Array.isArray(frs) ? frs : []) as FriendItem[]
          }
        } else {
          // 使用原始Synapse API
          const frs = (await listFriends()) as ListFriendsResponse | undefined
          this.friends = (frs?.friends || Array.isArray(frs) ? frs : []) as FriendItem[]
        }
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '加载好友数据失败'
        logger.error('[FriendsStore] Failed to refresh friends', { error: e })
      } finally {
        this.loading = false
      }
    },

    /**
     * 仅刷新好友列表（不刷新分类和统计）
     */
    async refreshFriendsOnly() {
      try {
        if (this.useEnhancedService) {
          const enhancedFriends = await enhancedFriendsService.listFriendsWithPresence()
          this.friends = enhancedFriends.map(mapEnhancedFriendToItem)
        } else {
          const frs = (await listFriends()) as ListFriendsResponse | undefined
          this.friends = (frs?.friends || Array.isArray(frs) ? frs : []) as FriendItem[]
        }
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '刷新好友列表失败'
      }
    },

    /**
     * 同步好友在线状态
     */
    async syncPresence() {
      if (!this.useEnhancedService) return

      try {
        const currentFriends: Friend[] = this.friends.map((f) => ({
          userId: f.user_id,
          displayName: f.display_name,
          avatarUrl: f.avatar_url,
          presence: f.presence || 'offline',
          categoryId: f.category_id,
          roomId: f.roomId
        }))

        const updatedFriends = await enhancedFriendsService.syncPresenceForFriends(currentFriends)
        this.friends = updatedFriends.map(mapEnhancedFriendToItem)
      } catch (e: unknown) {
        logger.warn('[FriendsStore] Failed to sync presence', { error: e })
      }
    },

    friendsByCategory() {
      const map: Record<string, FriendItem[]> = {}
      for (const f of this.friends) {
        const key = f.category_id || 'default'
        ;(map[key] ||= []).push(f)
      }
      return map
    },
    async refreshGroupPending() {
      try {
        const res = (await requestWithFallback({
          url: 'get_notices',
          params: { pageNo: 1, pageSize: 50, click: false, applyType: 'group', cursor: '' }
        })) as { list?: NoticeItemRaw[] } | undefined
        const list: NoticeItem[] = (res?.list || []).map((it: NoticeItemRaw) => ({
          applyId: it.applyId,
          senderId: it.senderId,
          operateId: it.operateId,
          receiverId: it.receiverId,
          type: it.type,
          eventType: it.eventType,
          roomId: it.roomId,
          content: it.content,
          status: it.status ?? RequestNoticeAgreeStatus.UNTREATED,
          createTime: it.createTime
        })) as unknown as NoticeItem[]
        this.pendingGroups = list
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '加载群通知失败'
      }
    },
    async acceptGroupInvite(applyId: string) {
      try {
        await requestWithFallback({
          url: 'handle_notice',
          body: { applyId, state: RequestNoticeAgreeStatus.ACCEPTED }
        })
        await this.refreshGroupPending()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '接受群邀请失败'
        throw e
      }
    },
    async rejectGroupInvite(applyId: string) {
      try {
        await requestWithFallback({
          url: 'handle_notice',
          body: { applyId, state: RequestNoticeAgreeStatus.REJECTED }
        })
        await this.refreshGroupPending()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '拒绝群邀请失败'
        throw e
      }
    },
    /**
     * 发送好友请求
     * 使用增强服务发送请求，支持m.direct fallback
     */
    async request(target_id: string, message?: string, category_id?: string) {
      try {
        if (this.useEnhancedService) {
          // 使用增强服务发送好友请求
          await enhancedFriendsService.sendFriendRequest(target_id, message)
          logger.info('[FriendsStore] Friend request sent via enhanced service', { target_id })
        } else {
          // 使用原始Synapse API
          const me = this.me()
          const payload: SendRequestPayload = { requester_id: me, target_id }
          if (message !== undefined) payload.message = message
          if (category_id !== undefined) payload.category_id = category_id
          await sendRequest(payload)
        }
        await this.refreshAll()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '发送请求失败'
        throw e
      }
    },
    async accept(request_id: string, category_id?: string) {
      try {
        const me = this.me()
        const payload: AcceptRequestPayload = { request_id, user_id: me }
        if (category_id !== undefined) payload.category_id = category_id
        await acceptRequest(payload)
        await this.refreshAll()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '接受请求失败'
        throw e
      }
    },
    async acceptBatch(request_ids: string[], category_id?: string) {
      try {
        const me = this.me()
        await Promise.all(
          request_ids.map((id) => {
            const payload: AcceptRequestPayload = { request_id: id, user_id: me }
            if (category_id !== undefined) payload.category_id = category_id
            return acceptRequest(payload)
          })
        )
        await this.refreshAll()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '批量接受请求失败'
        throw e
      }
    },
    async reject(request_id: string) {
      try {
        const me = this.me()
        await rejectRequest({ request_id, user_id: me } as RejectRequestPayload)
        await this.refreshAll()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '拒绝请求失败'
        throw e
      }
    },
    async rejectBatch(request_ids: string[]) {
      try {
        const me = this.me()
        await Promise.all(
          request_ids.map((id) => rejectRequest({ request_id: id, user_id: me } as RejectRequestPayload))
        )
        await this.refreshAll()
      } catch (e: unknown) {
        this.error = (e as { message?: string })?.message || '批量拒绝请求失败'
        throw e
      }
    },
    me(): string {
      try {
        return useMatrixAuthStore().userId || ''
      } catch {
        return ''
      }
    },

    /**
     * Check if a user is in the friends list
     * @param userId - The user ID to check
     * @returns true if the user is a friend, false otherwise
     */
    isFriend(userId: string): boolean {
      if (!userId) return false
      // Check if the user exists in the friends array
      return this.friends.some((friend) => friend.user_id === userId)
    },

    /**
     * Get friend info by user ID
     * @param userId - The user ID to look up
     * @returns The friend item or undefined if not found
     */
    getFriend(userId: string): FriendItem | undefined {
      if (!userId) return undefined
      return this.friends.find((friend) => friend.user_id === userId)
    }
  }
})
