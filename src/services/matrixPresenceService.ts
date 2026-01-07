/**
 * Matrix Presence Service
 * Provides enhanced presence management with continuous updates, statistics, and filtering
 *
 * @module services/matrixPresenceService
 */

import { logger } from '@/utils/logger'

/**
 * 在线状态类型
 */
export type PresenceStatus = 'online' | 'offline' | 'unavailable'

/**
 * 在线状态信息
 */
export interface PresenceInfo {
  userId: string
  displayName: string
  presence: PresenceStatus
  statusMsg?: string
  lastActive?: Date
}

/**
 * 房间在线状态统计
 */
export interface PresenceStats {
  online: number
  unavailable: number
  offline: number
  unknown: number
  total: number
}

/**
 * 用户在线状态详情
 */
export interface UserPresenceDetails extends PresenceInfo {
  lastActiveAgo?: number
  currentlyActive?: boolean
}

/**
 * 事件类型
 */
export type PresenceEvent = 'presence_updated' | 'presence_stats_updated' | 'heartbeat_sent'

/**
 * Matrix Presence Service
 * 提供增强的在线状态管理功能
 */
export class MatrixPresenceService {
  private static instance: MatrixPresenceService

  // 在线状态缓存
  private presenceCache: Map<string, PresenceInfo> = new Map()

  // 定时器
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  // 事件监听器
  private listeners: Map<PresenceEvent, Array<(data: unknown) => void>> = new Map()

  // 当前用户状态
  private myPresence: PresenceStatus = 'online'
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Reserved for future status message feature
  private _myStatusMsg = ''

  // 心跳间隔（毫秒）
  private heartbeatIntervalMs = 60000 // 60秒

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixPresenceService {
    if (!MatrixPresenceService.instance) {
      MatrixPresenceService.instance = new MatrixPresenceService()
    }
    return MatrixPresenceService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: PresenceEvent[] = ['presence_updated', 'presence_stats_updated', 'heartbeat_sent']
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  /**
   * 初始化服务
   */
  async initialize(matrixClient: unknown): Promise<void> {
    logger.info('[MatrixPresenceService] Initializing')

    const client = matrixClient as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      setPresence?: (presence: PresenceStatus, statusMsg?: string) => Promise<void>
      getRooms?: () => unknown[]
      getUser?: (userId: string) => { presence?: string; presenceStatusMsg?: string; lastActiveAgo?: number } | null
    }

    if (!client) {
      throw new Error('Matrix client is required')
    }

    // 监听在线状态变化事件
    client.on?.('Presence', (...args: unknown[]) => {
      const event = args[0] as {
        getSender?: () => string
        getContent?: () => { presence?: string; status_msg?: string; last_active_ago?: number }
      }
      this.handlePresenceUpdate(event)
    })

    // 初始化现有用户的在线状态
    this.initializePresenceCache(client)

    // 启动心跳
    this.startHeartbeat(client)

    logger.info('[MatrixPresenceService] Initialized')
  }

  /**
   * 初始化在线状态缓存
   */
  private initializePresenceCache(client: {
    getRooms?: () => unknown[]
    getUser?: (userId: string) => { presence?: string; presenceStatusMsg?: string; lastActiveAgo?: number } | null
  }): void {
    try {
      const rooms = client.getRooms?.() || []
      const userIds = new Set<string>()

      // 从房间成员中收集用户ID
      rooms.forEach((room: unknown) => {
        const roomLike = room as {
          getJoinedMembers?: () => Array<{ userId: string; name?: string }>
        }
        const members = roomLike.getJoinedMembers?.() || []
        members.forEach((member) => {
          userIds.add(member.userId)
        })
      })

      // 获取每个用户的在线状态
      userIds.forEach((userId) => {
        const user = client.getUser?.(userId)
        if (user) {
          const presenceInfo: PresenceInfo = {
            userId,
            displayName: user.presenceStatusMsg || userId,
            presence: (user.presence || 'offline') as PresenceStatus,
            statusMsg: user.presenceStatusMsg,
            lastActive: user.lastActiveAgo ? new Date(Date.now() - user.lastActiveAgo) : undefined
          }
          this.presenceCache.set(userId, presenceInfo)
        }
      })

      logger.info('[MatrixPresenceService] Presence cache initialized', {
        count: this.presenceCache.size
      })
    } catch (error) {
      logger.error('[MatrixPresenceService] Failed to initialize presence cache:', error)
    }
  }

  /**
   * 处理在线状态更新
   */
  private handlePresenceUpdate(event: {
    getSender?: () => string
    getContent?: () => { presence?: string; status_msg?: string; last_active_ago?: number }
  }): void {
    try {
      const sender = event.getSender?.()
      const content = event.getContent?.()

      if (!sender || !content) return

      const presenceInfo: PresenceInfo = {
        userId: sender,
        displayName: sender, // 可以从房间成员中获取更好的显示名
        presence: (content.presence || 'offline') as PresenceStatus,
        statusMsg: content.status_msg,
        lastActive: content.last_active_ago ? new Date(Date.now() - content.last_active_ago) : undefined
      }

      this.presenceCache.set(sender, presenceInfo)

      this.emit('presence_updated', presenceInfo)

      logger.debug('[MatrixPresenceService] Presence updated', {
        userId: sender,
        presence: presenceInfo.presence
      })
    } catch (error) {
      logger.error('[MatrixPresenceService] Failed to handle presence update:', error)
    }
  }

  /**
   * 启动心跳
   */
  startHeartbeat(client: { setPresence?: (presence: PresenceStatus) => Promise<void> }): void {
    this.stopHeartbeat()

    this.heartbeatInterval = setInterval(async () => {
      try {
        await client.setPresence?.(this.myPresence)
        this.emit('heartbeat_sent', { presence: this.myPresence })
        logger.debug('[MatrixPresenceService] Heartbeat sent')
      } catch (error) {
        logger.error('[MatrixPresenceService] Failed to send heartbeat:', error)
      }
    }, this.heartbeatIntervalMs)

    logger.info('[MatrixPresenceService] Heartbeat started', {
      interval: this.heartbeatIntervalMs
    })
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      logger.info('[MatrixPresenceService] Heartbeat stopped')
    }
  }

  /**
   * 设置当前用户的在线状态
   */
  async setMyPresence(
    client: { setPresence?: (presence: PresenceStatus, statusMsg?: string) => Promise<void> },
    presence: PresenceStatus,
    statusMsg?: string
  ): Promise<void> {
    try {
      await client.setPresence?.(presence, statusMsg)
      this.myPresence = presence
      this._myStatusMsg = statusMsg || ''

      logger.info('[MatrixPresenceService] Set my presence', { presence, statusMsg })
    } catch (error) {
      logger.error('[MatrixPresenceService] Failed to set my presence:', error)
      throw error
    }
  }

  /**
   * 获取用户的在线状态信息
   */
  getUserPresence(userId: string): PresenceInfo | undefined {
    return this.presenceCache.get(userId)
  }

  /**
   * 获取用户在线状态详情
   */
  getUserPresenceDetails(
    userId: string,
    client: { getUser?: (userId: string) => { lastActiveAgo?: number } | null }
  ): UserPresenceDetails | undefined {
    const info = this.presenceCache.get(userId)
    if (!info) return undefined

    const user = client.getUser?.(userId)
    return {
      ...info,
      lastActiveAgo: user?.lastActiveAgo,
      currentlyActive: user?.lastActiveAgo !== undefined && user.lastActiveAgo < 60000 // 1分钟内活跃
    }
  }

  /**
   * 批量获取用户在线状态
   */
  getBatchPresence(userIds: string[]): Map<string, PresenceInfo> {
    const result = new Map<string, PresenceInfo>()
    userIds.forEach((userId) => {
      const info = this.presenceCache.get(userId)
      if (info) {
        result.set(userId, info)
      }
    })
    return result
  }

  /**
   * 按在线状态过滤用户
   */
  filterUsersByPresence(userIds: string[], presence: PresenceStatus): string[] {
    return userIds.filter((userId) => {
      const info = this.presenceCache.get(userId)
      return info?.presence === presence
    })
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(userIds: string[]): string[] {
    return this.filterUsersByPresence(userIds, 'online')
  }

  /**
   * 获取离线用户列表
   */
  getOfflineUsers(userIds: string[]): string[] {
    return userIds.filter((userId) => {
      const info = this.presenceCache.get(userId)
      return info?.presence === 'offline' || !info
    })
  }

  /**
   * 获取房间在线状态统计
   */
  getPresenceStats(userIds: string[]): PresenceStats {
    const stats: PresenceStats = {
      online: 0,
      unavailable: 0,
      offline: 0,
      unknown: 0,
      total: userIds.length
    }

    userIds.forEach((userId) => {
      const info = this.presenceCache.get(userId)
      if (!info) {
        stats.unknown++
        return
      }

      switch (info.presence) {
        case 'online':
          stats.online++
          break
        case 'unavailable':
          stats.unavailable++
          break
        case 'offline':
          stats.offline++
          break
        default:
          stats.unknown++
      }
    })

    this.emit('presence_stats_updated', stats)

    return stats
  }

  /**
   * 获取房间在线成员
   */
  getOnlineMembers(members: Array<{ userId: string; name?: string }>): Array<{ userId: string; name?: string }> {
    return members.filter((member) => {
      const info = this.presenceCache.get(member.userId)
      return info?.presence === 'online'
    })
  }

  /**
   * 设置心跳间隔
   */
  setHeartbeatInterval(intervalMs: number): void {
    this.heartbeatIntervalMs = intervalMs
    logger.info('[MatrixPresenceService] Heartbeat interval updated', { intervalMs })
  }

  /**
   * 添加事件监听器
   */
  on(event: PresenceEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: PresenceEvent, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(event: PresenceEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixPresenceService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopHeartbeat()
    this.presenceCache.clear()
    this.listeners.clear()
    logger.info('[MatrixPresenceService] Disposed')
  }
}

// 导出单例实例
export const matrixPresenceService = MatrixPresenceService.getInstance()

// 导出便捷函数
export async function initializePresence(client: unknown): Promise<void> {
  return matrixPresenceService.initialize(client)
}

export function getUserPresence(userId: string): PresenceInfo | undefined {
  return matrixPresenceService.getUserPresence(userId)
}

export function filterUsersByPresence(userIds: string[], presence: PresenceStatus): string[] {
  return matrixPresenceService.filterUsersByPresence(userIds, presence)
}

export function getPresenceStats(userIds: string[]): PresenceStats {
  return matrixPresenceService.getPresenceStats(userIds)
}
