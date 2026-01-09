import { computed } from 'vue'
// import { Channel } from '@tauri-apps/api/primitives'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { messageStrategyMapSync, DefaultMessageStrategy } from '@/strategy'
import type { Ref } from 'vue'
import type { UserItem } from '@/services/types'
import type { MessageType } from '@/services/types'
import DOMPurify from 'dompurify'
import type { UploadOptions } from '@/hooks/useUpload'
import { logger, toError } from '@/utils/logger'
import { unifiedMessageService } from '@/services/unified-message-service'
import { useMockMessage } from '@/hooks/useMockMessage'

/** 回复信息 */
interface ReplyInfo {
  msgId: string
  senderId: string
  content: string
}

/** 消息策略接口 */
interface MessageStrategyLike {
  getMsg: (content: string, reply: ReplyInfo | null) => Promise<MessageContent>
  buildMessageType: (
    tempMsgId: string,
    body: unknown,
    globalStore: unknown,
    userUid: Ref<string | undefined>
  ) => Promise<unknown>
}

/** 位置信息 */
interface LocationInfo {
  latitude: number
  longitude: number
  address?: string
  name?: string
}

/** 缩略图信息（File 或包含 path 的对象） */
type ThumbnailInfo = File | { path: string; url?: string; width?: number; height?: number }

interface MessageContent {
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  fileList?: unknown[]
  thumbnail?: ThumbnailInfo
  path?: string
  voiceUrl?: string
  voiceDuration?: number
  location?: LocationInfo
  emojiUrl?: string
  [key: string]: unknown
}

/**
 * 消息发送器 Composable
 */
export function useMessageSender(
  messageInputDom: Ref<HTMLElement | null>,
  _uploadHook: ReturnType<typeof import('@/hooks/useUpload').useUpload>
) {
  const globalStore = useGlobalStore()
  const userStore = useUserStore()
  const chatStore = useChatStore()
  const groupStore = useGroupStore()
  const userUid = computed(() => userStore.userInfo?.uid)

  /**
   * 发送消息
   */
  const send = async () => {
    const draftKey = `draft_${globalStore.currentSessionRoomId}`

    try {
      // 清除草稿
      localStorage.removeItem(draftKey)

      // 获取目标房间ID
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) {
        logger.error('没有找到目标房间')
        return
      }

      if (!messageInputDom.value) {
        return
      }

      // 获取消息类型
      const contentType = getMessageContentType(messageInputDom)
      const strategyMap = messageStrategyMapSync as unknown as Record<MsgEnum, MessageStrategyLike>
      const messageStrategy = strategyMap[contentType] ?? new DefaultMessageStrategy()

      if (!messageStrategy) {
        logger.error('未找到对应的消息策略:', contentType)
        return
      }

      // 获取回复信息
      const replyDiv = messageInputDom.value.querySelector('#replyDiv')
      const reply = replyDiv ? parseReplyContent(replyDiv) : null

      // 构建消息
      const msg = await messageStrategy.getMsg(messageInputDom.value.innerHTML || '', reply)

      // 提取@用户ID
      const atUidList = extractAtUserIds(messageInputDom.value.innerHTML || '', groupStore.userList)

      // 生成临时消息ID
      const tempMsgId = 'T' + Date.now().toString()

      // 构建消息体
      const messageBody = {
        type: contentType,
        content: msg.content || '',
        fileUrl: msg.fileUrl || '',
        fileName: msg.fileName || '',
        fileSize: msg.fileSize || 0,
        atUidList,
        reply: reply,
        // 添加语音相关字段
        voiceUrl: msg.voiceUrl || '',
        voiceDuration: msg.voiceDuration || 0,
        // 添加位置相关字段
        location: msg.location || null,
        // 添加表情相关字段
        emojiUrl: msg.emojiUrl || ''
      }

      // 构建临时消息
      const tempMsg = await messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)

      // 添加消息到聊天列表
      await chatStore.addMessageToSessionList(tempMsg as MessageType)

      // 处理文件上传（如果有）
      if (msg.fileList && msg.fileList.length > 0) {
        await handleFileUpload(msg, tempMsgId, targetRoomId)
      } else if (msg.emojiUrl) {
        // 表情消息直接发送
        await sendEmojiMessage(msg, tempMsgId, targetRoomId)
      } else if (msg.voiceUrl) {
        // 语音消息直接发送
        await sendVoiceMessage(msg, tempMsgId, targetRoomId)
      } else if (msg.location) {
        // 位置消息直接发送
        await sendLocationMessage(msg, tempMsgId, targetRoomId)
      } else {
        // 文本消息直接发送
        await sendTextMessage(msg, tempMsgId, targetRoomId)
      }

      // 清空输入框
      resetInput()

      // 更新最后发送时间
      globalStore.updateLastSendTime()
    } catch (error) {
      logger.error('发送消息失败:', toError(error))
    }
  }

  /**
   * 获取消息内容类型
   */
  const getMessageContentType = (dom: Ref<HTMLElement | null>): MsgEnum => {
    const content = dom.value?.innerHTML || ''

    // 检查是否包含图片
    if (content.includes('<img')) {
      const imgElement = dom.value?.querySelector('img[data-type]')
      const imgType = imgElement?.getAttribute('data-type')

      if (imgType === 'emoji') {
        return MsgEnum.EMOJI
      }
      return MsgEnum.IMAGE
    }

    // 检查是否包含文件
    if (content.includes('[文件]')) {
      return MsgEnum.FILE
    }

    // 检查是否包含视频
    if (content.includes('[视频]')) {
      return MsgEnum.VIDEO
    }

    // 检查是否包含语音
    if (content.includes('[语音]')) {
      return MsgEnum.VOICE
    }

    // 检查是否包含位置
    if (content.includes('[位置]')) {
      return MsgEnum.LOCATION
    }

    return MsgEnum.TEXT
  }

  /**
   * 解析回复内容
   */
  const parseReplyContent = (replyDiv: Element): ReplyInfo | null => {
    const replyId = replyDiv.getAttribute('data-reply-id')
    const replySender = replyDiv.getAttribute('data-reply-sender')
    const replyContent = replyDiv.getAttribute('data-reply-content')

    if (!replyId || !replySender) {
      return null
    }

    return {
      msgId: replyId,
      senderId: replySender,
      content: replyContent || ''
    }
  }

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (msg: MessageContent, tempMsgId: string, _roomId: string): Promise<void> => {
    if (!msg.fileList || msg.fileList.length === 0) {
      return
    }

    const uploadOptions: UploadOptions = {
      onProgress: (progress: number) => {
        // 更新上传进度
        chatStore.updateMessageProgress(tempMsgId, progress)
      }
    }

    try {
      // 上传文件 - 使用新的 Matrix SDK API
      if (!msg.path) {
        throw new Error('Missing file path')
      }

      // 读取文件并上传到 Matrix Content Repository
      const file = await fetch(msg.path).then((r) => r.blob())
      const mxcUrl = await _uploadHook.upload(file, uploadOptions)

      if (mxcUrl) {
        await chatStore.updateMessageFileUrl(tempMsgId, mxcUrl)
      }

      // 如果有缩略图，上传缩略图（使用 Matrix SDK 的内置缩略图支持）
      if (msg.thumbnail) {
        const thumbnailFile = msg.thumbnail instanceof File ? msg.thumbnail : undefined
        if (thumbnailFile) {
          // Matrix SDK 自动处理缩略图，直接上传即可
          const thumbnailMxcUrl = await _uploadHook.uploadImage(thumbnailFile, uploadOptions)
          if (thumbnailMxcUrl) {
            await chatStore.updateMessageThumbnailUrl(tempMsgId, thumbnailMxcUrl.mxcUrl)
          }
        }
      }
    } catch (error) {
      logger.error('文件上传失败:', toError(error))
      // 移除失败的消息
      chatStore.removeMessageFromSessionList(tempMsgId)
    }
  }

  /**
   * 处理消息发送
   */
  const handleSendMessage = async (
    msg: {
      type: MsgEnum
      body?: {
        content?: string
        fileUrl?: string
        fileName?: string
        fileSize?: number
        [key: string]: unknown
      }
    },
    tempMsgId: string,
    roomId: string
  ): Promise<void> => {
    try {
      const result = await unifiedMessageService.sendMessage({
        roomId,
        type: msg.type,
        body: msg.body || {}
      })

      // 更新消息状态
      if (result) {
        await chatStore.updateMessageStatus(tempMsgId, MessageStatusEnum.SUCCESS)
        const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
        const matrixEnabled = import.meta.env?.VITE_MATRIX_ENABLED !== 'false'
        if (!isTauri || !matrixEnabled) {
          const { mockMessage } = useMockMessage()
          const echo = mockMessage(msg.type, msg.body as Record<string, unknown>)
          echo.message.roomId = roomId
          echo.message.sendTime = Date.now() + 500
          setTimeout(() => {
            chatStore.pushMsg(echo, { isActiveChatView: false, activeRoomId: roomId })
          }, 600)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('消息发送失败:', errorMessage)
      await chatStore.updateMessageStatus(tempMsgId, MessageStatusEnum.FAILED)
    }
  }

  /**
   * 发送文本消息
   */
  const sendTextMessage = async (msg: MessageContent, tempMsgId: string, roomId: string): Promise<void> => {
    const textStrategy = messageStrategyMapSync[MsgEnum.TEXT]
    const messageBody = textStrategy.buildMessageBody(msg, undefined)

    await handleSendMessage(
      {
        type: MsgEnum.TEXT,
        body: messageBody
      },
      tempMsgId,
      roomId
    )
  }

  /**
   * 发送表情消息
   */
  const sendEmojiMessage = async (msg: MessageContent, tempMsgId: string, roomId: string): Promise<void> => {
    const emojiStrategy = messageStrategyMapSync[MsgEnum.EMOJI]
    const messageBody = emojiStrategy.buildMessageBody(msg, undefined)

    await handleSendMessage(
      {
        type: MsgEnum.EMOJI,
        body: messageBody
      },
      tempMsgId,
      roomId
    )
  }

  /**
   * 发送语音消息
   */
  const sendVoiceMessage = async (msg: MessageContent, tempMsgId: string, roomId: string): Promise<void> => {
    const voiceStrategy = messageStrategyMapSync[MsgEnum.VOICE]
    const messageBody = voiceStrategy.buildMessageBody(msg, undefined)

    await handleSendMessage(
      {
        type: MsgEnum.VOICE,
        body: messageBody
      },
      tempMsgId,
      roomId
    )
  }

  /**
   * 发送位置消息
   */
  const sendLocationMessage = async (msg: MessageContent, tempMsgId: string, roomId: string): Promise<void> => {
    const locationStrategy = messageStrategyMapSync[MsgEnum.LOCATION]
    const messageBody = locationStrategy.buildMessageBody(msg, undefined)

    await handleSendMessage(
      {
        type: MsgEnum.LOCATION,
        body: messageBody
      },
      tempMsgId,
      roomId
    )
  }

  /**
   * 重置输入框
   */
  const resetInput = () => {
    if (messageInputDom.value) {
      messageInputDom.value.innerHTML = DOMPurify.sanitize('')
      messageInputDom.value.focus()
    }
  }

  /**
   * 提取@用户ID
   */
  const extractAtUserIds = (content: string, userList: UserItem[]): string[] => {
    const atUserIds: string[] = []
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = DOMPurify.sanitize(content)

    // 提取所有的@提及元素
    const mentionNodes = tempDiv.querySelectorAll<HTMLElement>('#aitSpan, [data-ait-uid]')

    mentionNodes.forEach((node) => {
      const uid = node.dataset.aitUid
      if (uid) {
        atUserIds.push(uid)
      } else {
        // 尝试通过文本内容匹配
        const name = node.textContent?.replace(/^@/, '')?.trim()
        const user = userList.find((u) => u.name === name)
        if (user) {
          atUserIds.push(user.uid)
        }
      }
    })

    // 从纯文本中提取@提及
    const textContent = tempDiv.textContent || ''
    const regex = /@([^\s]+)/g
    const matches = textContent.match(regex)

    if (matches) {
      matches.forEach((match) => {
        const username = match.slice(1) // 移除@符号
        const user = userList.find((u) => u.name === username)
        if (user && !atUserIds.includes(user.uid)) {
          atUserIds.push(user.uid)
        }
      })
    }

    return Array.from(new Set(atUserIds)) // 去重
  }

  return {
    send,
    resetInput,
    extractAtUserIds
  }
}
