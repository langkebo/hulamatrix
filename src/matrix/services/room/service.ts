/**
 * Matrix Room Service
 *
 * Unified room management service using Matrix SDK
 * Migrated from src/services/roomService.ts
 */

import type { MatrixClient, ICreateRoomOpts, Preset } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

// Type definitions for Matrix SDK extensions
interface MatrixClientLike {
  baseUrl?: string
  getUserId?(): string
  sendStateEvent(
    roomId: string,
    eventType: string,
    stateKey: string,
    content: Record<string, unknown>
  ): Promise<unknown>
  setRoomName(roomId: string, name: string): Promise<unknown>
  setRoomTopic(roomId: string, topic: string): Promise<unknown>
  invite(roomId: string, userId: string): Promise<unknown>
  kick(roomId: string, userId: string, reason?: string): Promise<unknown>
  ban(roomId: string, userId: string, reason?: string): Promise<unknown>
  unban(roomId: string, userId: string): Promise<unknown>
  leave(roomId: string): Promise<unknown>
  forget(roomId: string): Promise<unknown>
  createAlias(alias: string, roomId: string): Promise<unknown>
  deleteAlias(alias: string): Promise<unknown>
  setRoomDirectoryVisibility(roomId: string, visibility: string): Promise<unknown>
  getRoomDirectoryVisibility(roomId: string): Promise<{ visibility: 'public' | 'private' } | null>
  getStateEvent(roomId: string, eventType: string, stateKey: string): Promise<Record<string, unknown>>
  publicRooms?(options: Record<string, unknown>): Promise<{ chunk: RoomChunk[] }>
  on?(event: string, handler: (...args: unknown[]) => void): void
  getRoom(roomId: string): RoomLike | undefined
  getRooms(): RoomLike[]
  createRoom(options: ICreateRoomOpts): Promise<CreateRoomResponse>
}

interface RoomLike {
  roomId: string
  name: string
  topic?: string
  getJoinedMembers(): RoomMemberLike[]
  getMember?(userId: string): RoomMemberLike | undefined
  getAvatarUrl?(baseUrl: string): string
  hasEncryptionStateEvent?(): boolean
  getJoinRule?(): string
  getGuestAccess?(): string
  getHistoryVisibility?(): string
  getCreator?(): string
  getAliases?(): string[]
  getStateEvent?(eventType: string): Record<string, unknown> | undefined
  getTimelineEvents?(): MatrixEventLike[]
  currentState?: {
    getStateEvents?(eventType: string): MatrixEventLike[] | undefined
  }
}

interface RoomMemberLike {
  userId: string
  name: string
  membership?: string
  powerLevel?: number
  getAvatarUrl?(baseUrl: string): string
  events?: {
    presence?: { getTs?(): number }
    member?: { getTs?(): number }
  }
}

interface MatrixEventLike {
  getType?(): string
  getContent?(): Record<string, unknown>
  getRoomId?(): string
  getTs?(): number
}

interface RoomChunk {
  room_id: string
  [key: string]: unknown
}

interface CreateRoomResponse {
  room_id?: string
  roomId?: string
  [key: string]: unknown
}

interface CreateRoomOptsExtended extends ICreateRoomOpts {
  initial_state_events?: unknown[]
}

// 权限级别配置接口
interface PowerLevels {
  users: Record<string, number>
  users_default: number
  events: Record<string, number>
  events_default: number
  state_default: number
  ban: number
  kick: number
  redact: number
  invite: number
}

// 权限级别定义
export const POWER_LEVELS = {
  LORD: 100, // 群主
  ADMIN: 50, // 管理员
  NORMAL: 0, // 普通成员
  DEFAULT: 50 // 默认邀请用户权限
}

// 创建房间选项
export interface CreateRoomOptions {
  name: string
  topic?: string
  isPrivate?: boolean
  alias?: string
  invite?: string[]
  admins?: string[]
  avatar?: string
  encryption?: boolean
}

// 房间信息
export interface RoomInfo {
  roomId: string
  name: string
  topic?: string | undefined
  avatar?: string | undefined
  isEncrypted: boolean
  joinRule: 'public' | 'invite' | 'knock'
  guestAccess: 'can_join' | 'forbidden'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  memberCount: number
  onlineCount: number
  myPowerLevel: number
  creatorId?: string | undefined
  createdAt: number
}

// 成员信息
export interface RoomMember {
  userId: string
  displayName: string
  avatarUrl?: string | undefined
  powerLevel: number
  membership: 'join' | 'invite' | 'leave' | 'ban'
  joinedAt?: number | undefined
  lastActive?: number | undefined
}

/**
 * 统一房间服务类
 * 提供 Matrix 房间的高级操作接口
 */
export class RoomService {
  private client: MatrixClient
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map()
  private notFoundWarnTimes: Map<string, number> = new Map()

  constructor(client: MatrixClient) {
    this.client = client
    this.setupEventListeners()
  }

  /**
   * 创建房间（原创建群）
   */
  async createRoom(options: CreateRoomOptions): Promise<string> {
    try {
      logger.info('[RoomService] Creating room:', options.name)

      // 准备房间配置
      const roomConfig: CreateRoomOptsExtended = {
        name: options.name,
        preset: (options.isPrivate ? 'private_chat' : 'public_chat') as Preset,
        invite: options.invite || []
      }

      // 只有当 alias 存在时才添加 room_alias_name
      if (options.alias) {
        roomConfig.room_alias_name = options.alias
      }

      // 添加主题
      if (options.topic) {
        roomConfig.topic = options.topic
      }

      // 初始状态事件
      const initialState: unknown[] = []

      // 设置权限级别
      if (options.admins && options.admins.length > 0) {
        initialState.push({
          type: 'm.room.power_levels',
          state_key: '',
          content: this.generatePowerLevels(options.admins)
        })
      }

      // 房间加密
      if (options.encryption !== false) {
        initialState.push({
          type: 'm.room.encryption',
          state_key: '',
          content: {
            algorithm: 'm.megolm.v1.aes-sha2'
          }
        })
        roomConfig.initial_state_events = initialState
      }

      // 创建房间
      const response = await this.client.createRoom(roomConfig as ICreateRoomOpts)
      const roomId = (response as CreateRoomResponse)?.room_id || (response as CreateRoomResponse)?.roomId || ''
      if (!roomId) {
        logger.error('[RoomService] createRoom response missing room_id/roomId', { response })
        throw new Error('createRoom failed: missing room_id')
      }

      // 设置头像
      if (options.avatar) {
        await this.setRoomAvatar(roomId, options.avatar)
      }

      logger.info('[RoomService] Room created successfully:', roomId)
      msg.success('创建成功')

      return roomId
    } catch (error) {
      logger.error('[RoomService] Failed to create room:', error)
      msg.error('创建失败：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }

  /**
   * 设置群公告
   */
  async setRoomAnnouncement(roomId: string, announcement: string): Promise<void> {
    try {
      await this.client.setRoomTopic(roomId, announcement)
      logger.info(`[RoomService] Room ${roomId} announcement set successfully`)
    } catch (error) {
      logger.error(`[RoomService] Failed to set announcement for room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 获取群公告
   */
  async getRoomAnnouncement(roomId: string): Promise<string> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }
      return room.topic || ''
    } catch (error) {
      logger.error(`[RoomService] Failed to get announcement for room ${roomId}:`, error)
      return ''
    }
  }

  /**
   * 获取房间信息
   */
  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      if (!room) {
        throw new Error('Room not found')
      }

      // 获取房间状态
      const name = room.name || '未命名房间'
      const topic = room.topic || ''
      const avatar = room.getAvatarUrl?.(this.client.baseUrl || '') || ''

      // 获取成员列表
      const members = room.getJoinedMembers()
      const memberCount = members.length

      // 获取在线成员（基于最近活跃时间）
      const onlineCount = await this.getOnlineMemberCount(room)

      const clientLike = this.client as unknown as MatrixClientLike
      // 获取当前用户权限
      const myPowerLevel = room.getMember?.(clientLike.getUserId?.() || '')?.powerLevel || 0

      // 获取创建者
      const creatorId = room.getCreator?.()

      // 获取创建时间
      const timelineEvents = room.getTimelineEvents?.() || []
      const creationEvent = timelineEvents.find((e) => e.getType?.() === 'm.room.create')
      const createdAt = creationEvent?.getTs?.() || Date.now()

      return {
        roomId,
        name,
        topic: topic || undefined,
        avatar: avatar || undefined,
        isEncrypted: room.hasEncryptionStateEvent?.() || false,
        joinRule: (room.getJoinRule?.() || 'invite') as 'public' | 'invite' | 'knock',
        guestAccess: (room.getGuestAccess?.() || 'forbidden') as 'can_join' | 'forbidden',
        historyVisibility: (room.getHistoryVisibility?.() || 'shared') as
          | 'world_readable'
          | 'shared'
          | 'invited'
          | 'joined',
        memberCount,
        onlineCount,
        myPowerLevel,
        creatorId: creatorId || undefined,
        createdAt
      }
    } catch (error) {
      logger.error(`[RoomService] Failed to get room info for ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 更新房间信息
   */
  async updateRoomInfo(roomId: string, updates: Partial<RoomInfo>): Promise<void> {
    try {
      const updatesPromises: Promise<unknown>[] = []

      // 更新名称
      if (updates.name !== undefined) {
        updatesPromises.push(this.client.setRoomName(roomId, updates.name))
      }

      // 更新主题
      if (updates.topic !== undefined) {
        updatesPromises.push(this.client.setRoomTopic(roomId, updates.topic))
      }

      // 更新头像
      if (updates.avatar !== undefined) {
        updatesPromises.push(this.setRoomAvatar(roomId, updates.avatar))
      }

      await Promise.all(updatesPromises)
      logger.info(`[RoomService] Room ${roomId} updated successfully`)
    } catch (error) {
      logger.error(`[RoomService] Failed to update room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 设置房间名称（测试兼容）
   */
  async setRoomName(roomId: string, name: string): Promise<void> {
    await this.client.setRoomName(roomId, name)
    logger.info('[RoomService] Set room name:', { roomId, name })
  }

  /**
   * 设置房间主题（测试兼容）
   */
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    await this.client.setRoomTopic(roomId, topic)
    logger.info('[RoomService] Set room topic:', { roomId, topic })
  }

  /**
   * 设置房间头像
   */
  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    try {
      const clientLike = this.client as unknown as MatrixClientLike
      if (avatarUrl.startsWith('mxc://')) {
        // 已经是 MXC URL
        await clientLike.sendStateEvent(roomId, 'm.room.avatar', '', {
          url: avatarUrl
        })
      } else {
        // 需要先上传 - 暂时跳过，简化实现
        logger.warn('[RoomService] Avatar upload not implemented yet')
      }
    } catch (error) {
      logger.error(`[RoomService] Failed to set avatar for room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 邀请用户（原邀请进群）
   */
  async inviteUser(roomId: string, userId: string): Promise<void> {
    try {
      await this.client.invite(roomId, userId)
      logger.info(`[RoomService] User ${userId} invited to room ${roomId}`)
      msg.success('邀请发送成功')
    } catch (error) {
      logger.error(`[RoomService] Failed to invite user ${userId} to room ${roomId}:`, error)
      msg.error('邀请失败：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }

  /**
   * 批量设置用户权限级别
   * @param roomId 房间ID
   * @param updates 用户ID到权限级别的映射
   */
  async updatePowerLevels(roomId: string, updates: Record<string, number>): Promise<void> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      const clientLike = this.client as unknown as MatrixClientLike

      // 获取当前的 power levels
      let content = room?.getStateEvent?.('m.room.power_levels')

      // 如果没有缓存，尝试从服务器获取
      if (!content) {
        try {
          content = (await this.client.getStateEvent(roomId, 'm.room.power_levels', '')) as Record<string, unknown>
        } catch (_e) {
          // 如果获取失败（可能是新房间），使用默认值
          content = {
            users: {},
            users_default: POWER_LEVELS.DEFAULT,
            events: {},
            events_default: 0,
            state_default: 50,
            ban: 50,
            kick: 50,
            redact: 50,
            invite: 0
          }
        }
      }

      // 深拷贝以修改
      const powerLevels = JSON.parse(JSON.stringify(content)) as Record<string, unknown>
      if (!powerLevels.users) powerLevels.users = {}

      // 应用更新
      Object.entries(updates).forEach(([userId, level]) => {
        ;(powerLevels.users as Record<string, number>)[userId] = level
      })

      // 发送状态事件
      await clientLike.sendStateEvent(roomId, 'm.room.power_levels', '', powerLevels as Record<string, unknown>)
      logger.info('[RoomService] Updated power levels:', { roomId, updates })
    } catch (error) {
      logger.error(`[RoomService] Failed to update power levels for room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 设置用户权限级别
   */
  async setUserPowerLevel(roomId: string, userId: string, level: number): Promise<void> {
    return this.updatePowerLevels(roomId, { [userId]: level })
  }

  /**
   * 提升为管理员（测试兼容）
   */
  async promoteToAdmin(roomId: string, userId: string): Promise<void> {
    await this.setUserPowerLevel(roomId, userId, POWER_LEVELS.ADMIN)
    logger.info('[RoomService] Promote user to admin:', { roomId, userId })
  }

  /**
   * 取消管理员（测试兼容）
   */
  async demoteFromAdmin(roomId: string, userId: string): Promise<void> {
    await this.setUserPowerLevel(roomId, userId, POWER_LEVELS.NORMAL)
    logger.info('[RoomService] Demote user from admin:', { roomId, userId })
  }

  /**
   * 踢出用户（原踢出群聊）
   */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await this.client.kick(roomId, userId, reason)
      logger.info(`[RoomService] User ${userId} kicked from room ${roomId}: ${reason}`)
      msg.success('已踢出用户')
    } catch (error) {
      logger.error(`[RoomService] Failed to kick user ${userId} from room ${roomId}:`, error)
      msg.error('操作失败：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }

  /**
   * 禁言用户
   */
  async muteUser(roomId: string, userId: string): Promise<void> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const powerLevels = (room.getStateEvent?.('m.room.power_levels') || {
        events: {},
        users: {},
        users_default: POWER_LEVELS.DEFAULT
      }) as Record<string, unknown>

      // 禁言用户发送消息
      ;(powerLevels.events as Record<string, number>)['m.room.message'] = 50
      ;(powerLevels.users as Record<string, number>)[userId] = 0

      const clientLike = this.client as unknown as MatrixClientLike
      await clientLike.sendStateEvent(roomId, 'm.room.power_levels', '', powerLevels)
      logger.info('[RoomService] Muted user:', { roomId, userId })
      msg.success('已禁言用户')
    } catch (error) {
      logger.error(`[RoomService] Failed to mute user ${userId} in room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 取消禁言
   */
  async unmuteUser(roomId: string, userId: string): Promise<void> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const powerLevels = (room.getStateEvent?.('m.room.power_levels') || {
        events: {},
        users: {},
        users_default: POWER_LEVELS.DEFAULT
      }) as Record<string, unknown>

      // 移除事件限制
      delete (powerLevels.events as Record<string, number>)['m.room.message']

      const clientLike = this.client as unknown as MatrixClientLike
      await clientLike.sendStateEvent(roomId, 'm.room.power_levels', '', powerLevels)
      logger.info('[RoomService] Unmuted user:', { roomId, userId })
      msg.success('已取消禁言')
    } catch (error) {
      logger.error(`[RoomService] Failed to unmute user ${userId} in room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 封禁用户
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await this.client.ban(roomId, userId, reason)
      logger.info(`[RoomService] User ${userId} banned from room ${roomId}: ${reason}`)
      msg.success('已封禁用户')
    } catch (error) {
      logger.error(`[RoomService] Failed to ban user ${userId} from room ${roomId}:`, error)
      msg.error('操作失败：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }

  /**
   * 解除封禁
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    try {
      await this.client.unban(roomId, userId)
      logger.info(`[RoomService] User ${userId} unbanned from room ${roomId}`)
      msg.success('已解除封禁')
    } catch (error) {
      logger.error(`[RoomService] Failed to unban user ${userId} from room ${roomId}:`, error)
      msg.error('操作失败：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }

  /**
   * 忘记房间
   */
  async forgetRoom(roomId: string): Promise<void> {
    try {
      await this.client.forget(roomId)
      logger.info(`[RoomService] Forgot room ${roomId}`)
    } catch (error) {
      logger.error(`[RoomService] Failed to forget room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 设置入群规则
   */
  async setJoinRule(roomId: string, rule: 'public' | 'invite' | 'knock' | 'private'): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.sendStateEvent(roomId, 'm.room.join_rules', '', { join_rule: rule })
    logger.info('[RoomService] Set join rule:', { roomId, rule })
  }

  /**
   * 设置历史可见性
   */
  async setHistoryVisibility(
    roomId: string,
    visibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  ): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.sendStateEvent(roomId, 'm.room.history_visibility', '', { history_visibility: visibility })
    logger.info('[RoomService] Set history visibility:', { roomId, visibility })
  }

  /**
   * 设置房间加密状态
   */
  async setEncryption(roomId: string, enabled: boolean): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    if (enabled) {
      await clientLike.sendStateEvent(roomId, 'm.room.encryption', '', { algorithm: 'm.megolm.v1.aes-sha2' })
    } else {
      await clientLike.sendStateEvent(roomId, 'm.room.encryption', '', {})
    }
    logger.info('[RoomService] Set encryption:', { roomId, enabled })
  }

  /**
   * 创建别名
   */
  async createAlias(roomId: string, alias: string): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.createAlias(alias, roomId)
    logger.info('[RoomService] Created alias:', { roomId, alias })
  }

  /**
   * 删除别名
   */
  async deleteAlias(alias: string): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.deleteAlias(alias)
    logger.info('[RoomService] Deleted alias:', { alias })
  }

  /**
   * 获取房间别名列表
   */
  async getAliases(roomId: string): Promise<string[]> {
    const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
    return room?.getAliases?.() || []
  }

  /**
   * 设置目录可见性
   */
  async setDirectoryVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.setRoomDirectoryVisibility(roomId, visibility)
    logger.info('[RoomService] Set directory visibility:', { roomId, visibility })
  }

  /**
   * 获取目录可见性
   */
  async getDirectoryVisibility(roomId: string): Promise<'public' | 'private' | null> {
    const clientLike = this.client as unknown as MatrixClientLike
    try {
      const result = await clientLike.getRoomDirectoryVisibility(roomId)
      return result?.visibility || null
    } catch {
      return null
    }
  }

  /**
   * 启用房间加密（测试兼容）
   */
  async enableRoomEncryption(roomId: string): Promise<void> {
    const clientLike = this.client as unknown as MatrixClientLike
    await clientLike.sendStateEvent(roomId, 'm.room.encryption', '', {
      algorithm: 'm.megolm.v1.aes-sha2'
    })
    logger.info('[RoomService] Enabled room encryption:', { roomId })
  }

  /**
   * 判断房间是否加密（测试兼容）
   */
  isRoomEncrypted(roomId: string): boolean {
    const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
    if (!room) return false
    const events = room.currentState?.getStateEvents?.('m.room.encryption')
    if (Array.isArray(events) && events.length > 0) return true
    return Boolean(room.hasEncryptionStateEvent?.())
  }

  /**
   * 离开房间（原退出群聊）
   */
  async leaveRoom(roomId: string): Promise<void> {
    try {
      await this.client.leave(roomId)
      logger.info(`[RoomService] Left room ${roomId}`)
    } catch (error) {
      logger.error(`[RoomService] Failed to leave room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 获取房间详细统计信息
   */
  async getRoomStats(roomId: string): Promise<{
    totalMembers: number
    onlineMembers: number
    adminCount: number
    moderatorCount: number
    memberCount: number
    guestCount: number
  }> {
    const defaultStats = {
      totalMembers: 0,
      onlineMembers: 0,
      adminCount: 0,
      moderatorCount: 0,
      memberCount: 0,
      guestCount: 0
    }
    const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
    if (!room) {
      const now = Date.now()
      const last = this.notFoundWarnTimes.get(roomId) || 0
      if (now - last > 10 * 60 * 1000) {
        logger.warn(`[RoomService] Room ${roomId} not found when getting stats (suppressed for 10m)`)
        this.notFoundWarnTimes.set(roomId, now)
      }
      return defaultStats
    }
    try {
      const members = room.getJoinedMembers()
      const now = Date.now()
      const onlineThreshold = 5 * 60 * 1000 // 5分钟内活跃算在线

      let onlineCount = 0
      let adminCount = 0
      let moderatorCount = 0
      let memberCount = 0
      const guestCount = 0

      for (const member of members) {
        const powerLevel = member.powerLevel || 0

        // 统计权限级别
        if (powerLevel >= 100) {
          adminCount++ // 群主
        } else if (powerLevel >= 50) {
          moderatorCount++ // 管理员
        } else {
          memberCount++ // 普通成员
        }

        // 统计在线状态（基于 presence 或最近活跃）
        const lastActive = member.events?.presence?.getTs?.() || 0
        if (now - lastActive < onlineThreshold) {
          onlineCount++
        }
      }

      return {
        totalMembers: members.length,
        onlineMembers: onlineCount,
        adminCount,
        moderatorCount,
        memberCount,
        guestCount
      }
    } catch (error) {
      logger.warn(`[RoomService] Failed to compute stats for room ${roomId}:`, error)
      return defaultStats
    }
  }

  /**
   * 获取房间成员列表
   */
  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const room = this.client.getRoom(roomId) as unknown as RoomLike | undefined
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const members = room.getJoinedMembers()
      return members
        .map((member) => ({
          userId: member.userId,
          displayName: member.name || member.userId,
          avatarUrl: member.getAvatarUrl?.(this.client.baseUrl || '') || '',
          powerLevel: member.powerLevel || 0,
          membership: (member.membership as 'join' | 'invite' | 'leave' | 'ban') || 'join',
          joinedAt: member.events?.member?.getTs?.() || undefined,
          lastActive: member.events?.presence?.getTs?.() || undefined
        }))
        .sort((a, b) => {
          // 按权限级别排序
          if (a.powerLevel !== b.powerLevel) {
            return b.powerLevel - a.powerLevel
          }
          return a.displayName.localeCompare(b.displayName)
        })
    } catch (error) {
      logger.error(`[RoomService] Failed to get members for room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 搜索房间
   */
  async searchRooms(query: string, limit: number = 20): Promise<RoomInfo[]> {
    try {
      const clientLike = this.client as unknown as MatrixClientLike
      // 使用 Matrix 的房间目录搜索
      const response = await clientLike.publicRooms?.({
        limit,
        filter: {
          generic_search_term: query
        }
      })

      if (!response?.chunk) {
        return []
      }

      const rooms: RoomInfo[] = []

      for (const room of response.chunk) {
        // 获取详细信息
        try {
          const roomInfo = await this.getRoomInfo(room.room_id)
          rooms.push(roomInfo)
        } catch (error) {
          logger.warn(`[RoomService] Failed to get info for room ${room.room_id}:`, error)
        }
      }

      return rooms
    } catch (error) {
      logger.error('[RoomService] Failed to search rooms:', error)
      return []
    }
  }

  /**
   * 生成权限级别配置
   */
  private generatePowerLevels(admins: string[]): PowerLevels {
    const powerLevels: PowerLevels = {
      users: {},
      users_default: POWER_LEVELS.NORMAL,
      events: {
        'm.room.name': 50,
        'm.room.power_levels': 100,
        'm.room.history_visibility': 100,
        'm.room.canonical_alias': 50,
        'm.room.avatar': 50,
        'm.room.topic': 50
      },
      events_default: 0,
      state_default: 50,
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 0
    }

    // 设置管理员权限
    admins.forEach((userId) => {
      powerLevels.users[userId] = POWER_LEVELS.ADMIN
    })

    return powerLevels
  }

  /**
   * 获取在线成员数量
   */
  private async getOnlineMemberCount(room: RoomLike): Promise<number> {
    try {
      const members = room.getJoinedMembers()
      const now = Date.now()
      const onlineThreshold = 5 * 60 * 1000 // 5分钟内活跃算在线

      let onlineCount = 0
      for (const member of members) {
        const lastActive = member.events?.presence?.getTs?.() || 0
        if (now - lastActive < onlineThreshold) {
          onlineCount++
        }
      }

      return onlineCount
    } catch {
      // 如果无法获取精确的在线数，返回总数
      return room.getJoinedMembers().length
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const clientLike = this.client as unknown as MatrixClientLike
    if (typeof clientLike.on === 'function') {
      clientLike.on('Room', (...args: unknown[]) => {
        const room = args[0] as RoomLike
        this.emit('room:created', { roomId: room.roomId || '' })
      })
      clientLike.on('RoomMember.membership', (...args: unknown[]) => {
        const event = args[0] as MatrixEventLike
        const member = args[1] as RoomMemberLike
        this.emit('room:member_changed', {
          roomId: event?.getRoomId?.() || '',
          userId: member?.userId || '',
          membership: member?.membership || 'join'
        })
      })
      clientLike.on('RoomState.events', (...args: unknown[]) => {
        const event = args[0] as MatrixEventLike
        const type = event?.getType?.()
        if (['m.room.name', 'm.room.topic', 'm.room.avatar', 'm.room.power_levels'].includes(type || '')) {
          this.emit('room:state_changed', {
            roomId: event?.getRoomId?.() || '',
            type,
            content: event?.getContent?.() || {}
          })
        }
      })
    }
  }

  /**
   * 发射事件
   */
  private emit(event: string, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        logger.error(`[RoomService] Error in event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 添加事件监听器
   */
  addEventListener(event: string, listener: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(event: string, listener: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.eventListeners.clear()
  }
}

/**
 * 创建房间服务实例
 */
export function createRoomService(client: MatrixClient): RoomService {
  return new RoomService(client)
}
