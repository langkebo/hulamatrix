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
      const result = (await client.friends.getFriends({ page, limit, category: categoryId })) as any

      const paginatedResult: PaginatedFriends = {
        items: result?.items || result || [],
        total: result?.total || result?.length || 0,
        page,
        pageSize: limit,
        hasMore: (result?.items || result || []).length === limit
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
      const result = await (client.friends.sendFriendRequest as any)(targetUserId, message)

      this.clearCache('getFriends')
      this.clearCache('getPendingRequests')

      return {
        requestId: result?.request_id || result?.id || '',
        senderId: result?.sender_id || '',
        receiverId: result?.receiver_id || targetUserId,
        status: 'pending',
        message,
        createdAt: result?.created_at || new Date().toISOString()
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

      const requests: FriendRequest[] = (result || []).map((req: any) => ({
        requestId: req.request_id || req.room_id,
        senderId: req.sender_id || req.from_user,
        receiverId: req.receiver_id || req.to_user,
        status: req.status || 'pending',
        message: req.message,
        createdAt: req.created_at || new Date().toISOString()
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
      const result = await (client.friends.createCategory as any)(name, parentId)

      this.clearCache('getCategories')

      return {
        categoryId: result?.category_id || result?.id || '',
        name: result?.name || name,
        parentId: result?.parent_id || parentId,
        friendCount: 0,
        createdAt: result?.created_at || new Date().toISOString()
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
      const result = await (client.friends.getBlockedUsers as any)(page, limit)

      const blockedUsers: BlockedUser[] = (result?.items || result || []).map((user: any) => ({
        userId: user.user_id || user.id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
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
      const stats = await ((client.friends as any)?.getStats?.() || {})

      const result: FriendStatistics = {
        totalFriends: (stats as any)?.total_friends || (stats as any)?.total || 0,
        onlineFriends: (stats as any)?.online_friends || 0,
        pendingRequests: (stats as any)?.pending_requests || 0,
        blockedCount: (stats as any)?.blocked_count || 0,
        categoryDistribution: (stats as any)?.category_distribution || {}
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
