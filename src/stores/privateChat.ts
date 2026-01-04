import { logger } from '@/utils/logger'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPrivateChatManager } from '@/integrations/matrix/PrivateChatManager'
import { useGlobalStore } from '@/stores/global'
import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { StoresEnum } from '@/enums'

export interface PrivateChatRoom {
  id: string
  name: string
  participants: string[]
  createdAt: number
  encryptionLevel: 'standard' | 'high'
  defaultSelfDestruct?: number
  avatar?: string
  topic?: string
}

/** 自毁消息内容类型 */
export type SelfDestructMessageContent = string | Record<string, unknown> | unknown

export interface SelfDestructingMessage {
  id: string
  roomId: string
  eventId: string
  content: SelfDestructMessageContent
  destroyAt: number
  createdAt: number
  destroyAfterSeconds: number
}

/** 私密聊天创建参数 */
export interface CreatePrivateChatParams {
  participants: string[]
  name?: string
  encryptionLevel?: 'standard' | 'high'
  selfDestructDefault?: number
  topic?: string
}

/** 自定义事件类型 */
interface SelfDestructEventDetail {
  roomId: string
  eventId: string
}

declare global {
  interface Window {
    __privateChatCleanup?: () => void
  }
}

export const usePrivateChatStore = defineStore(
  StoresEnum.PRIVATE_CHAT,
  () => {
    const globalStore = useGlobalStore()
    const chatStore = useChatStore()
    const groupStore = useGroupStore()

    // 私密聊天房间列表
    const privateChatRooms = ref<Map<string, PrivateChatRoom>>(new Map())

    // 当前私密聊天
    const currentPrivateChat = ref<string | null>(null)

    // 自毁消息列表
    const selfDestructingMessages = ref<Map<string, SelfDestructingMessage>>(new Map())

    // 创建私密聊天的加载状态
    const creatingPrivateChat = ref(false)

    // 发送自毁消息的加载状态
    const sendingSelfDestructingMessage = ref(false)

    // 计算属性：是否为私密聊天
    const isPrivateChat = computed(() => (roomId: string) => {
      const manager = getPrivateChatManager()
      return privateChatRooms.value.has(roomId) || manager.isPrivateChat(roomId)
    })

    // 计算属性：获取私密聊天信息
    const getPrivateChatInfo = computed(() => (roomId: string) => {
      const localInfo = privateChatRooms.value.get(roomId)
      const managerInfo = getPrivateChatManager().getPrivateChatInfo(roomId)

      return {
        ...localInfo,
        ...managerInfo,
        isPrivateChat: !!(localInfo || managerInfo)
      }
    })

    // 计算属性：当前房间的私密聊天信息
    const currentPrivateChatInfo = computed(() => {
      const currentRoomId = globalStore.currentSessionRoomId
      return currentRoomId ? getPrivateChatInfo.value(currentRoomId) : null
    })

    // 计算属性：获取消息剩余自毁时间
    const getMessageRemainingTime = computed(() => (messageId: string) => {
      const message = selfDestructingMessages.value.get(messageId)
      if (!message) return 0

      const remaining = message.destroyAt - Date.now()
      return Math.max(0, remaining)
    })

    // 初始化私密聊天管理器
    const initialize = () => {
      const privateChatManager = getPrivateChatManager()
      privateChatManager.initialize()
      privateChatManager.checkAndRestartTimers()

      // 监听自毁消息事件
      if (typeof window !== 'undefined') {
        const eventHandler = (event: Event) => handleSelfDestructEvent(event as CustomEvent<SelfDestructEventDetail>)
        window.addEventListener('message-self-destructed', eventHandler as EventListener)

        // 导出清理函数
        window.__privateChatCleanup = () => {
          window.removeEventListener('message-self-destructed', eventHandler as EventListener)
        }
      }
    }

    // 创建私密聊天
    const createPrivateChat = async (
      participants: string[],
      options?: {
        name?: string
        encryptionLevel?: 'standard' | 'high'
        selfDestructDefault?: number
        topic?: string
      }
    ) => {
      if (creatingPrivateChat.value) {
        throw new Error('Already creating a private chat')
      }

      creatingPrivateChat.value = true

      try {
        const privateChatManager = getPrivateChatManager()
        const payload: CreatePrivateChatParams = {
          participants,
          name: options?.name || `私密聊天 ${participants.length + 1}人`,
          encryptionLevel: options?.encryptionLevel || 'standard'
        }
        if (options?.selfDestructDefault !== undefined) payload.selfDestructDefault = options.selfDestructDefault
        if (options?.topic !== undefined) payload.topic = options.topic
        const roomId = await privateChatManager.createPrivateChat(payload)

        // 获取参与者信息
        const participantInfo = participants.map((uid) => {
          const user = groupStore.getUserInfo(uid)
          return {
            uid,
            name: user?.name || `用户${uid}`,
            avatar: user?.avatar || ''
          }
        })

        // 添加到本地状态
        const privateChatRoom: PrivateChatRoom = {
          id: roomId,
          name: options?.name || `私密聊天 ${participantInfo.length + 1}人`,
          participants,
          createdAt: Date.now(),
          encryptionLevel: options?.encryptionLevel || 'standard',
          defaultSelfDestruct: options?.selfDestructDefault ?? 0,
          topic: options?.topic || '私密聊天 - 端到端加密'
        }

        privateChatRooms.value.set(roomId, privateChatRoom)

        // 添加到会话列表
        await chatStore.addSession(roomId)

        logger.debug('[PrivateChatStore] Private chat created successfully:', roomId)

        return roomId
      } catch (error) {
        logger.error('[PrivateChatStore] Failed to create private chat:', error)
        throw error
      } finally {
        creatingPrivateChat.value = false
      }
    }

    // 发送自毁消息
    const sendSelfDestructingMessage = async (
      roomId: string,
      content: SelfDestructMessageContent,
      destroyAfterSeconds: number = 300 // 默认5分钟
    ) => {
      if (sendingSelfDestructingMessage.value) {
        throw new Error('Already sending a self-destructing message')
      }

      sendingSelfDestructingMessage.value = true

      try {
        const privateChatManager = getPrivateChatManager()
        const eventId = await privateChatManager.sendSelfDestructingMessage(
          roomId,
          content as string | Record<string, unknown>,
          destroyAfterSeconds
        )

        // 添加到本地状态
        const selfDestructMessage: SelfDestructingMessage = {
          id: `${roomId}_${eventId}`,
          roomId,
          eventId,
          content,
          destroyAt: Date.now() + destroyAfterSeconds * 1000,
          createdAt: Date.now(),
          destroyAfterSeconds
        }

        selfDestructingMessages.value.set(selfDestructMessage.id, selfDestructMessage)

        logger.debug('[PrivateChatStore] Self-destructing message sent successfully:', eventId)

        return eventId
      } catch (error) {
        logger.error('[PrivateChatStore] Failed to send self-destructing message:', error)
        throw error
      } finally {
        sendingSelfDestructingMessage.value = false
      }
    }

    // 处理自毁消息事件
    const handleSelfDestructEvent = (event: CustomEvent) => {
      const { roomId, eventId } = event.detail
      const messageId = `${roomId}_${eventId}`

      // 从本地状态中移除
      selfDestructingMessages.value.delete(messageId)

      // 如果是当前房间，通知UI更新
      if (globalStore.currentSessionRoomId === roomId) {
        // 这里可以添加通知逻辑，比如显示提示
      }
    }

    // 设置高级加密
    const setupHighEncryption = async (roomId: string) => {
      try {
        const privateChatManager = getPrivateChatManager()
        await privateChatManager.setupHighEncryption(roomId)

        // 更新本地状态
        const room = privateChatRooms.value.get(roomId)
        if (room) {
          room.encryptionLevel = 'high'
          privateChatRooms.value.set(roomId, { ...room })
        }

        logger.debug(`[PrivateChatStore] High encryption enabled for room: ${roomId}`)
      } catch (error) {
        logger.error('[PrivateChatStore] Failed to setup high encryption:', error)
        throw error
      }
    }

    // 获取私密聊天列表
    const getPrivateChatList = () => {
      return Array.from(privateChatRooms.value.values()).sort((a, b) => b.createdAt - a.createdAt)
    }

    // 获取自毁消息列表
    const getSelfDestructingMessagesList = () => {
      return Array.from(selfDestructingMessages.value.values()).sort((a, b) => b.createdAt - a.createdAt)
    }

    // 检查消息是否为自毁消息
    const isSelfDestructingMessage = (messageId: string) => {
      return selfDestructingMessages.value.has(messageId)
    }

    // 格式化剩余时间显示
    const formatRemainingTime = (milliseconds: number): string => {
      const seconds = Math.ceil(milliseconds / 1000)
      if (seconds < 60) {
        return `${seconds}秒`
      }
      if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}分`
      }
      return `${Math.floor(seconds / 3600)}时`
    }

    // 切换当前私密聊天
    const setCurrentPrivateChat = (roomId: string | null) => {
      currentPrivateChat.value = roomId
    }

    // 移除私密聊天
    const removePrivateChat = (roomId: string) => {
      privateChatRooms.value.delete(roomId)
      if (currentPrivateChat.value === roomId) {
        currentPrivateChat.value = null
      }
    }

    // 清理过期的自毁消息
    const cleanupExpiredMessages = () => {
      const now = Date.now()
      const expiredMessages: string[] = []

      for (const [id, message] of selfDestructingMessages.value.entries()) {
        if (message.destroyAt <= now) {
          expiredMessages.push(id)
        }
      }

      expiredMessages.forEach((id) => {
        selfDestructingMessages.value.delete(id)
      })
    }

    // 定期清理过期消息
    const startCleanupTimer = () => {
      setInterval(cleanupExpiredMessages, 60000) // 每分钟检查一次
    }

    // 获取加密级别显示文本
    const getEncryptionLevelText = (level: 'standard' | 'high'): string => {
      return level === 'high' ? '高级加密' : '标准加密'
    }

    // 获取加密级别颜色
    const getEncryptionLevelColor = (level: 'standard' | 'high'): string => {
      return level === 'high' ? '#4ade80' : '#60a5fa'
    }

    return {
      // 状态
      privateChatRooms,
      currentPrivateChat,
      selfDestructingMessages,
      creatingPrivateChat,
      sendingSelfDestructingMessage,

      // 计算属性
      isPrivateChat,
      getPrivateChatInfo,
      currentPrivateChatInfo,
      getMessageRemainingTime,

      // 方法
      initialize,
      createPrivateChat,
      sendSelfDestructingMessage,
      setupHighEncryption,
      getPrivateChatList,
      getSelfDestructingMessagesList,
      isSelfDestructingMessage,
      formatRemainingTime,
      setCurrentPrivateChat,
      removePrivateChat,
      cleanupExpiredMessages,
      startCleanupTimer,
      getEncryptionLevelText,
      getEncryptionLevelColor
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
