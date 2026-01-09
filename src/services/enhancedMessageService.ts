import { matrixClientService } from '@/integrations/matrix/client'
import { useChatStore } from '@/stores/chat'
import { logger } from '@/utils/logger'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MsgType, MessageBody } from '@/services/types'
import { generateMessageId, formatMessageContent } from '@/utils/messageUtils'
import { mediaService } from './mediaService'
import { messageSyncService, type RetryMessage } from '@/matrix/services/message/sync'

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
    messageSyncService.setRetryCallback(async (retryMessage: RetryMessage) => {
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
   * 发送消息 - 使用 Matrix SDK
   * 集成消息状态管理 (Requirements: 5.3)
   */
  async sendMessage(
    roomId: string,
    msg: SendMessageParams,
    _options?: {
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
        tempMsgId
      })

      // 通过 Matrix SDK 发送消息
      const result = await this.sendViaMatrix(roomId, msg)

      // 更新消息状态为sent (Requirements: 5.3)
      messageSyncService.markAsSent(result.id || tempMsgId)

      // 记录发送成功
      logger.info('[EnhancedMessageService] 消息发送成功', {
        roomId,
        msgId: result.id
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
