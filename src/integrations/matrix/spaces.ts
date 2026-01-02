/**
 * Matrix Spaces 功能实现
 * 提供完整的工作区管理功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'

// Matrix SDK type definitions
interface MatrixRoomLike {
  roomId: string
  name?: string
  currentState?: MatrixRoomStateLike
  getMyMembership?(): string
  getJoinedMembers(): MatrixMemberLike[]
  getUnreadNotificationCount?(): { highlightCount: number; notificationCount: number } | undefined
}

interface MatrixRoomStateLike {
  getStateEvents(eventType: string): MatrixEventLike[]
}

interface MatrixEventLike {
  getId?(): string
  getType?(): string
  getSender?(): string
  getTs?(): number
  getContent?<T = unknown>(): T
  getRoom?(): MatrixRoomLike
  getStateKey?(): string
  getEventId?(): string
}

interface MatrixMemberLike {
  userId: string
  name: string
  events?: {
    member?: {
      getTs?(): number
    }
  }
  getAvatarUrl?(): string | undefined
}

interface MatrixUserLike {
  presence?: 'online' | 'offline' | 'unavailable' | 'busy'
}

interface MatrixClientLike {
  getRoom(roomId: string): MatrixRoomLike | null
  getRooms(): MatrixRoomLike[]
  getUserId?(): string
  getUser(userId: string): MatrixUserLike | undefined
  on(event: string, handler: (...args: unknown[]) => void): void
  createRoom(options: unknown): Promise<unknown>
  sendStateEvent(roomId: string, eventType: string, content: unknown, stateKey?: string): Promise<void>
  getRoomHierarchy?(
    spaceId: string,
    limit?: number,
    maxDepth?: number,
    suggestedOnly?: boolean,
    fromToken?: string
  ): Promise<unknown>
  joinRoom(roomId: string, opts?: unknown): Promise<unknown>
  leave(roomId: string): Promise<unknown>
  invite(roomId: string, userId: string): Promise<unknown>
  kick(roomId: string, userId: string, reason?: string): Promise<unknown>
}

interface CreateRoomOptions {
  room_version?: string
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  visibility?: 'public' | 'private'
  name?: string
  topic?: string
  creation_content?: {
    type: string
  }
  initial_state?: Array<{
    type: string
    state_key: string
    content: {
      url?: string
    }
  }>
  room_alias_name?: string
  invite?: string[]
}

interface JoinRoomOptions {
  viaServers?: string[]
}

// Last message type for Room
interface LastMessage {
  id: string
  type: string
  content: unknown
  sender: string
  timestamp: number
}

export interface Space {
  id: string
  name: string
  topic?: string
  avatar?: string
  canonicalAlias?: string
  altAliases?: readonly string[]
  joinRule?: 'public' | 'restricted' | 'knock' | 'invite'
  roomId: string
  isPublic: boolean
  worldReadable: boolean
  guestCanJoin: boolean
  creationTs: number
  type: 'space' | 'room'
  children: SpaceChild[]
  memberCount: number
  activeMembers: number
  notifications: {
    highlightCount: number
    notificationCount: number
  }
  permissions: {
    canEdit: boolean
    canInvite: boolean
    canKick: boolean
    canBan: boolean
    canRedact: boolean
    canSendEvents: boolean
    canUpload: boolean
    canManageChildren: boolean
    canChangePermissions: boolean
  }
  settings: SpaceSettings
  // 兼容视图层扩展字段
  roomCount?: number
  rooms?: Room[]
  description?: string
  tags?: string[]
  isAdmin?: boolean
  isJoined?: boolean
  isArchived?: boolean
  isFavorite?: boolean
  created?: number
  isActive?: boolean
  lastActivity?: number
  theme?: { gradient?: string }
  members?: Member[]
}

export interface SpaceChild {
  roomId: string
  type: 'room' | 'space'
  name: string
  topic?: string
  avatar?: string
  isJoined: boolean
  canonicalAlias?: string
  worldReadable?: boolean
  joinRule?: string
  memberCount?: number
  notifications?: {
    highlightCount: number
    notificationCount: number
  }
  order?: string | number
  suggested?: boolean
  via?: string[]
}

// 视图层使用的房间与成员类型
export interface Room {
  id: string
  name: string
  type?: 'text' | 'voice' | 'video' | 'file' | 'announcement'
  topic?: string
  avatar?: string
  memberCount?: number
  lastMessage?: LastMessage
  unreadCount?: number
}

export interface Member {
  id?: string
  userId: string
  name?: string
  displayName?: string
  avatar?: string
  role?: 'admin' | 'moderator' | 'member'
  isOnline?: boolean
  status?: string
  joinedAt?: number
}

export interface SpaceSettings {
  autoJoin: boolean
  publicDirectory: boolean
  allowInvites: boolean
  guestAccess: boolean
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  encryption: boolean
  requireInvite: boolean
  roomVersions: string[]
  permissions: {
    events_default: number
    state_default: number
    users_default: number
    events: Record<string, number>
    users: Record<string, number>
  }
}

export interface SpaceMember {
  userId: string
  displayName?: string
  avatar?: string
  membership: 'join' | 'invite' | 'leave' | 'ban'
  powerLevel: number
  isOwner: boolean
  isAdmin: boolean
  isModerator: boolean
  joinedAt?: number
  lastActive?: number
  presence?: 'online' | 'offline' | 'away' | 'busy'
}

export interface SpaceEvent {
  id: string
  type: string
  sender: string
  timestamp: number
  content: unknown
  roomId: string
  spaceId: string
  eventType:
    | 'room_created'
    | 'member_joined'
    | 'member_left'
    | 'room_added'
    | 'room_removed'
    | 'permission_changed'
    | 'settings_updated'
}

/**
 * Matrix Spaces 管理器
 */
export class MatrixSpacesManager {
  private client: MatrixClientLike
  private spaces = new Map<string, Space>()
  private eventListeners = new Map<string, Array<(...args: unknown[]) => void>>()

  constructor(client: MatrixClient) {
    this.client = client as unknown as MatrixClientLike
    this.setupEventListeners()
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 监听房间状态变化
    this.client.on?.('RoomState.events', (...args: unknown[]) => {
      const [event] = args as [MatrixEventLike]
      this.handleRoomStateEvent(event)
    })

    // 监听成员状态变化
    this.client.on?.('RoomMember.membership', (...args: unknown[]) => {
      const [event, member, oldMembership] = args as [MatrixEventLike, MatrixMemberLike, string]
      this.handleMembershipChange(event, member, oldMembership)
    })

    // 监听新房间加入
    this.client.on?.('Room', (...args: unknown[]) => {
      const [room] = args as [MatrixRoomLike]
      this.handleNewRoom(room)
    })
  }

  /**
   * 创建新的Space
   */
  async createSpace(options: {
    name: string
    topic?: string
    isPublic?: boolean
    avatar?: string
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
    roomAlias?: string
    invite?: string[]
  }): Promise<Space> {
    try {
      const roomOptions: CreateRoomOptions = {
        room_version: '10',
        preset: options.preset || 'private_chat',
        visibility: options.isPublic ? 'public' : 'private',
        name: options.name,
        topic: options.topic || '',
        creation_content: {
          type: 'm.space'
        }
      }

      if (options.avatar) {
        roomOptions.initial_state = [
          {
            type: 'm.room.avatar',
            state_key: '',
            content: {
              url: options.avatar
            }
          }
        ]
      }

      if (options.roomAlias) {
        roomOptions.room_alias_name = options.roomAlias
      }

      const resp = await this.client.createRoom(roomOptions)
      const respLike = resp as { room_id?: string; roomId?: string } | string
      const spaceId = typeof respLike === 'string' ? respLike : (respLike.room_id ?? respLike.roomId ?? '')
      if (!spaceId) {
        throw new Error('Failed to create space: No room ID returned')
      }

      // 等待房间同步
      let retry = 0
      while (!this.client.getRoom(spaceId) && retry < 20) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retry++
      }
      const space = await this.getSpace(spaceId)

      if (options.invite && options.invite.length > 0) {
        for (const userId of options.invite) {
          await this.inviteToSpace(spaceId, userId)
        }
      }

      this.emit('space:created', space)
      return space
    } catch (error) {
      logger.error('Failed to create space:', error)
      throw new Error(`创建Space失败: ${String(error)}`)
    }
  }

  /**
   * 获取Space信息
   */
  async getSpace(spaceId: string): Promise<Space> {
    if (this.spaces.has(spaceId)) {
      return this.spaces.get(spaceId)!
    }

    try {
      const room = this.client.getRoom(spaceId) as unknown as MatrixRoomLike
      if (!room || !this.isSpaceRoom(room)) {
        throw new Error('Space不存在或不是Space类型')
      }

      const currentState = room.currentState
      const spaceInfo = this.extractSpaceInfo(room, currentState)

      // 获取子房间和子Space
      const children = await this.getSpaceChildren(spaceId)
      spaceInfo.children = children

      // 获取成员信息
      const members = await this.getSpaceMembers(spaceId)
      spaceInfo.memberCount = members.length
      spaceInfo.activeMembers = members.filter((m) => m.presence === 'online' || m.membership === 'join').length

      // 计算通知数
      spaceInfo.notifications = this.calculateSpaceNotifications(room, children)

      this.spaces.set(spaceId, spaceInfo)
      return spaceInfo
    } catch (error) {
      logger.error('Failed to get space:', error)
      throw new Error(`获取Space信息失败: ${String(error)}`)
    }
  }

  /**
   * 获取用户所有的Space
   */
  async getUserSpaces(): Promise<Space[]> {
    try {
      const rooms = this.client.getRooms()
      const spaceRooms = rooms.filter((room) => this.isSpaceRoom(room))

      const spaces: Space[] = []
      for (const room of spaceRooms) {
        try {
          const space = await this.getSpace(room.roomId)
          spaces.push(space)
        } catch (error) {
          logger.warn(`Failed to load space ${room.roomId}:`, error)
        }
      }

      return spaces.sort((a, b) => b.creationTs - a.creationTs)
    } catch (error) {
      logger.error('Failed to get user spaces:', error)
      throw new Error(`获取用户Space列表失败: ${String(error)}`)
    }
  }

  /**
   * 加入Space
   */
  async joinSpace(spaceId: string, viaServers?: string[]): Promise<void> {
    try {
      const opts: JoinRoomOptions = {}
      if (viaServers !== undefined) opts.viaServers = viaServers
      await this.client.joinRoom?.(spaceId, opts as unknown)

      const space = await this.getSpace(spaceId)
      this.emit('space:joined', space)
    } catch (error) {
      logger.error('Failed to join space:', error)
      throw new Error(`加入Space失败: ${String(error)}`)
    }
  }

  /**
   * 离开Space
   */
  async leaveSpace(spaceId: string): Promise<void> {
    try {
      await this.client.leave?.(spaceId)
      this.spaces.delete(spaceId)

      this.emit('space:left', { spaceId })
    } catch (error) {
      logger.error('Failed to leave space:', error)
      throw new Error(`离开Space失败: ${String(error)}`)
    }
  }

  /**
   * 邀请用户到Space
   */
  async inviteToSpace(spaceId: string, userId: string): Promise<void> {
    try {
      await this.client.invite?.(spaceId, userId)

      this.emit('space:member_invited', { spaceId, userId })
    } catch (error) {
      logger.error('Failed to invite to space:', error)
      throw new Error(`邀请用户到Space失败: ${String(error)}`)
    }
  }

  /**
   * 从Space移除用户
   */
  async removeFromSpace(spaceId: string, userId: string, reason?: string): Promise<void> {
    try {
      await this.client.kick?.(spaceId, userId, reason)

      this.emit('space:member_removed', { spaceId, userId })
    } catch (error) {
      logger.error('Failed to remove from space:', error)
      throw new Error(`从Space移除用户失败: ${String(error)}`)
    }
  }

  /**
   * 添加子房间到Space
   */
  async addChildToSpace(
    spaceId: string,
    childRoomId: string,
    options: {
      order?: string
      suggested?: boolean
      via?: string[]
    } = {}
  ): Promise<void> {
    try {
      const content: Record<string, unknown> = {
        via: options.via || []
      }

      if (options.order) {
        content.order = options.order
      }

      if (options.suggested) {
        content.suggested = options.suggested
      }

      await this.client.sendStateEvent(spaceId, 'm.space.child', content, childRoomId)

      // 更新本地Space缓存
      if (this.spaces.has(spaceId)) {
        const space = this.spaces.get(spaceId)!
        const childInfo = await this.getRoomInfo(childRoomId)
        if (childInfo) {
          const child: SpaceChild = (() => {
            const result: SpaceChild = {
              roomId: childRoomId,
              type: childInfo.isSpace ? 'space' : 'room',
              name: childInfo.name,
              isJoined: childInfo.isJoined,
              memberCount: childInfo.memberCount
            }
            if (childInfo.topic !== undefined) result.topic = childInfo.topic
            if (childInfo.avatar !== undefined) result.avatar = childInfo.avatar
            if (childInfo.canonicalAlias !== undefined) result.canonicalAlias = childInfo.canonicalAlias
            if (childInfo.worldReadable !== undefined) result.worldReadable = childInfo.worldReadable
            if (childInfo.joinRule !== undefined) result.joinRule = childInfo.joinRule
            if (options.order !== undefined) result.order = options.order
            if (options.suggested !== undefined) result.suggested = options.suggested
            if (options.via !== undefined) result.via = options.via
            return result
          })()
          space.children.push(child)
        }
      }

      this.emit('space:child_added', { spaceId, childRoomId })
    } catch (error) {
      logger.error('Failed to add child to space:', error)
      throw new Error(`添加子房间到Space失败: ${String(error)}`)
    }
  }

  public async insertChildWithOrder(spaceId: string, childRoomId: string) {
    const children = await this.getSpaceChildren(spaceId)
    const { averageBetweenStrings, nextString } = await import('./order-utils')
    const orders = children.map((c) => c.order).filter(Boolean) as string[]
    const ord = orders.length ? averageBetweenStrings(orders[orders.length - 1], undefined) : nextString('')
    await this.addChildToSpace(spaceId, childRoomId, { order: ord })
  }

  /**
   * 从Space移除子房间
   */
  async removeChildFromSpace(spaceId: string, childRoomId: string): Promise<void> {
    try {
      await this.client.sendStateEvent(spaceId, 'm.space.child', {}, childRoomId)

      // 更新本地Space缓存
      if (this.spaces.has(spaceId)) {
        const space = this.spaces.get(spaceId)!
        space.children = space.children.filter((child) => child.roomId !== childRoomId)
      }

      this.emit('space:child_removed', { spaceId, childRoomId })
    } catch (error) {
      logger.error('Failed to remove child from space:', error)
      throw new Error(`从Space移除子房间失败: ${String(error)}`)
    }
  }

  /**
   * 更新Space设置
   */
  async updateSpaceSettings(spaceId: string, settings: Partial<SpaceSettings>): Promise<void> {
    try {
      const room = this.client.getRoom(spaceId) as unknown as MatrixRoomLike
      if (!room) {
        throw new Error('Space不存在')
      }

      // 更新历史可见性
      if (settings.historyVisibility) {
        await this.client.sendStateEvent(spaceId, 'm.room.history_visibility', {
          history_visibility: settings.historyVisibility
        })
      }

      // 更新加入规则
      if (settings.guestAccess !== undefined || settings.requireInvite !== undefined) {
        let joinRule = 'invite'
        if (!settings.requireInvite && settings.guestAccess) {
          joinRule = 'public'
        } else if (!settings.requireInvite && !settings.guestAccess) {
          joinRule = 'knock'
        }

        await this.client.sendStateEvent(spaceId, 'm.room.join_rules', { join_rule: joinRule })
      }

      // 更新权限
      if (settings.permissions) {
        await this.client.sendStateEvent(spaceId, 'm.room.power_levels', this.formatPowerLevels(settings.permissions))
      }

      // 更新本地缓存
      if (this.spaces.has(spaceId)) {
        const space = this.spaces.get(spaceId)!
        space.settings = { ...space.settings, ...settings }
      }

      this.emit('space:settings_updated', { spaceId, settings })
    } catch (error) {
      logger.error('Failed to update space settings:', error)
      throw new Error(`更新Space设置失败: ${String(error)}`)
    }
  }

  /**
   * 获取Space成员
   */
  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    try {
      const room = this.client.getRoom(spaceId) as unknown as MatrixRoomLike
      if (!room) {
        return []
      }

      const members = room.getJoinedMembers()
      const currentState = room.currentState
      if (!currentState) return []
      const powerLevelsEvents = currentState.getStateEvents('m.room.power_levels')
      const powerLevelsContent = powerLevelsEvents[0]?.getContent?.()
      const powerLevels = powerLevelsContent as { users?: Record<string, number>; users_default?: number } | undefined

      return members.map((member): SpaceMember => {
        const userPower = powerLevels?.users?.[member.userId] || powerLevels?.users_default || 0
        const isAdmin = userPower >= 50
        const isModerator = userPower >= 25
        const isOwner = userPower >= 100

        const user = this.client.getUser(member.userId)
        const presence = user?.presence

        const result: SpaceMember = {
          userId: member.userId,
          displayName: member.name,
          membership: 'join',
          powerLevel: userPower,
          isOwner,
          isAdmin,
          isModerator,
          presence:
            presence === 'online'
              ? 'online'
              : presence === 'unavailable'
                ? 'away'
                : presence === 'busy'
                  ? 'busy'
                  : 'offline',
          joinedAt: member.events?.member?.getTs?.() || 0
        }
        const avatarUrl = member.getAvatarUrl?.()
        if (avatarUrl !== undefined) result.avatar = avatarUrl
        return result
      })
    } catch (error) {
      logger.error('Failed to get space members:', error)
      return []
    }
  }

  /**
   * 搜索Space
   */
  async searchSpaces(
    query: string,
    options: {
      limit?: number
      includePublic?: boolean
      includeJoined?: boolean
    } = {}
  ): Promise<Space[]> {
    try {
      const allSpaces = await this.getUserSpaces()

      let filteredSpaces = allSpaces

      if (!options.includeJoined) {
        filteredSpaces = filteredSpaces.filter((space) => !space.children.some((child) => child.isJoined))
      }

      if (!options.includePublic) {
        filteredSpaces = filteredSpaces.filter((space) => !space.isPublic)
      }

      // 按名称和主题搜索
      if (query.trim()) {
        const queryLower = query.toLowerCase()
        filteredSpaces = filteredSpaces.filter(
          (space) =>
            space.name.toLowerCase().includes(queryLower) ||
            (space.topic && space.topic.toLowerCase().includes(queryLower))
        )
      }

      return options.limit ? filteredSpaces.slice(0, options.limit) : filteredSpaces
    } catch (error) {
      logger.error('Failed to search spaces:', error)
      return []
    }
  }

  /**
   * 获取Space活动日志
   */
  async getSpaceActivity(
    spaceId: string,
    options: {
      limit?: number
      from?: string
      filter?: string[]
    } = {}
  ): Promise<SpaceEvent[]> {
    try {
      const room = this.client.getRoom(spaceId) as unknown as MatrixRoomLike
      if (!room) {
        return []
      }

      const timeline =
        (
          room as unknown as {
            getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } | undefined
            getUnfilteredTimelineSet?(): { getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } }
          }
        ).getLiveTimeline?.() ||
        (
          room as unknown as {
            getUnfilteredTimelineSet?(): { getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } }
          }
        )
          .getUnfilteredTimelineSet?.()
          ?.getLiveTimeline?.()
      const events = timeline?.getEvents?.() || []

      const spaceEvents: SpaceEvent[] = []

      for (const event of events) {
        const eventType = this.categorizeSpaceEvent(event)
        if (!eventType) continue

        if (options.filter && !options.filter.includes(eventType)) continue

        spaceEvents.push({
          id: event.getId?.() || '',
          type: event.getType?.() || '',
          sender: event.getSender?.() || '',
          timestamp: event.getTs?.() || Date.now(),
          content: event.getContent?.() || {},
          roomId: room.roomId,
          spaceId,
          eventType
        })
      }

      return options.from
        ? spaceEvents.filter((e) => e.id > options.from!)
        : options.limit
          ? spaceEvents.slice(0, options.limit)
          : spaceEvents
    } catch (error) {
      logger.error('Failed to get space activity:', error)
      return []
    }
  }

  /**
   * 获取Space统计信息
   */
  async getSpaceStats(spaceId: string): Promise<{
    totalMembers: number
    activeMembers: number
    totalRooms: number
    activeRooms: number
    totalMessages: number
    lastActivity: number
    storageUsage: number
  }> {
    try {
      const space = await this.getSpace(spaceId)
      const members = await this.getSpaceMembers(spaceId)

      let totalMessages = 0
      let lastActivity = 0

      // 计算所有子房间的消息数和活动
      let storageUsage = 0
      for (const child of space.children) {
        if (child.type === 'room') {
          const childRoom = this.client.getRoom(child.roomId) as MatrixRoomLike
          if (childRoom) {
            const timeline =
              (
                childRoom as unknown as {
                  getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } | undefined
                  getUnfilteredTimelineSet?(): { getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } }
                }
              ).getLiveTimeline?.() ||
              (
                childRoom as unknown as {
                  getUnfilteredTimelineSet?(): { getLiveTimeline?(): { getEvents?(): MatrixEventLike[] } }
                }
              )
                .getUnfilteredTimelineSet?.()
                ?.getLiveTimeline?.()
            const evs = timeline?.getEvents?.() || []
            totalMessages += evs.length

            // 估算存储使用量（基于事件大小）
            for (const event of evs) {
              // 估算每个事件的大小：使用 getContent 获取内容
              try {
                const content = event.getContent?.() || {}
                storageUsage += JSON.stringify(content).length
              } catch {
                // 如果无法序列化，使用默认估算
                storageUsage += 500 // 每个事件平均 500 字节
              }
            }

            const lastEvent = evs.slice(-1)[0]
            const ts = lastEvent?.getTs?.()
            if (ts && ts > lastActivity) lastActivity = ts
          }
        }
      }

      return {
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.presence === 'online').length,
        totalRooms: space.children.filter((c) => c.type === 'room').length,
        activeRooms: space.children.filter((c) => c.type === 'room' && c.isJoined).length,
        totalMessages,
        lastActivity,
        storageUsage // 存储使用量（字节）
      }
    } catch (error) {
      logger.error('Failed to get space stats:', error)
      throw new Error(`获取Space统计信息失败: ${String(error)}`)
    }
  }

  // ========== 私有辅助方法 ==========

  private isSpaceRoom(room: MatrixRoomLike): boolean {
    const currentState = room.currentState
    if (!currentState) return false
    const creationEvents = currentState.getStateEvents('m.room.creation')
    const creationContent = creationEvents[0]?.getContent?.() as { type?: string } | undefined
    return creationContent?.type === 'm.space'
  }

  private extractSpaceInfo(room: MatrixRoomLike, currentState: MatrixRoomStateLike | undefined): Space {
    if (!currentState) {
      throw new Error('Room state is required')
    }

    const getNameContent = () =>
      currentState.getStateEvents('m.room.name')[0]?.getContent?.() as { name?: string } | undefined
    const getTopicContent = () =>
      currentState.getStateEvents('m.room.topic')[0]?.getContent?.() as { topic?: string } | undefined
    const getAvatarContent = () =>
      currentState.getStateEvents('m.room.avatar')[0]?.getContent?.() as { url?: string } | undefined
    const getAliasContent = () =>
      currentState.getStateEvents('m.room.canonical_alias')[0]?.getContent?.() as
        | { alias?: string; alt_aliases?: string[] }
        | undefined
    const getJoinRuleContent = () =>
      currentState.getStateEvents('m.room.join_rules')[0]?.getContent?.() as { join_rule?: string } | undefined
    const getPowerLevelsContent = () =>
      currentState.getStateEvents('m.room.power_levels')[0]?.getContent?.() as
        | {
            users?: Record<string, number>
            users_default?: number
            state_default?: number
            invite?: number
            kick?: number
            ban?: number
            redact?: number
            events_default?: number
            events?: Record<string, number>
          }
        | undefined
    const getHistoryVisContent = () =>
      currentState.getStateEvents('m.room.history_visibility')[0]?.getContent?.() as
        | { history_visibility?: string }
        | undefined
    const getGuestAccessContent = () =>
      currentState.getStateEvents('m.room.guest_access')[0]?.getContent?.() as { guest_access?: string } | undefined

    const nameState = getNameContent()
    const topicState = getTopicContent()
    const avatarState = getAvatarContent()
    const aliasState = getAliasContent()
    const joinRuleState = getJoinRuleContent()
    const powerLevels = getPowerLevelsContent()

    const myUserId = this.client.getUserId?.()
    const myLevel = (powerLevels?.users?.[myUserId ?? ''] ?? powerLevels?.users_default ?? 0) as number
    const space: Space = {
      id: room.roomId,
      roomId: room.roomId,
      name: nameState?.name || room.name || room.roomId,
      altAliases: aliasState?.alt_aliases || [],
      isPublic: joinRuleState?.join_rule === 'public',
      worldReadable: getHistoryVisContent()?.history_visibility === 'world_readable',
      guestCanJoin: getGuestAccessContent()?.guest_access === 'can_join',
      creationTs: (currentState.getStateEvents('m.room.create')[0] as MatrixEventLike)?.getTs?.() || Date.now(),
      type: 'space',
      children: [],
      memberCount: 0,
      activeMembers: 0,
      notifications: {
        highlightCount: 0,
        notificationCount: 0
      },
      permissions: {
        canEdit: myLevel >= (powerLevels?.state_default ?? 50),
        canInvite: myLevel >= (powerLevels?.invite ?? 50),
        canKick: myLevel >= (powerLevels?.kick ?? 50),
        canBan: myLevel >= (powerLevels?.ban ?? 50),
        canRedact: myLevel >= (powerLevels?.redact ?? 50),
        canSendEvents: myLevel >= (powerLevels?.events_default ?? 0),
        canUpload: true,
        canManageChildren:
          myLevel >=
          ((powerLevels?.events && powerLevels?.events['m.space.child']) ?? powerLevels?.state_default ?? 50),
        canChangePermissions:
          myLevel >=
          ((powerLevels?.events && powerLevels?.events['m.room.power_levels']) ?? powerLevels?.state_default ?? 50)
      },
      settings: this.getDefaultSpaceSettings()
    }
    if (topicState?.topic !== undefined) space.topic = topicState.topic
    if (avatarState?.url !== undefined) space.avatar = avatarState.url
    if (aliasState?.alias !== undefined) space.canonicalAlias = aliasState.alias
    if (joinRuleState?.join_rule !== undefined) {
      const joinRule = joinRuleState.join_rule
      if (joinRule === 'public' || joinRule === 'restricted' || joinRule === 'knock' || joinRule === 'invite') {
        space.joinRule = joinRule
      }
    }
    return space
  }

  private async getSpaceChildren(spaceId: string): Promise<SpaceChild[]> {
    try {
      const room = this.client.getRoom(spaceId) as unknown as MatrixRoomLike
      if (!room) return []

      const currentState = room.currentState
      if (!currentState) return []

      const childEvents = currentState.getStateEvents('m.space.child')
      const children: SpaceChild[] = []

      for (const childEvent of childEvents) {
        const childRoomId = childEvent.getStateKey?.()
        const childContent = childEvent.getContent?.() as
          | { via?: string[]; order?: string; suggested?: boolean }
          | undefined

        if (!childRoomId) continue

        // 只处理有效的子房间
        if (childContent?.via && childContent.via.length > 0) {
          const childInfo = await this.getRoomInfo(childRoomId)
          if (childInfo) {
            children.push(
              (() => {
                const child: SpaceChild = {
                  roomId: childRoomId,
                  type: childInfo.isSpace ? 'space' : 'room',
                  name: childInfo.name,
                  isJoined: childInfo.isJoined,
                  memberCount: childInfo.memberCount
                }
                if (childInfo.topic !== undefined) child.topic = childInfo.topic
                if (childInfo.avatar !== undefined) child.avatar = childInfo.avatar
                if (childInfo.canonicalAlias !== undefined) child.canonicalAlias = childInfo.canonicalAlias
                if (childInfo.worldReadable !== undefined) child.worldReadable = childInfo.worldReadable
                if (childInfo.joinRule !== undefined) child.joinRule = childInfo.joinRule
                if (childContent.order !== undefined) child.order = childContent.order
                if (childContent.suggested !== undefined) child.suggested = childContent.suggested
                if (childContent.via !== undefined) child.via = childContent.via
                return child
              })()
            )
          }
        }
      }

      // 按order排序
      children.sort((a, b) => {
        const ao = a.order ?? ''
        const bo = b.order ?? ''
        const aos = typeof ao === 'string' ? ao : ao.toString()
        const bos = typeof bo === 'string' ? bo : bo.toString()
        if (aos !== '' && bos !== '') return aos.localeCompare(bos)
        if (a.order) return -1
        if (b.order) return 1
        return 0
      })

      return children
    } catch (error) {
      logger.error('Failed to get space children:', error)
      return []
    }
  }

  public async getSpaceHierarchy(
    spaceId: string,
    options?: { limit?: number; maxDepth?: number; suggestedOnly?: boolean; fromToken?: string }
  ) {
    try {
      const res = await (this.client as unknown as MatrixClientLike).getRoomHierarchy?.(
        spaceId,
        options?.limit,
        options?.maxDepth,
        options?.suggestedOnly,
        options?.fromToken
      )
      if (!res) {
        const children = await this.getSpaceChildren(spaceId)
        return { children, nextToken: null }
      }

      const resLike = res as {
        rooms?: Array<{
          room_id?: string
          room_type?: string
          name?: string
          canonical_alias?: string
          topic?: string
          avatar_url?: string
          membership?: string
          world_readable?: boolean
          join_rule?: string
          num_joined_members?: number
          children_state?: Array<{ type?: string; content?: { order?: string; suggested?: boolean; via?: string[] } }>
        }>
        next_batch?: string
      }
      const children: SpaceChild[] = (resLike.rooms || [])
        .filter((r) => Array.isArray(r.children_state))
        .map((r): SpaceChild => {
          const childState = r.children_state?.find((s) => s.type === 'm.space.child')?.content || {}
          const result: SpaceChild = {
            roomId: r.room_id || '',
            type: r.room_type === 'm.space' ? 'space' : 'room',
            name: r.name || r.canonical_alias || r.room_id || '',
            isJoined: r.membership === 'join',
            via: (childState.via as string[]) || []
          }
          if (r.topic !== undefined) result.topic = r.topic
          if (r.avatar_url !== undefined) result.avatar = r.avatar_url
          if (r.canonical_alias !== undefined) result.canonicalAlias = r.canonical_alias
          if (r.world_readable !== undefined) result.worldReadable = r.world_readable
          if (r.join_rule !== undefined) result.joinRule = r.join_rule
          if (r.num_joined_members !== undefined) result.memberCount = r.num_joined_members
          if (childState.order !== undefined) result.order = childState.order as string
          if (childState.suggested !== undefined) result.suggested = childState.suggested as boolean
          return result
        })
      return {
        children,
        nextToken: resLike.next_batch || null
      }
    } catch {
      const children = await this.getSpaceChildren(spaceId)
      return { children, nextToken: null }
    }
  }

  private async getRoomInfo(roomId: string) {
    try {
      const room = this.client.getRoom(roomId) as unknown as MatrixRoomLike
      if (!room) return null

      const currentState = room.currentState
      if (!currentState) return null

      const getNameContent = () =>
        currentState.getStateEvents('m.room.name')[0]?.getContent?.() as { name?: string } | undefined
      const getTopicContent = () =>
        currentState.getStateEvents('m.room.topic')[0]?.getContent?.() as { topic?: string } | undefined
      const getAvatarContent = () =>
        currentState.getStateEvents('m.room.avatar')[0]?.getContent?.() as { url?: string } | undefined
      const getAliasContent = () =>
        currentState.getStateEvents('m.room.canonical_alias')[0]?.getContent?.() as { alias?: string } | undefined
      const getJoinRuleContent = () =>
        currentState.getStateEvents('m.room.join_rules')[0]?.getContent?.() as { join_rule?: string } | undefined
      const getCreationContent = () =>
        currentState.getStateEvents('m.room.creation')[0]?.getContent?.() as { type?: string } | undefined
      const getHistoryVisContent = () =>
        currentState.getStateEvents('m.room.history_visibility')[0]?.getContent?.() as
          | { history_visibility?: string }
          | undefined

      const nameState = getNameContent()
      const topicState = getTopicContent()
      const avatarState = getAvatarContent()
      const aliasState = getAliasContent()
      const joinRuleState = getJoinRuleContent()
      const creationContent = getCreationContent()
      const historyVisContent = getHistoryVisContent()

      return {
        name: nameState?.name || room.name || roomId,
        topic: topicState?.topic,
        avatar: avatarState?.url,
        canonicalAlias: aliasState?.alias,
        isSpace: creationContent?.type === 'm.space',
        isJoined: room.getMyMembership?.() === 'join',
        worldReadable: historyVisContent?.history_visibility === 'world_readable',
        joinRule: joinRuleState?.join_rule,
        memberCount: room.getJoinedMembers().length
      }
    } catch (error) {
      logger.warn(`Failed to get room info for ${roomId}:`, error)
      return null
    }
  }

  private calculateSpaceNotifications(room: MatrixRoomLike, children: SpaceChild[]) {
    let highlightCount = 0
    let notificationCount = 0

    // 计算主Space的通知
    const roomSummary = room.getUnreadNotificationCount?.()
    if (roomSummary) {
      highlightCount += roomSummary.highlightCount || 0
      notificationCount += roomSummary.notificationCount || 0
    }

    // 计算子房间的通知
    for (const child of children) {
      if (child.notifications) {
        highlightCount += child.notifications.highlightCount
        notificationCount += child.notifications.notificationCount
      }
    }

    return { highlightCount, notificationCount }
  }

  private getDefaultSpaceSettings(): SpaceSettings {
    return {
      autoJoin: false,
      publicDirectory: false,
      allowInvites: true,
      guestAccess: false,
      historyVisibility: 'shared',
      encryption: false,
      requireInvite: true,
      roomVersions: ['10'],
      permissions: {
        events_default: 0,
        state_default: 50,
        users_default: 0,
        events: {
          'm.room.name': 50,
          'm.room.power_levels': 100,
          'm.room.history_visibility': 100,
          'm.room.canonical_alias': 50,
          'm.room.avatar': 50,
          'm.room.topic': 50,
          'm.space.child': 50
        },
        users: {}
      }
    }
  }

  private formatPowerLevels(permissions: SpaceSettings['permissions']) {
    return {
      ban: 50,
      events: permissions.events,
      events_default: permissions.events_default,
      invite: 50,
      kick: 50,
      redact: 50,
      state_default: permissions.state_default,
      users: permissions.users,
      users_default: permissions.users_default
    }
  }

  private categorizeSpaceEvent(event: MatrixEventLike): SpaceEvent['eventType'] | null {
    const eventType = event.getType?.()
    if (!eventType) return null

    const content = event.getContent?.()
    if (!content) return null

    const contentLike = content as { membership?: string; via?: string[] }
    switch (eventType) {
      case 'm.room.create':
        return 'room_created'
      case 'm.room.member':
        if (contentLike.membership === 'join') return 'member_joined'
        if (contentLike.membership === 'leave') return 'member_left'
        if (contentLike.membership === 'ban') return 'member_left'
        break
      case 'm.space.child':
        return contentLike.via && contentLike.via.length > 0 ? 'room_added' : 'room_removed'
      case 'm.room.power_levels':
        return 'permission_changed'
      case 'm.room.name':
      case 'm.room.topic':
      case 'm.room.avatar':
      case 'm.room.history_visibility':
      case 'm.room.join_rules':
        return 'settings_updated'
    }

    return null
  }

  private handleRoomStateEvent(event: MatrixEventLike) {
    const room = event.getRoom?.()
    if (!room || !this.isSpaceRoom(room)) return

    // 更新本地Space缓存
    const spaceId = room.roomId
    if (this.spaces.has(spaceId)) {
      // 异步更新Space信息
      this.getSpace(spaceId).catch(logger.error)
    }

    this.emit('space:state_changed', { spaceId, event })
  }

  private handleMembershipChange(_event: MatrixEventLike, member: MatrixMemberLike, oldMembership: string) {
    const room = member as unknown as { room?: MatrixRoomLike }
    if (!room.room || !this.isSpaceRoom(room.room)) return

    const spaceId = room.room.roomId
    this.emit('space:membership_changed', {
      spaceId,
      userId: member.userId,
      newMembership: 'join',
      oldMembership
    })
  }

  private handleNewRoom(room: MatrixRoomLike) {
    if (!this.isSpaceRoom(room)) return

    this.getSpace(room.roomId)
      .then((space) => {
        this.emit('space:discovered', space)
      })
      .catch(logger.error)
  }

  private emit(event: string, data: unknown) {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        logger.error(`Error in space event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 事件监听器管理
   */
  public addEventListener(event: string, listener: (...args: unknown[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  public removeEventListener(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 清理资源
   */
  public destroy() {
    this.spaces.clear()
    this.eventListeners.clear()
  }
}

/**
 * 创建Matrix Spaces管理器
 */
export function createMatrixSpacesManager(client: MatrixClient): MatrixSpacesManager {
  const manager = new MatrixSpacesManager(client as unknown as MatrixClient)
  return manager
}
