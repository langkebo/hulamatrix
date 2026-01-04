import { MsgEnum } from '@/enums'
import { AbstractMessageStrategy, type MessageBody, type ReplyMessage } from '../base'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

/**
 * 默认消息策略
 * 用于处理尚未实现的消息类型
 *
 * 注意: 此策略仅作为后备方案,实际消息发送应使用具体的消息类型策略
 * (如 TextMessageStrategy, ImageMessageStrategy 等)
 */
export class DefaultMessageStrategy extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.UNKNOWN)
  }

  validateNotEmpty(input: string): boolean {
    return input !== null && input !== undefined && input.toString().trim() !== ''
  }

  getMsg(msgInputValue: string, replyValue?: ReplyMessage, fileList?: File[]): MessageBody {
    return {
      content: msgInputValue || '',
      reply: replyValue,
      fileList: fileList && fileList.length > 0 ? fileList : undefined
    }
  }

  buildMessageBody(content: MessageBody, _reply?: ReplyMessage): MessageBody {
    // 返回一个基本的消息体结构
    return {
      type: this.msgType,
      content: content.content || '',
      ...content
    }
  }

  /**
   * 发送消息
   *
   * 对于未知类型消息,尝试将其作为文本消息发送
   * 如果发送失败,记录错误但不抛出异常(允许UI处理)
   *
   * @param content 消息内容
   * @param roomId 目标房间ID
   * @param tempMsgId 临时消息ID(用于跟踪)
   */
  async sendMessage(content: MessageBody, roomId: string, tempMsgId: string): Promise<void> {
    try {
      // 验证必需参数
      if (!roomId) {
        throw new Error('roomId is required for sending message')
      }

      // 提取文本内容
      const text = String(content.content || '')

      // 如果内容为空,直接返回(不发送空消息)
      if (!text.trim()) {
        logger.debug('[DefaultMessageStrategy] Skipping empty message', { tempMsgId })
        return
      }

      // 尝试通过 Matrix SDK 发送文本消息
      // 注意: 对于未知类型,我们默认使用 m.text 消息类型
      const client = matrixClientService.getClient()
      if (client) {
        await matrixClientService.sendTextMessage(roomId, text)
        logger.debug('[DefaultMessageStrategy] Message sent successfully', { tempMsgId, roomId })
      } else {
        // Matrix 客户端未初始化,记录警告
        logger.warn('[DefaultMessageStrategy] Matrix client not initialized, cannot send message', {
          tempMsgId,
          roomId
        })
      }
    } catch (error) {
      // 记录发送失败,但不重新抛出(允许上层处理)
      logger.error('[DefaultMessageStrategy] Failed to send message:', {
        tempMsgId,
        roomId,
        error: error instanceof Error ? error.message : String(error)
      })
      // 重新抛出以允许上层处理(如显示错误提示)
      throw error
    }
  }
}
