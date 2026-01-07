/**
 * PrivateChat Store - 基于 PrivateChat SDK (强制 E2EE 版本)
 *
 * 使用新优化的 matrix-js-sdk PrivateChat API 扩展
 * 提供完整的 PrivateChat API 功能
 *
 * 安全增强：
 * - 强制端到端加密（Mandatory E2EE）
 * - 拒绝未加密消息
 * - 加密状态实时监控
 * - 设备验证集成
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PrivateChatSession,
  PrivateChatMessage,
  CreateSessionOptions,
  SendMessageOptions,
  GetMessagesOptions
} from '@/sdk/matrix-private-chat'
import type { PrivateChatApi } from '@/sdk/matrix-private-chat/types'
import { getEnhancedMatrixClient } from '@/integrations/matrix/client.js'
import { getProfileInfo, toRecord } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'
import { e2eeGuard } from '@/utils/e2eeGuard'
import { e2eeServiceEnhanced } from '@/services/e2eeServiceEnhanced'
import type { EncryptionStatus } from '@/types/private-chat-security'

/**
 * 扩展的会话信息（包含 UI 需要的额外字段）
 */
export interface PrivateChatSessionWithUI extends PrivateChatSession {
  /** 显示名称（从用户资料获取） */
  display_name?: string
  /** 头像 URL（从用户资料获取） */
  avatar_url?: string
  /** 最后一条消息 */
  last_message?: {
    content: string
    timestamp: number
  }
  /** 未读数（从 store 计算） */
  unread_count?: number
}

/**
 * 扩展的消息信息（包含 UI 需要的额外字段）
 */
export interface PrivateChatMessageWithUI extends PrivateChatMessage {
  /** 是否为自己发送的 */
  is_own?: boolean
  /** 消息状态 */
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  /** 消息时间戳（毫秒） */
  timestamp?: number
  /** 是否已销毁 */
  is_destroyed?: boolean
}

export const usePrivateChatSDKStore = defineStore('privateChatSDK', () => {
  // ==================== 辅助函数 ====================

  /**
   * 获取当前用户 ID
   */
  function getCurrentUserId(): string {
    // 从 localStorage 或其他地方获取当前用户 ID
    return localStorage.getItem('matrix_user_id') || ''
  }

  /**
   * 获取 PrivateChat API 客户端
   */
  async function getPrivateChatClient(): Promise<PrivateChatApi> {
    const client = await getEnhancedMatrixClient()
    const clientRecord = toRecord(client)
    if (!clientRecord?.privateChatV2) {
      throw new Error('PrivateChat API not available on client')
    }
    return clientRecord.privateChatV2 as PrivateChatApi
  }

  // ==================== 状态 ====================

  const loading = ref(false)
  const error = ref<string | null>(null)
  const sessions = ref<PrivateChatSessionWithUI[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<Map<string, PrivateChatMessageWithUI[]>>(new Map())
  const initialized = ref(false)

  // ==================== 计算属性 ====================

  /**
   * 当前会话
   */
  const currentSession = computed(() => {
    if (!currentSessionId.value) return null
    return sessions.value.find((s) => s.session_id === currentSessionId.value) || null
  })

  /**
   * 当前会话的消息
   */
  const currentMessages = computed(() => {
    if (!currentSessionId.value) return []
    return messages.value.get(currentSessionId.value) || []
  })

  /**
   * 会话总数
   */
  const totalSessionsCount = computed(() => sessions.value.length)

  /**
   * 已加载
   */
  const isLoaded = computed(() => !loading.value && initialized.value)

  /**
   * 是否有 E2EE 启用
   */
  const e2eeEnabled = ref(true) // 默认启用

  /**
   * 加密状态映射（按会话 ID）
   */
  const encryptionStatusMap = ref<Map<string, EncryptionStatus>>(new Map())

  /**
   * 安全警告列表
   */
  const securityWarnings = ref<string[]>([])

  /**
   * 是否有存储启用
   */
  const storageEnabled = ref(false)

  // ==================== 辅助方法 ====================

  /**
   * 清除错误
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * 处理错误
   */
  function handleError(e: unknown, message: string): void {
    const errorMessage = e instanceof Error ? e.message : String(e)
    error.value = `${message}: ${errorMessage}`
    logger.error(`[PrivateChatSDKStore] ${message}`, { error: errorMessage })
  }

  // ==================== 初始化操作 ====================

  /**
   * 初始化 E2EE
   */
  async function initializeE2EE(): Promise<void> {
    try {
      const _client = await getPrivateChatClient()
      // E2EE 需要通过 E2EEExtension 初始化
      logger.info('[PrivateChatSDKStore] E2EE initialization requested')
      e2eeEnabled.value = true
    } catch (e) {
      handleError(e, 'E2EE 初始化失败')
      throw e
    }
  }

  /**
   * 初始化存储
   */
  async function initializeStorage(): Promise<void> {
    try {
      const _client = await getPrivateChatClient()
      // 存储需要通过 StorageService 初始化
      logger.info('[PrivateChatSDKStore] Storage initialization requested')
      storageEnabled.value = true
    } catch (e) {
      handleError(e, '存储初始化失败')
      throw e
    }
  }

  /**
   * 初始化 Store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      logger.debug('[PrivateChatSDKStore] Already initialized')
      return
    }

    logger.info('[PrivateChatSDKStore] Initializing...')

    try {
      await fetchSessions()

      initialized.value = true
      logger.info('[PrivateChatSDKStore] Initialized successfully', {
        sessionsCount: sessions.value.length
      })
    } catch (e) {
      handleError(e, '初始化失败')
      throw e
    }
  }

  // ==================== 查询操作 ====================

  /**
   * 获取会话列表
   */
  async function fetchSessions(): Promise<void> {
    loading.value = true
    clearError()

    try {
      const privateChatApi = await getPrivateChatClient()
      const client = await getEnhancedMatrixClient()
      const response = await privateChatApi.listSessions({})

      // 过滤掉已过期的会话并添加 UI 字段
      const now = new Date().toISOString()
      const myId = getCurrentUserId()

      const sessionsWithUI = await Promise.all(
        (response.sessions || [])
          .filter((s) => !s.expires_at || s.expires_at > now)
          .map(async (session) => {
            // 获取其他参与者的信息（用于显示名称和头像）
            const otherParticipantId = session.participants.find((id) => id !== myId) || session.participants[0]

            let display_name: string | undefined
            let avatar_url: string | undefined

            if (otherParticipantId) {
              try {
                const profile = await getProfileInfo(toRecord(client), otherParticipantId)
                display_name = profile?.displayname
                avatar_url = profile?.avatar_url
              } catch {
                // 忽略获取资料失败
              }
            }

            // 获取该会话的最后一条消息（从本地缓存）
            const sessionMessages = messages.value.get(session.session_id) || []
            const lastMessage = sessionMessages[sessionMessages.length - 1]

            return {
              ...session,
              display_name,
              avatar_url,
              last_message: lastMessage
                ? {
                    content: lastMessage.content,
                    timestamp: lastMessage.timestamp || Date.parse(lastMessage.created_at)
                  }
                : undefined,
              unread_count: 0 // SDK 暂未提供未读数 API
            } as PrivateChatSessionWithUI
          })
      )

      sessions.value = sessionsWithUI

      logger.debug('[PrivateChatSDKStore] Sessions fetched', {
        count: sessions.value.length
      })
    } catch (e) {
      handleError(e, '获取会话列表失败')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取会话消息（带强制 E2EE 验证）
   */
  async function fetchMessages(sessionId: string, limit = 50, before?: string): Promise<void> {
    clearError()

    try {
      const privateChatApi = await getPrivateChatClient()
      const options: GetMessagesOptions = { session_id: sessionId, limit }
      if (before) {
        options.before = before
      }

      const response = await privateChatApi.getMessages(options)
      const myId = getCurrentUserId()

      // 🔒 强制 E2EE：验证所有接收的消息
      const validatedMessages: PrivateChatMessageWithUI[] = []
      for (const msg of response.messages || []) {
        // 验证接收到的消息是否已加密
        const receiveValidation = await e2eeGuard.validateReceivedMessage(sessionId, msg.content, msg.message_id)

        if (receiveValidation.valid) {
          validatedMessages.push({
            ...msg,
            is_own: msg.sender_id === myId,
            status: 'sent' as const,
            timestamp: Date.parse(msg.created_at),
            is_destroyed: false
          })
        } else {
          logger.warn('[PrivateChatSDKStore] Rejected unencrypted message', {
            messageId: msg.message_id,
            error: receiveValidation.error
          })
        }
      }

      if (before) {
        // 分页加载：追加到前面
        const existing = messages.value.get(sessionId) || []
        messages.value.set(sessionId, [...validatedMessages, ...existing])
      } else {
        // 首次加载：替换
        messages.value.set(sessionId, validatedMessages)
      }

      logger.debug('[PrivateChatSDKStore] Messages fetched (E2EE enforced)', {
        sessionId,
        count: validatedMessages.length,
        totalReceived: response.messages?.length || 0
      })
    } catch (e) {
      handleError(e, '获取消息失败')
      throw e
    }
  }

  // ==================== 会话操作 ====================

  /**
   * 创建会话（带强制 E2EE 初始化）
   */
  async function createSession(options: CreateSessionOptions): Promise<string> {
    loading.value = true
    clearError()

    try {
      const privateChatApi = await getPrivateChatClient()
      const response = await privateChatApi.createSession(options)

      // 添加到会话列表
      if (response.session) {
        sessions.value = [response.session, ...sessions.value]
      }

      // 🔒 强制 E2EE：确保会话密钥已协商
      if (response.session_id && e2eeEnabled) {
        try {
          const _client = await getEnhancedMatrixClient()

          // 验证会话是否具有有效加密
          e2eeServiceEnhanced.requireValidEncryption(response.session_id)

          // 获取加密状态
          const encryptionStatus = await e2eeServiceEnhanced.getSessionEncryptionStatus(response.session_id)

          logger.info('[PrivateChatSDKStore] Session created with mandatory E2EE', {
            sessionId: response.session_id,
            encryptionLevel: encryptionStatus.level,
            strengthScore: encryptionStatus.strengthScore
          })
        } catch (e) {
          logger.error('[PrivateChatSDKStore] E2EE initialization failed', { error: e })
          // 如果 E2EE 初始化失败，抛出错误阻止会话创建
          throw new Error(`Mandatory E2EE failed: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      logger.info('[PrivateChatSDKStore] Session created', {
        sessionId: response.session_id
      })

      return response.session_id || ''
    } catch (e) {
      handleError(e, '创建会话失败')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除会话
   */
  async function deleteSession(sessionId: string): Promise<void> {
    loading.value = true
    clearError()

    try {
      const privateChatApi = await getPrivateChatClient()
      await privateChatApi.deleteSession(sessionId)

      // 从列表中移除
      sessions.value = sessions.value.filter((s) => s.session_id !== sessionId)

      // 清除消息
      messages.value.delete(sessionId)

      // 如果删除的是当前会话，清空当前会话 ID
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null
      }

      logger.info('[PrivateChatSDKStore] Session deleted', { sessionId })
    } catch (e) {
      handleError(e, '删除会话失败')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 选择会话
   */
  async function selectSession(sessionId: string): Promise<void> {
    try {
      currentSessionId.value = sessionId

      // 加载消息（如果未加载）
      if (!messages.value.has(sessionId)) {
        await fetchMessages(sessionId, 50)
      }

      // 订阅新消息
      subscribeToMessages(sessionId)

      logger.debug('[PrivateChatSDKStore] Session selected', { sessionId })
    } catch (e) {
      handleError(e, '选择会话失败')
      throw e
    }
  }

  /**
   * 取消选择会话
   */
  function deselectSession(): void {
    if (currentSessionId.value) {
      // 取消订阅
      unsubscribeFromMessages(currentSessionId.value)
    }
    currentSessionId.value = null
    logger.debug('[PrivateChatSDKStore] Session deselected')
  }

  // ==================== 消息操作 ====================

  /**
   * 发送消息（带强制 E2EE 验证）
   */
  async function sendMessage(content: string, type = 'text'): Promise<string> {
    if (!currentSessionId.value) {
      const err = 'No active session'
      error.value = err
      throw new Error(err)
    }

    clearError()

    try {
      // 🔒 强制 E2EE：验证会话是否具有有效加密
      e2eeServiceEnhanced.requireValidEncryption(currentSessionId.value)

      // 获取加密状态
      const encryptionStatus = await e2eeServiceEnhanced.getSessionEncryptionStatus(currentSessionId.value)

      // 🔒 强制 E2EE：验证加密状态
      const guardValidation = await e2eeGuard.validateSessionEncryption(currentSessionId.value, encryptionStatus)
      if (!guardValidation.valid) {
        throw new Error(`Mandatory E2EE violation: ${guardValidation.error}`)
      }

      const privateChatApi = await getPrivateChatClient()
      const options: SendMessageOptions = {
        session_id: currentSessionId.value,
        content,
        type: type as 'text' | 'image' | 'file' | 'audio' | 'video'
      }

      const response = await privateChatApi.sendMessage(options)

      // 乐观更新：添加到本地消息列表
      const msgs = messages.value.get(currentSessionId.value) || []
      const newMessage: PrivateChatMessageWithUI = {
        message_id: response.message_id,
        session_id: currentSessionId.value,
        sender_id: getCurrentUserId(),
        content,
        type: type as 'text' | 'image' | 'file' | 'audio' | 'video',
        created_at: new Date().toISOString(),
        is_own: true,
        status: 'sent',
        timestamp: Date.now(),
        is_destroyed: false
      }
      msgs.push(newMessage)
      messages.value.set(currentSessionId.value, msgs)

      logger.info('[PrivateChatSDKStore] Message sent (E2EE enforced)', {
        messageId: response.message_id,
        encryptionLevel: encryptionStatus.level
      })
      return response.message_id || ''
    } catch (e) {
      handleError(e, '发送消息失败')
      throw e
    }
  }

  /**
   * 发送文本消息（便捷方法）
   */
  async function sendText(text: string): Promise<string> {
    return sendMessage(text, 'text')
  }

  /**
   * 订阅消息
   */
  function subscribeToMessages(sessionId: string): void {
    // PrivateChat API 内部处理轮询
    logger.debug('[PrivateChatSDKStore] Subscribed to messages', { sessionId })
  }

  /**
   * 取消订阅消息
   */
  function unsubscribeFromMessages(sessionId: string): void {
    // PrivateChat API 内部处理取消订阅
    logger.debug('[PrivateChatSDKStore] Unsubscribed from messages', { sessionId })
  }

  // ==================== 缓存操作 ====================

  /**
   * 清除缓存
   */
  async function invalidateCache(): Promise<void> {
    try {
      const privateChatApi = await getPrivateChatClient()
      privateChatApi.invalidateCache()
      logger.debug('[PrivateChatSDKStore] Cache invalidated')
    } catch (e) {
      handleError(e, '清除缓存失败')
      throw e
    }
  }

  // ==================== 清理操作 ====================

  /**
   * 重置 Store
   */
  function reset(): void {
    sessions.value = []
    messages.value.clear()
    currentSessionId.value = null
    initialized.value = false
    e2eeEnabled.value = false
    storageEnabled.value = false
    error.value = null
    loading.value = false

    logger.info('[PrivateChatSDKStore] Store reset')
  }

  /**
   * 刷新所有数据
   */
  async function refresh(): Promise<void> {
    await initialize()
  }

  // ==================== E2EE 加密状态管理 ====================

  /**
   * 获取会话的加密状态
   */
  async function getEncryptionStatus(sessionId: string): Promise<EncryptionStatus | null> {
    try {
      const status = await e2eeServiceEnhanced.getSessionEncryptionStatus(sessionId)
      encryptionStatusMap.value.set(sessionId, status)

      // 获取安全警告
      securityWarnings.value = e2eeServiceEnhanced.getSecurityWarnings(sessionId)

      return status
    } catch (e) {
      logger.warn('[PrivateChatSDKStore] Failed to get encryption status', { error: e })
      return null
    }
  }

  /**
   * 获取当前会话的加密状态
   */
  const currentEncryptionStatus = computed(() => {
    if (!currentSessionId.value) return null
    return encryptionStatusMap.value.get(currentSessionId.value) || null
  })

  /**
   * 检查当前会话是否已加密
   */
  const isCurrentEncrypted = computed(() => {
    return currentEncryptionStatus.value?.encrypted || false
  })

  /**
   * 获取当前会话的加密强度分数
   */
  const currentStrengthScore = computed(() => {
    return currentEncryptionStatus.value?.strengthScore || 0
  })

  /**
   * 检查当前会话是否需要密钥轮换
   */
  const needsKeyRotation = computed(() => {
    return currentEncryptionStatus.value?.needsRotation || false
  })

  /**
   * 刷新所有会话的加密状态
   */
  async function refreshAllEncryptionStatus(): Promise<void> {
    for (const session of sessions.value) {
      await getEncryptionStatus(session.session_id)
    }
  }

  /**
   * 获取 E2EE 审计日志
   */
  function getAuditLog(sessionId?: string) {
    return e2eeServiceEnhanced.getAuditLog(sessionId)
  }

  /**
   * 获取加密统计信息
   */
  function getEncryptionStats(sessionId?: string) {
    return e2eeServiceEnhanced.getEncryptionStats(sessionId)
  }

  /**
   * 清理资源
   */
  function dispose(): void {
    // 取消当前会话选择
    deselectSession()

    // 清空状态
    sessions.value = []
    messages.value.clear()
    currentSessionId.value = null
    initialized.value = false
    e2eeEnabled.value = false
    storageEnabled.value = false

    logger.info('[PrivateChatSDKStore] Disposed')
  }

  // ==================== 返回 ====================

  return {
    // 状态
    loading,
    error,
    sessions,
    currentSessionId,
    messages,
    initialized,
    e2eeEnabled,
    storageEnabled,
    encryptionStatusMap,
    securityWarnings,

    // 计算属性
    currentSession,
    currentMessages,
    totalSessionsCount,
    isLoaded,
    currentEncryptionStatus,
    isCurrentEncrypted,
    currentStrengthScore,
    needsKeyRotation,

    // 辅助方法
    clearError,

    // 初始化操作
    initializeE2EE,
    initializeStorage,
    initialize,
    fetchSessions,
    fetchMessages,

    // 会话操作
    createSession,
    deleteSession,
    selectSession,
    deselectSession,

    // 消息操作
    sendMessage,
    sendText,

    // 缓存操作
    invalidateCache,

    // E2EE 加密状态操作
    getEncryptionStatus,
    refreshAllEncryptionStatus,
    getAuditLog,
    getEncryptionStats,

    // 清理操作
    reset,
    refresh,
    dispose
  }
})
