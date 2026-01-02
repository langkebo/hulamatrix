import { logger, toError } from '@/utils/logger'

import { matrixClientService } from './client'
import { useChatStore } from '@/stores/chat'
import type { MatrixClient } from 'matrix-js-sdk'
import { withRetry } from '@/utils/retry'
import { useTimerManager } from '@/composables/useTimerManager'

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  on: (event: string, callback: (...args: unknown[]) => void) => void
  createRoom: (config: MatrixRoomConfig) => Promise<MatrixRoomResponse | string>
  invite: (roomId: string, userId: string) => Promise<unknown>
  sendStateEvent: (
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey: string
  ) => Promise<unknown>
  sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<MatrixEventResponse>
  redactEvent: (roomId: string, eventId: string, reason?: string) => Promise<unknown>
  getCrypto: () => MatrixCrypto | undefined
}

/** Matrix 房间配置 */
interface MatrixRoomConfig {
  name: string
  topic?: string
  preset: string
  visibility: string
  initial_state: Array<{
    type: string
    state_key: string
    content: Record<string, unknown>
  }>
}

/** Matrix 房间创建响应 */
interface MatrixRoomResponse {
  room_id?: string
  roomId?: string
}

/** Matrix 事件响应 */
interface MatrixEventResponse {
  event_id?: string
  eventId?: string
}

/** Matrix 房间对象 */
interface MatrixRoom {
  roomId?: string
  currentState: {
    getStateEvents: (eventType: string, stateKey: string) => MatrixStateEvent | null
  }
}

/** Matrix 状态事件 */
interface MatrixStateEvent {
  getContent?: () => Record<string, unknown>
}

/** Matrix 加密对象 */
interface MatrixCrypto {
  checkKeyBackupAndEnable?: () => Promise<MatrixBackupInfo | null>
  isKeyBackupTrusted?: (backupInfo: MatrixBackupInfo) => Promise<MatrixBackupTrust | null>
  getBackupKeyCount?: () => Promise<number | undefined>
  resetKeyBackup?: () => Promise<MatrixBackupInfo | null>
  restoreKeyBackupWithRecoveryKey?: (recoveryKey: string) => Promise<MatrixRestoreResult | null>
}

/** Matrix 备份信息 */
interface MatrixBackupInfo {
  version?: string
  backupVersion?: string
  algorithm?: string
  recoveryKey?: string
  recovery_key?: string
}

/** Matrix 备份信任信息 */
interface MatrixBackupTrust {
  usable?: boolean
  trusted_locally?: boolean
}

/** Matrix 恢复结果 */
interface MatrixRestoreResult {
  imported?: number
  total?: number
}

/** 自毁定时器信息 */
interface SelfDestructTimer {
  roomId: string
  eventId: string
  destroyTime: number
  timeoutMs: number
  destroyAfterSeconds?: number
}

/**
 * Key backup status information
 * Requirements 8.4: THE UI SHALL show key backup status in settings
 */
export interface KeyBackupStatus {
  enabled: boolean
  version?: string
  algorithm?: string
  keyCount?: number
  trustInfo?: {
    usable: boolean
    trusted: boolean
  }
}

/**
 * Key backup creation result
 * Requirements 8.2: THE System SHALL support creating encrypted key backup with recovery key
 */
export interface KeyBackupCreationResult {
  version: string
  recoveryKey: string
}

/**
 * Key backup restoration result
 * Requirements 8.3: THE System SHALL support restoring keys from backup on new device login
 */
export interface KeyBackupRestoreResult {
  imported: number
  total: number
}

/**
 * E2EE encryption algorithm constant
 * This is the standard Megolm encryption algorithm used by Matrix
 */
export const E2EE_ALGORITHM = 'm.megolm.v1.aes-sha2'

/**
 * Encryption status for a private chat room
 */
export interface EncryptionStatus {
  isEncrypted: boolean
  algorithm: string | null
  rotationPeriodMs: number | null
  rotationPeriodMsgs: number | null
  isCorrectAlgorithm: boolean
}

/**
 * HuLa私密聊天管理器
 * 基于Matrix企业SDK实现私密聊天和自毁消息功能
 */
export class HuLaPrivateChatManager {
  private client: MatrixClient | null = null
  private chatStore: ReturnType<typeof useChatStore>
  private timerManager = useTimerManager()
  private activeTimers = new Set<string>() // Track all active timer IDs

  constructor() {
    this.chatStore = useChatStore()
    this.client = this.getClient()
  }

  /**
   * 获取Matrix客户端
   */
  private getClient(): MatrixClient | null {
    return matrixClientService.getClient() as unknown as MatrixClient | null
  }

  /**
   * 初始化管理器
   */
  initialize() {
    this.client = this.getClient()
    if (!this.client) {
      logger.warn('[PrivateChat] Matrix client not available')
      return
    }

    this.setupEventListeners()
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.client) return // 监听私密聊天相关事件
    const clientExtended = this.client as unknown as MatrixClientExtended
    clientExtended.on('Room', (room: unknown) => {
      const roomRecord = room as Record<string, unknown> | null
      const roomId = roomRecord?.roomId as string | undefined
      if (roomId && this.isPrivateChat(roomId)) {
        logger.debug('[PrivateChat] Private chat room detected:', { data: roomId, component: 'PrivateChatManager' })
        this.markRoomAsPrivate(roomId)
      }
    })
  }

  /**
   * 创建私密聊天房间
   * E2EE is ALWAYS enabled by default with m.megolm.v1.aes-sha2 algorithm
   * Requirements: 6.1 - WHEN creating a private chat, THE PrivateChat_Manager SHALL enable E2EE
   */
  async createPrivateChat(options: {
    participants: string[]
    name?: string
    encryptionLevel?: 'standard' | 'high'
    selfDestructDefault?: number
    topic?: string
    /** @deprecated E2EE is always enabled for private chats. This option is ignored. */
    enableE2EE?: boolean
  }): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const { participants, name = '私密聊天', encryptionLevel = 'standard', selfDestructDefault, topic } = options

      logger.debug('[PrivateChat] Creating private chat with options:', {
        data: options,
        component: 'PrivateChatManager'
      })

      // E2EE encryption configuration - ALWAYS enabled for private chats
      // Algorithm: m.megolm.v1.aes-sha2 (Requirements 6.1)
      const encryptionConfig = {
        algorithm: E2EE_ALGORITHM, // 'm.megolm.v1.aes-sha2'
        rotation_period_ms: 604800000, // 7 days
        rotation_period_msgs: encryptionLevel === 'high' ? 100 : 1000
      }

      // 创建房间配置 - E2EE is mandatory in initial_state
      const roomConfig: MatrixRoomConfig = {
        name,
        topic: topic || '私密聊天 - 端到端加密',
        preset: 'private_chat',
        visibility: 'private',
        initial_state: [
          // E2EE encryption state - REQUIRED for all private chats
          {
            type: 'm.room.encryption',
            state_key: '',
            content: encryptionConfig
          },
          {
            type: 'm.room.join_rules',
            state_key: '',
            content: { join_rule: 'invite' }
          },
          {
            type: 'm.room.history_visibility',
            state_key: '',
            content: { history_visibility: 'joined' }
          },
          // 标记为私密聊天
          {
            type: 'com.hula.private_chat',
            state_key: '',
            content: {
              is_private: true,
              encryption_level: encryptionLevel,
              self_destruct_default: selfDestructDefault,
              created_at: Date.now()
            }
          }
        ]
      }

      // 创建房间
      const clientExtended = this.client as unknown as MatrixClientExtended
      const response = await withRetry(() => clientExtended.createRoom(roomConfig))
      const roomId =
        typeof response === 'string'
          ? response
          : ((response as MatrixRoomResponse)?.room_id ?? (response as MatrixRoomResponse)?.roomId ?? '')

      if (!roomId) {
        throw new Error('Failed to create room: No room ID returned')
      }

      logger.debug('[PrivateChat] Room created successfully:', { data: roomId, component: 'PrivateChatManager' })

      // 邀请参与者
      for (const userId of participants) {
        try {
          await withRetry(() => clientExtended.invite(roomId, userId))
          logger.debug('[PrivateChat] Invited user:', { data: userId, component: 'PrivateChatManager' })
        } catch (error) {
          logger.error('[PrivateChat] Failed to invite user:', {
            error: error,
            userId,
            component: 'PrivateChatManager'
          })
        }
      }

      // 等待房间同步
      await this.waitForRoomSync(roomId)

      // 验证E2EE已正确启用 (Requirements 6.2)
      const encryptionVerified = this.verifyPrivateChatEncryption(roomId)
      if (!encryptionVerified) {
        logger.warn('[PrivateChat] E2EE verification failed for new room, attempting to enable encryption:', { roomId })
        // 尝试手动启用加密
        try {
          await clientExtended.sendStateEvent(roomId, 'm.room.encryption', encryptionConfig, '')
          logger.info('[PrivateChat] E2EE manually enabled for room:', { roomId })

          // Verify again after manual enablement
          const secondVerification = this.verifyPrivateChatEncryption(roomId)
          if (!secondVerification) {
            // Requirements 6.4: IF encryption setup fails, THEN THE System SHALL notify user
            throw new Error('E2EE setup failed: Unable to enable encryption for private chat')
          }
        } catch (encError) {
          logger.error('[PrivateChat] Failed to manually enable E2EE:', toError(encError))
          // Requirements 6.4: Notify user and prevent unencrypted messages
          throw new Error(`E2EE setup failed: ${toError(encError).message}`)
        }
      }

      logger.info('[PrivateChat] Private chat created with E2EE enabled:', {
        roomId,
        algorithm: E2EE_ALGORITHM,
        encryptionLevel
      })

      return roomId
    } catch (error) {
      logger.error('[PrivateChat] Failed to create private chat:', toError(error))
      throw error
    }
  }

  /**
   * 发送自毁消息
   * Requirements 6.2: Verify encryption is active before sending messages
   * Requirements 6.4: Block sending if encryption is not properly configured
   * Requirements 7.1: WHEN sending a self-destruct message, THE PrivateChat_Manager SHALL set expiration time in message content
   *
   * @param roomId - The room ID to send the message to
   * @param content - The message content (can be string or object with msgtype)
   * @param timeoutMs - The timeout in milliseconds before the message self-destructs
   * @returns The event ID of the sent message
   */
  async sendSelfDestructMessage(
    roomId: string,
    content: string | { msgtype?: string; body?: string; [key: string]: unknown },
    timeoutMs: number
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Verify encryption before sending (Requirements 6.2, 6.4)
      // This will throw if the room is not properly encrypted
      const isEncrypted = this.verifyPrivateChatEncryption(roomId)
      if (!isEncrypted) {
        throw new Error('Cannot send self-destruct message to unencrypted room')
      }

      const expiresAt = Date.now() + timeoutMs

      // Normalize content to message object
      const messageBody =
        typeof content === 'string'
          ? { msgtype: 'm.text', body: content }
          : { msgtype: content.msgtype || 'm.text', body: content.body || '', ...content }

      logger.debug('[PrivateChat] Sending self-destruct message:', {
        roomId,
        timeoutMs,
        expiresAt,
        contentType: messageBody.msgtype
      })

      // 添加自毁消息的元数据 (Requirements 7.1)
      // Using im.hula.self_destruct format as per design document
      const messageContent = {
        ...messageBody,
        'im.hula.self_destruct': {
          expires_at: expiresAt,
          timeout: timeoutMs
        },
        // Also include legacy format for backward compatibility
        'com.hula.self_destruct': {
          destroy_after: Math.floor(timeoutMs / 1000),
          created_at: Date.now(),
          will_self_destruct: true
        }
      }

      // 发送消息
      const clientExtended = this.client as unknown as MatrixClientExtended
      const response = await withRetry(() => clientExtended.sendEvent(roomId, 'm.room.message', messageContent))

      const eventId = (response as MatrixEventResponse)?.event_id ?? ''
      if (!eventId) {
        throw new Error('Failed to send message: No event ID returned')
      }

      logger.info('[PrivateChat] Self-destruct message sent:', {
        eventId,
        timeoutMs,
        expiresAt
      })

      // 设置本地定时器 (Requirements 7.3)
      this.scheduleSelfDestruct(eventId, roomId, timeoutMs)

      return eventId
    } catch (error) {
      logger.error('[PrivateChat] Failed to send self-destruct message:', toError(error))
      throw error
    }
  }

  /**
   * 发送自毁消息 (Legacy method - kept for backward compatibility)
   * @deprecated Use sendSelfDestructMessage instead
   * Requirements 6.2: Verify encryption is active before sending messages
   * Requirements 6.4: Block sending if encryption is not properly configured
   */
  async sendSelfDestructingMessage(
    roomId: string,
    content: string | Record<string, unknown>,
    destroyAfterSeconds: number
  ): Promise<string> {
    // Convert seconds to milliseconds and delegate to new method
    return this.sendSelfDestructMessage(roomId, content, destroyAfterSeconds * 1000)
  }

  /**
   * Send a secure message to a private chat room
   * Requirements 6.2: Verify encryption is active before sending messages
   * Requirements 6.4: Block sending if encryption is not properly configured
   *
   * @param roomId - The room ID to send the message to
   * @param content - The message content
   * @returns The event ID of the sent message
   * @throws Error if the room is not encrypted or has incorrect algorithm
   */
  async sendSecureMessage(roomId: string, content: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Verify encryption before sending (Requirements 6.2, 6.4)
      // This will throw if the room is not properly encrypted
      this.verifyEncryptionBeforeSend(roomId)

      logger.debug('[PrivateChat] Sending secure message:', {
        roomId,
        contentType: (content as Record<string, unknown>).msgtype
      })

      // 发送消息
      const clientExtended = this.client as unknown as MatrixClientExtended
      const response = await withRetry(() => clientExtended.sendEvent(roomId, 'm.room.message', content))

      const eventId = (response as MatrixEventResponse)?.event_id ?? ''
      if (!eventId) {
        throw new Error('Failed to send message: No event ID returned')
      }

      logger.debug('[PrivateChat] Secure message sent successfully:', {
        data: eventId,
        component: 'PrivateChatManager'
      })

      return eventId
    } catch (error) {
      logger.error('[PrivateChat] Failed to send secure message:', toError(error))
      throw error
    }
  }

  /**
   * 检查房间是否为私密聊天
   */
  isPrivateChat(roomId: string): boolean {
    if (!this.client) return false

    const room = this.client.getRoom(roomId) as MatrixRoom | null
    if (!room) return false

    const privateChatState = room.currentState.getStateEvents('com.hula.private_chat', '') as MatrixStateEvent | null
    const content = privateChatState?.getContent?.()
    return (content as Record<string, unknown>)?.is_private === true
  }

  /**
   * 获取私密聊天信息
   */
  getPrivateChatInfo(roomId: string): Record<string, unknown> | null {
    if (!this.client) return null

    const room = this.client.getRoom(roomId) as MatrixRoom | null
    if (!room) return null

    const privateChatState = room.currentState.getStateEvents('com.hula.private_chat', '') as MatrixStateEvent | null
    return (privateChatState?.getContent?.() as Record<string, unknown>) || null
  }

  /**
   * 获取房间的加密状态
   * 验证私密聊天是否正确启用了E2EE
   */
  getEncryptionStatus(roomId: string): EncryptionStatus {
    if (!this.client) {
      return {
        isEncrypted: false,
        algorithm: null,
        rotationPeriodMs: null,
        rotationPeriodMsgs: null,
        isCorrectAlgorithm: false
      }
    }

    const room = this.client.getRoom(roomId) as MatrixRoom | null
    if (!room) {
      return {
        isEncrypted: false,
        algorithm: null,
        rotationPeriodMs: null,
        rotationPeriodMsgs: null,
        isCorrectAlgorithm: false
      }
    }

    // Get the encryption state event
    const encryptionState = room.currentState.getStateEvents('m.room.encryption', '') as MatrixStateEvent | null
    const content = encryptionState?.getContent?.() as Record<string, unknown> | null

    if (!content) {
      return {
        isEncrypted: false,
        algorithm: null,
        rotationPeriodMs: null,
        rotationPeriodMsgs: null,
        isCorrectAlgorithm: false
      }
    }

    const algorithm = (content.algorithm as string) || null
    const isCorrectAlgorithm = algorithm === E2EE_ALGORITHM

    return {
      isEncrypted: true,
      algorithm,
      rotationPeriodMs: (content.rotation_period_ms as number) || null,
      rotationPeriodMsgs: (content.rotation_period_msgs as number) || null,
      isCorrectAlgorithm
    }
  }

  /**
   * 验证私密聊天是否正确配置了E2EE
   * @returns true if the room has E2EE enabled with the correct algorithm
   */
  verifyPrivateChatEncryption(roomId: string): boolean {
    const status = this.getEncryptionStatus(roomId)

    if (!status.isEncrypted) {
      logger.warn('[PrivateChat] Room is not encrypted:', { roomId })
      return false
    }

    if (!status.isCorrectAlgorithm) {
      logger.warn('[PrivateChat] Room has incorrect encryption algorithm:', {
        roomId,
        expected: E2EE_ALGORITHM,
        actual: status.algorithm
      })
      return false
    }

    logger.debug('[PrivateChat] Room encryption verified:', {
      roomId,
      algorithm: status.algorithm,
      rotationPeriodMs: status.rotationPeriodMs,
      rotationPeriodMsgs: status.rotationPeriodMsgs
    })

    return true
  }

  /**
   * Verify encryption status before sending a message
   * Requirements 6.2: THE PrivateChat_Manager SHALL verify encryption is active before sending messages
   * Requirements 6.4: IF encryption setup fails, THEN THE System SHALL notify user and prevent unencrypted messages
   *
   * @param roomId - The room ID to verify
   * @throws Error if the room is not encrypted or has incorrect algorithm
   * @returns EncryptionStatus if verification passes
   */
  verifyEncryptionBeforeSend(roomId: string): EncryptionStatus {
    const status = this.getEncryptionStatus(roomId)

    if (!status.isEncrypted) {
      const error = new Error(`Cannot send message: Room ${roomId} is not encrypted. Private chats require E2EE.`)
      logger.error('[PrivateChat] Encryption verification failed - room not encrypted:', { roomId })
      throw error
    }

    if (!status.isCorrectAlgorithm) {
      const error = new Error(
        `Cannot send message: Room ${roomId} has incorrect encryption algorithm. ` +
          `Expected: ${E2EE_ALGORITHM}, Got: ${status.algorithm}`
      )
      logger.error('[PrivateChat] Encryption verification failed - wrong algorithm:', {
        roomId,
        expected: E2EE_ALGORITHM,
        actual: status.algorithm
      })
      throw error
    }

    logger.debug('[PrivateChat] Encryption verified for message send:', {
      roomId,
      algorithm: status.algorithm
    })

    return status
  }

  /**
   * Check if a room is safe to send messages to (encrypted with correct algorithm)
   * This is a non-throwing version of verifyEncryptionBeforeSend
   *
   * @param roomId - The room ID to check
   * @returns Object with isSafe boolean and optional error message
   */
  canSendSecureMessage(roomId: string): { isSafe: boolean; error?: string; status: EncryptionStatus } {
    const status = this.getEncryptionStatus(roomId)

    if (!status.isEncrypted) {
      return {
        isSafe: false,
        error: 'Room is not encrypted. Private chats require E2EE.',
        status
      }
    }

    if (!status.isCorrectAlgorithm) {
      return {
        isSafe: false,
        error: `Room has incorrect encryption algorithm. Expected: ${E2EE_ALGORITHM}, Got: ${status.algorithm}`,
        status
      }
    }

    return { isSafe: true, status }
  }

  /**
   * 标记房间为私密聊天
   */
  private markRoomAsPrivate(roomId: string) {
    // 更新本地会话信息
    const session = this.chatStore.getSession(roomId) as { name: string } | null
    if (session) {
      this.chatStore.updateSession(roomId, {
        name: `🔒 ${session.name}`
      } as Record<string, unknown>)
    }
  }

  /**
   * 等待房间同步
   */
  private async waitForRoomSync(roomId: string, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const checkRoom = () => {
        if (this.client?.getRoom(roomId)) {
          resolve()
          return
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Room sync timeout'))
          return
        }

        const { id } = this.timerManager.setTimer(checkRoom, 100)
        this.activeTimers.add(`waitForRoomSync-${id}`)
      }

      checkRoom()
    })
  }

  /**
   * 调度自毁定时器
   * Requirements 7.3: WHEN countdown reaches zero, THE System SHALL remove message from local storage
   * Requirements 7.4: THE System SHALL send redaction event to remove message from server
   *
   * @param eventId - The event ID of the message to schedule for destruction
   * @param roomId - The room ID containing the message
   * @param timeoutMs - The timeout in milliseconds before destruction
   */
  scheduleSelfDestruct(eventId: string, roomId: string, timeoutMs: number): void {
    const destroyTime = Date.now() + timeoutMs

    logger.debug('[PrivateChat] Scheduling self-destruct:', {
      roomId,
      eventId,
      destroyTime,
      timeoutMs
    })

    // Persist timer info to localStorage for recovery after app restart
    const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}')
    timers[`${roomId}_${eventId}`] = {
      roomId,
      eventId,
      destroyTime,
      timeoutMs
    }
    localStorage.setItem('hula_self_destruct_timers', JSON.stringify(timers))

    // Set the actual timer
    const timerId = `selfDestruct-${roomId}_${eventId}`
    this.timerManager.setTimer(() => {
      this.destroyMessage(eventId, roomId)
      this.activeTimers.delete(timerId)
    }, timeoutMs)
    this.activeTimers.add(timerId)
  }

  /**
   * 销毁消息
   * Requirements 7.3: WHEN countdown reaches zero, THE System SHALL remove message from local storage
   * Requirements 7.4: THE System SHALL send redaction event to remove message from server
   *
   * @param eventId - The event ID of the message to destroy
   * @param roomId - The room ID containing the message
   */
  async destroyMessage(eventId: string, roomId: string): Promise<void> {
    try {
      logger.info('[PrivateChat] Destroying message:', { eventId, roomId })

      // Send redaction event to remove message from server (Requirements 7.4)
      if (this.client) {
        const clientExtended = this.client as unknown as MatrixClientExtended
        const timerData = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}') as Record<
          string,
          SelfDestructTimer
        >
        const timer = timerData[`${roomId}_${eventId}`]
        await clientExtended.redactEvent(
          roomId,
          eventId,
          timer?.destroyAfterSeconds ? `Self-destruct after ${timer.destroyAfterSeconds}s` : 'Self-destruct'
        )
      }

      // Remove from local storage (Requirements 7.3)
      const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}') as Record<
        string,
        SelfDestructTimer
      >
      delete timers[`${roomId}_${eventId}`]
      localStorage.setItem('hula_self_destruct_timers', JSON.stringify(timers))

      // Clear any pending timer
      const timerId = `selfDestruct-${roomId}_${eventId}`
      if (this.activeTimers.has(timerId)) {
        this.activeTimers.delete(timerId)
      }

      // Notify UI to update (Requirements 7.5)
      window.dispatchEvent(
        new CustomEvent('message-self-destructed', {
          detail: { roomId, eventId }
        })
      )

      logger.info('[PrivateChat] Message destroyed successfully:', { eventId })
    } catch (error) {
      logger.error('[PrivateChat] Failed to destroy message:', toError(error))
      throw error
    }
  }

  /**
   * 获取消息剩余时间
   *
   * @param eventId - The event ID of the message
   * @param roomId - The room ID containing the message
   * @returns The remaining time in milliseconds, or 0 if expired/not found
   */
  getMessageTimeRemaining(eventId: string, roomId: string): number {
    const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}') as Record<
      string,
      SelfDestructTimer
    >
    const timer = timers[`${roomId}_${eventId}`]

    if (!timer || !timer.destroyTime) {
      return 0
    }

    return Math.max(0, timer.destroyTime - Date.now())
  }

  /**
   * 获取待销毁的消息列表
   */
  getPendingSelfDestructMessages(): Array<{
    roomId: string
    eventId: string
    destroyTime: number
    timeoutMs: number
  }> {
    const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}') as Record<
      string,
      SelfDestructTimer
    >
    const now = Date.now()

    return Object.entries(timers)
      .filter(([, timer]) => timer.destroyTime > now)
      .map(([, timer]) => ({
        roomId: timer.roomId,
        eventId: timer.eventId,
        destroyTime: timer.destroyTime,
        timeoutMs: timer.timeoutMs
      }))
  }

  /**
   * 检查并重新启动自毁定时器（应用启动时调用）
   */
  checkAndRestartTimers() {
    const pendingMessages = this.getPendingSelfDestructMessages()
    const now = Date.now()

    pendingMessages.forEach((message) => {
      const timeLeft = message.destroyTime - now
      if (timeLeft > 0) {
        const timerId = `restart-${message.roomId}_${message.eventId}`
        this.timerManager.setTimer(() => {
          this.destroyMessage(message.eventId, message.roomId)
          this.activeTimers.delete(timerId)
        }, timeLeft)
        this.activeTimers.add(timerId)
        logger.debug('[PrivateChat] Restarted timer for message:', {
          roomId: message.roomId,
          eventId: message.eventId,
          timeLeft: Math.floor(timeLeft / 1000)
        })
      } else {
        // Timer already expired, destroy immediately
        this.destroyMessage(message.eventId, message.roomId)
      }
    })
  }

  /**
   * 设置高级加密
   */
  async setupHighEncryption(roomId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const encryptionConfig: Record<string, unknown> = {
        algorithm: E2EE_ALGORITHM,
        rotation_period_ms: 604800000, // 7天
        rotation_period_msgs: 50, // 50条消息后轮换
        blacklist_unverified_devices: true
      }

      const clientExtended = this.client as unknown as MatrixClientExtended
      await clientExtended.sendStateEvent(roomId, 'm.room.encryption', encryptionConfig, '')

      // 更新私密聊天配置
      await clientExtended.sendStateEvent(
        roomId,
        'com.hula.private_chat',
        {
          is_private: true,
          encryption_level: 'high',
          updated_at: Date.now()
        },
        ''
      )

      logger.debug('[PrivateChat] High encryption enabled for room:', { data: roomId, component: 'PrivateChatManager' })
    } catch (error) {
      logger.error('[PrivateChat] Failed to setup high encryption:', toError(error))
      throw error
    }
  }

  // ==================== Key Backup Methods ====================

  /**
   * Check the current key backup status
   * Requirements 8.4: THE UI SHALL show key backup status in settings
   *
   * @returns KeyBackupStatus object with backup information
   */
  async checkKeyBackupStatus(): Promise<KeyBackupStatus> {
    if (!this.client) {
      logger.warn('[PrivateChat] Cannot check key backup: client not initialized')
      return { enabled: false }
    }

    try {
      const clientExtended = this.client as unknown as MatrixClientExtended
      const crypto = clientExtended.getCrypto()
      if (!crypto) {
        logger.warn('[PrivateChat] Crypto module not available')
        return { enabled: false }
      }

      // Check if key backup exists and is enabled
      // Using checkKeyBackupAndEnable which checks for existing backup and enables it if found
      const backupInfo = await crypto.checkKeyBackupAndEnable?.()

      if (!backupInfo) {
        logger.debug('[PrivateChat] No key backup found')
        return { enabled: false }
      }

      // Get additional backup info if available
      let keyCount: number | undefined
      let trustInfo: { usable: boolean; trusted: boolean } | undefined

      try {
        // Try to get the backup trust info
        const backupTrust = await crypto.isKeyBackupTrusted?.(backupInfo)
        if (backupTrust) {
          trustInfo = {
            usable: backupTrust.usable ?? false,
            trusted: backupTrust.trusted_locally ?? false
          }
        }
      } catch {
        // Trust info not available, continue without it
      }

      try {
        // Try to get the key count
        const backupKeyCount = await crypto.getBackupKeyCount?.()
        if (typeof backupKeyCount === 'number') {
          keyCount = backupKeyCount
        }
      } catch {
        // Key count not available, continue without it
      }

      logger.info('[PrivateChat] Key backup status checked:', {
        version: backupInfo.version,
        algorithm: backupInfo.algorithm,
        keyCount,
        trustInfo
      })

      const result: KeyBackupStatus = {
        enabled: true
      }
      if (backupInfo.version !== undefined) result.version = backupInfo.version
      if (backupInfo.algorithm !== undefined) result.algorithm = backupInfo.algorithm
      if (keyCount !== undefined) result.keyCount = keyCount
      if (trustInfo !== undefined) result.trustInfo = trustInfo
      return result
    } catch (error) {
      logger.error('[PrivateChat] Failed to check key backup status:', toError(error))
      return { enabled: false }
    }
  }

  /**
   * Create a new key backup with a recovery key
   * Requirements 8.2: THE System SHALL support creating encrypted key backup with recovery key
   *
   * @returns KeyBackupCreationResult with version and recovery key
   * @throws Error if backup creation fails
   */
  async createKeyBackup(): Promise<KeyBackupCreationResult> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    const clientExtended = this.client as unknown as MatrixClientExtended
    const crypto = clientExtended.getCrypto()
    if (!crypto) {
      throw new Error('Crypto module not available')
    }

    try {
      logger.info('[PrivateChat] Creating new key backup...')

      // Reset/create key backup - this generates a new recovery key
      const backupInfo = await crypto.resetKeyBackup?.()

      if (!backupInfo) {
        throw new Error('Failed to create key backup: No backup info returned')
      }

      // Extract version and recovery key from the result
      const version = backupInfo.version || backupInfo.backupVersion || ''
      const recoveryKey = backupInfo.recoveryKey || backupInfo.recovery_key || ''

      if (!version) {
        throw new Error('Failed to create key backup: No version returned')
      }

      logger.info('[PrivateChat] Key backup created successfully:', {
        version,
        hasRecoveryKey: !!recoveryKey
      })

      // Emit event to notify UI about key backup creation
      // Requirements 8.1: THE PrivateChat_Manager SHALL prompt user to setup key backup
      this.emitKeyBackupEvent('keyBackupCreated', {
        version,
        hasRecoveryKey: !!recoveryKey
      })

      return {
        version,
        recoveryKey
      }
    } catch (error) {
      logger.error('[PrivateChat] Failed to create key backup:', toError(error))
      throw error
    }
  }

  /**
   * Restore keys from backup using a recovery key
   * Requirements 8.3: THE System SHALL support restoring keys from backup on new device login
   *
   * @param recoveryKey - The recovery key to use for restoration
   * @returns KeyBackupRestoreResult with import statistics
   * @throws Error if restoration fails
   */
  async restoreKeyBackup(recoveryKey: string): Promise<KeyBackupRestoreResult> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    if (!recoveryKey || typeof recoveryKey !== 'string') {
      throw new Error('Invalid recovery key provided')
    }

    const clientExtended = this.client as unknown as MatrixClientExtended
    const crypto = clientExtended.getCrypto()
    if (!crypto) {
      throw new Error('Crypto module not available')
    }

    try {
      logger.info('[PrivateChat] Restoring keys from backup...')

      // Restore keys using the recovery key
      const result = await crypto.restoreKeyBackupWithRecoveryKey?.(recoveryKey)

      if (!result) {
        throw new Error('Failed to restore key backup: No result returned')
      }

      const imported = result.imported ?? result.total ?? 0
      const total = result.total ?? result.imported ?? 0

      logger.info('[PrivateChat] Key backup restored successfully:', {
        imported,
        total
      })

      // Emit event to notify UI about successful restoration
      this.emitKeyBackupEvent('keyBackupRestored', {
        imported,
        total
      })

      return {
        imported,
        total
      }
    } catch (error) {
      logger.error('[PrivateChat] Failed to restore key backup:', toError(error))
      throw error
    }
  }

  /**
   * Check if key backup should be prompted to the user
   * Requirements 8.1: THE PrivateChat_Manager SHALL prompt user to setup key backup on first encrypted chat
   * Requirements 8.5: IF key backup is not setup, THEN THE UI SHALL warn about potential message loss
   *
   * @returns true if user should be prompted to setup key backup
   */
  async shouldPromptKeyBackup(): Promise<boolean> {
    const status = await this.checkKeyBackupStatus()

    if (!status.enabled) {
      logger.debug('[PrivateChat] Key backup not enabled, should prompt user')
      return true
    }

    // Check if backup is trusted
    if (status.trustInfo && !status.trustInfo.usable) {
      logger.debug('[PrivateChat] Key backup not usable, should prompt user')
      return true
    }

    return false
  }

  /**
   * Emit key backup related events for UI updates
   * @param eventType - The type of key backup event
   * @param data - Event data
   */
  private emitKeyBackupEvent(eventType: string, data: Record<string, unknown>): void {
    try {
      window.dispatchEvent(
        new CustomEvent(`hula-key-backup-${eventType}`, {
          detail: data
        })
      )
    } catch {
      // Ignore event dispatch errors (e.g., in non-browser environments)
    }
  }

  /**
   * 清理所有定时器
   */
  cleanup() {
    this.timerManager.clearAllTimers()
    this.activeTimers.clear()
  }
}

// 导出单例实例
let _privateChatManager: HuLaPrivateChatManager | null = null
export const getPrivateChatManager = () => {
  if (!_privateChatManager) {
    _privateChatManager = new HuLaPrivateChatManager()
  }
  return _privateChatManager
}
