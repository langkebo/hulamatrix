/**
 * Matrix 好友适配器
 *
 * 封装 EnhancedFriendsService 实现好友系统功能
 * Phase 4: 集成迁移监控，记录好友操作性能
 */

import { enhancedFriendsService, type Friend as EnhancedFriendType } from '@/services/enhancedFriendsService'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import type {
  FriendAdapter,
  Friend,
  FriendCategory,
  FriendRequest,
  FriendStatus,
  PresenceUpdateCallback
} from './service-adapter'
import { logger } from '@/utils/logger'
import { migrationMonitor } from '@/utils/migrationMonitor'

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  credentials?: { userId?: string }
  getUserId?: () => string
  getRooms?: () => MatrixRoom[]
  getAccountData?: (type: string) => MatrixAccountData | null
  setRoomTag?: (roomId: string, tag: string, content: Record<string, unknown>) => Promise<unknown>
  deleteRoomTag?: (roomId: string, tag: string) => Promise<unknown>
}

/** Matrix 房间接口 */
interface MatrixRoom {
  roomId: string
  getMember?: (userId: string) => MatrixRoomMember | null
  getJoinedMembers?: () => MatrixRoomMember[]
  getCreationTimestamp?: () => number
}

/** Matrix 房间成员接口 */
interface MatrixRoomMember {
  userId?: string
  user?: { userId?: string; avatarUrl?: string }
  name?: string
  rawName?: string
  avatarUrl?: string
  membership?: string
}

/** Matrix 账户数据接口 */
interface MatrixAccountData {
  getContent?: () => Record<string, string[]>
}

/** EnhancedFriendsService 好友接口 */
// Re-using the imported type
type EnhancedFriend = EnhancedFriendType

export class MatrixFriendAdapter implements FriendAdapter {
  name = 'matrix-friend'
  priority = 100 // Phase 4: 提高优先级到 100（高于 WebSocket 的 90）

  private presenceCallbacks: Set<PresenceUpdateCallback> = new Set()

  async isReady(): Promise<boolean> {
    try {
      return enhancedFriendsService.isInitialized()
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 检查就绪状态失败:', error)
      return false
    }
  }

  async initialize(): Promise<void> {
    try {
      await enhancedFriendsService.initialize()
      // 订阅 Presence 更新 - 回调接收单个事件，不是数组
      enhancedFriendsService.onPresenceUpdate((event) => {
        // 映射 EnhancedFriendsService 的 PresenceUpdateEvent 到 adapter 的 PresenceUpdateEvent
        const adapterEvent: Parameters<PresenceUpdateCallback>[0] = {
          userId: event.userId,
          status: this.mapPresenceStatus(event.presence)
        }
        if (event.lastActiveAgo !== undefined) {
          adapterEvent.lastActive = event.lastActiveAgo
        }
        this.presenceCallbacks.forEach((callback) => callback(adapterEvent))
      })
      logger.info('[MatrixFriendAdapter] 初始化成功')
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 初始化失败:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    this.presenceCallbacks.clear()
    // EnhancedFriendsService 没有 cleanup 方法，使用 unsubscribeFromPresence
    enhancedFriendsService.unsubscribeFromPresence?.()
  }

  /**
   * 获取好友列表
   */
  async listFriends(options?: { includePresence?: boolean; categoryId?: string | null }): Promise<Friend[]> {
    const startTime = Date.now()
    try {
      let friends: EnhancedFriendType[]

      if (options?.categoryId !== undefined) {
        friends = await enhancedFriendsService.getFriendsByCategory(options.categoryId)
      } else {
        friends = options?.includePresence
          ? await enhancedFriendsService.listFriendsWithPresence()
          : await enhancedFriendsService.listFriends()
      }

      // Phase 4: 记录路由决策和性能
      const latency = Date.now() - startTime
      migrationMonitor.recordRoute({
        route: 'matrix',
        encrypted: false
      })
      migrationMonitor.recordPerformance('matrix', latency)

      logger.info('[MatrixFriendAdapter] List friends successful via Matrix SDK', {
        count: friends.length,
        latency
      })

      return friends.map((f): Friend => this.mapEnhancedFriend(f))
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 获取好友列表失败:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      return []
    }
  }

  /**
   * 搜索好友
   * 注意: EnhancedFriendsService 没有 searchFriends 方法
   * 这里实现客户端搜索作为 fallback
   */
  async searchFriends(query: string, limit: number = 20): Promise<Friend[]> {
    try {
      const friends = await enhancedFriendsService.listFriends()
      const lowerQuery = query.toLowerCase()

      // 客户端过滤
      const results = friends
        .filter((f) => f.displayName?.toLowerCase().includes(lowerQuery) || f.userId.toLowerCase().includes(lowerQuery))
        .slice(0, limit)

      return results.map((f): Friend => this.mapEnhancedFriend(f))
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 搜索好友失败:', error)
      return []
    }
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(targetUserId: string, message?: string): Promise<string> {
    try {
      const requestId = await enhancedFriendsService.sendFriendRequest(targetUserId, message)
      logger.info('[MatrixFriendAdapter] 发送好友请求成功:', { targetUserId, requestId })
      return requestId
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 发送好友请求失败:', error)
      throw error
    }
  }

  /**
   * 获取待处理的好友请求
   * 注意: EnhancedFriendsService 没有 listPendingRequests 方法
   * 这里从 Matrix 客户端获取被邀请的房间作为好友请求
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const client = matrixClientService.getClient() as MatrixClientExtended | null
      if (!client) return []

      // 获取所有房间
      const rooms = client.getRooms?.() || []
      const requests: FriendRequest[] = []

      for (const room of rooms) {
        try {
          // 检查是否是私聊房间且当前用户被邀请
          const myUserId = useMatrixAuthStore().userId || client.getUserId?.()
          if (!myUserId) continue

          const member = room.getMember?.(myUserId)
          if (!member) continue

          const membership = member.membership

          // 检查 m.direct 账户数据
          let isDirect = false
          try {
            const mDirect = client.getAccountData?.('m.direct')
            const mDirectContent = mDirect?.getContent?.()
            if (mDirectContent) {
              for (const userId in mDirectContent) {
                if (mDirectContent[userId]?.includes(room.roomId)) {
                  isDirect = true
                  break
                }
              }
            }
          } catch {
            // 忽略获取 m.direct 失败
          }

          if (isDirect && membership === 'invite') {
            // 尝试获取邀请者信息
            const members = room.getJoinedMembers?.() || []
            const inviter = members[0] // 获取第一个加入的成员作为邀请者

            if (inviter) {
              const request: FriendRequest = {
                requestId: room.roomId,
                fromUserId: inviter.userId || inviter.user?.userId || room.roomId,
                fromDisplayName: inviter.name || inviter.rawName || inviter.userId || 'Unknown',
                roomId: room.roomId,
                timestamp: room.getCreationTimestamp?.() || Date.now()
              }
              if (inviter.user?.avatarUrl) {
                request.fromAvatarUrl = inviter.user.avatarUrl
              }
              requests.push(request)
            }
          }
        } catch (_roomError) {}
      }

      return requests
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 获取待处理请求失败:', error)
      return []
    }
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(requestId: string, _categoryId?: string): Promise<void> {
    try {
      const client = matrixClientService.getClient() as MatrixClientExtended | null
      if (!client) throw new Error('Matrix 客户端未初始化')

      // 获取当前用户ID - credentials userId
      const myUserId = client.credentials?.userId || client.getUserId?.()
      if (!myUserId) throw new Error('无法获取当前用户ID')

      // acceptFriendRequest now takes roomId and optional requestId
      await enhancedFriendsService.acceptFriendRequest(requestId)
      logger.info('[MatrixFriendAdapter] 接受好友请求成功:', { requestId })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 接受好友请求失败:', error)
      throw error
    }
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await enhancedFriendsService.rejectFriendRequest(requestId)
      logger.info('[MatrixFriendAdapter] 拒绝好友请求成功:', { requestId })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 拒绝好友请求失败:', error)
      throw error
    }
  }

  /**
   * 删除好友
   */
  async removeFriend(userId: string): Promise<void> {
    try {
      // 需要先获取与该用户的私信房间ID
      const client = matrixClientService.getClient() as MatrixClientExtended | null
      if (!client) throw new Error('Matrix 客户端未初始化')

      // 从 m.direct 获取房间ID
      let roomIds: string[] = []
      try {
        const mDirect = client.getAccountData?.('m.direct')
        const mDirectContent = mDirect?.getContent?.()
        if (mDirectContent && mDirectContent[userId]) {
          const ids = mDirectContent[userId]
          if (Array.isArray(ids)) {
            roomIds = ids
          }
        }
      } catch {
        // 忽略 m.direct 获取失败
      }

      if (roomIds.length === 0) {
        throw new Error(`未找到与用户 ${userId} 的私信房间`)
      }

      const roomId = roomIds[0]
      if (!roomId) {
        throw new Error(`未找到与用户 ${userId} 的私信房间 ID`)
      }
      await enhancedFriendsService.removeFriend(userId, roomId)
      logger.info('[MatrixFriendAdapter] 删除好友成功:', { userId })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 删除好友失败:', error)
      throw error
    }
  }

  /**
   * 获取好友在线状态
   */
  async getPresence(userId: string): Promise<FriendStatus> {
    try {
      const presence = await enhancedFriendsService.getPresence(userId)
      return this.mapPresenceStatus(presence)
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 获取Presence失败:', error)
      return 'offline'
    }
  }

  /**
   * 订阅 Presence 更新
   */
  subscribeToPresence(callback: PresenceUpdateCallback): () => void {
    this.presenceCallbacks.add(callback)

    // 返回取消订阅函数
    return () => {
      this.presenceCallbacks.delete(callback)
    }
  }

  /**
   * 获取好友分类列表
   * 注意: EnhancedFriendsService.FriendCategory 只有 {id, name, order}
   * 需要映射到 adapter 的 FriendCategory 接口
   */
  async listCategories(): Promise<FriendCategory[]> {
    try {
      const categories = await enhancedFriendsService.listCategories()
      // 计算每个分类的好友数量
      const result: FriendCategory[] = []

      for (const cat of categories) {
        const friends = await enhancedFriendsService.getFriendsByCategory(cat.id)
        const category: FriendCategory = {
          categoryId: cat.id,
          name: cat.name,
          sort: cat.order,
          count: friends.length
        }
        result.push(category)
      }

      return result
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 获取分类列表失败:', error)
      return []
    }
  }

  /**
   * 创建好友分类
   * 注意: EnhancedFriendsService.createCategory 只接受 name 参数
   */
  async createCategory(name: string, description?: string, color?: string): Promise<FriendCategory> {
    try {
      const category = await enhancedFriendsService.createCategory(name)
      // description 和 color 存储在客户端，不在服务端
      const result: FriendCategory = {
        categoryId: category.id,
        name: category.name,
        sort: category.order,
        count: 0
      }
      if (description !== undefined) {
        result.description = description
      }
      if (color !== undefined) {
        result.color = color
      }
      return result
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 创建分类失败:', error)
      throw error
    }
  }

  /**
   * 删除好友分类
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      await enhancedFriendsService.deleteCategory(categoryId)
      logger.info('[MatrixFriendAdapter] 删除分类成功:', { categoryId })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 删除分类失败:', error)
      throw error
    }
  }

  /**
   * 设置好友分类
   * 注意: EnhancedFriendsService.setFriendCategory 接受 roomId 而不是 userId
   */
  async setFriendCategory(userId: string, categoryId: string | null): Promise<void> {
    try {
      // 需要先获取 roomId
      const client = matrixClientService.getClient() as MatrixClientExtended | null
      if (!client) throw new Error('Matrix 客户端未初始化')

      let roomIds: string[] = []
      try {
        const mDirect = client.getAccountData?.('m.direct')
        const mDirectContent = mDirect?.getContent?.()
        if (mDirectContent && mDirectContent[userId]) {
          const ids = mDirectContent[userId]
          if (Array.isArray(ids)) {
            roomIds = ids
          }
        }
      } catch {
        // 忽略 m.direct 获取失败
      }

      if (roomIds.length === 0) {
        throw new Error(`未找到与用户 ${userId} 的私信房间`)
      }

      const roomId = roomIds[0]
      if (!roomId) {
        throw new Error(`未找到与用户 ${userId} 的私信房间 ID`)
      }
      await enhancedFriendsService.setFriendCategory(roomId, categoryId)
      logger.info('[MatrixFriendAdapter] 设置好友分类成功:', { userId, categoryId })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 设置好友分类失败:', error)
      throw error
    }
  }

  /**
   * 更新好友备注
   * 注意: EnhancedFriendsService 没有 updateFriendRemark 方法
   * 需要使用 Matrix 的房间标签功能存储备注
   */
  async updateFriendRemark(userId: string, remark: string): Promise<void> {
    try {
      const client = matrixClientService.getClient() as MatrixClientExtended | null
      if (!client) throw new Error('Matrix 客户端未初始化')

      // 获取私信房间
      let roomIds: string[] = []
      try {
        const mDirect = client.getAccountData?.('m.direct')
        const mDirectContent = mDirect?.getContent?.()
        if (mDirectContent && mDirectContent[userId]) {
          const ids = mDirectContent[userId]
          if (Array.isArray(ids)) {
            roomIds = ids
          }
        }
      } catch {
        // 忽略 m.direct 获取失败
      }

      if (roomIds.length === 0) {
        throw new Error(`未找到与用户 ${userId} 的私信房间`)
      }

      const roomId = roomIds[0]
      if (!roomId) {
        throw new Error(`未找到与用户 ${userId} 的私信房间 ID`)
      }

      // 使用房间标签存储备注 (自定义标签前缀)
      const remarkTag = `im.hula.remark`
      if (remark) {
        await client.setRoomTag?.(roomId, remarkTag, { order: 0, remark })
      } else {
        try {
          await client.deleteRoomTag?.(roomId, remarkTag)
        } catch {
          // 忽略删除不存在的标签
        }
      }

      logger.info('[MatrixFriendAdapter] 更新好友备注成功:', { userId, remark })
    } catch (error) {
      logger.error('[MatrixFriendAdapter] 更新好友备注失败:', error)
      throw error
    }
  }

  /**
   * 映射增强服务的好友数据
   */
  private mapEnhancedFriend = (friend: EnhancedFriend): Friend => {
    const displayName = friend.displayName ?? friend.userId
    const result: Friend = {
      userId: friend.userId,
      displayName: displayName,
      status: this.mapPresenceStatus(friend.presence),
      categoryId: friend.categoryId ?? null
    }
    if (friend.avatarUrl !== undefined) {
      result.avatarUrl = friend.avatarUrl
    }
    if (friend.lastActiveAgo !== undefined) {
      result.lastActive = Date.now() - friend.lastActiveAgo
    }
    return result
  }

  /**
   * 映射 Presence 状态
   */
  private mapPresenceStatus = (presence: string): FriendStatus => {
    const status = presence?.toLowerCase()
    switch (status) {
      case 'online':
      case 'active':
        return 'online'
      case 'unavailable':
      case 'busy':
        return 'unavailable'
      case 'away':
      case 'idle':
        return 'away'
      default:
        return 'offline'
    }
  }
}

// 导出单例实例
export const matrixFriendAdapter = new MatrixFriendAdapter()
