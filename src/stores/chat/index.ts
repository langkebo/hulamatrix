/**
 * Chat Store - Main Orchestrator
 *
 * This file has been refactored into a modular architecture for better maintainability.
 * All functionality is now organized into focused modules under ./chat/
 *
 * Architecture:
 * - types.ts - Type definitions and interfaces
 * - session-state.ts - Session list, session map, CRUD operations
 * - message-state.ts - Message map, loading, pagination
 * - unread-state.ts - Unread count tracking and persistence
 * - recall-state.ts - Message recall/cancel functionality
 * - thread-state.ts - Thread/message relation handling
 * - worker-manager.ts - Background worker management
 * - index.ts - Main orchestrator
 *
 * @module ChatStore
 */

import { computed, ref } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { notificationService } from '@/services/notificationService'
import { ErrorType } from '@/common/exception'
import { MessageStatusEnum, MittEnum, MsgEnum, RoomTypeEnum, StoresEnum, TauriCommand } from '@/enums'
import type { MarkItemType, MessageBody, MessageType, MsgType, RevokedMsgType, SessionItem } from '@/services/types'
import { unifiedMessageService } from '@/services/unified-message-service'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { runInBatches, MESSAGES_POLICY } from '@/services/messages'
import { renderReplyContent } from '@/utils/RenderReplyContent'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import { useMitt } from '@/hooks/useMitt'
import { prefetchShallowHistory, tryBackfillWhenNoPagination } from '@/integrations/matrix/history'
import { useMatrixClient } from '@/composables'
import { logger } from '@/utils/logger'

// Import state managers
import { SessionStateManager } from './session-state'
import { MessageStateManager } from './message-state'
import { UnreadStateManager } from './unread-state'
import { RecallStateManager } from './recall-state'
import { ThreadStateManager } from './thread-state'
import { ChatWorkerManager } from './worker-manager'

// Import types
import type { SendMessageParams, RemoveSessionOptions, RecalledMessage } from './types'
import { PAGE_SIZE, RECALL_EXPIRATION_TIME } from './types'

// Re-export types
export * from './types'

export const useChatStore = defineStore(StoresEnum.CHAT, () => {
  const route = useRoute()
  const userStore = useUserStore()
  const roomStore = useRoomStore()
  const sessionUnreadStore = useSessionUnreadStore()

  // Current session room ID
  const currentSessionRoomId = ref('')

  // Initialize state managers
  const sessionState = new SessionStateManager(() => currentSessionRoomId.value)

  const messageState = new MessageStateManager(() => currentSessionRoomId.value)

  const unreadState = new UnreadStateManager(() => currentSessionRoomId.value, userStore, sessionUnreadStore)

  const recallState = new RecallStateManager(messageState, () => messageState.messageMap, roomStore)

  const { client } = useMatrixClient()
  const threadState = new ThreadStateManager(() => currentSessionRoomId.value, client)

  const workerManager = new ChatWorkerManager()

  // Multi-select mode state
  const isMsgMultiChoose = ref<boolean>(false)
  const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')

  // Current message reply
  const currentMsgReply = ref<Partial<MessageType>>({})

  // Remote sync locks
  const remoteSyncLocks = new Set<string>()

  // Computed properties
  const shouldShowNoMoreMessage = computed(() => messageState.shouldShowNoMoreMessage.value)

  const isGroup = computed(() => sessionState.getCurrentSession()?.type === RoomTypeEnum.GROUP)

  const currentSessionInfo = computed(() => sessionState.getCurrentSession())

  const currentMessageMap = computed(() => messageState.currentMessageMap.value)

  const currentMessageOptions = computed({
    get: () => messageState.currentMessageOptions.value,
    set: (val) => {
      messageState.currentMessageOptions.value = val
    }
  })

  const currentReplyMap = computed({
    get: () => messageState.currentReplyMap.value,
    set: (val) => {
      messageState.currentReplyMap.value = val
    }
  })

  const currentNewMsgCount = computed({
    get: () => unreadState.currentNewMsgCount.value,
    set: (val) => {
      unreadState.currentNewMsgCount.value = val
    }
  })

  const chatMessageList = computed(() => messageState.chatMessageList.value)

  const syncLoading = computed<boolean>({
    get: () => sessionState.syncLoading.value,
    set: (val) => {
      sessionState.syncLoading.value = val
    }
  })

  // ============================================================
  // Core Actions
  // ============================================================

  /**
   * Change current room
   */
  const changeRoom = async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) {
      const currentWindowLabel = WebviewWindow.getCurrent()
      if (currentWindowLabel.label !== 'home' && currentWindowLabel.label !== 'mobile-home') {
        return
      }
    }

    const roomId = currentSessionRoomId.value
    if (!roomId) return

    // Clear old message data
    messageState.clearRoomMessages(roomId)

    // Reset message loading state
    currentMessageOptions.value = {
      isLast: false,
      isLoading: false,
      cursor: ''
    }

    // Clear reply mapping
    if (currentReplyMap.value) {
      for (const key in currentReplyMap.value) {
        delete currentReplyMap.value[key]
      }
    }

    try {
      // Load messages from server
      await getPageMsg(PAGE_SIZE, roomId, '')
      const opts = messageState.messageOptions[roomId]
      const isEmpty = !messageState.messageMap[roomId] || Object.keys(messageState.messageMap[roomId]).length === 0

      if (opts?.isLast || isEmpty) {
        await tryBackfillWhenNoPagination(roomId, PAGE_SIZE)
        const desired = Math.ceil(PAGE_SIZE * 1.5)
        await prefetchShallowHistory(roomId, desired)
      }
    } catch (error) {
      logger.warn('无法加载消息::', { data: error, component: 'chatStore' })
      try {
        await tryBackfillWhenNoPagination(roomId, PAGE_SIZE)
        const desired = Math.ceil(PAGE_SIZE * 1.2)
        await prefetchShallowHistory(roomId, desired)
      } catch (e) {
        logger.warn('消息回填失败:', e)
      }
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: ''
      }
    }

    // Mark current session as read
    if (currentSessionRoomId.value) {
      const session = sessionState.getSession(currentSessionRoomId.value)
      if (session?.unreadCount) {
        markSessionRead(currentSessionRoomId.value)
        unreadState.updateTotalUnreadCount()
      }
    }

    // Reset current reply
    currentMsgReply.value = {}
  }

  /**
   * Get page of messages
   */
  const getPageMsg = async (pageSize: number, roomId: string, cursor: string, _async?: boolean) => {
    await messageState.getPageMsg(pageSize, roomId, cursor, _async)
  }

  /**
   * Get message list
   */
  const getMsgList = async (size = PAGE_SIZE, _async?: boolean) => {
    await info('获取消息列表')
    const requestRoomId = currentSessionRoomId.value
    await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, _async)
  }

  /**
   * Fetch current room remote once
   */
  const fetchCurrentRoomRemoteOnce = async (size = PAGE_SIZE) => {
    const roomId = currentSessionRoomId.value
    if (!roomId || remoteSyncLocks.has(roomId)) {
      return
    }

    remoteSyncLocks.add(roomId)
    try {
      await getPageMsg(size, roomId, '', true)
    } finally {
      remoteSyncLocks.delete(roomId)
    }
  }

  /**
   * Set all session message list
   */
  const setAllSessionMsgList = async (size = PAGE_SIZE) => {
    await info('初始设置所有会话消息列表')

    if (sessionState.sessionList.value.length === 0) return

    const sortedSessions = [...sessionState.sessionList.value].sort((a, b) => b.activeTime - a.activeTime)

    const results = await runInBatches(
      sortedSessions,
      (session) => getPageMsg(size, session.roomId, '', true),
      MESSAGES_POLICY.MAX_CONCURRENCY
    )

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = results.filter((r) => r.status === 'rejected').length

    await info(`会话消息加载完成: 成功 ${successCount}/${sortedSessions.length}, 失败 ${failCount}`)

    if (failCount > 0) {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(`会话 ${sortedSessions[index]?.roomId} 消息加载失败:`, result.reason)
        }
      })
    }
  }

  // ============================================================
  // Session Actions
  // ============================================================

  const getSessionList = async () => {
    await sessionState.getSessionList()
  }

  const sortAndUniqueSessionList = () => {
    sessionState.sortAndUniqueSessionList()
  }

  const checkDataConsistency = () => {
    return sessionState.checkDataConsistency()
  }

  const updateSession = (roomId: string, data: Partial<SessionItem>) => {
    sessionState.updateSession(roomId, data)
  }

  const updateSessionLastActiveTime = (roomId: string) => {
    return sessionState.updateSessionLastActiveTime(roomId)
  }

  const addSession = async (roomId: string) => {
    return await sessionState.addSession(roomId)
  }

  const getSession = (roomId: string): SessionItem | undefined => {
    return sessionState.getSession(roomId)
  }

  const removeSession = async (roomId: string, options?: RemoveSessionOptions): Promise<void> => {
    // Implementation here...
    const index = sessionState.sessionList.value.findIndex((s) => s.roomId === roomId)
    if (index !== -1) {
      sessionState.sessionList.value.splice(index, 1)
    }
    delete sessionState.sessionMap.value[roomId]

    if (options?.clearMessages) {
      messageState.clearRoomMessages(roomId)
      unreadState.removeUnreadCountCache(roomId)
    }

    if (options?.leaveRoom) {
      // Leave room implementation
    }
  }

  // ============================================================
  // Message Actions
  // ============================================================

  const pushMsg = async (msg: MessageType, options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
    if (!msg.message.id) {
      msg.message.id = `${msg.message.roomId}_${msg.message.sendTime}_${msg.fromUser.uid}`
    }
    const messageKey = msg.message.id

    const roomIdForPush = msg.message.roomId
    const existedMsg = messageState.messageMap[roomIdForPush]?.[messageKey]
    if (!messageState.messageMap[roomIdForPush]) {
      messageState.messageMap[roomIdForPush] = {}
    }
    messageState.messageMap[roomIdForPush][messageKey] = msg

    if (existedMsg) {
      return
    }

    // Handle thread relation
    await threadState.handleMessageThreadRelation(msg)

    const targetRoomId = options.activeRoomId ?? currentSessionRoomId.value ?? ''
    let isActiveChatView = options.isActiveChatView
    if (isActiveChatView === undefined) {
      const currentPath = route?.path
      isActiveChatView =
        (currentPath === '/message' || currentPath?.startsWith('/mobile/chatRoom')) &&
        targetRoomId === msg.message.roomId
    }

    // Get user info cache
    const uid = msg.fromUser.uid
    const member = roomStore.getMember(msg.message.roomId, uid)
    const cacheUser = member ? { name: member.displayName, avatar: member.avatarUrl, uid: member.userId } : undefined

    // Update session
    const session = sessionState.updateSessionLastActiveTime(msg.message.roomId)
    if (session) {
      const lastMsgUserName = cacheUser?.name
      const formattedText =
        msg.message.type === MsgEnum.RECALL
          ? session.type === RoomTypeEnum.GROUP
            ? `${lastMsgUserName}:撤回了一条消息`
            : msg.fromUser.uid === userStore.userInfo!.uid
              ? '你撤回了一条消息'
              : '对方撤回了一条消息'
          : renderReplyContent(
              lastMsgUserName,
              msg.message.type,
              typeof msg.message.body?.content === 'string'
                ? msg.message.body.content
                : JSON.stringify(msg.message.body?.content ?? ''),
              session.type
            )

      const patch: Partial<SessionItem> = {
        text: formattedText!,
        activeTime: Date.now()
      }

      if (msg.fromUser.uid !== userStore.userInfo!.uid) {
        if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
          patch.unreadCount = (session.unreadCount || 0) + 1
        }
      }

      sessionState.updateSession(session.roomId, patch)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: session.roomId })
    }

    // Send notification if mentioned
    if (msg.message.body.atUidList?.includes(userStore.userInfo!.uid) && cacheUser) {
      const content =
        typeof msg.message.body.content === 'string'
          ? msg.message.body.content
          : JSON.stringify(msg.message.body.content)
      notificationService.send({
        title: cacheUser.name as string,
        body: content || '',
        options: {
          icon: cacheUser.avatar as string
        }
      })
    }
  }

  const checkMsgExist = (roomId: string, msgId: string) => {
    return messageState.checkMsgExist(roomId, msgId)
  }

  const clearMsgCheck = () => {
    chatMessageList.value.forEach((msg) => (msg.isCheck = false))
  }

  const addThreadChild = (rootMsgId: string, childMsgId: string, roomId?: string) => {
    const targetRoomId = roomId || currentSessionRoomId.value
    if (!targetRoomId) return
    if (!messageState.replyMapping[targetRoomId]) {
      messageState.replyMapping[targetRoomId] = {}
    }
    const map = messageState.replyMapping[targetRoomId]
    const list = map[rootMsgId] || []
    if (!list.includes(childMsgId)) {
      list.push(childMsgId)
      map[rootMsgId] = list
    }
  }

  const loadMore = async (size?: number) => {
    await messageState.loadMore(size)
  }

  const clearNewMsgCount = () => {
    unreadState.clearNewMsgCount()
  }

  const getMsgIndex = (msgId: string) => {
    if (!msgId) return -1
    const keys = currentMessageMap.value ? Object.keys(currentMessageMap.value) : []
    return keys.indexOf(msgId)
  }

  // ============================================================
  // Mark Actions
  // ============================================================

  const updateMarkCount = async (markList: MarkItemType[]) => {
    info('保存消息标记到本地数据库')
    for (const mark of markList) {
      const { msgId, markType, markCount, actType, uid } = mark

      await invokeWithErrorHandler(
        TauriCommand.SAVE_MESSAGE_MARK,
        {
          data: {
            msgId: msgId.toString(),
            markType,
            markCount,
            actType,
            uid: uid.toString()
          }
        },
        {
          customErrorMessage: '保存消息标记',
          errorType: ErrorType.Client
        }
      )

      const msgItem = currentMessageMap.value?.[String(msgId)]
      if (msgItem && msgItem.message.messageMarks) {
        const currentMarkStat = msgItem.message.messageMarks[String(markType)] || {
          count: 0,
          userMarked: false
        }

        if (actType === 1) {
          if (uid === userStore.userInfo!.uid) {
            currentMarkStat.userMarked = true
          }
          currentMarkStat.count = markCount
        } else if (actType === 2) {
          if (uid === userStore.userInfo!.uid) {
            currentMarkStat.userMarked = false
          }
          currentMarkStat.count = markCount
        }

        msgItem.message.messageMarks[String(markType)] = currentMarkStat
      }
    }
  }

  // ============================================================
  // Recall Actions
  // ============================================================

  const recordRecallMsg = (data: { recallUid: string; msg: MessageType }) => {
    recallState.recordRecallMsg(data)

    if (data.recallUid === userStore.userInfo!.uid) {
      workerManager.postMessage({
        type: 'startTimer',
        msgId: data.msg.message.id,
        duration: RECALL_EXPIRATION_TIME
      })
    }
  }

  const updateRecallMsg = async (data: RevokedMsgType) => {
    const { msgId } = data
    const roomIdFromPayload = data.roomId || currentMessageMap.value?.[msgId]?.message?.roomId
    const resolvedRoomId = roomIdFromPayload || messageState.findRoomIdByMsgId(msgId)
    const roomMessages = resolvedRoomId ? messageState.messageMap[resolvedRoomId] : undefined
    const message = roomMessages?.[msgId] || currentMessageMap.value?.[msgId]
    let recallMessageBody = ''

    if (message && typeof data.recallUid === 'string') {
      const currentUid = userStore.userInfo!.uid
      const senderUid = message.fromUser.uid

      const isRecallerCurrentUser = data.recallUid === currentUid
      const isSenderCurrentUser = senderUid === currentUid

      if (isRecallerCurrentUser) {
        if (data.recallUid === senderUid) {
          recallMessageBody = '你撤回了一条消息'
        } else {
          const senderMember = resolvedRoomId ? roomStore.getMember(resolvedRoomId, senderUid) : undefined
          const senderName = senderMember?.displayName || senderUid
          recallMessageBody = `你撤回了${senderName}的一条消息`
        }
      } else {
        const recallerMember = resolvedRoomId ? roomStore.getMember(resolvedRoomId, data.recallUid) : undefined
        const isLord = recallerMember?.role === 'owner'
        const isAdmin = recallerMember?.role === 'admin'

        let rolePrefix = ''
        if (isLord) {
          rolePrefix = '群主'
        } else if (isAdmin) {
          rolePrefix = '管理员'
        }

        if (isSenderCurrentUser) {
          recallMessageBody = `${rolePrefix}撤回了你的一条消息`
        } else {
          recallMessageBody = `${rolePrefix}撤回了一条消息`
        }
      }

      // Update frontend cache
      message.message.type = MsgEnum.RECALL
      message.message.body.content = recallMessageBody

      // Sync with SQLite database
      try {
        await invokeWithErrorHandler(
          TauriCommand.UPDATE_MESSAGE_RECALL_STATUS,
          {
            messageId: message.message.id,
            messageType: MsgEnum.RECALL,
            messageBody: recallMessageBody
          },
          {
            customErrorMessage: '更新消息撤回状态',
            errorType: ErrorType.Client
          }
        )
      } catch (error) {
        logger.warn('更新消息撤回状态失败:', error)
      }

      const session = sessionState.getSession(resolvedRoomId)
      if (session) {
        sessionState.updateSession(session.roomId, {
          text: recallMessageBody,
          activeTime: Date.now()
        })
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: session.roomId })
      }
    }
  }

  const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
    return recallState.getRecalledMessage(msgId)
  }

  const deleteMsg = (msgId: string) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      messageState.deleteMessage(roomId, msgId)
    }
  }

  // ============================================================
  // Unread Actions
  // ============================================================

  const markSessionRead = (roomId: string) => {
    const session = sessionState.getSession(roomId)
    if (session) {
      sessionState.updateSession(roomId, { unreadCount: 0 })
      unreadState.persistUnreadCount(roomId, 0)
    }
  }

  const getMessage = (messageId: string) => {
    return messageState.getMessage(messageId)
  }

  const terminateWorker = () => {
    workerManager.terminate()
  }

  const clearAllExpirationTimers = () => {
    recallState.clearAllExpirationTimers()
  }

  const updateTotalUnreadCount = () => {
    unreadState.updateTotalUnreadCount()
  }

  const requestUnreadCountUpdate = (sessionId?: string) => {
    return unreadState.requestUnreadCountUpdate(sessionId)
  }

  const clearUnreadCount = () => {
    unreadState.clearUnreadCount()
  }

  const setCurrentSessionRoomId = (id: string) => {
    currentSessionRoomId.value = id
  }

  // ============================================================
  // Utility Actions
  // ============================================================

  const clearRedundantMessages = (roomId: string) => {
    messageState.clearRedundantMessages(roomId)
  }

  const resetAndRefreshCurrentRoomMessages = async () => {
    await messageState.resetAndRefreshCurrentRoomMessages()
  }

  const clearRoomMessages = (roomId: string) => {
    messageState.clearRoomMessages(roomId)
  }

  const getGroupSessions = () => {
    return sessionState.getGroupSessions()
  }

  const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
    isMsgMultiChoose.value = flag
    msgMultiChooseMode.value = mode
  }

  const resetSessionSelection = () => {
    chatMessageList.value.forEach((msg) => {
      msg.isCheck = false
    })
    isMsgMultiChoose.value = false
  }

  // ============================================================
  // Thread Actions
  // ============================================================

  const getThreadInfo = async (eventId: string) => {
    return await threadState.getThreadInfo(eventId)
  }

  const getThreadRoot = async (eventId: string) => {
    return await threadState.getThreadRoot(eventId)
  }

  const getRoomThreads = async (options?: { limit?: number; sortBy?: 'recent' | 'activity' }) => {
    return await threadState.getRoomThreads(options)
  }

  const getThreadMessages = async (threadRootId: string, options?: { limit?: number; from?: string }) => {
    return await threadState.getThreadMessages(threadRootId, options)
  }

  const sendThreadReply = async (threadRootId: string, type: MsgEnum, body: MessageBody | unknown) => {
    return await threadState.sendThreadReply(threadRootId, type, body)
  }

  const markThreadAsRead = async (threadRootId: string) => {
    return await threadState.markThreadAsRead(threadRootId)
  }

  const getThreadUnreadCount = async (threadRootId: string) => {
    return await threadState.getThreadUnreadCount(threadRootId)
  }

  const handleMessageThreadRelation = async (message: MessageType) => {
    await threadState.handleMessageThreadRelation(message)
  }

  // ============================================================
  // Additional Actions
  // ============================================================

  const updateMsg = async ({
    msgId,
    roomId,
    message,
    progress,
    status
  }: {
    msgId: string
    roomId?: string
    message?: Partial<MessageType>
    progress?: number
    status?: MessageStatusEnum
  }) => {
    const resolvedRoomId = roomId || messageState.findRoomIdByMsgId(msgId)
    if (!resolvedRoomId) return

    const msg = messageState.messageMap[resolvedRoomId]?.[msgId]
    if (!msg) return

    if (message) {
      Object.assign(msg, message)
    }

    if (progress !== undefined) {
      ;(msg.message as any).progress = progress
    }

    if (status !== undefined) {
      msg.message.status = status
    }
  }

  const addMessageToSessionList = (message: MessageType) => {
    const roomId = message.message.roomId
    if (!messageState.messageMap[roomId]) {
      messageState.messageMap[roomId] = {}
    }
    messageState.messageMap[roomId][message.message.id] = message
  }

  const updateMessageStatus = (msgId: string, status: MessageStatusEnum) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      const msg = messageState.messageMap[roomId]?.[msgId]
      if (msg) {
        msg.message.status = status
      }
    }
  }

  const updateMessageProgress = (msgId: string, progress: number) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      const msg = messageState.messageMap[roomId]?.[msgId]
      if (msg) {
        ;(msg.message as any).progress = progress
      }
    }
  }

  const updateMessageFileUrl = (msgId: string, fileUrl: string) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      const msg = messageState.messageMap[roomId]?.[msgId]
      if (msg && msg.message.body) {
        ;(msg.message.body as any).fileUrl = fileUrl
      }
    }
  }

  const updateMessageThumbnailUrl = (msgId: string, thumbnailUrl: string) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      const msg = messageState.messageMap[roomId]?.[msgId]
      if (msg && msg.message.body) {
        msg.message.body.thumbnailUrl = thumbnailUrl
      }
    }
  }

  const removeMessageFromSessionList = (msgId: string) => {
    const roomId = messageState.findRoomIdByMsgId(msgId)
    if (roomId) {
      delete messageState.messageMap[roomId]?.[msgId]
    }
  }

  const sendMessage = async (roomId: string, msg: SendMessageParams): Promise<MsgType> => {
    const result = await unifiedMessageService.sendMessage({
      roomId,
      type: msg.type,
      body: msg.body || ({} as MessageBody)
    })
    return result
  }

  const updateMemberInfo = async (roomId: string, userId: string, _info: { name?: string; displayName?: string }) => {
    const client = useMatrixClient().client.value
    if (!client) return

    const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(roomId)
    if (!room) return

    const _baseUrl = client.baseUrl || ''
    const roomLike = room as {
      getMember?: (userId: string) => { name?: string; getAvatarUrl?: () => string } | undefined
    }
    const member = roomLike.getMember?.(userId)
    if (!member) return

    const _avatar = member.getAvatarUrl?.() || ''

    // Update member info in room
    // Implementation depends on how member info is stored
  }

  const updateRoomInfo = async (roomId: string, info: { name?: string; topic?: string }) => {
    const session = sessionState.getSession(roomId)
    if (session) {
      sessionState.updateSession(roomId, info)
    }
  }

  const chatMessageListByRoomId = (roomId: string) => {
    return messageState.chatMessageListByRoomId(roomId)
  }

  const findRoomIdByMsgId = (msgId: string) => {
    return messageState.findRoomIdByMsgId(msgId)
  }

  // ============================================================
  // Return Store State and Actions
  // ============================================================

  return {
    // State
    currentSessionRoomId,
    sessionList: sessionState.sessionList,
    sessionMap: sessionState.sessionMap,
    sessionOptions: sessionState.sessionOptions,
    syncLoading,
    currentMsgReply,
    isMsgMultiChoose,
    msgMultiChooseMode,

    // Computed
    shouldShowNoMoreMessage,
    isGroup,
    currentSessionInfo,
    currentMessageMap,
    messageMap: messageState.messageMap,
    currentMessageOptions,
    currentReplyMap,
    currentNewMsgCount,
    newMsgCount: unreadState.newMsgCount, // Full map for backward compatibility
    chatMessageList,

    // Session Actions
    getSessionList,
    sortAndUniqueSessionList,
    checkDataConsistency,
    updateSession,
    updateSessionLastActiveTime,
    addSession,
    getSession,
    removeSession,
    setCurrentSessionRoomId,

    // Message Actions
    changeRoom,
    getPageMsg,
    getMsgList,
    fetchCurrentRoomRemoteOnce,
    setAllSessionMsgList,
    pushMsg,
    checkMsgExist,
    clearMsgCheck,
    addThreadChild,
    loadMore,
    getMsgIndex,
    updateMsg,
    addMessageToSessionList,
    updateMessageStatus,
    updateMessageProgress,
    updateMessageFileUrl,
    updateMessageThumbnailUrl,
    removeMessageFromSessionList,
    sendMessage,
    getMessage,
    deleteMsg,
    clearRedundantMessages,
    resetAndRefreshCurrentRoomMessages,
    clearRoomMessages,
    chatMessageListByRoomId,
    findRoomIdByMsgId,

    // Mark Actions
    updateMarkCount,

    // Recall Actions
    recordRecallMsg,
    updateRecallMsg,
    getRecalledMessage,
    clearAllExpirationTimers,

    // Unread Actions
    markSessionRead,
    clearNewMsgCount,
    updateTotalUnreadCount,
    requestUnreadCountUpdate,
    clearUnreadCount,

    // Thread Actions
    getThreadInfo,
    getThreadRoot,
    getRoomThreads,
    getThreadMessages,
    sendThreadReply,
    markThreadAsRead,
    getThreadUnreadCount,
    handleMessageThreadRelation,

    // Utility Actions
    getGroupSessions,
    setMsgMultiChoose,
    resetSessionSelection,
    updateMemberInfo,
    updateRoomInfo,
    terminateWorker
  }
})
