import type * as sdk from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'

export interface FriendRequest {
  id: string
  requester_id: string
  requester_name?: string
  requester_avatar?: string
  message: string
  created_at: string
  expires_at?: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface Friend {
  user_id: string
  display_name?: string
  avatar_url?: string
  category_id?: number
  category_name?: string
  category_color?: string
  created_at: string
  status: 'active' | 'blocked'
}

export interface FriendCategory {
  id: number
  name: string
  description?: string
  color: string
  friend_count: number
}

export interface FriendSearchResult {
  user_id: string
  display_name?: string
  avatar_url?: string
}

export interface FriendCache {
  friends: Friend[]
  pendingRequests: FriendRequest[]
  categories: FriendCategory[]
  timestamp: number
}

class MatrixFriendsService {
  private static instance: MatrixFriendsService
  private client: sdk.MatrixClient | null = null
  private friendSystemManager: any = null
  private cache: Map<string, FriendCache> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private constructor() {}

  static getInstance(): MatrixFriendsService {
    if (!MatrixFriendsService.instance) {
      MatrixFriendsService.instance = new MatrixFriendsService()
    }
    return MatrixFriendsService.instance
  }

  setClient(client: sdk.MatrixClient | null): void {
    this.client = client
    const clientService = MatrixClientService.getInstance()
    this.friendSystemManager = client ? clientService.getFriendSystemManager() : null
  }

  private getCacheKey(type: string, userId?: string): string {
    return userId ? `${type}:${userId}` : type
  }

  private getCache(type: string, userId?: string): FriendCache | null {
    const key = this.getCacheKey(type, userId)
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached
    }
    return null
  }

  private setCache(type: string, data: any, userId?: string): void {
    const key = this.getCacheKey(type, userId)
    this.cache.set(key, {
      ...data,
      timestamp: Date.now()
    })
  }

  private clearCache(type?: string, userId?: string): void {
    if (type) {
      const key = this.getCacheKey(type, userId)
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  async sendFriendRequest(userId: string, message?: string): Promise<string> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      const response = await this.friendSystemManager.sendFriendRequest(userId, message)
      this.clearCache('pendingRequests')
      return response.request_id
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to send friend request:', error)
      throw error
    }
  }

  async acceptFriendRequest(requestId: string, message?: string): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.respondToFriendRequest(requestId, 'accept', message)
      this.clearCache('friends')
      this.clearCache('pendingRequests')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to accept friend request:', error)
      throw error
    }
  }

  async rejectFriendRequest(requestId: string, message?: string): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.respondToFriendRequest(requestId, 'reject', message)
      this.clearCache('pendingRequests')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to reject friend request:', error)
      throw error
    }
  }

  async cancelFriendRequest(requestId: string): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.respondToFriendRequest(requestId, 'reject', 'Cancelled')
      this.clearCache('pendingRequests')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to cancel friend request:', error)
      throw error
    }
  }

  async getFriendsList(options?: {
    status?: string
    limit?: number
    offset?: number
    forceRefresh?: boolean
  }): Promise<{ friends: Friend[]; total: number }> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    if (!options?.forceRefresh) {
      const cached = this.getCache('friends')
      if (cached) {
        return { friends: cached.friends, total: cached.friends.length }
      }
    }

    try {
      const response = await this.friendSystemManager.getFriendsList(options)
      const friendsWithDetails = await Promise.all(
        response.friends.map(async (friend: any) => {
          const user = this.client?.getUser(friend.user_id)
          return {
            ...friend,
            display_name: user?.displayName,
            avatar_url: user?.avatarUrl,
            status: 'active' as const
          }
        })
      )

      this.setCache('friends', { friends: friendsWithDetails })

      return { friends: friendsWithDetails, total: response.total }
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to get friends list:', error)
      const cached = this.getCache('friends')
      if (cached) {
        return { friends: cached.friends, total: cached.friends.length }
      }
      throw error
    }
  }

  async deleteFriend(userId: string): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.deleteFriend(userId)
      this.clearCache('friends')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to delete friend:', error)
      throw error
    }
  }

  async blockUser(userId: string, _reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.client.setIgnoredUsers([userId])
      this.clearCache('friends')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to block user:', error)
      throw error
    }
  }

  async unblockUser(userId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const ignoredUsers = this.client.getIgnoredUsers()
      const filtered = ignoredUsers.filter((id: string) => id !== userId)
      await this.client.setIgnoredUsers(filtered)
      this.clearCache('friends')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to unblock user:', error)
      throw error
    }
  }

  async getBlockedUsers(): Promise<Friend[]> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const ignoredUsers = this.client.getIgnoredUsers()
      const blockedUsers = await Promise.all(
        ignoredUsers.map(async (userId: string) => {
          const user = this.client?.getUser(userId)
          return {
            user_id: userId,
            display_name: user?.displayName,
            avatar_url: user?.avatarUrl,
            created_at: new Date().toISOString(),
            status: 'blocked' as const
          }
        })
      )

      return blockedUsers
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to get blocked users:', error)
      return []
    }
  }

  async searchFriends(query: string, limit: number = 10): Promise<FriendSearchResult[]> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      const response = await this.friendSystemManager.searchFriends(query, limit)
      return response.results.map((result: any) => {
        const user = this.client?.getUser(result.user_id)
        return {
          user_id: result.user_id,
          display_name: user?.displayName,
          avatar_url: user?.avatarUrl
        }
      })
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to search friends:', error)
      return []
    }
  }

  async getPendingRequests(forceRefresh?: boolean): Promise<FriendRequest[]> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    if (!forceRefresh) {
      const cached = this.getCache('pendingRequests')
      if (cached) {
        return cached.pendingRequests
      }
    }

    try {
      const response = await this.friendSystemManager.getPendingRequests()
      const requestsWithDetails = await Promise.all(
        response.requests.map(async (request: any) => {
          const user = this.client?.getUser(request.requester_id)
          return {
            ...request,
            requester_name: user?.displayName,
            requester_avatar: user?.avatarUrl,
            status: 'pending' as const
          }
        })
      )

      this.setCache('pendingRequests', { pendingRequests: requestsWithDetails })

      return requestsWithDetails
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to get pending requests:', error)
      const cached = this.getCache('pendingRequests')
      if (cached) {
        return cached.pendingRequests
      }
      throw error
    }
  }

  async createFriendCategory(name: string, description?: string, color?: string): Promise<number> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      const response = await this.friendSystemManager.createFriendCategory(name, description, color)
      this.clearCache('categories')
      return response.category_id
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to create friend category:', error)
      throw error
    }
  }

  async getFriendCategories(forceRefresh?: boolean): Promise<FriendCategory[]> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    if (!forceRefresh) {
      const cached = this.getCache('categories')
      if (cached) {
        return cached.categories
      }
    }

    try {
      const response = await this.friendSystemManager.getFriendCategories()
      this.setCache('categories', { categories: response.categories })
      return response.categories
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to get friend categories:', error)
      const cached = this.getCache('categories')
      if (cached) {
        return cached.categories
      }
      throw error
    }
  }

  async addToFriendCategory(userId: string, categoryId: number): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.addFriendToCategory(userId, categoryId)
      this.clearCache('friends')
      this.clearCache('categories')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to add friend to category:', error)
      throw error
    }
  }

  async removeFromFriendCategory(userId: string, categoryId: number): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.removeFriendFromCategory(userId, categoryId)
      this.clearCache('friends')
      this.clearCache('categories')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to remove friend from category:', error)
      throw error
    }
  }

  async deleteFriendCategory(categoryId: number): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.deleteFriendCategory(categoryId)
      this.clearCache('categories')
      this.clearCache('friends')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to delete friend category:', error)
      throw error
    }
  }

  async renameFriendCategory(categoryId: number, name: string): Promise<void> {
    if (!this.client || !this.friendSystemManager) {
      throw new Error('Matrix client not initialized or FriendSystemManager not available')
    }

    try {
      await this.friendSystemManager.renameFriendCategory(categoryId, name)
      this.clearCache('categories')
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to rename friend category:', error)
      throw error
    }
  }

  async getUserProfile(userId: string): Promise<{
    user_id: string
    display_name?: string
    avatar_url?: string
    presence?: string
    status_msg?: string
  }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const user = this.client.getUser(userId)
      const profile = await this.client.getProfileInfo(userId)

      return {
        user_id: userId,
        display_name: user?.displayName || profile.displayname,
        avatar_url: user?.avatarUrl || profile.avatar_url,
        presence: user?.presence,
        status_msg: user?.presenceStatusMsg
      }
    } catch (error) {
      console.error('[MatrixFriendsService] Failed to get user profile:', error)
      throw error
    }
  }
}

export default MatrixFriendsService
