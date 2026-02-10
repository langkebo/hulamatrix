/*
 * Friends Management Service
 *
 * Provides comprehensive friend management functionality including:
 * - Friend list management
 * - Friend requests (send, accept, reject)
 * - Friend categories (create, edit, delete, move friends)
 * - User blocking
 * - Friend statistics
 */

import { enhancedSdkService } from './EnhancedSdkService'
import { SynapseEnhancedError } from './utils/SynapseEnhancedError'
import { createServiceLogger } from '@/utils/Logger'

const logger = createServiceLogger('FriendsService')

export interface Friend {
  userId: string
  displayName?: string
  avatarUrl?: string
  remark?: string
  categoryId?: string
  createdAt?: string
  lastActive?: string
}

export interface FriendRequest {
  requestId: string
  senderId: string
  receiverId: string
  status: 'pending' | 'accepted' | 'rejected'
  message?: string
  createdAt: string
}

export interface FriendCategory {
  categoryId: string
  name: string
  parentId?: string
  friendCount: number
  createdAt: string
}

export interface BlockedUser {
  userId: string
  displayName?: string
  avatarUrl?: string
  blockedAt: string
  reason?: string
}

export interface FriendStatistics {
  totalFriends: number
  onlineFriends: number
  pendingRequests: number
  blockedCount: number
  categoryDistribution: Record<string, number>
}

export interface PaginatedFriends {
  items: Friend[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

class FriendsService {
  private static instance: FriendsService
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 60 * 1000

  private constructor() {}

  static getInstance(): FriendsService {
    if (!FriendsService.instance) {
      FriendsService.instance = new FriendsService()
    }
    return FriendsService.instance
  }

  private getClient() {
    return enhancedSdkService.getClient()
  }

  private getCacheKey(method: string, params?: Record<string, unknown>): string {
    return params ? `${method}:${JSON.stringify(params)}` : method
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T
    }
    return null
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  private clearCache(method?: string): void {
    if (method) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(method)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  async getFriends(page: number = 1, limit: number = 20, categoryId?: string): Promise<PaginatedFriends> {
    const cacheKey = this.getCacheKey('getFriends', { page, limit, categoryId })
    const cached = this.getCached<PaginatedFriends>(cacheKey)
    if (cached && page === 1) {
      return cached
    }

    try {
      const client = this.getClient()
      const result = await client.friends.getFriends({ page, limit, category: categoryId })

      const paginatedResult: PaginatedFriends = {
        items: result.items.map((f) => ({
          userId: f.friend_id,
          displayName: f.display_name || '',
          avatarUrl: f.avatar_url || '',
          remark: f.remark || '',
          tags: [], // IFriend doesn't have tags?
          isOnline: false, // IFriend doesn't have presence
          lastSeen: ''
        })),
        total: result.pagination.total,
        page,
        pageSize: limit,
        hasMore: result.items.length === limit
      }

      if (page === 1) {
        this.setCache(cacheKey, paginatedResult)
      }

      return paginatedResult
    } catch (error) {
      logger.error('Failed to get friends:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async getFriendsBatch(userIds: string[]): Promise<Friend[]> {
    if (!userIds.length) return []
    try {
      const client = this.getClient()
      const resultMap = await client.friends.getFriendsBatch(userIds)

      return userIds.map((id) => {
        const f = resultMap.get(id)
        if (!f) return { userId: id } as Friend

        return {
          userId: f.friend_id,
          displayName: f.display_name || '',
          avatarUrl: f.avatar_url || '',
          remark: f.remark || '',
          tags: [],
          isOnline: false,
          lastSeen: ''
        }
      })
    } catch (error) {
      logger.error('Failed to get friends batch:', error)
      throw this.handleError(error)
    }
  }

  async searchFriends(query: string, limit: number = 20): Promise<Friend[]> {
    try {
      const client = this.getClient()
      const result = await client.friends.searchFriends(query, limit)
      return (result as any)?.items || result || []
    } catch (error) {
      console.error('[FriendsService] Failed to search friends:', error)
      return []
    }
  }

  async sendFriendRequest(targetUserId: string, message?: string): Promise<FriendRequest> {
    try {
      const client = this.getClient()
      const result = await client.friends.sendFriendRequest({ target_id: targetUserId, message })

      this.clearCache('getFriends')
      this.clearCache('getPendingRequests')

      return {
        requestId: result.request_id || '',
        senderId: (this.getClient() as any).getUserId() || '',
        receiverId: targetUserId,
        status: result.status as any,
        message,
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Failed to send friend request:', error)
      throw this.handleError(error)
    }
  }

  async getPendingRequests(): Promise<FriendRequest[]> {
    const cacheKey = this.getCacheKey('getPendingRequests')
    const cached = this.getCached<FriendRequest[]>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const client = this.getClient()
      const result = await client.friends.getPendingRequests()

      const requests: FriendRequest[] = result.map((req) => ({
        requestId: req.request_id,
        senderId: req.requester_id,
        receiverId: req.target_id,
        status: req.status as any,
        message: req.message,
        createdAt: req.created_at
      }))

      this.setCache(cacheKey, requests)
      return requests
    } catch (error) {
      console.error('[FriendsService] Failed to get pending requests:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async acceptFriendRequest(requestId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.acceptFriendRequest(requestId)

      this.clearCache('getFriends')
      this.clearCache('getPendingRequests')
      return true
    } catch (error) {
      console.error('[FriendsService] Failed to accept friend request:', error)
      throw this.handleError(error)
    }
  }

  async rejectFriendRequest(requestId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.rejectFriendRequest(requestId)

      this.clearCache('getPendingRequests')
      return true
    } catch (error) {
      logger.error('Failed to reject friend request:', error)
      throw this.handleError(error)
    }
  }

  async removeFriend(userId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.removeFriend(userId)

      this.clearCache('getFriends')
      return true
    } catch (error) {
      console.error('[FriendsService] Failed to remove friend:', error)
      throw this.handleError(error)
    }
  }

  async createCategory(name: string, parentId?: string): Promise<FriendCategory> {
    try {
      const client = this.getClient()
      const result = await client.friends.createCategory(name)

      this.clearCache('getCategories')

      return {
        categoryId: result.id,
        name: result.name,
        parentId,
        friendCount: 0,
        createdAt: result.created_at
      }
    } catch (error) {
      logger.error('Failed to create category:', error)
      throw this.handleError(error)
    }
  }

  async getCategories(): Promise<FriendCategory[]> {
    const cacheKey = this.getCacheKey('getCategories')
    const cached = this.getCached<FriendCategory[]>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const client = this.getClient()
      const result = await client.friends.getCategories()

      const categories: FriendCategory[] = (result || []).map((cat: any) => ({
        categoryId: cat.category_id || cat.id,
        name: cat.name,
        parentId: cat.parent_id,
        friendCount: cat.friend_count || 0,
        createdAt: cat.created_at || new Date().toISOString()
      }))

      this.setCache(cacheKey, categories)
      return categories
    } catch (error) {
      console.error('[FriendsService] Failed to get categories:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async moveFriendToCategory(userId: string, categoryId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.moveFriendToCategory(userId, categoryId)

      this.clearCache('getFriends')
      this.clearCache('getCategories')
      return true
    } catch (error) {
      console.error('[FriendsService] Failed to move friend to category:', error)
      throw this.handleError(error)
    }
  }

  async blockUser(userId: string, reason?: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.blockUser(userId, reason)

      this.clearCache('getFriends')
      this.clearCache('getBlockedUsers')
      return true
    } catch (error) {
      logger.error('Failed to block user:', error)
      throw this.handleError(error)
    }
  }

  async unblockUser(userId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.friends.unblockUser(userId)

      this.clearCache('getBlockedUsers')
      return true
    } catch (error) {
      console.error('[FriendsService] Failed to unblock user:', error)
      throw this.handleError(error)
    }
  }

  async getBlockedUsers(page: number = 1, limit: number = 20): Promise<BlockedUser[]> {
    const cacheKey = this.getCacheKey('getBlockedUsers', { page, limit })
    const cached = this.getCached<BlockedUser[]>(cacheKey)
    if (cached && page === 1) {
      return cached
    }

    try {
      const client = this.getClient()
      const result = await client.friends.getBlockedUsers({ page, limit })

      const blockedUsers: BlockedUser[] = result.items.map((user) => ({
        userId: user.user_id,
        displayName: undefined,
        avatarUrl: '',
        blockedAt: user.blocked_at || new Date().toISOString(),
        reason: user.reason
      }))

      if (page === 1) {
        this.setCache(cacheKey, blockedUsers)
      }

      return blockedUsers
    } catch (error) {
      logger.error('Failed to get blocked users:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async isBlocked(userId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      return await client.friends.isBlocked(userId)
    } catch (error) {
      console.error('[FriendsService] Failed to check if user is blocked:', error)
      return false
    }
  }

  async getStatistics(): Promise<FriendStatistics> {
    const cacheKey = this.getCacheKey('getStatistics')
    const cached = this.getCached<FriendStatistics>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const client = this.getClient()
      const stats = await client.friends.getFriendStats()

      const result: FriendStatistics = {
        totalFriends: stats.total_friends,
        onlineFriends: 0,
        pendingRequests: stats.pending_requests,
        blockedCount: stats.blocked_count,
        categoryDistribution: {}
      }

      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      logger.error('Failed to get statistics:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof SynapseEnhancedError) {
      return new Error(`[FriendsService] ${error.code}: ${error.message}`)
    }
    const err = error as Error
    return err
  }
}

export default FriendsService
