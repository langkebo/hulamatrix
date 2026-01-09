/**
 * 统一消息服务
 *
 * 整合 messageService.ts、enhancedMessageService.ts 和 messages.ts 的功能
 * 提供统一的消息发送、接收、状态管理和历史查询接口
 *
 * @module services/unified-message-service
 */

import { enhancedMessageService } from './enhancedMessageService'
import { matrixClientService } from '@/integrations/matrix/client'
import { useChatStore } from '@/stores/chat'
import { logger } from '@/utils/logger'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MsgType, MessageBody } from './types'

// ============================================================
// 类型定义
// ============================================================

/** 发送消息选项 */
export interface SendMessageOptions {
  /** 房间 ID */
  roomId: string
  /** 消息类型 */
  type: MsgEnum
  /** 消息体 */
  body: MessageBody
  /** 是否加密 */
  encrypted?: boolean
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high'
  /** 回复的消息 ID */
  replyTo?: string
  /** 事务 ID（用于幂等性） */
  transactionId?: string
}

/** 发送选项（便捷方法用） */
export interface SendOptions {
  /** 回复的消息 ID */
  replyTo?: string
  /** 事务 ID */
  transactionId?: string
  /** 是否加密 */
  encrypted?: boolean
}

/** 历史查询选项 */
export interface HistoryOptions {
  /** 每页数量 */
  limit?: number
  /** 起始事件 ID */
  from?: string
  /** 方向 */
  dir?: 'f' | 'b'
}

/** 分页选项 */
export interface PageOptions {
  /** 每页数量 */
  limit?: number
  /** 游标 */
  cursor?: string
  /** 方向 */
  dir?: 'f' | 'b'
}

/** 服务配置 */
export interface MessageServiceConfig {
  /** Matrix 服务器 URL */
  matrixUrl?: string
  /** 是否启用加密 */
  enableEncryption?: boolean
  /** 自动发送已读回执 */
  autoReadReceipt?: boolean
  /** 加入房间时同步历史 */
  syncHistoryOnJoin?: boolean
}

/** 服务状态 */
export interface ServiceStatus {
  /** 是否已初始化 */
  initialized: boolean
  /** 是否正在发送 */
  sending: boolean
  /** 待发送消息数 */
  pendingCount: number
  /** 失败消息数 */
  failedCount: number
}

/** 位置信息 */
export interface Location {
  /** 纬度 */
  latitude: number
  /** 经度 */
  longitude: number
  /** 描述 */
  description?: string
}

/** 发送结果 */
export interface SendResult {
  /** 消息对象 */
  message: MsgType
  /** 事件 ID */
  eventId: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
}

// ============================================================
// 统一消息服务类
// ============================================================

/**
 * 统一消息服务
 *
 * 整合所有消息相关功能，提供统一的 API
 */
export class UnifiedMessageService {
  private static instance: UnifiedMessageService
  private initialized = false
  private config: MessageServiceConfig = {}

  private constructor() {
    logger.debug('[UnifiedMessageService] Service created')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): UnifiedMessageService {
    if (!UnifiedMessageService.instance) {
      UnifiedMessageService.instance = new UnifiedMessageService()
    }
    return UnifiedMessageService.instance
  }

  // ============================================================
  // 核心发送 API
  // ============================================================

  /**
   * 发送消息（核心方法）
   *
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendMessage(options: SendMessageOptions): Promise<MsgType> {
    if (!this.initialized) {
      await this.initialize()
    }

    logger.debug('[UnifiedMessageService] Sending message:', {
      type: options.type,
      roomId: options.roomId,
      replyTo: options.replyTo
    })

    // 委托给 enhancedMessageService（已有路由和重试逻辑）
    return enhancedMessageService.sendMessage(
      options.roomId,
      {
        type: options.type,
        body: options.body,
        replyTo: options.replyTo,
        transactionId: options.transactionId
      },
      {
        encrypted: options.encrypted
      }
    )
  }

  /**
   * 发送文本消息
   *
   * @param roomId - 房间 ID
   * @param text - 文本内容
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendTextMessage(roomId: string, text: string, options?: SendOptions): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.TEXT,
      body: { text },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId,
      encrypted: options?.encrypted
    })
  }

  /**
   * 发送图片消息
   *
   * @param roomId - 房间 ID
   * @param file - 图片文件
   * @param caption - 图片说明
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendImageMessage(roomId: string, file: File, caption?: string, options?: SendOptions): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.IMAGE,
      body: { file, fileName: file.name, text: caption },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId
    })
  }

  /**
   * 发送文件消息
   *
   * @param roomId - 房间 ID
   * @param file - 文件
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendFileMessage(roomId: string, file: File, options?: SendOptions): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.FILE,
      body: { file, fileName: file.name, fileSize: file.size },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId
    })
  }

  /**
   * 发送语音消息
   *
   * @param roomId - 房间 ID
   * @param audio - 音频 Blob
   * @param duration - 时长（毫秒）
   * @param waveform - 波形数据
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendVoiceMessage(
    roomId: string,
    audio: Blob,
    duration: number,
    waveform?: number[],
    options?: SendOptions
  ): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.VOICE,
      body: {
        file: new File([audio], 'voice.wav', { type: 'audio/wav' }),
        duration,
        waveform
      },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId
    })
  }

  /**
   * 发送视频消息
   *
   * @param roomId - 房间 ID
   * @param video - 视频 Blob
   * @param duration - 时长（毫秒）
   * @param thumbnail - 缩略图
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendVideoMessage(
    roomId: string,
    video: Blob,
    duration: number,
    thumbnail?: string,
    options?: SendOptions
  ): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.VIDEO,
      body: {
        file: new File([video], 'video.mp4', { type: 'video/mp4' }),
        duration,
        thumbnailUrl: thumbnail
      },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId
    })
  }

  /**
   * 发送位置消息
   *
   * @param roomId - 房间 ID
   * @param location - 位置信息
   * @param options - 发送选项
   * @returns 发送的消息对象
   */
  async sendLocationMessage(roomId: string, location: Location, options?: SendOptions): Promise<MsgType> {
    return this.sendMessage({
      roomId,
      type: MsgEnum.LOCATION,
      body: {
        latitude: location.latitude,
        longitude: location.longitude,
        description: location.description
      },
      replyTo: options?.replyTo,
      transactionId: options?.transactionId
    })
  }

  // ============================================================
  // 消息操作
  // ============================================================

  /**
   * 撤回消息
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   */
  async recallMessage(roomId: string, eventId: string): Promise<void> {
    logger.debug('[UnifiedMessageService] Recalling message:', { roomId, eventId })

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      // 调用 redactEvent 并正确处理返回值
      const result = await (
        client as { redactEvent: (roomId: string, eventId: string, reason?: string) => Promise<unknown> }
      ).redactEvent(roomId, eventId)
      logger.info('[UnifiedMessageService] Message recalled successfully:', result)
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to recall message:', error)
      throw error
    }
  }

  /**
   * 编辑消息
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @param newContent - 新内容
   */
  async editMessage(roomId: string, eventId: string, newContent: string): Promise<void> {
    logger.debug('[UnifiedMessageService] Editing message:', { roomId, eventId, newContent })

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      // 发送替换事件
      const result = await (
        client as { sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown> }
      ).sendEvent(roomId, 'm.room.message', {
        'm.new_content': {
          msgtype: 'm.text',
          body: newContent
        },
        'm.relates_to': {
          event_id: eventId,
          rel_type: 'm.replace'
        }
      })
      logger.info('[UnifiedMessageService] Message edited successfully:', result)
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to edit message:', error)
      throw error
    }
  }

  /**
   * 重试失败的消息
   *
   * @param msgId - 消息 ID
   * @returns 是否成功
   */
  async retryFailedMessage(msgId: string): Promise<boolean> {
    logger.debug('[UnifiedMessageService] Retrying failed message:', msgId)
    return enhancedMessageService.retryFailedMessage(msgId)
  }

  /**
   * 取消待发送的消息
   *
   * @param roomId - 房间 ID
   * @param transactionId - 事务 ID
   * @returns 是否成功
   */
  async cancelPendingMessage(roomId: string, transactionId: string): Promise<boolean> {
    logger.debug('[UnifiedMessageService] Cancelling pending message:', { roomId, transactionId })

    const chatStore = useChatStore()

    // 访问 messageMap
    const messageMap = (chatStore as unknown as { messageMap: Record<string, Record<string, MsgType>> }).messageMap

    if (!messageMap[roomId]) {
      logger.warn('[UnifiedMessageService] Room not found in messageMap:', roomId)
      return false
    }

    // 查找并删除匹配 transactionId 的消息
    // transactionId 通常在消息发送时作为 eventId 存储或存储在 body 中
    let found = false
    for (const [eventId, message] of Object.entries(messageMap[roomId])) {
      // 检查是否为待取消的消息 (eventId 可能等于 transactionId)
      const isMatch =
        eventId === transactionId || (message.body as { transactionId?: string })?.transactionId === transactionId

      if (isMatch) {
        // 只允许取消 pending 或 sending 状态的消息
        if (message.status === MessageStatusEnum.PENDING || message.status === MessageStatusEnum.SENDING) {
          delete messageMap[roomId][eventId]
          found = true
          logger.info('[UnifiedMessageService] Cancelled pending message:', { eventId, transactionId })
        } else {
          logger.warn('[UnifiedMessageService] Cannot cancel message with status:', message.status)
          return false
        }
        break
      }
    }

    if (!found) {
      logger.warn('[UnifiedMessageService] Message not found with transactionId:', transactionId)
      return false
    }

    return true
  }

  // ============================================================
  // 已读回执
  // ============================================================

  /**
   * 标记消息为已读
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    logger.debug('[UnifiedMessageService] Marking as read:', { roomId, eventId })

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      await (client as { sendReadReceipt: (roomId: string, eventId: string) => Promise<unknown> }).sendReadReceipt(
        roomId,
        eventId
      )
      logger.info('[UnifiedMessageService] Message marked as read')
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to mark as read:', error)
      throw error
    }
  }

  /**
   * 标记整个房间为已读
   *
   * @param roomId - 房间 ID
   */
  async markRoomRead(roomId: string): Promise<void> {
    logger.debug('[UnifiedMessageService] Marking room as read:', roomId)

    try {
      const chatStore = useChatStore()
      // 获取房间的所有消息（ChatStore 使用 messageMap[roomId]）
      const roomMessages = (chatStore as unknown as { messageMap: Record<string, Record<string, unknown>> }).messageMap[
        roomId
      ]
      if (roomMessages) {
        const messageIds = Object.keys(roomMessages)
        if (messageIds.length > 0) {
          const latestEventId = messageIds[messageIds.length - 1]
          await this.markAsRead(roomId, latestEventId)
        }
      }
      logger.info('[UnifiedMessageService] Room marked as read')
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to mark room as read:', error)
      throw error
    }
  }

  // ============================================================
  // 历史管理
  // ============================================================

  /**
   * 同步房间历史消息
   *
   * @param roomId - 房间 ID
   * @param options - 历史选项
   */
  async syncRoomHistory(roomId: string, options?: HistoryOptions): Promise<void> {
    logger.debug('[UnifiedMessageService] Syncing room history:', { roomId, options })

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const limit = options?.limit || 20
      const from = options?.from
      const dir = options?.dir || 'b'

      // 使用 createMessagesRequest 的类型断言
      await (
        client as {
          createMessagesRequest: (
            roomId: string,
            from: string | undefined,
            dir: string,
            limit: number
          ) => Promise<unknown>
        }
      ).createMessagesRequest(roomId, from || '', dir, limit)
      logger.info('[UnifiedMessageService] Room history synced')
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to sync history:', error)
      throw error
    }
  }

  /**
   * 分页获取消息
   *
   * @param roomId - 房间 ID
   * @param options - 分页选项
   * @returns 消息列表
   */
  async pageMessages(roomId: string, options?: PageOptions): Promise<MsgType[]> {
    logger.debug('[UnifiedMessageService] Paging messages:', { roomId, options })

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const limit = options?.limit || 20
      const from = options?.cursor

      // 类型化 Matrix 事件结构
      interface MatrixEventResponse {
        event_id?: string
        type?: string
        content?: Record<string, unknown>
        origin_server_ts?: number
        sender?: string
      }

      interface MessagesResponse {
        chunk?: MatrixEventResponse[]
        [key: string]: unknown
      }

      const response = await (
        client as {
          createMessagesRequest: (
            roomId: string,
            from: string | null,
            dir: string,
            limit: number
          ) => Promise<MessagesResponse>
        }
      ).createMessagesRequest(roomId, from || null, 'b', limit)

      const chunk = response.chunk || []

      // 映射为 MsgType 格式
      const messages: MsgType[] = chunk
        .filter((event: MatrixEventResponse) => event.type === 'm.room.message')
        .map((event: MatrixEventResponse) => {
          const content = event.content || {}
          return {
            id: event.event_id || '',
            roomId,
            type: this.mapMsgType(String(content.msgtype)),
            body: content as MessageBody,
            sendTime: event.origin_server_ts || Date.now(),
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS,
            fromUser: {
              uid: event.sender || ''
            }
          }
        })

      logger.info('[UnifiedMessageService] Paged messages:', messages.length)
      return messages
    } catch (error) {
      logger.error('[UnifiedMessageService] Failed to page messages:', error)
      throw error
    }
  }

  // ============================================================
  // 状态查询
  // ============================================================

  /**
   * 获取服务状态
   */
  getStatus(): ServiceStatus {
    const chatStore = useChatStore()
    const messageMap = (
      chatStore as unknown as { messageMap: Record<string, Record<string, { status: MessageStatusEnum }>> }
    ).messageMap

    // 统计所有房间中的消息状态
    let pendingCount = 0
    let failedCount = 0
    let sending = false

    for (const roomMessages of Object.values(messageMap)) {
      for (const message of Object.values(roomMessages)) {
        switch (message.status) {
          case MessageStatusEnum.PENDING:
            pendingCount++
            break
          case MessageStatusEnum.SENDING:
            sending = true
            break
          case MessageStatusEnum.FAILED:
            failedCount++
            break
        }
      }
    }

    return {
      initialized: this.initialized,
      sending,
      pendingCount,
      failedCount
    }
  }

  /**
   * 获取消息状态
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @returns 消息状态
   */
  getMessageStatus(roomId: string, eventId: string): MessageStatusEnum {
    const chatStore = useChatStore()
    // 使用 messageMap[roomId][eventId] 访问消息
    const messageMap = (
      chatStore as unknown as { messageMap: Record<string, Record<string, { status: MessageStatusEnum }>> }
    ).messageMap
    const message = messageMap[roomId]?.[eventId]
    return message?.status || MessageStatusEnum.FAILED
  }

  /**
   * 获取消息反应
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @returns 反应 Map
   */
  getReactions(roomId: string, eventId: string): Map<string, string[]> {
    const chatStore = useChatStore()
    const messageMap = (
      chatStore as unknown as {
        messageMap: Record<string, Record<string, { body?: { reactions?: Record<string, unknown> } }>>
      }
    ).messageMap
    const message = messageMap[roomId]?.[eventId]
    const reactions = message?.body?.reactions

    const reactionMap = new Map<string, string[]>()
    if (reactions && typeof reactions === 'object') {
      for (const [emoji, users] of Object.entries(reactions)) {
        if (Array.isArray(users)) {
          reactionMap.set(emoji, users as string[])
        }
      }
    }
    return reactionMap
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 初始化服务
   *
   * @param config - 服务配置
   */
  async initialize(config?: MessageServiceConfig): Promise<void> {
    if (this.initialized) {
      logger.warn('[UnifiedMessageService] Already initialized')
      return
    }

    logger.info('[UnifiedMessageService] Initializing...')

    // 合并配置
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // enhancedMessageService 不需要显式初始化，它会按需使用
    // Matrix client 由 matrixClientService 管理

    this.initialized = true
    logger.info('[UnifiedMessageService] Initialized successfully')
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    logger.info('[UnifiedMessageService] Stopping...')
    this.initialized = false
    logger.info('[UnifiedMessageService] Stopped')
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 映射 Matrix 消息类型到内部类型
   */
  private mapMsgType(msgType?: string): MsgEnum {
    const typeMap: Record<string, MsgEnum> = {
      'm.text': MsgEnum.TEXT,
      'm.image': MsgEnum.IMAGE,
      'm.file': MsgEnum.FILE,
      'm.audio': MsgEnum.VOICE,
      'm.video': MsgEnum.VIDEO,
      'm.location': MsgEnum.LOCATION,
      'm.notice': MsgEnum.NOTICE
    }
    return typeMap[msgType || ''] || MsgEnum.TEXT
  }

  // ============================================================
  // 批量操作
  // ============================================================

  /**
   * 并发发送多条消息
   *
   * @param messages - 消息列表
   * @returns 发送结果
   */
  async sendMultipleMessagesParallel(
    messages: SendMessageOptions[]
  ): Promise<{ successes: MsgType[]; failures: Array<{ message: SendMessageOptions; error: unknown }> }> {
    logger.info('[UnifiedMessageService] Sending multiple messages in parallel:', messages.length)

    const promises = messages.map(async (msg) => {
      try {
        const result = await this.sendMessage(msg)
        return { success: true, message: result }
      } catch (error) {
        logger.error('[UnifiedMessageService] Failed to send message:', error)
        return { success: false, message: msg, error }
      }
    })

    const results = await Promise.all(promises)

    const successes: MsgType[] = []
    const failures: Array<{ message: SendMessageOptions; error: unknown }> = []

    for (const result of results) {
      if (result.success) {
        successes.push((result as { success: true; message: MsgType }).message)
      } else {
        failures.push(result as { success: false; message: SendMessageOptions; error: unknown })
      }
    }

    logger.info('[UnifiedMessageService] Batch send complete:', {
      total: messages.length,
      successes: successes.length,
      failures: failures.length
    })

    return { successes, failures }
  }

  /**
   * 顺序发送多条消息
   *
   * @param messages - 消息列表
   * @returns 发送结果
   */
  async sendMultipleMessages(
    messages: SendMessageOptions[]
  ): Promise<{ successes: MsgType[]; failures: Array<{ message: SendMessageOptions; error: unknown }> }> {
    logger.info('[UnifiedMessageService] Sending multiple messages sequentially:', messages.length)

    const successes: MsgType[] = []
    const failures: Array<{ message: SendMessageOptions; error: unknown }> = []

    for (const msg of messages) {
      try {
        const result = await this.sendMessage(msg)
        successes.push(result)
      } catch (error) {
        logger.error('[UnifiedMessageService] Failed to send message:', error)
        failures.push({ message: msg, error })
      }
    }

    return { successes, failures }
  }

  // ============================================================
  // 线程功能
  // ============================================================

  /**
   * 发送线程回复
   *
   * @param threadRootId - 线程根消息 ID
   * @param roomId - 房间 ID
   * @param type - 消息类型
   * @param body - 消息体
   * @returns 发送的消息对象
   */
  async sendThreadReply(threadRootId: string, roomId: string, type: MsgEnum, body: MessageBody): Promise<MsgType> {
    logger.debug('[UnifiedMessageService] Sending thread reply:', { threadRootId, roomId, type })

    // 添加线程关系
    const enhancedBody = {
      ...body,
      'm.relates_to': {
        event_id: threadRootId,
        rel_type: 'm.thread',
        'm.in_reply_to': {
          event_id: threadRootId
        }
      }
    }

    return this.sendMessage({
      roomId,
      type,
      body: enhancedBody as MessageBody
    })
  }

  /**
   * 标记线程为已读
   *
   * @param threadRootId - 线程根消息 ID
   * @param roomId - 房间 ID
   */
  async markThreadAsRead(threadRootId: string, roomId: string): Promise<void> {
    logger.debug('[UnifiedMessageService] Marking thread as read:', { threadRootId, roomId })

    // 发送已读回收到线程根消息
    await this.markAsRead(roomId, threadRootId)

    // 使用 ChatStore 的 markThreadAsRead 方法更新线程已读状态
    const chatStore = useChatStore()
    if (
      typeof (chatStore as { markThreadAsRead?: (threadRootId: string) => Promise<boolean> }).markThreadAsRead ===
      'function'
    ) {
      const result = await (
        chatStore as { markThreadAsRead: (threadRootId: string) => Promise<boolean> }
      ).markThreadAsRead(threadRootId)
      if (result) {
        logger.info('[UnifiedMessageService] Thread marked as read:', threadRootId)
      } else {
        logger.warn('[UnifiedMessageService] Failed to mark thread as read:', threadRootId)
      }
    } else {
      logger.debug('[UnifiedMessageService] markThreadAsRead not available in chatStore')
    }
  }
}

// ============================================================
// 导出单例
// ============================================================

/** 统一消息服务单例 */
export const unifiedMessageService = UnifiedMessageService.getInstance()

// ============================================================
// 便捷函数（直接导出，方便使用）
// ============================================================

/**
 * 发送文本消息
 */
export async function sendTextMessage(roomId: string, text: string, options?: SendOptions): Promise<MsgType> {
  return unifiedMessageService.sendTextMessage(roomId, text, options)
}

/**
 * 发送图片消息
 */
export async function sendImageMessage(
  roomId: string,
  file: File,
  caption?: string,
  options?: SendOptions
): Promise<MsgType> {
  return unifiedMessageService.sendImageMessage(roomId, file, caption, options)
}

/**
 * 发送文件消息
 */
export async function sendFileMessage(roomId: string, file: File, options?: SendOptions): Promise<MsgType> {
  return unifiedMessageService.sendFileMessage(roomId, file, options)
}

/**
 * 标记房间为已读
 */
export async function markRoomRead(roomId: string): Promise<void> {
  return unifiedMessageService.markRoomRead(roomId)
}

/**
 * 分页获取消息
 */
export async function pageMessages(roomId: string, options?: PageOptions): Promise<MsgType[]> {
  return unifiedMessageService.pageMessages(roomId, options)
}
