import { FILE_SIZE_LIMITS } from '@/constants'
import { ref } from 'vue'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { messageStrategyMapSync } from '@/strategy'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import type { MessageBody, GlobalStoreState } from '@/strategy/base'

/**
 * 直接发送功能 Composable
 */
export function useDirectSend() {
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const userStore = useUserStore()
  const userUid = ref(userStore.userInfo?.uid)

  /**
   * 直接发送文件
   */
  const sendFilesDirect = async (files: File[]): Promise<void> => {
    try {
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) {
        msg.error('请先选择聊天房间')
        return
      }

      // 检查文件数量限制（最多9个文件）
      if (files.length > 9) {
        msg.error('一次最多只能发送9个文件')
        return
      }

      // 检查每个文件大小
      for (const file of files) {
        if (file.size > FILE_SIZE_LIMITS.FILE_MAX_SIZE) {
          msg.error(`文件 ${file.name} 大小不能超过100MB`)
          return
        }
      }

      // 处理文件并发送
      const sendPromises = files.map((file) => processAndSendFile(file, targetRoomId))

      await Promise.allSettled(sendPromises)

      // 更新最后发送时间
      globalStore.updateLastSendTime()
    } catch (error) {
      logger.error('发送文件失败:', error)
      msg.error('发送文件失败，请重试')
    }
  }

  /**
   * 处理并发送单个文件
   */
  const processAndSendFile = async (file: File, roomId: string): Promise<void> => {
    const tempMsgId = 'T' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9)

    try {
      // 根据文件类型选择策略
      let strategy
      let msgType = MsgEnum.FILE
      let messageBody: Record<string, unknown>

      if (file.type.startsWith('image/')) {
        msgType = MsgEnum.IMAGE
        strategy = messageStrategyMapSync[MsgEnum.IMAGE]

        // 处理图片
        messageBody = {
          images: [
            {
              name: file.name,
              size: file.size,
              type: file.type,
              url: '',
              thumbnailUrl: ''
            }
          ]
        }
      } else if (file.type.startsWith('video/')) {
        msgType = MsgEnum.VIDEO
        strategy = messageStrategyMapSync[MsgEnum.VIDEO]

        // 处理视频
        messageBody = {
          videos: [
            {
              name: file.name,
              size: file.size,
              type: file.type,
              url: '',
              thumbnailUrl: '',
              duration: 0
            }
          ]
        }
      } else {
        strategy = messageStrategyMapSync[MsgEnum.FILE]

        // 处理普通文件
        messageBody = {
          files: [
            {
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              url: '' // 将在上传后填充
            }
          ]
        }
      }

      // 构建临时消息
      const tempMsg = await strategy?.buildMessageType(
        tempMsgId,
        messageBody as MessageBody,
        globalStore as unknown as GlobalStoreState,
        userUid
      )

      // 添加到聊天列表
      chatStore.addMessageToSessionList(tempMsg)

      // 上传文件
      // 文件上传交由统一上传逻辑或服务端处理，直接发送占位消息

      // 发送消息
      await sendMessage(tempMsgId, roomId, msgType, messageBody)
    } catch (error) {
      logger.error(`处理文件 ${file.name} 失败:`, error)
      // 移除失败的消息
      chatStore.removeMessageFromSessionList(tempMsgId)
    }
  }

  /**
   * 发送语音
   */
  const sendVoiceDirect = async (voiceData: { url: string; duration: number; blob: Blob }): Promise<void> => {
    try {
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) {
        msg.error('请先选择聊天房间')
        return
      }

      const tempMsgId = 'T' + Date.now().toString() + '_voice_' + Math.random().toString(36).substr(2, 9)

      // 构建消息体
      const messageBody = {
        voiceUrl: voiceData.url,
        duration: voiceData.duration
      }

      // 构建临时消息
      const strategy = messageStrategyMapSync[MsgEnum.VOICE]
      const tempMsg = await strategy?.buildMessageType(
        tempMsgId,
        messageBody as MessageBody,
        globalStore as unknown as GlobalStoreState,
        userUid
      )

      // 添加到聊天列表
      chatStore.addMessageToSessionList(tempMsg)

      // 发送消息
      await sendMessage(tempMsgId, targetRoomId, MsgEnum.VOICE, messageBody)

      logger.debug('语音发送成功')
    } catch (error) {
      logger.error('发送语音失败:', error)
      msg.error('发送语音失败，请重试')
    }
  }

  /**
   * 发送位置
   */
  const sendLocationDirect = async (locationData: {
    latitude: number
    longitude: number
    address?: string
    name?: string
  }): Promise<void> => {
    try {
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) {
        msg.error('请先选择聊天房间')
        return
      }

      const tempMsgId = 'T' + Date.now().toString() + '_location_' + Math.random().toString(36).substr(2, 9)

      // 构建消息体
      const messageBody = {
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address || '',
          name: locationData.name || '位置'
        }
      }

      // 构建临时消息
      const strategy = messageStrategyMapSync[MsgEnum.LOCATION]
      const tempMsg = await strategy?.buildMessageType(
        tempMsgId,
        messageBody as MessageBody,
        globalStore as unknown as GlobalStoreState,
        userUid
      )

      // 添加到聊天列表
      chatStore.addMessageToSessionList(tempMsg)

      // 发送消息
      await sendMessage(tempMsgId, targetRoomId, MsgEnum.LOCATION, messageBody)

      logger.debug('位置发送成功')
    } catch (error) {
      logger.error('发送位置失败:', error)
      msg.error('发送位置失败，请重试')
    }
  }

  /**
   * 发送表情
   */
  const sendEmojiDirect = async (emojiUrl: string): Promise<void> => {
    try {
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) {
        msg.error('请先选择聊天房间')
        return
      }

      const tempMsgId = 'T' + Date.now().toString() + '_emoji_' + Math.random().toString(36).substr(2, 9)

      // 构建消息体
      const messageBody = {
        emojiUrl
      }

      // 构建临时消息
      const strategy = messageStrategyMapSync[MsgEnum.EMOJI]
      const tempMsg = await strategy?.buildMessageType(
        tempMsgId,
        messageBody as MessageBody,
        globalStore as unknown as GlobalStoreState,
        userUid
      )

      // 添加到聊天列表
      chatStore.addMessageToSessionList(tempMsg)

      // 发送消息
      await sendMessage(tempMsgId, targetRoomId, MsgEnum.EMOJI, messageBody)

      logger.debug('表情发送成功')
    } catch (error) {
      logger.error('发送表情失败:', error)
      msg.error('发送表情失败，请重试')
    }
  }

  /**
   * 发送消息到服务器
   */
  const sendMessage = async (
    tempMsgId: string,
    roomId: string,
    msgType: MsgEnum,
    messageBody: Record<string, unknown>
  ): Promise<void> => {
    try {
      await chatStore.sendMessage(roomId, {
        type: msgType,
        body: messageBody as MessageBody
      })

      // 更新消息状态
      await chatStore.updateMessageStatus(tempMsgId, MessageStatusEnum.SUCCESS)
    } catch (error) {
      logger.error('发送消息失败:', error)
      // 更新消息状态为失败
      await chatStore.updateMessageStatus(tempMsgId, MessageStatusEnum.FAILED)
      throw error
    }
  }

  /**
   * 更新消息文件URL
   */

  return {
    sendFilesDirect,
    sendVoiceDirect,
    sendLocationDirect,
    sendEmojiDirect
  }
}
