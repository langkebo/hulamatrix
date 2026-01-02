/**
 * 聊天Store - 撤回消息管理模块
 *
 * 负责管理消息撤回功能
 */

import { reactive } from 'vue'
import { logger } from '@/utils/logger'
import { MsgEnum } from '@/enums'
import type { MessageType, RevokedMsgType } from '@/services/types'

type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

/** Parameters for updateMsg callback */
interface UpdateMsgParams {
  roomId: string
  msgId: string
  updates: {
    message: {
      type: MsgEnum
      body: {
        recallUid?: string
        recallTime?: number
        [key: string]: unknown
      }
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Data parameter for updateSession callback */
interface UpdateSessionData {
  lastMessage?: {
    message: {
      type: MsgEnum
      body: string
    }
  }
  [key: string]: unknown
}

export interface ChatRecallComposables {
  // 状态
  recalledMessages: Record<string, RecalledMessage>

  // 方法
  recordRecallMsg: (data: { recallUid: string; msg: MessageType }) => void
  updateRecallMsg: (data: RevokedMsgType) => Promise<void>
  getRecalledMessage: (msgId: string) => RecalledMessage | undefined
  clearAllExpirationTimers: () => void
}

export interface ChatRecallDeps {
  messageMap?: Record<string, Record<string, MessageType>>
  updateMsg?: (params: UpdateMsgParams) => void
  updateSession?: (roomId: string, data: UpdateSessionData) => void
  persistUnreadCount?: (roomId: string, count: number) => void
}

// 撤回消息的过期时间
const RECALL_EXPIRATION_TIME = 2 * 60 * 1000 // 2分钟

/**
 * 撤回消息管理 Composable
 */
export function useChatRecall(deps?: ChatRecallDeps): ChatRecallComposables {
  const { messageMap, updateMsg, updateSession } = deps || {}

  // 存储撤回的消息内容和时间
  const recalledMessages = reactive<Record<string, RecalledMessage>>({})
  // 存储每条撤回消息的过期定时器
  const expirationTimers: Record<string, boolean> = {}

  /**
   * 记录撤回的消息
   */
  const recordRecallMsg = (data: { recallUid: string; msg: MessageType }) => {
    const { msg } = data
    const { id, type, body } = msg.message

    // 记录撤回的消息
    recalledMessages[id] = {
      messageId: id,
      content: JSON.stringify(body),
      recallTime: Date.now(),
      originalType: type as MsgEnum
    }

    // 设置过期定时器
    expirationTimers[id] = true
    setTimeout(() => {
      delete recalledMessages[id]
      delete expirationTimers[id]
      logger.debug('[ChatRecall] 撤回消息已过期:', id)
    }, RECALL_EXPIRATION_TIME)

    logger.debug('[ChatRecall] 记录撤回消息:', id)
  }

  /**
   * 更新撤回消息
   */
  const updateRecallMsg = async (data: RevokedMsgType) => {
    try {
      const roomId = data.roomId || ''
      const msgId = data.msgId || ''
      if (!roomId || !msgId) return

      // 更新消息状态
      if (updateMsg && messageMap) {
        const roomMessages = messageMap[roomId]
        if (roomMessages && roomMessages[msgId]) {
          const msg = roomMessages[msgId]

          // 记录原始消息
          recordRecallMsg({ recallUid: data.recallUid || '', msg })

          // 更新消息为撤回状态
          updateMsg({
            roomId,
            msgId: msgId,
            updates: {
              message: {
                ...msg.message,
                type: MsgEnum.RECALL,
                body: {
                  recallUid: data.recallUid,
                  recallTime: Date.now()
                }
              }
            }
          })

          // 更新会话的最后消息
          if (updateSession) {
            updateSession(roomId, {
              lastMessage: {
                message: {
                  type: MsgEnum.RECALL,
                  body: '[撤回了一条消息]'
                }
              }
            })
          }

          logger.info('[ChatRecall] 更新撤回消息成功:', msgId)
        }
      }
    } catch (error) {
      logger.error('[ChatRecall] 更新撤回消息失败:', error)
    }
  }

  /**
   * 获取撤回的消息
   */
  const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
    return recalledMessages[msgId]
  }

  /**
   * 清空所有过期定时器
   */
  const clearAllExpirationTimers = () => {
    for (const timerId in expirationTimers) {
      delete expirationTimers[timerId]
    }
    // 清空所有撤回消息记录
    for (const msgId in recalledMessages) {
      delete recalledMessages[msgId]
    }
    logger.debug('[ChatRecall] 清空所有过期定时器')
  }

  return {
    recalledMessages,
    recordRecallMsg,
    updateRecallMsg,
    getRecalledMessage,
    clearAllExpirationTimers
  }
}
