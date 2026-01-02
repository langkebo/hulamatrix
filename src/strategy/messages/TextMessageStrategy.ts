import DOMPurify from 'dompurify'
import { MsgEnum } from '@/enums'
import { removeTag } from '@/utils/Formatting'
import { AppException } from '@/common/exception'
import { TEXT_LIMITS, ERROR_MESSAGES } from '@/constants'
import { AbstractMessageStrategy, ReplyMessage, MessageBody } from '../base'

/**
 * 带回复的消息体
 */
interface MessageWithReply extends MessageBody {
  reply?: {
    content: string
    key?: string
  }
  type?: MsgEnum
}

/**
 * 处理文本消息
 */
export class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: ReplyMessage): MessageWithReply {
    // 处理&nbsp;为空格
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    const msg: MessageWithReply = {
      type: this.msgType,
      content: content,
      reply: replyValue.content
        ? {
            content: replyValue.content,
            key: replyValue.key
          }
        : undefined
    }

    // 处理回复内容
    if (replyValue.content && msg.content) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(msg.content || '')
      const replyDiv = tempDiv.querySelector('#replyDiv')
      if (replyDiv) {
        replyDiv.parentNode?.removeChild(replyDiv)
      }
      tempDiv.innerHTML = DOMPurify.sanitize(removeTag(tempDiv.innerHTML), { RETURN_DOM: false })

      // 确保所有的&nbsp;都被替换为空格
      msg.content = tempDiv.innerHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }

    // 验证消息长度
    if (msg.content && msg.content.length > TEXT_LIMITS.MESSAGE_MAX_LENGTH) {
      throw new AppException(ERROR_MESSAGES.MESSAGE_TOO_LONG)
    }

    return msg
  }

  buildMessageBody(msg: MessageWithReply, reply?: ReplyMessage): MessageBody {
    return {
      content: msg.content,
      replyMsgId: msg.reply?.key || void 0,
      reply: reply?.content
        ? {
            body: reply.content,
            id: reply.key || reply.messageId,
            username: reply.senderId,
            type: msg.type
          }
        : void 0
    }
  }
}
