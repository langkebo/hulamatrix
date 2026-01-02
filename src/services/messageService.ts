/**
 * 消息服务主入口（适配器层）
 *
 * @deprecated 此服务已迁移到 unifiedMessageService.ts
 * 请使用 unifiedMessageService 代替。此类保留以保持向后兼容。
 *
 * 迁移指南：
 * - messageService.sendMessage() → unifiedMessageService.sendMessage()
 * - messageService.sendTextMessage() → unifiedMessageService.sendTextMessage()
 * - messageService.recallMessage() → unifiedMessageService.recallMessage()
 * - messageService.markAsRead() → unifiedMessageService.markAsRead()
 */

import { enhancedMessageService } from './enhancedMessageService'
import { messageReceiver } from './unifiedMessageReceiver'
import { matrixClientService } from '@/integrations/matrix/client'
import { webSocketService } from './webSocketService'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { threadService } from './matrixThreadAdapter'
import { logger } from '@/utils/logger'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MsgType } from './types'
import type { MatrixCredentials } from '@/types/matrix'
import { formatMessageContent, parseMatrixEvent } from '@/utils/messageUtils'
import { tokenRefreshService } from './tokenRefreshService'

/** 消息体基础类型 */
export interface MessageBody {
  text?: string
  file?: File
  fileName?: string
  mimeType?: string
  fileSize?: number
  caption?: string
  duration?: number
  waveform?: number[]
  latitude?: number
  longitude?: number
  geoUri?: string
  description?: string
  replyEventId?: string
  [key: string]: unknown
}

export interface SendMessageOptions {
  roomId: string
  type: MsgEnum
  body: MessageBody
  encrypted?: boolean
  priority?: 'low' | 'normal' | 'high'
  forceRoute?: 'matrix' | 'websocket' | 'hybrid'
}

export interface MessageServiceConfig {
  matrixUrl?: string
  enableEncryption?: boolean
  autoReadReceipt?: boolean
  syncHistoryOnJoin?: boolean
}

/** Matrix 客户端扩展类型 */
interface MatrixClientExtended {
  sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
  createMessagesRequest: (
    roomId: string,
    from: string | null,
    dir: number,
    limit: number
  ) => Promise<{
    chunk: Array<{
      getType?: () => string
      type?: string
      [key: string]: unknown
    }>
  }>
}

/** Matrix 事件 ID 响应类型 */
interface EventIdResponse {
  event_id?: string
  [key: string]: unknown
}

/** Store 扩展类型 */
interface ChatStoreExtended {
  recallMessage?: (roomId: string, eventId: string) => Promise<void>
  markAsRead?: (roomId: string, eventId: string) => Promise<void>
}

// Transaction tracker for pending messages
interface PendingTransaction {
  roomId: string
  transactionId: string
  timestamp: number
  abortController?: AbortController
}

const transactionTracker = new Map<string, PendingTransaction>()

export class MessageService {
  private static instance: MessageService
  private initialized = false
  private config: MessageServiceConfig = {}

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService()
    }
    return MessageService.instance
  }

  /**
   * 初始化消息服务
   */
  async initialize(config?: MessageServiceConfig): Promise<void> {
    if (this.initialized) return

    try {
      this.config = { ...this.config, ...config }

      logger.info('[MessageService] Initializing message service')

      // 初始化Matrix客户端
      await this.initializeMatrixClient()

      // 初始化消息接收器
      await messageReceiver.initialize()

      // 初始化WebSocket
      await this.initializeWebSocket()

      this.initialized = true
      logger.info('[MessageService] Message service initialized successfully')
    } catch (error) {
      logger.error('[MessageService] Failed to initialize message service:', error)
      throw error
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(options: SendMessageOptions): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Sending message:', {
        roomId: options.roomId,
        type: options.type,
        encrypted: options.encrypted
      })

      // 构建发送参数
      const sendParams = {
        type: options.type,
        body: options.body
      }

      // 通过增强消息服务发送
      const sendMessageOptions: {
        forceRoute?: 'matrix' | 'websocket' | 'hybrid'
        encrypted: boolean
        priority?: 'normal' | 'low' | 'high'
      } = {
        encrypted: options.encrypted ?? this.config.enableEncryption ?? true,
        priority: options.priority || 'normal'
      }
      if (options.forceRoute !== undefined) sendMessageOptions.forceRoute = options.forceRoute
      const message = await enhancedMessageService.sendMessage(options.roomId, sendParams, sendMessageOptions)

      // 更新本地消息状态
      const chatStore = useChatStore()
      await chatStore.updateMessageStatus(message.id, MessageStatusEnum.SUCCESS)

      logger.info('[MessageService] Message sent successfully:', {
        messageId: message.id,
        roomId: options.roomId
      })

      return message
    } catch (error) {
      logger.error('[MessageService] Failed to send message:', {
        roomId: options.roomId,
        type: options.type,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(roomId: string, text: string, replyTo?: string): Promise<MsgType> {
    const body: MessageBody = { text }

    // 如果是回复消息
    if (replyTo) {
      body.replyEventId = replyTo
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.TEXT,
      body
    })
  }

  /**
   * 发送图片消息
   */
  async sendImageMessage(roomId: string, file: File, caption?: string, replyTo?: string): Promise<MsgType> {
    const body: MessageBody = {
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size
    }

    if (caption) {
      body.caption = caption
    }

    if (replyTo) {
      body.replyEventId = replyTo
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.IMAGE,
      body
    })
  }

  /**
   * 发送视频消息
   */
  async sendVideoMessage(
    roomId: string,
    file: File,
    caption?: string,
    duration?: number,
    replyTo?: string
  ): Promise<MsgType> {
    const body: MessageBody = {
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size
    }

    if (caption) {
      body.caption = caption
    }

    if (duration) {
      body.duration = duration
    }

    if (replyTo) {
      body.replyEventId = replyTo
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.VIDEO,
      body
    })
  }

  /**
   * 发送语音消息
   */
  async sendVoiceMessage(
    roomId: string,
    file: File,
    duration: number,
    waveform?: number[],
    replyTo?: string
  ): Promise<MsgType> {
    const body: MessageBody = {
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      duration
    }

    if (waveform) {
      body.waveform = waveform
    }

    if (replyTo) {
      body.replyEventId = replyTo
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.VOICE,
      body
    })
  }

  /**
   * 发送文件消息
   */
  async sendFileMessage(roomId: string, file: File, replyTo?: string): Promise<MsgType> {
    const body: MessageBody = {
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size
    }

    if (replyTo) {
      body.replyEventId = replyTo
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.FILE,
      body
    })
  }

  /**
   * 发送位置消息
   */
  async sendLocationMessage(
    roomId: string,
    latitude: number,
    longitude: number,
    description?: string
  ): Promise<MsgType> {
    const body: MessageBody = {
      latitude,
      longitude,
      geoUri: `geo:${latitude},${longitude}`
    }

    if (description) {
      body.description = description
    }

    return this.sendMessage({
      roomId,
      type: MsgEnum.LOCATION,
      body
    })
  }

  /**
   * 撤回消息
   */
  async recallMessage(roomId: string, eventId: string): Promise<void> {
    this.ensureInitialized()

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      // 发送替换事件来撤回消息
      const content = {
        msgtype: 'm.notice',
        body: '撤回了一条消息',
        'm.new_content': {},
        'm.relates_to': {
          event_id: eventId,
          rel_type: 'm.replace'
        }
      }

      const clientLike = client as unknown as MatrixClientExtended
      await clientLike.sendEvent(roomId, 'm.room.message', content)

      // 更新本地消息状态
      const chatStore = useChatStore() as unknown as ChatStoreExtended
      if (typeof chatStore.recallMessage === 'function') {
        await chatStore.recallMessage(roomId, eventId)
      }

      logger.info('[MessageService] Message recalled:', { roomId, eventId })
    } catch (error) {
      logger.error('[MessageService] Failed to recall message:', {
        roomId,
        eventId,
        error
      })
      throw error
    }
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    this.ensureInitialized()

    try {
      const globalStore = useGlobalStore()
      const currentSession = globalStore.currentSession

      // 如果不是当前会话，不发送已读回执
      if (currentSession?.roomId !== roomId) {
        return
      }

      // 发送Matrix已读回执
      await enhancedMessageService.markAsRead(roomId, eventId)

      // 更新本地已读状态
      const chatStore = useChatStore() as unknown as ChatStoreExtended
      if (typeof chatStore.markAsRead === 'function') {
        await chatStore.markAsRead(roomId, eventId)
      }

      logger.debug('[MessageService] Message marked as read:', { roomId, eventId })
    } catch (error) {
      logger.error('[MessageService] Failed to mark message as read:', {
        roomId,
        eventId,
        error
      })
    }
  }

  /**
   * 获取历史消息
   */
  async getHistoryMessages(
    roomId: string,
    options?: {
      limit?: number
      from?: string
      dir?: 'b' | 'f'
    }
  ): Promise<MsgType[]> {
    this.ensureInitialized()

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      const direction = options?.dir === 'f' ? 1 : -1
      const clientLike = client as unknown as MatrixClientExtended
      const response = await clientLike.createMessagesRequest(
        roomId,
        options?.from ?? null,
        direction,
        options?.limit || 20
      )

      // 转换事件为消息格式
      const messages: MsgType[] = []
      for (const event of response.chunk) {
        const eventType = event.getType?.() || event.type
        if (eventType === 'm.room.message') {
          // 使用 parseMatrixEvent 转换 Matrix 事件为内部消息格式
          // 类型断言：Matrix SDK 事件类型兼容 MatrixEventLike
          const parsed = parseMatrixEvent(event as unknown as Parameters<typeof parseMatrixEvent>[0])
          if (parsed.message) {
            // 类型断言：将 message 转换为 MsgType 格式
            messages.push(parsed.message as unknown as MsgType)
          }
        }
      }

      return messages
    } catch (error) {
      logger.error('[MessageService] Failed to get history messages:', {
        roomId,
        error
      })
      throw error
    }
  }

  /**
   * 发送线程回复
   */
  async sendThreadReply(threadRootId: string, roomId: string, type: MsgEnum, body: MessageBody): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Sending thread reply:', {
        threadRootId,
        roomId,
        type
      })

      // 使用threadService发送回复
      let eventId = await threadService.sendThreadReply(threadRootId, roomId, type, body)
      eventId = typeof eventId === 'string' ? eventId : (eventId as EventIdResponse)?.event_id || String(eventId)

      // 构建返回的消息对象
      const message: MsgType = {
        id: eventId,
        roomId,
        type,
        body,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      logger.info('[MessageService] Thread reply sent successfully:', {
        eventId,
        threadRootId,
        roomId
      })

      return message
    } catch (error) {
      logger.error('[MessageService] Failed to send thread reply:', {
        threadRootId,
        roomId,
        type,
        error
      })
      throw error
    }
  }

  /**
   * 获取线程消息
   */
  async getThreadMessages(
    threadRootId: string,
    roomId: string,
    options?: {
      from?: string
      limit?: number
      dir?: 'b' | 'f'
    }
  ): Promise<unknown[]> {
    this.ensureInitialized()

    try {
      return await threadService.getThreadMessages(threadRootId, roomId, options)
    } catch (error) {
      logger.error('[MessageService] Failed to get thread messages:', {
        threadRootId,
        roomId,
        error
      })
      throw error
    }
  }

  /**
   * 批量发送消息（顺序发送，保证顺序）
   */
  async sendMultipleMessages(
    messages: Array<{ roomId: string; type: MsgEnum; body: MessageBody }>,
    options?: {
      delay?: number // 每条消息之间的延迟（毫秒）
      stopOnError?: boolean // 遇到错误是否停止
    }
  ): Promise<{
    successful: Array<{ message: MsgType; index: number }>
    failed: Array<{ error: Error; index: number }>
  }> {
    this.ensureInitialized()

    const successful: Array<{ message: MsgType; index: number }> = []
    const failed: Array<{ error: Error; index: number }> = []
    const delay = options?.delay || 100

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      try {
        logger.info('[MessageService] Sending message in batch:', {
          index: i,
          total: messages.length,
          roomId: msg.roomId,
          type: msg.type
        })

        const message = await this.sendMessage({
          roomId: msg.roomId,
          type: msg.type,
          body: msg.body
        })

        successful.push({ message, index: i })

        // 添加延迟以避免速率限制
        if (i < messages.length - 1) {
          await this.delay(delay)
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        failed.push({ error: err, index: i })

        logger.error('[MessageService] Failed to send message in batch:', {
          index: i,
          error: err.message
        })

        if (options?.stopOnError) {
          logger.info('[MessageService] Stopping batch due to error')
          break
        }
      }
    }

    const result = {
      successful,
      failed
    }

    logger.info('[MessageService] Batch send completed:', {
      total: messages.length,
      successful: successful.length,
      failed: failed.length
    })

    return result
  }

  /**
   * 批量发送消息（并发发送，不保证顺序）
   */
  async sendMultipleMessagesParallel(messages: Array<{ roomId: string; type: MsgEnum; body: MessageBody }>): Promise<{
    successful: Array<{ message: MsgType; index: number }>
    failed: Array<{ error: Error; index: number }>
  }> {
    this.ensureInitialized()

    logger.info('[MessageService] Starting parallel batch send:', {
      count: messages.length
    })

    const results = await Promise.allSettled(
      messages.map((msg, index) =>
        this.sendMessage({
          roomId: msg.roomId,
          type: msg.type,
          body: msg.body
        }).then(
          (message) => ({ success: true, message, index }),
          (error) => ({ success: false, error, index })
        )
      )
    )

    const successful: Array<{ message: MsgType; index: number }> = []
    const failed: Array<{ error: Error; index: number }> = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value as { success: boolean; message?: MsgType; error?: Error; index: number }
        if (value.success && value.message) {
          successful.push({ message: value.message, index: value.index })
        } else if (value.error) {
          const err = value.error instanceof Error ? value.error : new Error(String(value.error))
          failed.push({ error: err, index: value.index })
        }
      } else {
        const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
        failed.push({ error: err, index })
      }
    })

    logger.info('[MessageService] Parallel batch send completed:', {
      total: messages.length,
      successful: successful.length,
      failed: failed.length
    })

    return { successful, failed }
  }

  /**
   * 使用事务ID发送消息
   * Implementation of document requirement: transaction ID support
   * Uses Matrix SDK's native transaction ID support for idempotency
   */
  async sendMessageWithTransactionId(options: SendMessageOptions & { transactionId: string }): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Sending message with transaction ID:', {
        transactionId: options.transactionId,
        roomId: options.roomId,
        type: options.type
      })

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      // 构建消息内容
      const messageContent = formatMessageContent(options.type, options.body)

      // Create abort controller for cancellation
      const abortController = new AbortController()
      const txnKey = `${options.roomId}:${options.transactionId}`

      // Track the transaction
      transactionTracker.set(txnKey, {
        roomId: options.roomId,
        transactionId: options.transactionId,
        timestamp: Date.now(),
        abortController
      })

      try {
        // Use Matrix SDK's native transaction ID support
        // The sendMessage method accepts (roomId, content, txnId) as parameters
        const sendMethod = (
          client as unknown as {
            sendMessage: (
              roomId: string,
              content: Record<string, unknown>,
              txnId?: string
            ) => Promise<{ event_id: string } | string>
          }
        ).sendMessage

        const sendRes = await sendMethod(
          options.roomId,
          messageContent as unknown as Record<string, unknown>,
          options.transactionId
        )
        const eventId: string =
          typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)

        // Build response message object
        const message: MsgType = {
          id: eventId,
          roomId: options.roomId,
          type: options.type,
          body: options.body,
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.SUCCESS
        }

        logger.info('[MessageService] Message sent with transaction ID:', {
          transactionId: options.transactionId,
          messageId: message.id
        })

        return message
      } finally {
        // Clean up transaction tracker
        transactionTracker.delete(txnKey)
      }
    } catch (error) {
      logger.error('[MessageService] Failed to send message with transaction ID:', {
        transactionId: options.transactionId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 取消待发送的消息
   * Implementation of document requirement: cancel pending message by transaction ID
   */
  async cancelPendingMessage(roomId: string, transactionId: string): Promise<boolean> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Cancelling pending message:', { roomId, transactionId })

      const txnKey = `${roomId}:${transactionId}`
      const pendingTxn = transactionTracker.get(txnKey)

      if (pendingTxn && pendingTxn.abortController) {
        // Abort the pending request
        pendingTxn.abortController.abort()
        transactionTracker.delete(txnKey)

        logger.info('[MessageService] Message cancelled successfully:', { roomId, transactionId })
        return true
      }

      logger.warn('[MessageService] Message not found or already sent:', { roomId, transactionId })
      return false
    } catch (error) {
      logger.error('[MessageService] Failed to cancel message:', {
        roomId,
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * 编辑消息
   * Implementation of document requirement: edit message with m.new_content and m.replace
   */
  async editMessage(
    roomId: string,
    originalEventId: string,
    newContent: { text?: string; body?: MessageBody; formattedBody?: string }
  ): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Editing message:', {
        roomId,
        originalEventId,
        hasText: !!newContent.text,
        hasFormattedBody: !!newContent.formattedBody
      })

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      // 构建编辑消息内容
      const messageBody = newContent.body?.text || newContent.text || ''
      const editContent: Record<string, unknown> = {
        msgtype: 'm.text',
        body: messageBody,
        'm.new_content': {
          msgtype: 'm.text',
          body: messageBody
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      }

      // 添加格式化内容（如果提供）
      if (newContent.formattedBody) {
        editContent.format = 'org.matrix.custom.html'
        editContent.formatted_body = newContent.formattedBody
        ;(editContent['m.new_content'] as Record<string, unknown>).format = 'org.matrix.custom.html'
        ;(editContent['m.new_content'] as Record<string, unknown>).formatted_body = newContent.formattedBody
      }

      // 使用 sendEvent 发送编辑事件
      const sendMethod = (
        client as unknown as {
          sendEvent: (
            roomId: string,
            eventType: string,
            content: Record<string, unknown>
          ) => Promise<{ event_id: string } | string>
        }
      ).sendEvent

      const sendRes = await sendMethod(roomId, 'm.room.message', editContent)
      const eventId: string =
        typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)

      // 构建返回的消息对象
      const message: MsgType = {
        id: eventId,
        roomId: roomId,
        type: MsgEnum.TEXT,
        body: { text: messageBody } as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      logger.info('[MessageService] Message edited successfully:', {
        originalEventId,
        newEventId: eventId
      })

      return message
    } catch (error) {
      logger.error('[MessageService] Failed to edit message:', {
        roomId,
        originalEventId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 撤销编辑，恢复原始消息
   */
  async revertEdit(roomId: string, editEventId: string, originalContent: string): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Reverting edit:', { roomId, editEventId })

      // 获取原始编辑事件的关系信息
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const findEventByIdMethod = room.findEventById as
        | ((eventId: string) => Record<string, unknown> | null)
        | undefined
      const editEvent = findEventByIdMethod?.(editEventId)
      if (!editEvent) {
        throw new Error(`编辑事件不存在: ${editEventId}`)
      }

      const getContentMethod = editEvent.getContent as (() => Record<string, unknown>) | undefined
      const content = getContentMethod?.()
      if (!content) {
        throw new Error('无法获取编辑事件内容')
      }

      const relatesTo = content['m.relates_to'] as { event_id?: string } | undefined
      if (!relatesTo?.event_id) {
        throw new Error('无法获取原始事件ID')
      }

      // 发送恢复编辑
      return this.editMessage(roomId, relatesTo.event_id, { text: originalContent })
    } catch (error) {
      logger.error('[MessageService] Failed to revert edit:', {
        roomId,
        editEventId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 添加/删除消息反应
   * Implementation of document requirement: toggle reaction on message
   */
  async toggleReaction(
    roomId: string,
    targetEventId: string,
    emoji: string,
    userId?: string
  ): Promise<{ added: boolean; eventId?: string }> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Toggling reaction:', {
        roomId,
        targetEventId,
        emoji
      })

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      const currentUserId = userId || (client.getUserId as (() => string) | undefined)?.()
      if (!currentUserId) {
        throw new Error('无法获取当前用户ID')
      }

      // 检查用户是否已经对该消息添加了该表情
      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      // 查找现有的反应事件
      const getLiveTimelineMethod = room.getLiveTimeline as (() => Record<string, unknown>) | undefined
      const timeline = getLiveTimelineMethod?.()
      if (!timeline) {
        throw new Error('无法获取房间时间线')
      }

      const getEventsMethod = timeline.getEvents as (() => Array<Record<string, unknown>>) | undefined
      const events = getEventsMethod?.() || []

      let existingReactionEventId: string | null = null

      for (const event of events) {
        const getTypeMethod = event.getType as (() => string) | undefined
        const getSenderMethod = event.getSender as (() => string) | undefined
        const getIdMethod = event.getId as (() => string) | undefined
        const getContentMethod = event.getContent as (() => Record<string, unknown>) | undefined

        if (getTypeMethod?.() === 'm.reaction' && getSenderMethod?.() === currentUserId) {
          const content = getContentMethod?.()
          const relatesTo = content?.['m.relates_to'] as { event_id?: string; key?: string } | undefined
          if (relatesTo?.event_id === targetEventId && relatesTo?.key === emoji) {
            existingReactionEventId = getIdMethod?.() || null
            break
          }
        }
      }

      // 如果存在现有反应，删除它
      if (existingReactionEventId) {
        logger.info('[MessageService] Removing existing reaction:', { eventId: existingReactionEventId })

        await (
          client as unknown as {
            redactEvent: (roomId: string, eventId: string, reason?: { reason?: string }) => Promise<unknown>
          }
        ).redactEvent(roomId, existingReactionEventId, {})

        logger.info('[MessageService] Reaction removed successfully')
        return { added: false }
      }

      // 添加新的反应
      logger.info('[MessageService] Adding new reaction')

      const sendMethod = (
        client as unknown as {
          sendEvent: (
            roomId: string,
            eventType: string,
            content: Record<string, unknown>
          ) => Promise<{ event_id: string } | string>
        }
      ).sendEvent

      const reactionContent = {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: targetEventId,
          key: emoji
        }
      }

      const sendRes = await sendMethod(roomId, 'm.reaction', reactionContent)
      const eventId: string =
        typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)

      logger.info('[MessageService] Reaction added successfully:', { eventId })
      return { added: true, eventId }
    } catch (error) {
      logger.error('[MessageService] Failed to toggle reaction:', {
        roomId,
        targetEventId,
        emoji,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 获取消息的所有反应
   * Implementation of document requirement: get reactions for message
   */
  getReactions(roomId: string, targetEventId: string): Map<string, string[]> {
    this.ensureInitialized()

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) {
        return new Map()
      }

      const getLiveTimelineMethod = room.getLiveTimeline as (() => Record<string, unknown>) | undefined
      const timeline = getLiveTimelineMethod?.()
      if (!timeline) {
        return new Map()
      }

      const getEventsMethod = timeline.getEvents as (() => Array<Record<string, unknown>>) | undefined
      const events = getEventsMethod?.() || []

      const reactions = new Map<string, string[]>()

      for (const event of events) {
        const getTypeMethod = event.getType as (() => string) | undefined
        const getSenderMethod = event.getSender as (() => string) | undefined
        const getContentMethod = event.getContent as (() => Record<string, unknown>) | undefined

        if (getTypeMethod?.() === 'm.reaction') {
          const content = getContentMethod?.()
          const relatesTo = content?.['m.relates_to'] as { event_id?: string; key?: string } | undefined
          if (relatesTo?.event_id === targetEventId && relatesTo?.key) {
            const emoji = relatesTo.key
            const sender = getSenderMethod?.()
            if (sender) {
              if (!reactions.has(emoji)) {
                reactions.set(emoji, [])
              }
              reactions.get(emoji)!.push(sender)
            }
          }
        }
      }

      logger.info('[MessageService] Retrieved reactions:', {
        roomId,
        targetEventId,
        count: reactions.size
      })

      return reactions
    } catch (error) {
      logger.error('[MessageService] Failed to get reactions:', {
        roomId,
        targetEventId,
        error
      })
      return new Map()
    }
  }

  /**
   * 批量添加反应
   */
  async addMultipleReactions(
    roomId: string,
    targetEventId: string,
    emojis: string[]
  ): Promise<{ successful: string[]; failed: Array<{ emoji: string; error: string }> }> {
    this.ensureInitialized()

    const results = await Promise.allSettled(emojis.map((emoji) => this.toggleReaction(roomId, targetEventId, emoji)))

    const successful: string[] = []
    const failed: Array<{ emoji: string; error: string }> = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.added) {
          successful.push(emojis[index])
        }
      } else {
        failed.push({ emoji: emojis[index], error: String(result.reason) })
      }
    })

    logger.info('[MessageService] Batch reactions completed:', {
      successful: successful.length,
      failed: failed.length
    })

    return { successful, failed }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 发送通知消息
   * Implementation of document requirement: send notice messages
   * Notice messages are special messages that don't show as user messages
   */
  async sendNotice(roomId: string, text: string): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Sending notice:', { roomId, text })

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      // 使用 SDK 的 sendNotice 方法（如果可用）或使用 sendEvent
      const sendNoticeMethod = (
        client as unknown as {
          sendNotice?: (roomId: string, text: string) => Promise<{ event_id: string } | string>
        }
      ).sendNotice

      let eventId: string

      if (typeof sendNoticeMethod === 'function') {
        const sendRes = await sendNoticeMethod(roomId, text)
        eventId = typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)
      } else {
        // 回退到 sendEvent
        const sendMethod = (
          client as unknown as {
            sendEvent: (
              roomId: string,
              eventType: string,
              content: Record<string, unknown>
            ) => Promise<{ event_id: string } | string>
          }
        ).sendEvent

        const noticeContent = {
          msgtype: 'm.notice',
          body: text
        }

        const sendRes = await sendMethod(roomId, 'm.room.message', noticeContent)
        eventId = typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)
      }

      // 构建返回的消息对象
      const message: MsgType = {
        id: eventId,
        roomId: roomId,
        type: MsgEnum.NOTICE,
        body: { text } as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      logger.info('[MessageService] Notice sent successfully:', { eventId })
      return message
    } catch (error) {
      logger.error('[MessageService] Failed to send notice:', {
        roomId,
        text,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 发送表情消息（动作消息）
   * Implementation of document requirement: send emote messages
   * Emote messages are displayed as /me style actions
   */
  async sendEmote(roomId: string, text: string): Promise<MsgType> {
    this.ensureInitialized()

    try {
      logger.info('[MessageService] Sending emote:', { roomId, text })

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix客户端未初始化')
      }

      // 使用 sendEvent 发送 m.emote 消息
      const sendMethod = (
        client as unknown as {
          sendEvent: (
            roomId: string,
            eventType: string,
            content: Record<string, unknown>
          ) => Promise<{ event_id: string } | string>
        }
      ).sendEvent

      const emoteContent = {
        msgtype: 'm.emote',
        body: text
      }

      const sendRes = await sendMethod(roomId, 'm.room.message', emoteContent)
      const eventId: string =
        typeof sendRes === 'string' ? sendRes : (sendRes as { event_id: string })?.event_id || String(sendRes)

      // 构建返回的消息对象
      const message: MsgType = {
        id: eventId,
        roomId: roomId,
        type: MsgEnum.TEXT, // Emote is a text message variant
        body: { text } as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      logger.info('[MessageService] Emote sent successfully:', { eventId })
      return message
    } catch (error) {
      logger.error('[MessageService] Failed to send emote:', {
        roomId,
        text,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 标记线程为已读
   */
  async markThreadAsRead(threadRootId: string, roomId: string): Promise<void> {
    this.ensureInitialized()

    try {
      await threadService.markThreadAsRead(threadRootId, roomId)
      logger.info('[MessageService] Thread marked as read:', {
        threadRootId,
        roomId
      })
    } catch (error) {
      logger.error('[MessageService] Failed to mark thread as read:', {
        threadRootId,
        roomId,
        error
      })
    }
  }

  /**
   * 获取房间的所有线程
   */
  async getRoomThreads(
    roomId: string,
    options?: {
      limit?: number
      sortBy?: 'recent' | 'activity'
    }
  ): Promise<unknown[]> {
    this.ensureInitialized()

    try {
      return await threadService.getRoomThreads(roomId, options)
    } catch (error) {
      logger.error('[MessageService] Failed to get room threads:', {
        roomId,
        error
      })
      return []
    }
  }

  /**
   * 同步房间历史
   */
  async syncRoomHistory(roomId: string): Promise<void> {
    this.ensureInitialized()

    try {
      await messageReceiver.syncHistoryMessages(roomId)
      logger.info('[MessageService] Room history synced:', { roomId })
    } catch (error) {
      logger.error('[MessageService] Failed to sync room history:', {
        roomId,
        error
      })
    }
  }

  /**
   * 初始化Matrix客户端
   */
  private async initializeMatrixClient(): Promise<void> {
    if (!this.config.matrixUrl) {
      logger.warn('[MessageService] Matrix URL not configured')
      return
    }

    // 从存储获取凭据
    const credentials = await this.getStoredCredentials()
    if (credentials) {
      await matrixClientService.initialize(credentials)
      await matrixClientService.start()
    }
  }

  /**
   * 初始化WebSocket
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      await webSocketService.connect()
      logger.info('[MessageService] WebSocket initialized')
    } catch (error) {
      logger.warn('[MessageService] WebSocket initialization failed:', error)
    }
  }

  /**
   * 获取存储的凭据
   * 使用 tokenRefreshService 从存储中恢复 Matrix 会话凭据
   *
   * Note: 当前使用 localStorage 加 base64 编码存储
   * 生产环境应使用 Tauri 的 secure-store 插件进行安全存储
   */
  private async getStoredCredentials(): Promise<MatrixCredentials | null> {
    try {
      return await tokenRefreshService.recoverSession()
    } catch (error) {
      logger.warn('[MessageService] Failed to recover Matrix credentials:', error)
      return null
    }
  }

  /**
   * 确保服务已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Message service not initialized')
    }
  }

  /**
   * 停止消息服务
   */
  async stop(): Promise<void> {
    try {
      logger.info('[MessageService] Stopping message service')

      await messageReceiver.stop()
      await matrixClientService.stop()
      await webSocketService.disconnect()

      this.initialized = false
      logger.info('[MessageService] Message service stopped')
    } catch (error) {
      logger.error('[MessageService] Failed to stop message service:', error)
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    initialized: boolean
    matrixConnected: boolean
    webSocketConnected: boolean
  } {
    return {
      initialized: this.initialized,
      matrixConnected: matrixClientService.getSyncState() !== 'STOPPED',
      webSocketConnected: webSocketService.isConnected()
    }
  }
}

// 导出单例实例
export const messageService = MessageService.getInstance()
