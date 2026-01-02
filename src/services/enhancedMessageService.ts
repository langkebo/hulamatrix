import { messageRouter, type RouteDecision } from './message-router'
import { matrixClientService } from '@/integrations/matrix/client'
import { useChatStore } from '@/stores/chat'
import { logger } from '@/utils/logger'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MsgType, MessageBody } from '@/services/types'
import { generateMessageId, formatMessageContent } from '@/utils/messageUtils'
import { webSocketService } from '@/services/webSocketService'
import { mediaService } from './mediaService'
import { messageSyncService } from './messageSyncService'

// 发送消息类型定义
interface SendMessageParams {
  type: MsgEnum
  body?: Record<string, unknown> | undefined
  roomId?: string
  [key: string]: unknown
}

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  sendMessage: (roomId: string, content: Record<string, unknown>) => Promise<MatrixEventIdResponse | string>
  getRoom?: (roomId: string) => MatrixRoom | undefined
  sendReadReceipt?: (room: MatrixRoom, event: MatrixEvent) => Promise<void>
}

/** Matrix 客户端带事件接口（支持加密消息发送） */
interface MatrixClientWithEvents {
  sendEvent: (
    roomId: string,
    eventType: string,
    content: Record<string, unknown>
  ) => Promise<MatrixEventIdResponse | string>
}

/** Matrix 事件 ID 响应 */
interface MatrixEventIdResponse {
  event_id?: string
  [key: string]: unknown
}

/** Matrix 房间接口 */
interface MatrixRoom {
  findEventById?: (eventId: string) => MatrixEvent
  [key: string]: unknown
}

/** Matrix 事件接口 */
interface MatrixEvent {
  getId: () => string
  [key: string]: unknown
}

/** 媒体上传结果 */
interface MediaUploadResult {
  content_uri: string
  info?: {
    thumbnail_url?: string
    thumbnail_info?: {
      w: number
      h: number
      mimetype?: string
      type?: string
      size: number
    }
  }
}

/**
 * 增强的消息发送服务
 * 集成了消息路由器，支持智能选择最优传输方式
 * 集成消息状态管理和重试机制 (Requirements: 5.3, 5.4)
 */
export class EnhancedMessageService {
  private static instance: EnhancedMessageService

  static getInstance(): EnhancedMessageService {
    if (!EnhancedMessageService.instance) {
      EnhancedMessageService.instance = new EnhancedMessageService()
      // 设置重试回调
      EnhancedMessageService.instance.setupRetryCallback()
    }
    return EnhancedMessageService.instance
  }

  /**
   * 设置重试回调
   */
  private setupRetryCallback(): void {
    messageSyncService.setRetryCallback(async (retryMessage) => {
      try {
        const msg: SendMessageParams = {
          type: retryMessage.type,
          body: retryMessage.body
        }

        await this.sendViaMatrix(retryMessage.roomId, msg)
        return true
      } catch (error) {
        logger.error('[EnhancedMessageService] Retry callback failed:', error)
        return false
      }
    })
  }

  /**
   * 发送消息 - 使用路由器智能选择传输方式
   * 集成消息状态管理 (Requirements: 5.3)
   */
  async sendMessage(
    roomId: string,
    msg: SendMessageParams,
    options?: {
      forceRoute?: RouteDecision
      encrypted?: boolean
      priority?: 'low' | 'normal' | 'high'
    }
  ): Promise<MsgType> {
    // 生成临时消息ID
    const tempMsgId = generateMessageId()

    // 设置消息初始状态为pending (Requirements: 5.3)
    messageSyncService.setMessagePending(tempMsgId)

    try {
      // 记录发送尝试
      logger.info('[EnhancedMessageService] 准备发送消息', {
        roomId,
        msgType: msg.type,
        hasContent: !!msg.body,
        route: options?.forceRoute || 'auto',
        tempMsgId
      })

      // 构建消息内容
      const messageContent = this.buildMessageContent(msg)

      // 决定路由策略
      let routeDecision: RouteDecision
      if (options?.forceRoute) {
        routeDecision = options.forceRoute
      } else {
        // 使用路由器自动决策
        routeDecision = messageRouter.decideRoute(messageContent, {
          encrypted: options?.encrypted || this.shouldEncrypt(msg),
          fileSize: this.getFileSize(msg),
          priority: options?.priority || 'normal'
        })
      }

      logger.info('[EnhancedMessageService] 选择路由策略:', routeDecision)

      // 根据路由策略发送消息
      let result
      switch (routeDecision) {
        case 'matrix':
          result = await this.sendViaMatrix(roomId, msg)
          break
        case 'websocket':
          result = await this.sendViaWebSocket(roomId, msg)
          break
        case 'hybrid':
          result = await this.sendHybrid(roomId, msg, options)
          break
        default:
          throw new Error(`未知的路由策略: ${routeDecision}`)
      }

      // 更新消息状态为sent (Requirements: 5.3)
      messageSyncService.markAsSent(result.id || tempMsgId)

      // 记录发送成功
      logger.info('[EnhancedMessageService] 消息发送成功', {
        roomId,
        msgId: result.id,
        route: routeDecision
      })

      return result
    } catch (error) {
      logger.error('[EnhancedMessageService] 消息发送失败:', {
        roomId,
        error: error instanceof Error ? error.message : String(error),
        msgType: msg.type
      })

      // 标记消息为失败并添加到重试队列 (Requirements: 5.4)
      const errorMsg = error instanceof Error ? error.message : String(error)
      const failedMessage: MsgType = {
        id: tempMsgId,
        roomId,
        type: msg.type,
        body: (msg.body ?? {}) as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.FAILED
      }
      messageSyncService.addToRetryQueue(failedMessage, errorMsg)

      // 尝试回退到混合模式
      if (!options?.forceRoute || options.forceRoute !== 'hybrid') {
        logger.info('[EnhancedMessageService] 尝试回退到混合模式')
        try {
          const result = await this.sendHybrid(roomId, msg, options)
          // 如果回退成功，从重试队列移除
          messageSyncService.removeFromRetryQueue(tempMsgId)
          messageSyncService.markAsSent(result.id || tempMsgId)
          return result
        } catch (fallbackError) {
          logger.error('[EnhancedMessageService] 回退发送也失败:', fallbackError)
        }
      }

      throw error
    }
  }

  /**
   * 通过Matrix发送消息
   */
  private async sendViaMatrix(roomId: string, msg: SendMessageParams): Promise<MsgType> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix客户端未初始化')
    }

    try {
      // 检查房间是否存在
      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      // 检查房间是否启用加密
      const hasEncryptionStateEventMethod = room.hasEncryptionStateEvent as (() => boolean) | undefined
      const isEncrypted = hasEncryptionStateEventMethod?.() ?? false

      // 检查加密 API 是否可用
      const getCryptoMethod = client.getCrypto as (() => Record<string, unknown> | null) | undefined
      const crypto = getCryptoMethod?.()
      const encryptionAvailable = !!(crypto && isEncrypted)

      // 构建消息内容
      const messageContent = formatMessageContent(msg.type, msg.body as MessageBody)

      // 处理媒体消息上传
      if (this.isMediaMessage(msg.type) && msg.body?.file instanceof File) {
        const uploadResult = await this.uploadMedia(client, msg.body.file, msg.body)
        messageContent.url = uploadResult.content_uri

        // 更新媒体信息
        if (messageContent.info && typeof messageContent.info === 'object') {
          ;(messageContent.info as Record<string, unknown>).size = msg.body.file.size
        }
      }

      let eventId: string

      // 发送消息 - Matrix SDK 会自动处理加密
      if (encryptionAvailable) {
        logger.info('[EnhancedMessageService] 发送加密消息', { roomId, type: msg.type })

        // 使用 sendEvent 发送消息，SDK 会自动加密
        const clientLike = client as unknown as MatrixClientWithEvents
        const sendRes = await clientLike.sendEvent(roomId, 'm.room.message', messageContent)
        eventId =
          typeof sendRes === 'string' ? sendRes : (sendRes as MatrixEventIdResponse)?.event_id || String(sendRes)

        logger.info('[EnhancedMessageService] 加密消息发送成功', { eventId, roomId })
      } else {
        if (isEncrypted) {
          logger.warn('[EnhancedMessageService] 房间已加密但加密 API 不可用，消息可能未加密')
        }

        // 普通发送
        const clientLike = client as unknown as MatrixClientExtended
        const sendRes = await clientLike.sendMessage(roomId, messageContent as unknown as Record<string, unknown>)
        eventId =
          typeof sendRes === 'string' ? sendRes : (sendRes as MatrixEventIdResponse)?.event_id || String(sendRes)

        logger.info('[EnhancedMessageService] 消息发送成功', { eventId, roomId, encrypted: encryptionAvailable })
      }

      // 构建返回的消息对象
      const response: MsgType = {
        id: eventId,
        roomId: roomId,
        type: msg.type,
        body: (msg.body ?? {}) as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      return response
    } catch (error) {
      logger.error('[EnhancedMessageService] Matrix消息发送失败:', {
        roomId,
        type: msg.type,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 通过WebSocket发送消息
   */

  /**
   * 混合模式发送（Matrix + WebSocket）
   */
  private async sendHybrid(
    roomId: string,
    msg: SendMessageParams,
    _options?: { encrypted?: boolean }
  ): Promise<MsgType> {
    logger.info('[EnhancedMessageService] 使用混合模式发送消息')

    // 并行尝试两种方式
    const matrixPromise = this.sendViaMatrix(roomId, msg).catch((error) => ({ error, source: 'matrix' }))
    const wsPromise = this.sendViaWebSocket(roomId, msg).catch((error) => ({ error, source: 'websocket' }))

    try {
      // 尝试Matrix发送
      const matrixResult = await matrixPromise
      if (typeof matrixResult === 'object' && matrixResult && 'error' in matrixResult) {
        // 有错误
        logger.warn('[EnhancedMessageService] Matrix发送失败:', matrixResult.error)
      } else {
        // 成功
        logger.info('[EnhancedMessageService] Matrix发送成功')
        return matrixResult as MsgType
      }
    } catch (error) {
      logger.warn('[EnhancedMessageService] Matrix发送失败:', error)
    }

    try {
      // 尝试WebSocket发送
      const wsResult = await wsPromise
      if (typeof wsResult === 'object' && wsResult && 'error' in wsResult) {
        // 有错误
        logger.warn('[EnhancedMessageService] WebSocket发送失败:', wsResult.error)
      } else {
        // 成功
        logger.info('[EnhancedMessageService] WebSocket发送成功')
        return wsResult as MsgType
      }
    } catch (error) {
      logger.warn('[EnhancedMessageService] WebSocket发送失败:', error)
    }

    // 如果都失败了，抛出错误
    throw new Error('混合模式发送失败: 所有通道都失败')
  }

  /**
   * 构建标准化的消息内容
   */
  private buildMessageContent(msg: SendMessageParams): Record<string, unknown> {
    return {
      type: msg.type,
      body: msg.body,
      timestamp: Date.now()
    }
  }

  /**
   * 判断是否应该加密消息
   */
  private shouldEncrypt(msg: SendMessageParams): boolean {
    // 根据消息类型和内容判断是否需要加密
    switch (msg.type) {
      case MsgEnum.TEXT:
        return true // 文本消息默认加密
      case MsgEnum.FILE:
      case MsgEnum.IMAGE:
      case MsgEnum.VIDEO:
      case MsgEnum.VOICE:
        return false // 媒体文件暂不加密
      default:
        return false
    }
  }

  /**
   * 获取文件大小
   */
  private getFileSize(msg: SendMessageParams): number {
    switch (msg.type) {
      case MsgEnum.FILE:
      case MsgEnum.IMAGE:
      case MsgEnum.VIDEO:
      case MsgEnum.VOICE:
        return typeof msg.body?.fileSize === 'number' ? msg.body.fileSize : 0
      default:
        return 0
    }
  }

  /**
   * 判断是否为媒体消息
   */
  private isMediaMessage(type: MsgEnum): boolean {
    return [MsgEnum.IMAGE, MsgEnum.VIDEO, MsgEnum.VOICE, MsgEnum.FILE].includes(type)
  }

  /**
   * 上传媒体文件
   */
  private async uploadMedia(
    _client: unknown,
    file: File,
    _body: Record<string, unknown> | undefined
  ): Promise<MediaUploadResult> {
    try {
      logger.info('[EnhancedMessageService] Uploading media:', { name: file.name, size: file.size })

      // 使用媒体服务上传
      const uploadResult = await mediaService.uploadMedia(file, {
        filename: file.name,
        contentType: file.type,
        generateThumbnail: file.type.startsWith('image/'),
        thumbnailWidth: 800,
        thumbnailHeight: 600
      })

      // 构建Matrix格式的结果
      const result: MediaUploadResult = {
        content_uri: uploadResult.contentUri
      }

      // 添加缩略图信息
      if (uploadResult.thumbnailInfo) {
        result.info = (() => {
          const info: {
            thumbnail_url: string
            thumbnail_info: {
              w: number
              h: number
              mimetype?: string
              type?: string
              size: number
            }
          } = {
            thumbnail_url: uploadResult.thumbnailInfo.uri,
            thumbnail_info: {
              w: uploadResult.thumbnailInfo.width,
              h: uploadResult.thumbnailInfo.height,
              size: uploadResult.thumbnailInfo.size
            }
          }
          const type =
            (uploadResult.thumbnailInfo as { type?: string; mimeType?: string }).type ||
            (uploadResult.thumbnailInfo as { type?: string; mimeType?: string }).mimeType
          if (type !== undefined) {
            info.thumbnail_info.mimetype = type
          }
          return info
        })()
      }

      logger.info('[EnhancedMessageService] Media uploaded successfully:', {
        contentUri: uploadResult.contentUri,
        size: uploadResult.size,
        hasThumbnail: !!uploadResult.thumbnailInfo
      })

      return result
    } catch (error) {
      logger.error('[EnhancedMessageService] Media upload failed:', error)
      throw new Error(`Media upload failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 通过WebSocket发送消息
   */
  private async sendViaWebSocket(roomId: string, msg: SendMessageParams): Promise<MsgType> {
    try {
      // 检查WebSocket服务是否可用
      if (!webSocketService?.isConnected()) {
        throw new Error('WebSocket未连接')
      }

      // 构建WebSocket消息格式
      const wsMessage = {
        type: 'message',
        roomId,
        payload: {
          type: msg.type,
          body: msg.body,
          timestamp: Date.now()
        }
      }

      // 发送消息
      await webSocketService.send(wsMessage)

      // 构建返回的消息对象
      const response: MsgType = {
        id: generateMessageId(),
        roomId: roomId,
        type: msg.type,
        body: (msg.body ?? {}) as MessageBody,
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }

      logger.info('[EnhancedMessageService] WebSocket消息发送成功', {
        roomId,
        type: msg.type
      })

      return response
    } catch (error) {
      logger.error('[EnhancedMessageService] WebSocket消息发送失败:', {
        roomId,
        type: msg.type,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 发送消息状态更新
   */
  async updateMessageStatus(_roomId: string, messageId: string, status: MessageStatusEnum): Promise<void> {
    try {
      const chatStore = useChatStore()
      await chatStore.updateMessageStatus(messageId, status)

      logger.info('[EnhancedMessageService] 消息状态更新成功:', { roomId: _roomId, messageId, status })
    } catch (error) {
      logger.error('[EnhancedMessageService] 消息状态更新失败:', {
        roomId: _roomId,
        messageId,
        status,
        error
      })
    }
  }

  /**
   * 发送已读回执
   * SDK Integration: Uses client.sendReadReceipt(roomId, eventId)
   */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (client) {
        // Use SDK's native sendReadReceipt(roomId, eventId) signature
        await (
          client as unknown as { sendReadReceipt: (roomId: string, eventId: string) => Promise<void> }
        ).sendReadReceipt(roomId, eventId)
        logger.info('[EnhancedMessageService] 已读回执发送成功:', { roomId, eventId })
      }

      // 同时更新本地状态
      // 更新消息状态为已读 (Requirements: 5.3)
      messageSyncService.markAsRead(eventId)
    } catch (error) {
      logger.error('[EnhancedMessageService] 发送已读回执失败:', {
        roomId,
        eventId,
        error
      })
    }
  }

  /**
   * 重试发送失败的消息 (Requirements: 5.4)
   */
  async retryFailedMessage(msgId: string): Promise<boolean> {
    return messageSyncService.retryMessage(msgId)
  }

  /**
   * 获取所有待重试的消息 (Requirements: 5.4)
   */
  getRetryQueue() {
    return messageSyncService.getRetryQueue()
  }

  /**
   * 从重试队列中移除消息
   */
  removeFromRetryQueue(msgId: string): void {
    messageSyncService.removeFromRetryQueue(msgId)
  }

  /**
   * 更新消息为已送达状态 (Requirements: 5.3)
   */
  markMessageDelivered(msgId: string): boolean {
    return messageSyncService.markAsDelivered(msgId)
  }

  /**
   * 获取消息当前状态
   */
  getMessageStatus(msgId: string): MessageStatusEnum | undefined {
    return messageSyncService.getMessageStatus(msgId)
  }
}

// 导出单例
export const enhancedMessageService = EnhancedMessageService.getInstance()
