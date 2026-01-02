import { MsgEnum } from '@/enums'
import type { MsgType } from '@/services/types'

/**
 * 根据消息类型获取回复内容
 * @param message 消息对象
 * @returns 格式化后的回复内容
 */
export const getReplyContent = (message: MsgType): string => {
  let content: string

  // 根据消息类型确定回复内容
  switch (message.type) {
    case MsgEnum.TEXT: {
      // 文本消息：显示原内容，处理&nbsp;
      const bodyContent = message.body.content
      content = typeof bodyContent === 'string' ? bodyContent : JSON.stringify(bodyContent || '')
      content = content.replace(/&nbsp;/g, ' ')
      break
    }

    case MsgEnum.VIDEO: {
      // 视频消息：使用缩略图URL或显示[视频]
      const bodyWithExt = message.body as Record<string, unknown>
      content = (bodyWithExt.thumbnailUrl as string) || (bodyWithExt.thumbUrl as string) || '[视频]'
      break
    }

    case MsgEnum.VOICE: {
      // 语音消息：显示 "[语音] X秒"
      const bodyWithExt = message.body as Record<string, unknown>
      const seconds = (bodyWithExt.second as number) || 0
      content = `[语音] ${seconds}秒`
      break
    }

    case MsgEnum.FILE: {
      // 文件消息：显示文件名
      content = `[文件] ${(message.body as Record<string, unknown>).fileName || ''}`
      break
    }

    case MsgEnum.IMAGE: {
      // 图片消息：使用图片URL
      const url = (message.body as Record<string, unknown>).url
      content = typeof url === 'string' ? url : '[图片]'
      break
    }

    case MsgEnum.NOTICE: {
      // 公告消息：显示内容
      const bodyContent = message.body.content
      content = `[公告] ${typeof bodyContent === 'string' ? bodyContent : ''}`
      break
    }

    case MsgEnum.SYSTEM: {
      // 系统消息
      content = '[系统消息]'
      break
    }

    case MsgEnum.MERGE: {
      // 聊天记录
      content = '[聊天记录]'
      break
    }

    default: {
      // 其他类型：尝试获取content或url
      const bodyContent = message.body.content
      const bodyUrl = (message.body as Record<string, unknown>).url
      content = typeof bodyContent === 'string' ? bodyContent : typeof bodyUrl === 'string' ? bodyUrl : '[未知消息]'
      content = content.replace(/&nbsp;/g, ' ')
      break
    }
  }

  return content
}
