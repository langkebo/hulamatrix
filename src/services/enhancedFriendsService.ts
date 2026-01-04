/**
 * 增强好友服务
 * 提供好友管理功能，支持Synapse扩展API和Matrix m.direct fallback
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * Phase 12 优化: 使用缓存的 client 引用，避免重复调用 getClient()
 *
 * @module EnhancedFriendsService
 */

import { matrixClientService } from '@/integrations/matrix/client'
import * as synapseApi from '@/integrations/synapse/friends'
import { logger } from '@/utils/logger'

/**
 * 好友信息接口
 */
export interface Friend {
  /** 用户ID (Matrix MXID) */
  userId: string
  /** 显示名称 */
  displayName?: string | undefined
  /** 头像URL */
  avatarUrl?: string | undefined
  /** 在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 分类ID */
  categoryId?: string | undefined
  /** 关联的私聊房间ID */
  roomId?: string | undefined
  /** 状态文本 */
  statusText?: string | undefined
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
}

/**
 * Presence缓存条目接口
 * Requirement 4.4: THE Friends_Service SHALL cache last known presence status
 */
export interface PresenceCacheEntry {
  /** 在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
  /** 缓存时间戳 */
  timestamp: number
}

/**
 * Presence更新事件数据接口
 */
export interface PresenceUpdateEvent {
  /** 用户ID */
  userId: string
  /** 新的在线状态 */
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  /** 最后活跃时间（毫秒前） */
  lastActiveAgo?: number | undefined
}

/**
 * 事件监听器类型
 */
export type PresenceUpdateCallback = (event: PresenceUpdateEvent) => void

/**
 * 好友请求接口
 */
export interface FriendRequest {
  /** 请求ID */
  requestId: string
  /** 发送者用户ID */
  fromUserId: string
  /** 接收者用户ID */
  toUserId: string
  /** 申请消息 */
  message?: string
  /** 时间戳 */
  timestamp: number
}

/**
 * 好友分类接口
 * Requirement 5.1: THE Friends_Service SHALL support creating friend categories using room tags
 */
export interface FriendCategory {
  /** 分类ID */
  id: string
  /** 分类名称 */
  name: string
  /** 排序顺序 */
  order: number
}

/**
 * 好友分类账户数据内容接口
 */
export interface FriendCategoriesContent {
  /** 分类列表 */
  categories: FriendCategory[]
}

/**
 * 增强好友服务类
 * 优先使用Synapse扩展API，失败时自动fallback到Matrix m.direct
 */
export class EnhancedFriendsService {
  /** 是否使用Synapse扩展 */
  private useSynapseExtension = true

  /** Synapse扩展是否可用的缓存 */
  private synapseAvailabilityChecked = false

  /** 服务是否已初始化 */
  private initialized = false

  /**
   * Presence缓存
   * Requirement 4.4: THE Friends_Service SHALL cache last known presence status
   */
  private presenceCache = new Map<string, PresenceCacheEntry>()

  /** Presence缓存TTL（毫秒） */
  private readonly PRESENCE_CACHE_TTL = 60000 // 1分钟

  /** Presence更新事件监听器 */
  private presenceListeners = new Set<PresenceUpdateCallback>()

  /** 是否已订阅presence事件 */
  private presenceSubscribed = false

  /**
   * Phase 12 优化: 获取缓存的 Matrix client 引用
   * 避免重复调用 matrixClientService.getClient()
   */
  private get client() {
    return matrixClientService.getClient()
  }

  /**
   * 忽略用户
   * 使用 Matrix SDK 的 ignoreUsers API
   *
   * @param userIds 要忽略的用户ID列表
   */
  async ignoreUsers(userIds: string[]): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const ignoreUsersMethod = client.ignoreUsers as ((userIds: string[]) => Promise<unknown>) | undefined
      await ignoreUsersMethod?.(userIds)
      logger.info('[EnhancedFriends] Users ignored successfully', { userIds })
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to ignore users', { error, userIds })
      throw new Error(`Failed to ignore users: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 取消忽略用户
   * 通过更新 m.ignored_user_list 账户数据来实现
   *
   * @param userIds 要取消忽略的用户ID列表
   */
  async unignoreUsers(userIds: string[]): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 获取当前忽略列表
      let ignoredList: Record<string, { type?: number }> = {}
      try {
        const getAccountDataMethod = client.getAccountData as
          | ((type: string) => { getContent?: () => Record<string, { type?: number }> } | undefined)
          | undefined
        const ignoredEvent = getAccountDataMethod?.('m.ignored_user_list')
        const getContentMethod = ignoredEvent?.getContent as (() => Record<string, { type?: number }>) | undefined
        ignoredList = { ...(getContentMethod?.() || {}) }
      } catch {
        // 如果获取失败，使用空对象
      }

      // 从忽略列表中移除指定用户
      for (const userId of userIds) {
        delete ignoredList[userId]
      }

      // 更新忽略列表
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: Record<string, { type?: number }>) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.('m.ignored_user_list', ignoredList)

      logger.info('[EnhancedFriends] Users unignored successfully', { userIds })
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to unignore users', { error, userIds })
      throw new Error(`Failed to unignore users: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取忽略的用户列表
   *
   * @returns 忽略的用户ID列表
   */
  async getIgnoredUsers(): Promise<string[]> {
    const client = this.client
    if (!client) {
      return []
    }

    try {
      const getAccountDataMethod = client.getAccountData as
        | ((type: string) => { getContent?: () => Record<string, { type?: number }> } | undefined)
        | undefined
      const ignoredEvent = getAccountDataMethod?.('m.ignored_user_list')
      const getContentMethod = ignoredEvent?.getContent as (() => Record<string, { type?: number }>) | undefined
      const ignoredList = getContentMethod?.() || {}
      const userIds = Object.keys(ignoredList)
      logger.debug('[EnhancedFriends] Got ignored users list', { count: userIds.length })
      return userIds
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to get ignored users list', { error })
      return []
    }
  }

  /**
   * 检查用户是否被忽略
   *
   * @param userId 用户ID
   * @returns 是否被忽略
   */
  async isUserIgnored(userId: string): Promise<boolean> {
    const ignoredUsers = await this.getIgnoredUsers()
    return ignoredUsers.includes(userId)
  }

  /**
   * 初始化好友服务
   * 检测Synapse扩展API可用性并设置useSynapseExtension标志
   *
   * Requirement 2.1: WHEN Synapse extension API is available,
   * THE Friends_Service SHALL use `/_synapse/client/friends` endpoints
   *
   * @returns Promise<void>
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[EnhancedFriends] Service already initialized')
      return
    }

    logger.info('[EnhancedFriends] Initializing friends service...')

    try {
      // 尝试调用Synapse扩展API来检测可用性（已内置3秒超时）
      const result = await synapseApi.listFriends()

      // 如果调用成功（即使返回空列表），说明Synapse扩展可用
      if (result !== null && result !== undefined) {
        this.useSynapseExtension = true
        this.synapseAvailabilityChecked = true
        logger.info('[EnhancedFriends] Synapse extension API available', {
          friendsCount: result?.friends?.length || 0
        })
      }
    } catch (error) {
      // Synapse扩展不可用（404、超时等），将使用m.direct fallback
      this.useSynapseExtension = false
      this.synapseAvailabilityChecked = true
      logger.info('[EnhancedFriends] Synapse extension unavailable, using m.direct fallback', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    this.initialized = true
    logger.info('[EnhancedFriends] Friends service initialized', {
      useSynapseExtension: this.useSynapseExtension
    })

    // 订阅presence事件
    // Requirement 4.1: THE Friends_Service SHALL subscribe to presence events for all friends
    this.subscribeToPresence()
  }

  /**
   * 订阅presence事件
   * 监听Matrix客户端的User.presence事件，实时更新好友在线状态
   *
   * Requirement 4.1: THE Friends_Service SHALL subscribe to presence events for all friends
   *
   * @returns void
   */
  subscribeToPresence(): void {
    if (this.presenceSubscribed) {
      logger.debug('[EnhancedFriends] Already subscribed to presence events')
      return
    }

    const client = this.client
    if (!client) {
      logger.warn('[EnhancedFriends] Cannot subscribe to presence: client not initialized')
      return
    }

    // SDK Integration: Use ClientEvent.Presence instead of User.presence
    // According to SDK docs: client.on(ClientEvent.Presence, (event) => {...})
    const onMethod = client.on as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined
    onMethod?.('Presence', this.handlePresenceEvent)

    this.presenceSubscribed = true
    logger.info('[EnhancedFriends] Subscribed to presence events')
  }

  /**
   * 取消订阅presence事件
   *
   * @returns void
   */
  unsubscribeFromPresence(): void {
    if (!this.presenceSubscribed) {
      return
    }

    const client = this.client
    if (client) {
      // SDK Integration: Use Presence event
      const offMethod = client.off as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined
      offMethod?.('Presence', this.handlePresenceEvent)
    }

    this.presenceSubscribed = false
    logger.info('[EnhancedFriends] Unsubscribed from presence events')
  }

  /**
   * 处理presence事件
   * 更新缓存并通知监听器
   *
   * SDK Integration: ClientEvent.Presence passes (event) with event.getContent() containing presence data
   *
   * @param event Matrix事件对象
   * @param user 用户对象 (deprecated in SDK)
   */
  private handlePresenceEvent = (event: unknown, _user?: unknown): void => {
    // SDK's ClientEvent.Presence passes a MatrixEvent with getContent()
    const eventObj = event as {
      getSender?: () => string
      getContent?: () => { presence?: string; status_msg?: string; last_active_ago?: number }
    }

    const userId = eventObj.getSender?.()
    if (!userId) {
      return
    }

    const content = eventObj.getContent?.()
    const presence = this.normalizePresence(content?.presence)
    const lastActiveAgo = content?.last_active_ago

    // 更新缓存
    // Requirement 4.4: THE Friends_Service SHALL cache last known presence status
    const cacheEntry: PresenceCacheEntry = {
      presence,
      timestamp: Date.now()
    }
    if (lastActiveAgo !== undefined) {
      cacheEntry.lastActiveAgo = lastActiveAgo
    }
    this.presenceCache.set(userId, cacheEntry)

    // 通知监听器
    // Requirement 4.2: WHEN a friend's presence changes, THE UI SHALL update in real-time
    this.emitPresenceUpdate({
      userId,
      presence,
      lastActiveAgo
    })

    logger.debug('[EnhancedFriends] Presence updated', { userId, presence })
  }

  /**
   * 标准化presence状态值
   *
   * @param presence 原始presence值
   * @returns 标准化的presence值
   */
  private normalizePresence(presence?: string): 'online' | 'offline' | 'unavailable' | 'away' {
    switch (presence) {
      case 'online':
        return 'online'
      case 'unavailable':
        return 'unavailable'
      case 'away':
        return 'away'
      default:
        return 'offline'
    }
  }

  /**
   * 添加presence更新监听器
   * 用于UI实时更新好友在线状态
   *
   * Requirement 4.2: WHEN a friend's presence changes, THE UI SHALL update in real-time
   *
   * @param callback 回调函数
   */
  onPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presenceListeners.add(callback)
  }

  /**
   * 移除presence更新监听器
   *
   * @param callback 回调函数
   */
  offPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presenceListeners.delete(callback)
  }

  /**
   * 发送presence更新事件给所有监听器
   *
   * @param event Presence更新事件数据
   */
  private emitPresenceUpdate(event: PresenceUpdateEvent): void {
    this.presenceListeners.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        logger.warn('[EnhancedFriends] Presence listener error', { error })
      }
    })
  }

  /**
   * 检查服务是否已初始化
   *
   * @returns 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取好友列表
   * 优先使用Synapse扩展，失败时fallback到m.direct
   *
   * Requirement 3.1: WHEN Synapse extension is unavailable,
   * THE Friends_Service SHALL fallback to Matrix m.direct account data
   *
   * @returns 好友列表
   */
  async listFriends(): Promise<Friend[]> {
    if (this.useSynapseExtension) {
      try {
        const result = await synapseApi.listFriends()
        if (result?.friends?.length > 0) {
          logger.info('[EnhancedFriends] Loaded friends from Synapse extension', {
            count: result.friends.length
          })
          return this.mapSynapseFriends(result.friends)
        }
        // 如果返回空列表，也尝试fallback
        if (!this.synapseAvailabilityChecked) {
          this.synapseAvailabilityChecked = true
          // Synapse返回空列表可能是正常的，继续尝试m.direct
        }
      } catch (error) {
        logger.warn('[EnhancedFriends] Synapse extension unavailable, falling back to m.direct', { error })
        this.useSynapseExtension = false
        this.synapseAvailabilityChecked = true
      }
    }

    // Fallback: 使用Matrix m.direct账户数据
    return this.listFriendsFromMDirect()
  }

  /**
   * 从m.direct账户数据获取好友列表
   *
   * @returns 好友列表
   */
  async listFriendsFromMDirect(): Promise<Friend[]> {
    const client = this.client
    if (!client) {
      logger.warn('[EnhancedFriends] Client not initialized')
      return []
    }

    let mDirect: Record<string, string[]> = {}
    try {
      const getAccountDataMethod = client.getAccountData as
        | ((type: string) => { getContent?: () => Record<string, string[]> } | undefined)
        | undefined
      const mDirectEvent = getAccountDataMethod?.('m.direct')
      const getContentMethod = mDirectEvent?.getContent as (() => Record<string, string[]>) | undefined
      mDirect = getContentMethod?.() || {}
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to get m.direct account data', { error })
      return []
    }

    const friends: Friend[] = []

    for (const [userId, roomIds] of Object.entries(mDirect)) {
      if (!Array.isArray(roomIds) || roomIds.length === 0) continue

      // 获取用户资料
      let displayName: string | undefined
      let avatarUrl: string | undefined

      try {
        const getProfileInfoMethod = client.getProfileInfo as
          | ((userId: string) => Promise<{ displayname?: string; avatar_url?: string } | undefined> | undefined)
          | undefined
        const profile = await getProfileInfoMethod?.(userId)
        displayName = profile?.displayname
        avatarUrl = profile?.avatar_url
      } catch {
        // 忽略获取资料失败
        logger.debug('[EnhancedFriends] Failed to get profile for user', { userId })
      }

      // 获取在线状态
      let presence: 'online' | 'offline' | 'unavailable' = 'offline'
      try {
        const getUserMethod = client.getUser as ((userId: string) => { presence?: string } | undefined) | undefined
        const user = getUserMethod?.(userId)
        if (user) {
          const presenceState = user.presence
          if (presenceState === 'online') {
            presence = 'online'
          } else if (presenceState === 'unavailable') {
            presence = 'unavailable'
          }
        }
      } catch {
        // 忽略获取状态失败
      }

      const friend: Friend = {
        userId,
        presence
      }
      if (displayName !== undefined) {
        friend.displayName = displayName
      }
      if (avatarUrl !== undefined) {
        friend.avatarUrl = avatarUrl
      }
      if (roomIds[0]) {
        friend.roomId = roomIds[0]
      }
      friends.push(friend)
    }

    logger.info('[EnhancedFriends] Loaded friends from m.direct', { count: friends.length })
    return friends
  }

  /**
   * 发送好友请求
   * 创建私聊房间并发送邀请
   *
   * Requirement 3.2: WHEN a friend request is sent,
   * THE Friends_Service SHALL create a direct room and send invitation
   *
   * @param targetUserId 目标用户ID
   * @param message 可选的申请消息
   * @returns 创建的房间ID
   */
  async sendFriendRequest(targetUserId: string, message?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')

    logger.info('[EnhancedFriends] Sending friend request', { targetUserId })

    // 创建私聊房间
    const createRoomMethod = client.createRoom as
      | ((opts: {
          is_direct?: boolean
          preset?: string
          invite?: string[]
        }) => Promise<{ room_id?: string; roomId?: string } | undefined> | undefined)
      | undefined
    const roomResponse = await createRoomMethod?.({
      is_direct: true,
      preset: 'trusted_private_chat',
      invite: [targetUserId]
    })

    const roomId = roomResponse?.room_id || roomResponse?.roomId
    if (!roomId) {
      throw new Error('Failed to create direct room')
    }

    // 更新m.direct账户数据
    await this.updateMDirect(targetUserId, roomId)

    // 发送申请消息
    if (message) {
      try {
        const sendEventMethod = client.sendEvent as
          | ((roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>)
          | undefined
        await sendEventMethod?.(roomId, 'm.room.message', {
          msgtype: 'm.text',
          body: message
        })
      } catch (error) {
        logger.warn('[EnhancedFriends] Failed to send friend request message', { error })
      }
    }

    // 如果Synapse扩展可用，也通过扩展发送
    if (this.useSynapseExtension) {
      try {
        const getUserIdMethod = client.getUserId as (() => string) | undefined
        const myUserId = getUserIdMethod?.() || ''
        const requestParams: { requester_id: string; target_id: string; message?: string } = {
          requester_id: myUserId,
          target_id: targetUserId
        }
        if (message !== undefined) {
          requestParams.message = message
        }
        await synapseApi.sendRequest(requestParams)
      } catch {
        // 忽略Synapse扩展失败
        logger.debug('[EnhancedFriends] Synapse extension request failed, using m.direct only')
      }
    }

    logger.info('[EnhancedFriends] Friend request sent successfully', { roomId })
    return roomId
  }

  /**
   * 接受好友请求
   * 加入房间并更新m.direct
   *
   * Requirement 2.3: THE Friends_Service SHALL support accepting/rejecting friend requests
   * Requirement 3.3: WHEN a friend request is accepted,
   * THE Friends_Service SHALL join the direct room and update m.direct
   *
   * @param roomId 房间ID
   * @param fromUserId 发送者用户ID
   * @param requestId 可选的Synapse请求ID（用于Synapse扩展API）
   * @param categoryId 可选的分类ID
   */
  async acceptFriendRequest(
    roomId: string,
    fromUserId: string,
    requestId?: string,
    categoryId?: string
  ): Promise<void> {
    const client = this.client
    if (!client) throw new Error('Matrix client not initialized')

    logger.info('[EnhancedFriends] Accepting friend request', { roomId, fromUserId })

    // 加入房间
    const joinRoomMethod = client.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
    await joinRoomMethod?.(roomId)

    // 更新m.direct
    await this.updateMDirect(fromUserId, roomId)

    // 如果Synapse扩展可用且有requestId，也通过扩展接受
    if (this.useSynapseExtension && requestId) {
      try {
        const getUserIdMethod = client.getUserId as (() => string) | undefined
        const myUserId = getUserIdMethod?.() || ''
        const acceptParams: { request_id: string; user_id: string; category_id?: string } = {
          request_id: requestId,
          user_id: myUserId
        }
        if (categoryId !== undefined) {
          acceptParams.category_id = categoryId
        }
        await synapseApi.acceptRequest(acceptParams)
        logger.debug('[EnhancedFriends] Accepted via Synapse extension', { requestId })
      } catch (error) {
        // 忽略Synapse扩展失败，m.direct已更新
        logger.debug('[EnhancedFriends] Synapse extension accept failed, m.direct updated', { error })
      }
    }

    logger.info('[EnhancedFriends] Friend request accepted successfully')
  }

  /**
   * 拒绝好友请求
   *
   * Requirement 2.3: THE Friends_Service SHALL support accepting/rejecting friend requests
   *
   * @param roomId 房间ID
   * @param requestId 可选的Synapse请求ID（用于Synapse扩展API）
   */
  async rejectFriendRequest(roomId: string, requestId?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')

    logger.info('[EnhancedFriends] Rejecting friend request', { roomId })

    try {
      const leaveMethod = client.leave as ((roomId: string) => Promise<unknown>) | undefined
      await leaveMethod?.(roomId)
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to leave room', { error })
    }

    // 如果Synapse扩展可用且有requestId，也通过扩展拒绝
    if (this.useSynapseExtension && requestId) {
      try {
        const getUserIdMethod = client.getUserId as (() => string) | undefined
        const myUserId = getUserIdMethod?.() || ''
        await synapseApi.rejectRequest({
          request_id: requestId,
          user_id: myUserId
        })
        logger.debug('[EnhancedFriends] Rejected via Synapse extension', { requestId })
      } catch (error) {
        // 忽略Synapse扩展失败
        logger.debug('[EnhancedFriends] Synapse extension reject failed', { error })
      }
    }

    logger.info('[EnhancedFriends] Friend request rejected')
  }

  /**
   * 删除好友
   * 离开私聊房间并从m.direct中移除
   *
   * Requirement 2.4: THE Friends_Service SHALL support removing friends
   * Requirement 3.3: THE Friends_Service SHALL support remove action via Synapse API
   *
   * @param userId 好友用户ID
   * @param roomId 关联的私聊房间ID
   */
  async removeFriend(userId: string, roomId: string): Promise<void> {
    const client = this.client
    if (!client) throw new Error('Matrix client not initialized')

    logger.info('[EnhancedFriends] Removing friend', { userId, roomId })

    // 离开房间
    try {
      const leaveMethod = client.leave as ((roomId: string) => Promise<unknown>) | undefined
      await leaveMethod?.(roomId)
      logger.debug('[EnhancedFriends] Left room', { roomId })
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to leave room during friend removal', { error, roomId })
      // 继续执行，即使离开房间失败也要更新m.direct
    }

    // 从m.direct中移除
    await this.removeMDirect(userId, roomId)

    // 如果Synapse扩展可用，也通过扩展删除
    if (this.useSynapseExtension) {
      try {
        await synapseApi.removeFriend(userId)
        logger.debug('[EnhancedFriends] Removed via Synapse extension', { userId })
      } catch (error) {
        // 忽略Synapse扩展失败，m.direct已更新
        logger.debug('[EnhancedFriends] Synapse extension remove failed', { error })
      }
    }

    logger.info('[EnhancedFriends] Friend removed successfully', { userId })
  }

  /**
   * 更新m.direct账户数据
   *
   * @param userId 用户ID
   * @param roomId 房间ID
   */
  async updateMDirect(userId: string, roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) return

    let mDirect: Record<string, string[]> = {}
    try {
      const getAccountDataMethod = client.getAccountData as
        | ((type: string) => { getContent?: () => Record<string, string[]> } | undefined)
        | undefined
      const mDirectEvent = getAccountDataMethod?.('m.direct')
      const getContentMethod = mDirectEvent?.getContent as (() => Record<string, string[]>) | undefined
      mDirect = { ...(getContentMethod?.() || {}) }
    } catch {
      // 如果获取失败，使用空对象
    }

    if (!mDirect[userId]) {
      mDirect[userId] = []
    }

    if (!mDirect[userId].includes(roomId)) {
      mDirect[userId].push(roomId)
    }

    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: Record<string, string[]>) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.('m.direct', mDirect)
      logger.debug('[EnhancedFriends] Updated m.direct', { userId, roomId })
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to update m.direct', { error })
    }
  }

  /**
   * 从m.direct账户数据中移除好友关系
   *
   * @param userId 用户ID
   * @param roomId 房间ID
   */
  async removeMDirect(userId: string, roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) return

    let mDirect: Record<string, string[]> = {}
    try {
      const getAccountDataMethod = client.getAccountData as
        | ((type: string) => { getContent?: () => Record<string, string[]> } | undefined)
        | undefined
      const mDirectEvent = getAccountDataMethod?.('m.direct')
      const getContentMethod = mDirectEvent?.getContent as (() => Record<string, string[]>) | undefined
      mDirect = { ...(getContentMethod?.() || {}) }
    } catch {
      // 如果获取失败，无需继续
      return
    }

    // 如果用户不在m.direct中，无需操作
    if (!mDirect[userId]) {
      return
    }

    // 从用户的房间列表中移除指定房间
    mDirect[userId] = mDirect[userId].filter((id: string) => id !== roomId)

    // 如果用户没有关联的房间了，删除该用户条目
    if (mDirect[userId].length === 0) {
      delete mDirect[userId]
    }

    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: Record<string, string[]>) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.('m.direct', mDirect)
      logger.debug('[EnhancedFriends] Removed from m.direct', { userId, roomId })
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to remove from m.direct', { error })
    }
  }

  /**
   * 映射Synapse好友数据到Friend接口
   *
   * @param synapseFriends Synapse返回的好友数据
   * @returns 标准化的好友列表
   */
  private mapSynapseFriends(synapseFriends: Record<string, unknown>[]): Friend[] {
    return synapseFriends.map((f) => {
      const friend: Friend = {
        userId: (f.user_id || f.userId) as string,
        presence: this.normalizePresence(f.presence as string | undefined)
      }

      if (f.display_name || f.displayName) {
        friend.displayName = (f.display_name || f.displayName) as string
      }

      if (f.avatar_url || f.avatarUrl) {
        friend.avatarUrl = (f.avatar_url || f.avatarUrl) as string
      }

      if (f.category_id || f.categoryId) {
        friend.categoryId = (f.category_id || f.categoryId) as string
      }

      if (f.room_id || f.roomId) {
        friend.roomId = (f.room_id || f.roomId) as string
      }

      if (f.status_text || f.statusText) {
        friend.statusText = (f.status_text || f.statusText) as string
      }

      if (f.last_active_ago || f.lastActiveAgo) {
        friend.lastActiveAgo = (f.last_active_ago || f.lastActiveAgo) as number
      }

      return friend
    })
  }

  /**
   * 获取好友列表并同步在线状态
   *
   * Requirement 3.4: THE Friends_Service SHALL sync presence status for all friends
   *
   * @returns 包含最新在线状态的好友列表
   */
  async listFriendsWithPresence(): Promise<Friend[]> {
    const friends = await this.listFriends()
    await this.enrichWithPresence(friends)
    return friends
  }

  /**
   * 丰富好友列表的presence信息
   * 优先使用缓存，缓存过期时从SDK获取
   *
   * Requirement 4.3: THE Friends_Service SHALL handle presence unavailable gracefully
   * Requirement 4.4: THE Friends_Service SHALL cache last known presence status
   *
   * @param friends 好友列表（会被原地修改）
   */
  async enrichWithPresence(friends: Friend[]): Promise<void> {
    const client = this.client
    if (!client) return

    for (const friend of friends) {
      // 先检查缓存
      // Requirement 4.4: THE Friends_Service SHALL cache last known presence status
      const cached = this.presenceCache.get(friend.userId)
      if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
        friend.presence = cached.presence
        if (cached.lastActiveAgo !== undefined) {
          friend.lastActiveAgo = cached.lastActiveAgo
        }
        continue
      }

      // 从SDK获取
      // Requirement 4.3: THE Friends_Service SHALL handle presence unavailable gracefully
      try {
        const getUserMethod = client.getUser as
          | ((userId: string) => { presence?: string; lastActiveAgo?: number } | undefined)
          | undefined
        const user = getUserMethod?.(friend.userId)
        if (user) {
          friend.presence = this.normalizePresence(user.presence)
          const lastActiveAgo = user.lastActiveAgo
          if (lastActiveAgo !== undefined) {
            friend.lastActiveAgo = lastActiveAgo
          }

          // 更新缓存
          // Requirement 4.4: THE Friends_Service SHALL cache last known presence status
          const cacheEntry: PresenceCacheEntry = {
            presence: friend.presence,
            timestamp: Date.now()
          }
          if (friend.lastActiveAgo !== undefined) {
            cacheEntry.lastActiveAgo = friend.lastActiveAgo
          }
          this.presenceCache.set(friend.userId, cacheEntry)
        }
      } catch {
        // Requirement 4.3: Handle presence unavailable gracefully
        // 保持原有状态，不抛出错误
        logger.debug('[EnhancedFriends] Failed to get presence for user', {
          userId: friend.userId
        })
      }
    }
  }

  /**
   * 同步好友的在线状态
   *
   * @param friends 好友列表
   * @returns 更新了在线状态的好友列表
   */
  async syncPresenceForFriends(friends: Friend[]): Promise<Friend[]> {
    const client = matrixClientService.getClient()
    if (!client) return friends

    const updatedFriends: Friend[] = []

    for (const friend of friends) {
      let presence: 'online' | 'offline' | 'unavailable' | 'away' = friend.presence
      let lastActiveAgo: number | undefined = friend.lastActiveAgo

      // 先检查缓存
      const cached = this.presenceCache.get(friend.userId)
      if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
        presence = cached.presence
        lastActiveAgo = cached.lastActiveAgo
      } else {
        try {
          // 尝试从客户端缓存获取用户状态
          const getUserMethod = client.getUser as
            | ((userId: string) => { presence?: string; lastActiveAgo?: number } | undefined)
            | undefined
          const user = getUserMethod?.(friend.userId)
          if (user) {
            presence = this.normalizePresence(user.presence)
            lastActiveAgo = user.lastActiveAgo

            // 更新缓存
            const cacheEntry: PresenceCacheEntry = {
              presence,
              timestamp: Date.now()
            }
            if (lastActiveAgo !== undefined) {
              cacheEntry.lastActiveAgo = lastActiveAgo
            }
            this.presenceCache.set(friend.userId, cacheEntry)
          }
        } catch (error) {
          // 处理presence获取失败的情况
          // Requirement 4.3: THE Friends_Service SHALL handle presence unavailable gracefully
          logger.debug('[EnhancedFriends] Failed to get presence for user', {
            userId: friend.userId,
            error
          })
          // 保持原有状态
        }
      }

      const updatedFriend: Friend = {
        ...friend,
        presence,
        ...(lastActiveAgo !== undefined ? { lastActiveAgo } : {})
      }
      updatedFriends.push(updatedFriend)
    }

    logger.debug('[EnhancedFriends] Synced presence for friends', {
      total: friends.length,
      online: updatedFriends.filter((f) => f.presence === 'online').length
    })

    return updatedFriends
  }

  /**
   * 获取单个用户的在线状态
   * 优先使用缓存，缓存过期时从SDK获取
   *
   * Requirement 4.3: THE Friends_Service SHALL handle presence unavailable gracefully
   * Requirement 4.4: THE Friends_Service SHALL cache last known presence status
   *
   * @param userId 用户ID
   * @returns 在线状态
   */
  async getPresence(userId: string): Promise<'online' | 'offline' | 'unavailable' | 'away'> {
    // 先检查缓存
    const cached = this.presenceCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
      return cached.presence
    }

    const client = matrixClientService.getClient()
    if (!client) return 'offline'

    try {
      const getUserMethod = client.getUser as
        | ((userId: string) => { presence?: string; lastActiveAgo?: number } | undefined)
        | undefined
      const user = getUserMethod?.(userId)
      if (user) {
        const presence = this.normalizePresence(user.presence)

        // 更新缓存
        this.presenceCache.set(userId, {
          presence,
          lastActiveAgo: user.lastActiveAgo,
          timestamp: Date.now()
        })

        return presence
      }
    } catch (error) {
      // Requirement 4.3: Handle presence unavailable gracefully
      logger.debug('[EnhancedFriends] Failed to get presence', { userId, error })
    }

    return 'offline'
  }

  /**
   * 获取缓存的presence信息
   *
   * @param userId 用户ID
   * @returns 缓存的presence条目，如果不存在或已过期则返回undefined
   */
  getCachedPresence(userId: string): PresenceCacheEntry | undefined {
    const cached = this.presenceCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
      return cached
    }
    return undefined
  }

  /**
   * 清除presence缓存
   */
  clearPresenceCache(): void {
    this.presenceCache.clear()
    logger.debug('[EnhancedFriends] Presence cache cleared')
  }

  /**
   * 检查是否已订阅presence事件
   */
  isPresenceSubscribed(): boolean {
    return this.presenceSubscribed
  }

  /**
   * 重置Synapse扩展可用性检查
   * 用于在网络恢复后重新尝试使用Synapse扩展
   */
  resetSynapseAvailability(): void {
    this.useSynapseExtension = true
    this.synapseAvailabilityChecked = false
    this.initialized = false
    logger.info('[EnhancedFriends] Reset Synapse availability check')
  }

  /**
   * 检查Synapse扩展是否可用
   */
  isSynapseExtensionAvailable(): boolean {
    return this.useSynapseExtension
  }

  // ==================== 好友分类管理 ====================

  /** 好友分类账户数据类型 */
  private readonly FRIEND_CATEGORIES_TYPE = 'im.hula.friend_categories'

  /** 好友分类标签前缀 */
  private readonly CATEGORY_TAG_PREFIX = 'im.hula.category.'

  /**
   * 获取好友分类列表
   * 从im.hula.friend_categories账户数据读取分类
   *
   * Requirement 5.1: THE Friends_Service SHALL support creating friend categories using room tags
   *
   * @returns 分类列表
   */
  async listCategories(): Promise<FriendCategory[]> {
    const client = this.client
    if (!client) {
      logger.warn('[EnhancedFriends] Cannot list categories: client not initialized')
      return []
    }

    try {
      const getAccountDataMethod = client.getAccountData as
        | ((type: string) => { getContent?: () => FriendCategoriesContent } | undefined)
        | undefined
      const categoriesEvent = getAccountDataMethod?.(this.FRIEND_CATEGORIES_TYPE)
      const getContentMethod = categoriesEvent?.getContent as (() => FriendCategoriesContent) | undefined
      const content = getContentMethod?.()
      const categories = content?.categories || []

      logger.debug('[EnhancedFriends] Listed categories', { count: categories.length })
      return categories
    } catch (error) {
      logger.warn('[EnhancedFriends] Failed to get categories', { error })
      return []
    }
  }

  /**
   * 创建好友分类
   * 将新分类添加到im.hula.friend_categories账户数据
   *
   * Requirement 5.1: THE Friends_Service SHALL support creating friend categories using room tags
   *
   * @param name 分类名称
   * @returns 创建的分类
   */
  async createCategory(name: string): Promise<FriendCategory> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 获取现有分类
    const categories = await this.listCategories()

    // 检查是否已存在同名分类
    const existingCategory = categories.find((c) => c.name === name)
    if (existingCategory) {
      logger.warn('[EnhancedFriends] Category with same name already exists', { name })
      return existingCategory
    }

    // 创建新分类
    const newCategory: FriendCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      order: categories.length
    }

    // 添加到列表
    categories.push(newCategory)

    // 保存到账户数据
    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: { categories: FriendCategory[] }) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.(this.FRIEND_CATEGORIES_TYPE, { categories })
      logger.info('[EnhancedFriends] Created category', { id: newCategory.id, name })
      return newCategory
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to create category', { error, name })
      throw new Error(`Failed to create category: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 重命名好友分类
   *
   * Requirement 5.3: THE Friends_Service SHALL support renaming and deleting categories
   *
   * @param categoryId 分类ID
   * @param newName 新名称
   */
  async renameCategory(categoryId: string, newName: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 获取现有分类
    const categories = await this.listCategories()

    // 查找要重命名的分类
    const categoryIndex = categories.findIndex((c) => c.id === categoryId)
    if (categoryIndex === -1) {
      throw new Error(`Category not found: ${categoryId}`)
    }

    // 检查新名称是否与其他分类冲突
    const conflictCategory = categories.find((c) => c.name === newName && c.id !== categoryId)
    if (conflictCategory) {
      throw new Error(`Category with name "${newName}" already exists`)
    }

    // 更新名称
    const category = categories[categoryIndex]
    if (!category) {
      throw new Error(`Category not found at index: ${categoryIndex}`)
    }
    category.name = newName

    // 保存到账户数据
    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: { categories: FriendCategory[] }) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.(this.FRIEND_CATEGORIES_TYPE, { categories })
      logger.info('[EnhancedFriends] Renamed category', { categoryId, newName })
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to rename category', { error, categoryId })
      throw new Error(`Failed to rename category: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 删除好友分类
   * 删除分类时，该分类下的好友将移动到默认分类（未分类）
   *
   * Requirement 5.3: THE Friends_Service SHALL support renaming and deleting categories
   * Requirement 5.4: WHEN a category is deleted, THE System SHALL move friends to default category
   *
   * @param categoryId 分类ID
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 获取现有分类
    const categories = await this.listCategories()

    // 查找要删除的分类
    const categoryIndex = categories.findIndex((c) => c.id === categoryId)
    if (categoryIndex === -1) {
      logger.warn('[EnhancedFriends] Category not found for deletion', { categoryId })
      return
    }

    // Requirement 5.4: 删除分类前，先清理该分类下所有好友的标签
    // 将好友移动到默认分类（未分类）
    await this.cleanupCategoryTags(categoryId)

    // 从列表中移除
    categories.splice(categoryIndex, 1)

    // 重新排序
    categories.forEach((c, index) => {
      c.order = index
    })

    // 保存到账户数据
    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: { categories: FriendCategory[] }) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.(this.FRIEND_CATEGORIES_TYPE, { categories })
      logger.info('[EnhancedFriends] Deleted category', { categoryId })
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to delete category', { error, categoryId })
      throw new Error(`Failed to delete category: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 清理指定分类的所有房间标签
   * 将该分类下的好友移动到默认分类（未分类）
   *
   * Requirement 5.4: WHEN a category is deleted, THE System SHALL move friends to default category
   *
   * @param categoryId 要清理的分类ID
   */
  private async cleanupCategoryTags(categoryId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    const tagToRemove = `${this.CATEGORY_TAG_PREFIX}${categoryId}`

    // 获取所有好友
    const friends = await this.listFriends()

    // 遍历好友，移除该分类的标签
    for (const friend of friends) {
      if (!friend.roomId) continue

      const getRoomMethod = client.getRoom as
        | ((roomId: string) => { tags?: Record<string, { order: number }> } | undefined)
        | undefined
      const room = getRoomMethod?.(friend.roomId)
      if (!room) continue

      const tags = room.tags || {}
      if (tags[tagToRemove]) {
        try {
          const deleteRoomTagMethod = client.deleteRoomTag as
            | ((roomId: string, tag: string) => Promise<unknown>)
            | undefined
          await deleteRoomTagMethod?.(friend.roomId, tagToRemove)
          logger.debug('[EnhancedFriends] Removed category tag from room', {
            roomId: friend.roomId,
            categoryId
          })
        } catch (error) {
          logger.warn('[EnhancedFriends] Failed to remove category tag from room', {
            error,
            roomId: friend.roomId,
            categoryId
          })
        }
      }
    }

    logger.info('[EnhancedFriends] Cleaned up category tags', { categoryId })
  }

  /**
   * 更新分类排序
   *
   * @param categoryIds 按新顺序排列的分类ID数组
   */
  async reorderCategories(categoryIds: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 获取现有分类
    const categories = await this.listCategories()

    // 创建ID到分类的映射
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    // 按新顺序重建分类列表
    const reorderedCategories: FriendCategory[] = []
    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i]
      if (!categoryId) continue
      const category = categoryMap.get(categoryId)
      if (category) {
        reorderedCategories.push({
          ...category,
          order: i
        })
        categoryMap.delete(categoryId)
      }
    }

    // 将未在新顺序中的分类追加到末尾
    for (const category of categoryMap.values()) {
      reorderedCategories.push({
        ...category,
        order: reorderedCategories.length
      })
    }

    // 保存到账户数据
    try {
      const setAccountDataMethod = client.setAccountData as
        | ((type: string, content: { categories: FriendCategory[] }) => Promise<unknown>)
        | undefined
      await setAccountDataMethod?.(this.FRIEND_CATEGORIES_TYPE, { categories: reorderedCategories })
      logger.info('[EnhancedFriends] Reordered categories', { count: reorderedCategories.length })
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to reorder categories', { error })
      throw new Error(`Failed to reorder categories: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 设置好友分类
   * 使用room tags存储分类信息
   *
   * Requirement 5.2: THE Friends_Service SHALL support moving friends between categories
   * Requirement 5.5: THE Friends_Service SHALL persist categories using m.tag room state
   *
   * @param roomId 好友关联的房间ID
   * @param categoryId 分类ID，传null移除分类
   */
  async setFriendCategory(roomId: string, categoryId: string | null): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = client.getRoom as
      | ((roomId: string) => { tags?: Record<string, { order: number }> } | undefined)
      | undefined
    const room = getRoomMethod?.(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    // 如果设置新分类，验证分类存在
    if (categoryId) {
      const categories = await this.listCategories()
      const categoryExists = categories.some((c) => c.id === categoryId)
      if (!categoryExists) {
        throw new Error(`Category not found: ${categoryId}`)
      }
    }

    // 获取当前房间的所有标签
    const currentTags = room.tags || {}

    // 移除所有现有的分类标签
    for (const tag of Object.keys(currentTags)) {
      if (tag.startsWith(this.CATEGORY_TAG_PREFIX)) {
        try {
          const deleteRoomTagMethod = client.deleteRoomTag as
            | ((roomId: string, tag: string) => Promise<unknown>)
            | undefined
          await deleteRoomTagMethod?.(roomId, tag)
          logger.debug('[EnhancedFriends] Removed category tag', { roomId, tag })
        } catch (error) {
          logger.warn('[EnhancedFriends] Failed to remove category tag', { error, roomId, tag })
        }
      }
    }

    // 如果指定了新分类，添加新标签
    if (categoryId) {
      const newTag = `${this.CATEGORY_TAG_PREFIX}${categoryId}`
      try {
        const setRoomTagMethod = client.setRoomTag as
          | ((roomId: string, tag: string, opts: { order: number }) => Promise<unknown>)
          | undefined
        await setRoomTagMethod?.(roomId, newTag, { order: 0 })
        logger.info('[EnhancedFriends] Set friend category', { roomId, categoryId })
      } catch (error) {
        logger.error('[EnhancedFriends] Failed to set category tag', { error, roomId, categoryId })
        throw new Error(`Failed to set friend category: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      logger.info('[EnhancedFriends] Removed friend category', { roomId })
    }
  }

  /**
   * 获取好友分类
   * 从room tags读取分类信息
   *
   * Requirement 5.5: THE Friends_Service SHALL persist categories using m.tag room state
   *
   * @param roomId 好友关联的房间ID
   * @returns 分类ID，如果未分类则返回undefined
   */
  async getFriendCategory(roomId: string): Promise<string | undefined> {
    const client = this.client
    if (!client) {
      logger.warn('[EnhancedFriends] Cannot get friend category: client not initialized')
      return undefined
    }

    const getRoomMethod = client.getRoom as
      | ((roomId: string) => { tags?: Record<string, { order: number }> } | undefined)
      | undefined
    const room = getRoomMethod?.(roomId)
    if (!room) {
      logger.debug('[EnhancedFriends] Room not found for category lookup', { roomId })
      return undefined
    }

    // 查找分类标签
    const tags = room.tags || {}
    for (const tag of Object.keys(tags)) {
      if (tag.startsWith(this.CATEGORY_TAG_PREFIX)) {
        const categoryId = tag.substring(this.CATEGORY_TAG_PREFIX.length)
        logger.debug('[EnhancedFriends] Found friend category', { roomId, categoryId })
        return categoryId
      }
    }

    return undefined
  }

  /**
   * 获取指定分类下的所有好友
   *
   * Requirement 5.4: THE UI SHALL display friends grouped by category
   *
   * @param categoryId 分类ID，传null获取未分类的好友
   * @returns 该分类下的好友列表
   */
  async getFriendsByCategory(categoryId: string | null): Promise<Friend[]> {
    const friends = await this.listFriends()
    const result: Friend[] = []

    for (const friend of friends) {
      if (!friend.roomId) continue

      const friendCategoryId = await this.getFriendCategory(friend.roomId)

      if (categoryId === null) {
        // 获取未分类的好友
        if (!friendCategoryId) {
          const updatedFriend: Friend = { ...friend }
          delete updatedFriend.categoryId
          result.push(updatedFriend)
        }
      } else {
        // 获取指定分类的好友
        if (friendCategoryId === categoryId) {
          result.push({ ...friend, categoryId })
        }
      }
    }

    logger.debug('[EnhancedFriends] Got friends by category', {
      categoryId,
      count: result.length
    })

    return result
  }

  /**
   * 获取按分类分组的好友列表
   *
   * Requirement 5.4: THE UI SHALL display friends grouped by category
   *
   * @returns 按分类分组的好友映射，key为分类ID（null表示未分类）
   */
  async getFriendsGroupedByCategory(): Promise<Map<string | null, Friend[]>> {
    const friends = await this.listFriends()
    const grouped = new Map<string | null, Friend[]>()

    // 初始化未分类组
    grouped.set(null, [])

    // 获取所有分类
    const categories = await this.listCategories()
    for (const category of categories) {
      grouped.set(category.id, [])
    }

    // 分组好友
    for (const friend of friends) {
      let categoryId: string | null = null

      if (friend.roomId) {
        const friendCategoryId = await this.getFriendCategory(friend.roomId)
        if (friendCategoryId && grouped.has(friendCategoryId)) {
          categoryId = friendCategoryId
        }
      }

      const group = grouped.get(categoryId) || []
      const groupedFriend: Friend = { ...friend }
      if (categoryId) {
        groupedFriend.categoryId = categoryId
      }
      group.push(groupedFriend)
      grouped.set(categoryId, group)
    }

    logger.debug('[EnhancedFriends] Grouped friends by category', {
      categories: categories.length,
      totalFriends: friends.length
    })

    return grouped
  }
}

// 导出单例实例
export const enhancedFriendsService = new EnhancedFriendsService()
