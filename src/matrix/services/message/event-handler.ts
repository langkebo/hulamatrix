/**
 * Matrix 事件处理器
 * 统一处理 Matrix SDK 的各类事件
 * 实现文档 05-events-handling.md 中描述的事件监听功能
 */

import { matrixClientService } from '@/matrix/core/client'
import { logger } from '@/utils/logger'

// Matrix 客户端扩展接口
interface MatrixClientLike {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  off: (event: string, handler: (...args: unknown[]) => void) => void
  once?: (event: string, handler: (...args: unknown[]) => void) => void
  getUserId?: () => string
  getRoom?: (roomId: string) => RoomLike | null
  getRooms?: () => Array<RoomLike>
  getCrypto?: () => CryptoLike | null
}

// 房间接口
interface RoomLike {
  roomId: string
  name?: string
  topic?: string
  getLiveTimeline?: () => TimelineLike | null
  currentState?: {
    getStateEvents: (type: string, stateKey?: string) => Array<{ event?: { content?: { topic?: string } } }>
    getJoinRule: () => string
    getGuestAccess: () => string
    getHistoryVisibility: () => string
  }
  getJoinedMemberCount?: () => number
  getMember?: (userId: string) => MemberLike | null
  hasEncryptionStateEvent?: () => boolean
  findEventById?: (eventId: string) => EventLike | null
}

// 时间线接口
interface TimelineLike {
  getEvents: () => Array<EventLike>
}

// 成员接口
interface MemberLike {
  userId: string
  name?: string
  displayName?: string
  membership?: string
  powerLevel?: number
  presence?: string
  getAvatarUrl?: (baseUrl: string) => string
}

// 事件接口
interface EventLike {
  getId?: () => string
  getType?: () => string
  getContent?: () => Record<string, unknown>
  getSender?: () => string
  getRoomId?: () => string
  getTs?: () => number
  getWireContent?: () => Record<string, unknown> | null
  getRelation?: () => { rel_type?: string; event_id?: string } | null
  isRedacted?: () => boolean
  redacts?: string
}

// 加密接口
interface CryptoLike {
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  off?: (event: string, handler: (...args: unknown[]) => void) => void
  getCrossSigningStatus?: () => Promise<CrossSigningStatusLike | undefined>
  getUserDeviceInfo?: (userIds: string[]) => Promise<Record<string, DeviceInfoLike[]>>
  setDeviceVerified?: (userId: string, deviceId: string, verified: boolean) => Promise<void>
  setDeviceBlocked?: (userId: string, deviceId: string, blocked: boolean) => Promise<void>
  requestDeviceVerification?: (userId: string, deviceId: string) => Promise<void>
  bootstrapSecretStorage?: (options: { setupCrossSigning?: boolean }) => Promise<void>
  isSecretStorageReady?: () => Promise<boolean>
}

// 交叉签名状态
interface CrossSigningStatusLike {
  crossSigningReady?: boolean
  hasMasterKey?: boolean
  hasUserSigningKey?: boolean
  hasDeviceSigningKey?: boolean
}

// 设备信息
interface DeviceInfoLike {
  deviceId: string
  userId: string
  fingerprint?: string
  displayName?: string
  isVerified?: boolean
  isBlocked?: boolean
  lastSeen?: { ts: number }
}

// 验证请求
interface VerificationRequestLike {
  requestId: string
  requestingDevice: {
    userId: string
    deviceId: string
    displayName?: string
    fingerprint?: string
  }
  state?: string
  cancel?: () => void
  accept?: () => Promise<void>
  reject?: () => Promise<void>
}

// 通话接口
interface CallLike {
  callId: string
  type?: 'voice' | 'video'
  state?: string
  getOpponentMember?: () => MemberLike
  getHangupParty?: () => string
  getHangupReason?: () => string
  invite?: () => Promise<void>
  answer?: () => Promise<void>
  hangup?: () => Promise<void>
  reject?: () => Promise<void>
}

/**
 * 事件处理器回调类型
 */
export interface EventCallbacks {
  // 客户端事件回调
  onSyncStateChange?: (state: string, prevState: string) => void
  onAccountDataChange?: (eventType: string, content: Record<string, unknown>) => void
  onToDeviceEvent?: (eventType: string, content: Record<string, unknown>) => void
  onPresenceEvent?: (userId: string, presence: string, statusMsg?: string) => void
  onNewRoom?: (roomId: string, roomData: { name?: string; isDirect?: boolean }) => void
  onDeleteRoom?: (roomId: string) => void
  onSessionChange?: (sessionData: 'soft_logout' | 'logout') => void

  // 房间事件回调
  onRoomTimeline?: (event: EventLike, room: RoomLike, toStartOfTimeline: boolean) => void
  onRoomNameChange?: (roomId: string, newName: string) => void
  onRoomTopicChange?: (roomId: string, newTopic: string) => void
  onRoomAvatarChange?: (roomId: string, newAvatarUrl: string) => void
  onMyMembershipChange?: (roomId: string, membership: string, prevMembership: string) => void
  onRoomMemberChange?: (roomId: string, member: MemberLike, membership: string) => void
  onTypingUsersChange?: (roomId: string, typingUsers: string[]) => void
  onNewReadReceipt?: (roomId: string, eventId: string, userId: string) => void
  onEventRedaction?: (roomId: string, redactedEventId: string, reason?: string) => void

  // 成员事件回调
  onMemberNameChange?: (roomId: string, userId: string, newName: string) => void
  onMemberAvatarChange?: (roomId: string, userId: string, newAvatarUrl: string) => void
  onMemberPresenceChange?: (roomId: string, userId: string, presence: string) => void
  onMemberPowerLevelChange?: (roomId: string, userId: string, newPowerLevel: number) => void

  // 加密事件回调
  onKeyVerificationRequest?: (request: VerificationRequestLike) => void
  onVerificationStatusChange?: (requestId: string, status: string) => void
  onUserTrustStatusChange?: (userId: string, trustLevel: string) => void
  onDeviceVerificationChange?: (userId: string, deviceId: string, trustLevel: string) => void
  onCrossSigningKeysChange?: () => void

  // 通话事件回调
  onCallInvite?: (call: CallLike) => void
  onCallStateChange?: (call: CallLike) => void
  onCallHangup?: (call: CallLike) => void
  onCallError?: (call: CallLike, error: Error) => void
}

/**
 * Matrix 事件处理器类
 */
export class MatrixEventHandler {
  private static instance: MatrixEventHandler
  private client: MatrixClientLike | null = null
  private crypto: CryptoLike | null = null
  private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>()
  private isSetup = false
  private callbacks: EventCallbacks = {}

  static getInstance(): MatrixEventHandler {
    if (!MatrixEventHandler.instance) {
      MatrixEventHandler.instance = new MatrixEventHandler()
    }
    return MatrixEventHandler.instance
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: EventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
    logger.info('[MatrixEventHandler] Callbacks updated')
  }

  /**
   * 初始化事件处理器
   */
  async initialize(): Promise<void> {
    if (this.isSetup) return

    try {
      this.client = matrixClientService.getClient() as unknown as MatrixClientLike | null
      if (!this.client) {
        throw new Error('Matrix client not initialized')
      }

      logger.info('[MatrixEventHandler] Initializing event handlers')

      // 获取加密接口
      this.crypto = this.client.getCrypto?.() || null

      // 设置各类事件监听器
      this.setupClientEvents()
      this.setupRoomEvents()
      this.setupMemberEvents()
      this.setupCryptoEvents()
      this.setupCallEvents()

      this.isSetup = true
      logger.info('[MatrixEventHandler] Event handlers initialized successfully')
    } catch (error) {
      logger.error('[MatrixEventHandler] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * 设置客户端事件监听器
   */
  private setupClientEvents(): void {
    if (!this.client) return

    // Sync 状态事件
    this.client.on('Sync', (...args: unknown[]) => {
      const [state, prevState] = args as [string, string]
      logger.info('[MatrixEventHandler] Sync state changed:', { from: prevState, to: state })

      this.callbacks.onSyncStateChange?.(state, prevState)

      // 触发自定义事件
      this.emit('matrix:sync-state', { state, prevState })
    })

    // 账户数据变化
    this.client.on('accountData', (...args: unknown[]) => {
      const [event] = args as [{ type?: string; content?: Record<string, unknown> }]
      logger.info('[MatrixEventHandler] Account data changed:', { type: event?.type })

      if (event?.type && event?.content) {
        this.callbacks.onAccountDataChange?.(event.type, event.content)
        this.emit('matrix:account-data', { type: event.type, content: event.content })
      }
    })

    // 设备到设备事件
    this.client.on('toDevice', (...args: unknown[]) => {
      const [event] = args as [{ type?: string; content?: Record<string, unknown> }]
      logger.info('[MatrixEventHandler] ToDevice event:', { type: event?.type })

      if (event?.type && event?.content) {
        this.callbacks.onToDeviceEvent?.(event.type, event.content)
        this.emit('matrix:todevice', { type: event.type, content: event.content })
      }
    })

    // 在线状态事件
    this.client.on('Presence', (...args: unknown[]) => {
      const [event] = args as [
        { type?: string; getContent?: () => { presence?: string; status_msg?: string }; getSender?: () => string }
      ]
      const presence = event.getContent?.()
      const sender = event.getSender?.()

      if (presence && sender) {
        logger.info('[MatrixEventHandler] Presence event:', { userId: sender, presence: presence.presence })

        this.callbacks.onPresenceEvent?.(sender, presence.presence || 'unknown', presence.status_msg)
        this.emit('matrix:presence', { userId: sender, presence: presence.presence, statusMsg: presence.status_msg })
      }
    })

    // 新房间事件
    this.client.on('Room', (...args: unknown[]) => {
      const [room] = args as [RoomLike | undefined]
      if (room) {
        logger.info('[MatrixEventHandler] New room:', { roomId: room.roomId, name: room.name })

        this.callbacks.onNewRoom?.(room.roomId, { name: room.name, isDirect: false })
        this.emit('matrix:new-room', { roomId: room.roomId, name: room.name })
      }
    })

    // 删除房间事件
    this.client.on('deleteRoom', (...args: unknown[]) => {
      const [roomId] = args as [string]
      logger.info('[MatrixEventHandler] Room deleted:', { roomId })

      this.callbacks.onDeleteRoom?.(roomId)
      this.emit('matrix:delete-room', { roomId })
    })

    // 会话变化事件
    this.client.on('Session', (...args: unknown[]) => {
      const [sessionData] = args as ['soft_logout' | 'logout']
      logger.info('[MatrixEventHandler] Session changed:', { sessionData })

      this.callbacks.onSessionChange?.(sessionData)
      this.emit('matrix:session', { sessionData })
    })

    logger.info('[MatrixEventHandler] Client event listeners setup complete')
  }

  /**
   * 设置房间事件监听器
   */
  private setupRoomEvents(): void {
    if (!this.client) return

    // 时间线事件
    this.client.on('Room.timeline', (...args: unknown[]) => {
      const [event, room, toStartOfTimeline] = args as [
        EventLike | undefined,
        RoomLike | undefined,
        boolean | undefined
      ]

      if (!event || !room) return
      if (toStartOfTimeline) return // 忽略历史消息

      const type = event.getType?.() || event.getWireContent?.()?.type
      logger.info('[MatrixEventHandler] Timeline event:', { roomId: room.roomId, type })

      this.callbacks.onRoomTimeline?.(event, room, toStartOfTimeline ?? false)
      this.emit('matrix:timeline', { event, room, toStartOfTimeline: toStartOfTimeline ?? false })
    })

    // 房间名称变化
    this.client.on('Room.name', (...args: unknown[]) => {
      const [room] = args as [RoomLike | undefined]
      if (room && room.name) {
        logger.info('[MatrixEventHandler] Room name changed:', { roomId: room.roomId, name: room.name })

        this.callbacks.onRoomNameChange?.(room.roomId, room.name)
        this.emit('matrix:room-name', { roomId: room.roomId, name: room.name })
      }
    })

    // 房间主题变化
    this.client.on('Room.topic', (...args: unknown[]) => {
      const [room] = args as [RoomLike | undefined]
      if (room && room.topic !== undefined) {
        logger.info('[MatrixEventHandler] Room topic changed:', { roomId: room.roomId, topic: room.topic })

        this.callbacks.onRoomTopicChange?.(room.roomId, room.topic || '')
        this.emit('matrix:room-topic', { roomId: room.roomId, topic: room.topic })
      }
    })

    // 房间头像变化
    this.client.on('Room.avatar', (...args: unknown[]) => {
      const [room] = args as [RoomLike | undefined]
      // Note: Room.avatar event doesn't contain the avatar URL directly
      // The avatar needs to be fetched from room state
      if (room) {
        logger.info('[MatrixEventHandler] Room avatar changed:', { roomId: room.roomId })

        // Get avatar from room state
        const client = matrixClientService.getClient()
        const baseUrl = client?.baseUrl as string
        const avatarUrl =
          (room as unknown as { getAvatarUrl?: (url: string) => string })?.getAvatarUrl?.(baseUrl || '') || ''

        this.callbacks.onRoomAvatarChange?.(room.roomId, avatarUrl)
        this.emit('matrix:room-avatar', { roomId: room.roomId, avatarUrl })
      }
    })

    // 成员状态变化
    this.client.on('Room.myMembership', (...args: unknown[]) => {
      const [room, membership, prevMembership] = args as [RoomLike | undefined, string | undefined, string | undefined]

      if (room && membership) {
        logger.info('[MatrixEventHandler] My membership changed:', {
          roomId: room.roomId,
          from: prevMembership,
          to: membership
        })

        this.callbacks.onMyMembershipChange?.(room.roomId, membership, prevMembership || 'leave')
        this.emit('matrix:my-membership', { roomId: room.roomId, membership, prevMembership })
      }
    })

    // 成员变化
    this.client.on('Room.member', (...args: unknown[]) => {
      const [event, member] = args as [
        { getRoomId?: () => string } | undefined,
        { roomId?: string; name?: string; membership?: string; userId?: string } | undefined
      ]

      if (member && member.membership) {
        const roomId = event?.getRoomId?.() || member.roomId || ''
        logger.info('[MatrixEventHandler] Member membership changed:', {
          roomId,
          userId: member.userId,
          membership: member.membership
        })

        this.callbacks.onRoomMemberChange?.(roomId, member as unknown as MemberLike, member.membership)
        this.emit('matrix:member-change', { roomId, member, membership: member.membership })
      }
    })

    // 输入状态
    this.client.on('Room.typing', (...args: unknown[]) => {
      const [event, room] = args as [{ getContent?: () => { user_ids?: string[] } } | undefined, RoomLike | undefined]

      if (room && event) {
        const content = event.getContent?.()
        const typingUsers = content?.user_ids || []

        logger.info('[MatrixEventHandler] Typing users:', { roomId: room.roomId, count: typingUsers.length })

        this.callbacks.onTypingUsersChange?.(room.roomId, typingUsers)
        this.emit('matrix:typing', { roomId: room.roomId, typingUsers })
      }
    })

    // 已读回执
    this.client.on('Room.newReadReceipt', (...args: unknown[]) => {
      const [event, room] = args as [
        { getId?: () => string; getSender?: () => string } | undefined,
        RoomLike | undefined
      ]

      if (event && room) {
        const eventId = event.getId?.()
        const userId = event.getSender?.()

        if (eventId && userId) {
          logger.info('[MatrixEventHandler] New read receipt:', { roomId: room.roomId, eventId, userId })

          this.callbacks.onNewReadReceipt?.(room.roomId, eventId, userId)
          this.emit('matrix:read-receipt', { roomId: room.roomId, eventId, userId })
        }
      }
    })

    // 事件删除
    this.client.on('Room.redaction', (...args: unknown[]) => {
      const [event, room] = args as [
        { redacts?: string; getContent?: () => { reason?: string } } | undefined,
        RoomLike | undefined
      ]

      if (event && room) {
        const redactedEventId = event.redacts
        const reason = event.getContent?.()?.reason

        logger.info('[MatrixEventHandler] Event redacted:', {
          roomId: room.roomId,
          eventId: redactedEventId,
          reason
        })

        if (redactedEventId) {
          this.callbacks.onEventRedaction?.(room.roomId, redactedEventId, reason)
          this.emit('matrix:redaction', { roomId: room.roomId, eventId: redactedEventId, reason })
        }
      }
    })

    logger.info('[MatrixEventHandler] Room event listeners setup complete')
  }

  /**
   * 设置成员事件监听器
   */
  private setupMemberEvents(): void {
    if (!this.client) return

    // 成员名称变化
    this.client.on('RoomMember.name', (...args: unknown[]) => {
      const [event, member] = args as [
        { getRoomId?: () => string } | undefined,
        { name?: string; userId?: string } | undefined
      ]

      if (member && member.name) {
        const roomId = event?.getRoomId?.()
        if (roomId && member.userId) {
          logger.info('[MatrixEventHandler] Member name changed:', { roomId, userId: member.userId, name: member.name })

          this.callbacks.onMemberNameChange?.(roomId, member.userId, member.name)
          this.emit('matrix:member-name', { roomId, userId: member.userId, name: member.name })
        }
      }
    })

    // 成员头像变化
    this.client.on('RoomMember.avatar', (...args: unknown[]) => {
      const [event, member] = args as [
        { getRoomId?: () => string } | undefined,
        { userId?: string; getAvatarUrl?: (baseUrl: string) => string } | undefined
      ]

      if (member && member.userId) {
        const roomId = event?.getRoomId?.()
        if (roomId) {
          const client = matrixClientService.getClient()
          const baseUrl = client?.baseUrl as string
          const avatarUrl = member.getAvatarUrl?.(baseUrl || '') || ''

          logger.info('[MatrixEventHandler] Member avatar changed:', { roomId, userId: member.userId })

          this.callbacks.onMemberAvatarChange?.(roomId, member.userId, avatarUrl)
          this.emit('matrix:member-avatar', { roomId, userId: member.userId, avatarUrl })
        }
      }
    })

    // 成员权限等级变化
    this.client.on('RoomMember.powerLevel', (...args: unknown[]) => {
      const [event, member] = args as [
        { getRoomId?: () => string } | undefined,
        { powerLevel?: number; userId?: string } | undefined
      ]

      if (member && member.powerLevel !== undefined) {
        const roomId = event?.getRoomId?.()
        if (roomId && member.userId) {
          logger.info('[MatrixEventHandler] Member power level changed:', {
            roomId,
            userId: member.userId,
            powerLevel: member.powerLevel
          })

          this.callbacks.onMemberPowerLevelChange?.(roomId, member.userId, member.powerLevel)
          this.emit('matrix:power-level', { roomId, userId: member.userId, powerLevel: member.powerLevel })
        }
      }
    })

    logger.info('[MatrixEventHandler] Member event listeners setup complete')
  }

  /**
   * 设置加密事件监听器
   */
  private setupCryptoEvents(): void {
    if (!this.crypto) {
      logger.warn('[MatrixEventHandler] Crypto not available, skipping crypto event handlers')
      return
    }

    const cryptoOn = this.crypto.on

    if (typeof cryptoOn !== 'function') {
      logger.warn('[MatrixEventHandler] Crypto.on not available')
      return
    }

    // 密钥验证请求
    cryptoOn('CryptoEvent.KeyVerificationRequest', (...args: unknown[]) => {
      const [request] = args as [VerificationRequestLike]
      logger.info('[MatrixEventHandler] Key verification request:', {
        requestId: request.requestId,
        requestingDevice: request.requestingDevice?.deviceId
      })

      this.callbacks.onKeyVerificationRequest?.(request)
      this.emit('matrix:verification-request', { request })
    })

    // 密钥验证状态变化
    cryptoOn('CryptoEvent.KeyVerificationChanged', (...args: unknown[]) => {
      const [request] = args as [VerificationRequestLike]
      logger.info('[MatrixEventHandler] Verification status changed:', {
        requestId: request.requestId,
        state: request.state
      })

      if (request.requestId) {
        this.callbacks.onVerificationStatusChange?.(request.requestId, request.state || 'unknown')
        this.emit('matrix:verification-status', { requestId: request.requestId, status: request.state })
      }
    })

    // 用户信任状态变化
    cryptoOn('CryptoEvent.UserTrustStatusChanged', (...args: unknown[]) => {
      const [userId, trustLevel] = args as [string, 'trusted' | 'untrusted' | 'unknown' | undefined]
      logger.info('[MatrixEventHandler] User trust status changed:', { userId, trustLevel })

      if (userId && trustLevel) {
        this.callbacks.onUserTrustStatusChange?.(userId, trustLevel)
        this.emit('matrix:user-trust', { userId, trustLevel })
      }
    })

    // 设备验证变化
    cryptoOn('CryptoEvent.DeviceVerificationChanged', (...args: unknown[]) => {
      const [userId, deviceInfo, trustLevel] = args as [
        string,
        { deviceId?: string } | undefined,
        'verified' | 'unverified' | 'blocked' | undefined
      ]

      logger.info('[MatrixEventHandler] Device verification changed:', {
        userId,
        deviceId: deviceInfo?.deviceId,
        trustLevel
      })

      if (deviceInfo?.deviceId) {
        this.callbacks.onDeviceVerificationChange?.(userId, deviceInfo.deviceId, trustLevel || 'unknown')
        this.emit('matrix:device-verification', { userId, deviceId: deviceInfo.deviceId, trustLevel })
      }
    })

    logger.info('[MatrixEventHandler] Crypto event listeners setup complete')
  }

  /**
   * 设置通话事件监听器
   */
  private setupCallEvents(): void {
    if (!this.client) return

    // 来电邀请
    this.client.on('Call.invite', (...args: unknown[]) => {
      const [call] = args as [CallLike | undefined]
      if (call) {
        const opponent = call.getOpponentMember?.()
        logger.info('[MatrixEventHandler] Incoming call:', {
          callId: call.callId,
          opponent: opponent?.name,
          type: call.type
        })

        this.callbacks.onCallInvite?.(call)
        this.emit('matrix:call-invite', { call })
      }
    })

    // 通话状态变化
    this.client.on('Call.state', (...args: unknown[]) => {
      const [call] = args as [CallLike | undefined]
      if (call && call.state) {
        logger.info('[MatrixEventHandler] Call state changed:', {
          callId: call.callId,
          state: call.state
        })

        this.callbacks.onCallStateChange?.(call)
        this.emit('matrix:call-state', { call })
      }
    })

    // 通话挂断
    this.client.on('Call.hangup', (...args: unknown[]) => {
      const [call] = args as [CallLike | undefined]
      if (call) {
        const hangupParty = call.getHangupParty?.()
        const reason = call.getHangupReason?.()

        logger.info('[MatrixEventHandler] Call hangup:', {
          callId: call.callId,
          by: hangupParty,
          reason
        })

        this.callbacks.onCallHangup?.(call)
        this.emit('matrix:call-hangup', { call })
      }
    })

    // 通话错误
    this.client.on('Call.error', (...args: unknown[]) => {
      const [call, error] = args as [CallLike | undefined, Error | undefined]
      if (call && error) {
        logger.error('[MatrixEventHandler] Call error:', {
          callId: call.callId,
          error: error.message
        })

        this.callbacks.onCallError?.(call, error)
        this.emit('matrix:call-error', { call, error })
      }
    })

    logger.info('[MatrixEventHandler] Call event listeners setup complete')
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void {
    if (!this.client) return

    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.client?.off(event, handler)
      })
    })

    this.eventHandlers.clear()
    logger.info('[MatrixEventHandler] All listeners removed')
  }

  /**
   * 触发自定义事件
   */
  private emit(event: string, data: Record<string, unknown>): void {
    window.dispatchEvent(new CustomEvent(event, { detail: data }))
  }

  /**
   * 添加自定义事件监听器
   */
  on(event: string, handler: (data: CustomEventInit) => void): () => void {
    const wrappedHandler = (e: Event) => {
      handler(e as CustomEvent)
    }

    window.addEventListener(event, wrappedHandler)

    return () => {
      window.removeEventListener(event, wrappedHandler)
    }
  }
}

// 导出单例
export const matrixEventHandler = MatrixEventHandler.getInstance()
