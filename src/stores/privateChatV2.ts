/**
 * 私聊 Store v2.0
 * 基于 SDK v2.0.0 API 和 PrivateChatServiceV2
 *
 * 统一 PC 端和移动端实现
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'
import { logger } from '@/utils/logger'
import type { PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'

/**
 * 私聊 Store v2.0
 * 使用 Composition API 风格
 */
export const usePrivateChatStoreV2 = defineStore('privateChatV2', () => {
  // ==================== 状态 ====================

  const loading = ref(false)
  const error = ref('')
  const sessions = ref<PrivateChatSessionItem[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<Map<string, PrivateChatMessageItem[]>>(new Map())
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
   * 当前会话的未读数
   */
  const currentUnreadCount = computed(() => {
    return currentSession.value?.unread_count || 0
  })

  /**
   * 会话总数
   */
  const totalSessionsCount = computed(() => sessions.value.length)

  /**
   * 已加载
   */
  const isLoaded = computed(() => !loading.value && initialized.value)

  // ==================== 操作 ====================

  /**
   * 初始化 Store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      logger.debug('[PrivateChatStoreV2] Already initialized')
      return
    }

    loading.value = true
    error.value = ''

    try {
      // 初始化服务
      await privateChatServiceV2.initialize()

      // 设置服务事件监听
      setupServiceListeners()

      // 加载初始数据
      await refreshSessions()

      initialized.value = true
      logger.info('[PrivateChatStoreV2] Initialized successfully')
    } catch (e) {
      error.value = e instanceof Error ? e.message : '初始化失败'
      logger.error('[PrivateChatStoreV2] Initialization failed', { error: e })
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置服务事件监听
   */
  function setupServiceListeners(): void {
    // 监听会话创建
    privateChatServiceV2.on('session.created', (data: unknown) => {
      const session = data as PrivateChatSessionItem
      logger.info('[PrivateChatStoreV2] Session created event received', session.session_id)
      // 添加到会话列表开头
      sessions.value = [session, ...sessions.value.filter((s) => s.session_id !== session.session_id)]
    })

    // 监听会话删除
    privateChatServiceV2.on('session.deleted', (data: unknown) => {
      const eventData = data as { sessionId: string }
      logger.info('[PrivateChatStoreV2] Session deleted event received', eventData.sessionId)
      sessions.value = sessions.value.filter((s) => s.session_id !== eventData.sessionId)
      messages.value.delete(eventData.sessionId)

      // 如果删除的是当前会话，清空当前会话 ID
      if (currentSessionId.value === eventData.sessionId) {
        currentSessionId.value = null
      }
    })

    // 监听消息接收
    privateChatServiceV2.on('message.received', (data: unknown) => {
      const message = data as PrivateChatMessageItem
      logger.info('[PrivateChatStoreV2] Message received event', message.message_id)
      const msgs = messages.value.get(message.session_id) || []
      msgs.push(message)
      messages.value.set(message.session_id, msgs)
    })

    // 监听消息发送
    privateChatServiceV2.on('message.sent', (data: unknown) => {
      const eventData = data as { sessionId: string; messageId: string }
      logger.info('[PrivateChatStoreV2] Message sent event', eventData.messageId)
      // 可以更新消息状态
    })
  }

  /**
   * 刷新会话列表
   */
  async function refreshSessions(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      sessions.value = await privateChatServiceV2.listSessions(true)
      logger.info('[PrivateChatStoreV2] Sessions refreshed', { count: sessions.value.length })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '刷新会话失败'
      logger.error('[PrivateChatStoreV2] Failed to refresh sessions', { error: e })
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建新会话
   */
  async function createSession(params: {
    participants: string[]
    session_name?: string
    ttl_seconds?: number
  }): Promise<PrivateChatSessionItem> {
    loading.value = true
    error.value = ''

    try {
      const session = await privateChatServiceV2.createSession(params)

      // 添加到会话列表开头
      sessions.value = [session, ...sessions.value]

      logger.info('[PrivateChatStoreV2] Session created', { sessionId: session.session_id })
      return session
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建会话失败'
      logger.error('[PrivateChatStoreV2] Failed to create session', { error: e })
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
    error.value = ''

    try {
      await privateChatServiceV2.deleteSession(sessionId)

      // 从列表中移除
      sessions.value = sessions.value.filter((s) => s.session_id !== sessionId)

      // 清除消息
      messages.value.delete(sessionId)

      // 如果删除的是当前会话，清空当前会话 ID
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null
      }

      logger.info('[PrivateChatStoreV2] Session deleted', { sessionId })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除会话失败'
      logger.error('[PrivateChatStoreV2] Failed to delete session', { error: e, sessionId })
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
        await loadMessages(sessionId, 50)
      }

      // 订阅新消息
      subscribeToMessages(sessionId)

      logger.debug('[PrivateChatStoreV2] Session selected', { sessionId })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '选择会话失败'
      logger.error('[PrivateChatStoreV2] Failed to select session', { error: e, sessionId })
    }
  }

  /**
   * 取消选择会话
   */
  function deselectSession(): void {
    if (currentSessionId.value) {
      // 取消订阅
      privateChatServiceV2.unsubscribeFromMessages(currentSessionId.value)
    }
    currentSessionId.value = null
    logger.debug('[PrivateChatStoreV2] Session deselected')
  }

  /**
   * 加载消息
   */
  async function loadMessages(sessionId: string, limit = 50, before?: string): Promise<void> {
    try {
      const msgs = before
        ? await privateChatServiceV2.getMessages({ session_id: sessionId, limit, before })
        : await privateChatServiceV2.getMessages({ session_id: sessionId, limit })

      messages.value.set(sessionId, msgs)
      logger.debug('[PrivateChatStoreV2] Messages loaded', { sessionId, count: msgs.length })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载消息失败'
      logger.error('[PrivateChatStoreV2] Failed to load messages', { error: e, sessionId })
    }
  }

  /**
   * 加载更多消息（分页）
   */
  async function loadMoreMessages(sessionId: string): Promise<boolean> {
    const msgs = messages.value.get(sessionId)
    if (!msgs || msgs.length === 0) return false

    const oldestMessage = msgs[0]
    try {
      const newMessages = await privateChatServiceV2.getMessages({
        session_id: sessionId,
        limit: 50,
        before: oldestMessage.message_id
      })

      if (newMessages.length > 0) {
        messages.value.set(sessionId, [...newMessages, ...msgs])
        logger.debug('[PrivateChatStoreV2] More messages loaded', {
          sessionId,
          count: newMessages.length
        })
        return true
      }

      return false
    } catch (e) {
      logger.warn('[PrivateChatStoreV2] Failed to load more messages', { error: e, sessionId })
      return false
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string): Promise<string> {
    if (!currentSessionId.value) {
      const err = 'No active session'
      error.value = err
      throw new Error(err)
    }

    try {
      const messageId = await privateChatServiceV2.sendText(currentSessionId.value, content)

      // 乐观更新：添加到本地消息列表
      const msgs = messages.value.get(currentSessionId.value) || []
      const newMessage: PrivateChatMessageItem = {
        message_id: messageId,
        session_id: currentSessionId.value,
        sender_id: '', // 当前用户 ID
        content,
        type: 'text',
        created_at: new Date().toISOString(),
        timestamp: Date.now(),
        is_own: true
      }
      msgs.push(newMessage)
      messages.value.set(currentSessionId.value, msgs)

      logger.info('[PrivateChatStoreV2] Message sent', { messageId })
      return messageId
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送消息失败'
      logger.error('[PrivateChatStoreV2] Failed to send message', { error: e })
      throw e
    }
  }

  /**
   * 订阅消息
   */
  function subscribeToMessages(sessionId: string): void {
    // 如果已订阅，先取消
    if (messages.value.has(sessionId)) {
      // 检查是否已经订阅
      // privateChatServiceV2 内部会处理重复订阅
    }

    privateChatServiceV2.subscribeToMessages(sessionId, (message: PrivateChatMessageItem) => {
      const msgs = messages.value.get(sessionId) || []
      // 避免重复添加
      if (!msgs.find((m) => m.message_id === message.message_id)) {
        msgs.push(message)
        messages.value.set(sessionId, msgs)
      }
    })

    logger.debug('[PrivateChatStoreV2] Subscribed to messages', { sessionId })
  }

  /**
   * 清除缓存
   */
  function invalidateCache(): void {
    privateChatServiceV2.invalidateCache()
    logger.debug('[PrivateChatStoreV2] Cache invalidated')
  }

  /**
   * 清理资源
   */
  function dispose(): void {
    // 取消当前会话选择
    deselectSession()

    // 清理服务资源
    privateChatServiceV2.dispose()

    // 清空状态
    sessions.value = []
    messages.value.clear()
    currentSessionId.value = null
    initialized.value = false

    logger.info('[PrivateChatStoreV2] Disposed')
  }

  /**
   * 重置 Store
   */
  function reset(): void {
    // 先清理资源
    dispose()

    // 重置状态
    loading.value = false
    error.value = ''
    sessions.value = []
    currentSessionId.value = null
    messages.value = new Map()
    initialized.value = false
  }

  /**
   * 获取会话信息
   */
  function getSession(sessionId: string): PrivateChatSessionItem | undefined {
    return sessions.value.find((s) => s.session_id === sessionId)
  }

  /**
   * 获取会话消息
   */
  function getSessionMessages(sessionId: string): PrivateChatMessageItem[] {
    return messages.value.get(sessionId) || []
  }

  /**
   * 检查会话是否存在
   */
  function hasSession(sessionId: string): boolean {
    return sessions.value.some((s) => s.session_id === sessionId)
  }

  return {
    // ==================== 状态 ====================
    loading,
    error,
    sessions,
    currentSessionId,
    messages,
    initialized,

    // ==================== 计算属性 ====================
    currentSession,
    currentMessages,
    currentUnreadCount,
    totalSessionsCount,
    isLoaded,

    // ==================== 操作 ====================
    initialize,
    refreshSessions,
    createSession,
    deleteSession,
    selectSession,
    deselectSession,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    invalidateCache,
    dispose,
    reset,
    getSession,
    getSessionMessages,
    hasSession
  }
})
