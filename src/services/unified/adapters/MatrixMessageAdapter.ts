/**
 * Matrix 消息服务适配器
 *
 * 实现 Matrix 协议的消息发送功能
 *
 * 注意：
 * - 已移除对废弃 messageService 的依赖
 * - 使用 unifiedMessageService 和 enhancedMessageService
 * - 此适配器保持动态导入以避免循环依赖
 */

import { logger } from '@/utils/logger'
import { ProtocolType } from '../IMessageService'
import { BaseMessageAdapter } from '../BaseMessageAdapter'
import type {
  SendMessageParams,
  SendFileParams,
  RecallMessageParams,
  GetMessageHistoryParams,
  Message,
  MessageSendResult
} from '../IMessageService'

/**
 * Matrix 消息适配器
 * 使用现有服务作为底层实现，提供统一接口
 */
export class MatrixMessageAdapter extends BaseMessageAdapter {
  // ==================== 必须实现的抽象方法 ====================

  /**
   * 获取协议类型
   */
  getProtocolType(): ProtocolType {
    return ProtocolType.MATRIX
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return import.meta.env.VITE_MATRIX_ENABLED === 'on'
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[MatrixAdapter] 初始化 Matrix 消息服务')

      // Use unifiedMessageReceiver instead of deprecated messageService
      const { unifiedMessageReceiver } = await import('@/services/unifiedMessageReceiver')
      await unifiedMessageReceiver.initialize()

      logger.info('[MatrixAdapter] Matrix 消息服务初始化成功')
    } catch (error) {
      logger.error('[MatrixAdapter] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 发送消息的具体实现
   * 使用现有的 enhancedMessageService
   */
  protected async doSendMessage(params: SendMessageParams): Promise<MessageSendResult> {
    try {
      logger.debug('[MatrixAdapter] 发送消息:', {
        roomId: params.roomId,
        msgType: params.msgType,
        tempMsgId: params.tempMsgId
      })

      // 使用现有的 enhancedMessageService 发送消息
      const { enhancedMessageService } = await import('@/services/enhancedMessageService')
      const { MsgEnum } = await import('@/enums')

      // 转换消息类型
      let msgTypeEnum = MsgEnum.TEXT
      if (typeof params.msgType === 'number') {
        msgTypeEnum = params.msgType
      } else {
        // 尝试从字符串映射到 MsgEnum
        const msgTypeStr = String(params.msgType).toUpperCase()
        const enumKey = msgTypeStr as keyof typeof MsgEnum
        if (enumKey in MsgEnum) {
          msgTypeEnum = MsgEnum[enumKey]
        }
      }

      const result = await enhancedMessageService.sendMessage(params.roomId, {
        type: msgTypeEnum,
        body: params.content as Record<string, unknown>
      })

      return {
        success: true,
        eventId: result.id,
        tempMsgId: params.tempMsgId
      }
    } catch (error) {
      logger.error('[MatrixAdapter] 发送消息失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tempMsgId: params.tempMsgId
      }
    }
  }

  /**
   * 发送文件的具体实现
   * 使用 enhancedMessageService
   */
  protected async doSendFile(params: SendFileParams): Promise<MessageSendResult> {
    try {
      logger.debug('[MatrixAdapter] 发送文件:', {
        roomId: params.roomId,
        fileName: params.fileName || params.file.name,
        fileSize: params.file.size,
        tempMsgId: params.tempMsgId
      })

      // 根据文件类型确定消息类型
      const { MsgEnum } = await import('@/enums')
      let msgType = MsgEnum.FILE
      if (params.file.type.startsWith('image/')) {
        msgType = MsgEnum.IMAGE
      } else if (params.file.type.startsWith('video/')) {
        msgType = MsgEnum.VIDEO
      } else if (params.file.type.startsWith('audio/')) {
        msgType = MsgEnum.VOICE
      }

      // Use enhancedMessageService to send file
      const { enhancedMessageService } = await import('@/services/enhancedMessageService')
      const result = await enhancedMessageService.sendMessage(params.roomId, {
        type: msgType,
        body: {
          file: params.file,
          fileName: params.fileName || params.file.name,
          mimeType: params.file.type,
          fileSize: params.file.size
        }
      })

      return {
        success: true,
        eventId: result.id,
        tempMsgId: params.tempMsgId
      }
    } catch (error) {
      logger.error('[MatrixAdapter] 发送文件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tempMsgId: params.tempMsgId
      }
    }
  }

  /**
   * 撤回消息的具体实现
   * 使用 unifiedMessageService
   */
  protected async doRecallMessage(params: RecallMessageParams): Promise<boolean> {
    try {
      logger.debug('[MatrixAdapter] 撤回消息:', {
        roomId: params.roomId,
        eventId: params.eventId
      })

      // Use unifiedMessageService to recall message
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.recallMessage(params.roomId, params.eventId)

      return true
    } catch (error) {
      logger.error('[MatrixAdapter] 撤回消息失败:', error)
      return false
    }
  }

  /**
   * 获取消息历史的具体实现
   * 使用 unifiedMessageService
   */
  protected async doGetMessageHistory(params: GetMessageHistoryParams): Promise<Message[]> {
    try {
      logger.debug('[MatrixAdapter] 获取消息历史:', {
        roomId: params.roomId,
        limit: params.limit
      })

      // Use unifiedMessageService to get message history
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      const options: { limit: number; from?: string; dir?: 'b' | 'f' } = {
        limit: params.limit || 50
      }
      if (params.fromToken !== undefined) {
        options.from = params.fromToken
      }
      if (params.direction !== undefined) {
        options.dir = params.direction
      }
      const messages = await unifiedMessageService.pageMessages(params.roomId, options)

      // 转换为统一格式
      return messages.map((msg) => ({
        eventId: msg.id,
        roomId: msg.roomId,
        senderId: msg.fromUser?.uid || '',
        type: String(msg.type),
        content: msg.body,
        timestamp: msg.sendTime
      }))
    } catch (error) {
      logger.error('[MatrixAdapter] 获取消息历史失败:', error)
      return []
    }
  }
}

// 导出单例实例
export const matrixMessageAdapter = new MatrixMessageAdapter()
