import { computed, reactive, ref } from 'vue'
import { logger } from '@/utils/logger'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { orderBy, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { notificationService } from '@/services/notificationService'
import { ErrorType } from '@/common/exception'
import { MessageStatusEnum, MittEnum, MsgEnum, RoomTypeEnum, StoresEnum, TauriCommand } from '@/enums'
import type { MarkItemType, MessageBody, MessageType, MsgType, RevokedMsgType, SessionItem } from '@/services/types'
import { unifiedMessageService } from '@/services/unified-message-service'
import { threadService, type MatrixRoomLike } from '@/services/matrixThreadAdapter'
import { useMatrixClient } from '@/composables'

// 发送消息类型定义
interface SendMessageParams {
  type: MsgEnum
  body?: MessageBody
  roomId?: string
  [key: string]: unknown
}

// Timer Worker 类型定义
interface TimerWorker {
  postMessage: (data: unknown) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

// Matrix SDK 类型定义
interface MatrixMemberLike {
  name: string
  getAvatarUrl?: (
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    animated: boolean
  ) => string | undefined
}

interface MatrixRoomLikeForUpdate {
  getMember?: (userId: string) => MatrixMemberLike | undefined
  [key: string]: unknown
}

interface MatrixClientLikeForUpdate {
  getRoom: (roomId: string) => MatrixRoomLikeForUpdate | null | undefined
  baseUrl?: string
  [key: string]: unknown
}

// 删除会话选项
export interface RemoveSessionOptions {
  /** 是否同时清除该房间的聊天记录 */
  clearMessages?: boolean
  /** 是否调用Matrix leave接口彻底退出房间 */
  leaveRoom?: boolean
}
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { getSessionDetail, runInBatches, MESSAGES_POLICY, sdkPageMessagesWithCursor } from '@/services/messages'
// import { matrixClientService } from '@/integrations/matrix/client'
// import { useMatrixClient } from '@/composables' // 已在顶部导入
import { getSessionListFromMatrix, getSessionFromMatrix } from '@/utils/matrixRoomMapper'
import { flags } from '@/utils/envFlags'
import { renderReplyContent } from '@/utils/RenderReplyContent'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import {
  applyPersistedUnreadCounts,
  persistUnreadCount as persistUnreadCountSvc,
  removeUnreadCountCache as removeUnreadCountCacheSvc,
  requestUnreadUpdate as requestUnreadUpdateSvc,
  setUnreadUpdateCallback
} from '@/services/session'
import { useMitt } from '@/hooks/useMitt'
import { prefetchShallowHistory, tryBackfillWhenNoPagination } from '@/integrations/matrix/history'
import { hiddenSessions } from '@/utils/HiddenSessions'

type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

// 定义每页加载的消息数量
export const pageSize = 20

// 撤回消息的过期时间
const RECALL_EXPIRATION_TIME = 2 * 60 * 1000 // 2分钟，单位毫秒

// // 定义消息数量阈值
// const MESSAGE_THRESHOLD = 120
// // 定义保留的最新消息数量
// const KEEP_MESSAGE_COUNT = 60

// 创建src/workers/timer.worker.ts（在非浏览器/测试环境下提供降级）
const workerSupported = typeof Worker !== 'undefined' && typeof window !== 'undefined'
const timerWorker: TimerWorker = workerSupported
  ? new Worker(new URL('../workers/timer.worker.ts', import.meta.url))
  : {
      postMessage: () => {},
      terminate: () => {},
      onmessage: () => {},
      onerror: () => {}
    }

// 添加错误处理
timerWorker.onerror = (error) => {
  logger.error('[Worker Error]', error)
}

export const useChatStore = defineStore(
  StoresEnum.CHAT,
  () => {
    const route = useRoute()
    const userStore = useUserStore()
    const currentSessionRoomId = ref('')
    const roomStore = useRoomStore()
    const sessionUnreadStore = useSessionUnreadStore()

    // 会话列表
    const sessionList = ref<SessionItem[]>([])
    // 会话列表的快速查找 Map，通过 roomId 进行 O(1) 查找
    const sessionMap = ref<Record<string, SessionItem>>({})
    // 会话列表的加载状态
    const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
    // 消息同步加载状态（用于显示同步中的提示）
    const syncLoading = ref(false)

    // 持久化的未读数同步回内存里的会话对象，确保刷新或切账号后还能看到旧的未读状态
    const syncPersistedUnreadCounts = (targetSessions: SessionItem[] = sessionList.value) => {
      if (!targetSessions.length) return
      applyPersistedUnreadCounts(sessionUnreadStore, userStore.userInfo?.uid, targetSessions)
    }

    // 更新本地缓存里的某个会话未读数
    const persistUnreadCount = (roomId: string, count: number) => {
      if (!roomId) return
      persistUnreadCountSvc(sessionUnreadStore, userStore.userInfo?.uid, roomId, count)
    }

    // 在删除会话或清理数据时同步移除缓存，避免旧数据污染
    const removeUnreadCountCache = (roomId: string) => {
      if (!roomId) return
      removeUnreadCountCacheSvc(sessionUnreadStore, userStore.userInfo?.uid, roomId)
    }

    // 存储所有消息的Record
    const messageMap = reactive<Record<string, Record<string, MessageType>>>({})
    // 消息加载状态
    const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})

    // 回复消息的映射关系
    const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
    // 存储撤回的消息内容和时间
    const recalledMessages = reactive<Record<string, RecalledMessage>>({})
    // 存储每条撤回消息的过期定时器
    const expirationTimers: Record<string, boolean> = {}
    const isMsgMultiChoose = ref<boolean>(false)
    const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')

    // 当前聊天室的消息Map计算属性
    const currentMessageMap = computed(() => {
      return messageMap[currentSessionRoomId.value] || {}
    })

    // 当前聊天室的消息加载状态计算属性
    const currentMessageOptions = computed({
      get: () => {
        const roomId = currentSessionRoomId.value
        const current = messageOptions[roomId]
        if (current === undefined) {
          messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
        }
        return messageOptions[roomId]
      },
      set: (val) => {
        const roomId = currentSessionRoomId.value
        messageOptions[roomId] = val as { isLast: boolean; isLoading: boolean; cursor: string }
      }
    })

    // 当前聊天室的回复消息映射计算属性
    const currentReplyMap = computed({
      get: () => {
        const roomId = currentSessionRoomId.value
        const current = replyMapping[roomId]
        if (current === undefined) {
          replyMapping[roomId] = {}
        }
        return replyMapping[roomId]
      },
      set: (val) => {
        const roomId = currentSessionRoomId.value
        replyMapping[roomId] = val as Record<string, string[]>
      }
    })

    // 判断是否应该显示“没有更多消息”
    const shouldShowNoMoreMessage = computed(() => {
      return currentMessageOptions.value?.isLast
    })

    // 判断当前是否为群聊
    const isGroup = computed(() => currentSessionInfo.value?.type === RoomTypeEnum.GROUP)

    // 获取当前会话信息的计算属性
    const currentSessionInfo = computed(() => {
      const roomId = currentSessionRoomId.value
      if (!roomId) return undefined

      // 直接从 sessionMap 中查找（页面刷新后会自动恢复）
      return sessionMap.value[roomId]
    })

    // 新消息计数相关的响应式数据
    const newMsgCount = reactive<Record<string, { count: number; isStart: boolean }>>({})

    // 当前聊天室的新消息计数计算属性
    const currentNewMsgCount = computed({
      get: () => {
        const roomId = currentSessionRoomId.value
        const current = newMsgCount[roomId]
        if (current === undefined) {
          newMsgCount[roomId] = { count: 0, isStart: false }
        }
        return newMsgCount[roomId]
      },
      set: (val) => {
        const roomId = currentSessionRoomId.value
        newMsgCount[roomId] = val as { count: number; isStart: boolean }
      }
    })

    /**
     * 切换聊天室
     * @description
     * 当用户切换到不同的聊天室时调用此方法，执行完整的房间切换流程。
     * 该方法会清空旧房间的消息数据，重新加载新房间的消息，并处理相关的状态重置。
     */
    const changeRoom = async () => {
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      if (isTauri) {
        const currentWindowLabel = WebviewWindow.getCurrent()
        if (currentWindowLabel.label !== 'home' && currentWindowLabel.label !== 'mobile-home') {
          return
        }
      }

      // 如果 currentSession 不存在，直接返回
      if (!currentSessionRoomId.value) {
        return
      }

      const roomId = currentSessionRoomId.value

      // 1. 清空当前房间的旧消息数据
      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      // 2. 重置消息加载状态
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: ''
      }

      // 3. 清空回复映射
      if (currentReplyMap.value) {
        for (const key in currentReplyMap.value) {
          delete currentReplyMap.value[key]
        }
      }

      try {
        // 从服务器加载消息
        await getPageMsg(pageSize, roomId, '')
        const opts = messageOptions[roomId]
        const isEmpty = !messageMap[roomId] || Object.keys(messageMap[roomId]).length === 0
        if (flags.matrixEnabled && (opts?.isLast || isEmpty)) {
          await tryBackfillWhenNoPagination(roomId, pageSize)
          const desired = Math.ceil(pageSize * 1.5)
          await prefetchShallowHistory(roomId, desired)
        }
      } catch (error) {
        logger.warn('无法加载消息::', { data: error, component: 'chatStore' })
        // 回退：尝试从 Matrix 历史回填，避免空白界面
        try {
          if (flags.matrixEnabled) {
            await tryBackfillWhenNoPagination(roomId, pageSize)
            const desired = Math.ceil(pageSize * 1.2)
            await prefetchShallowHistory(roomId, desired)
          }
        } catch (e) {
          logger.warn('消息回填失败:', e)
        }
        currentMessageOptions.value = {
          isLast: false,
          isLoading: false,
          cursor: ''
        }
      }

      // 标记当前会话已读
      if (currentSessionRoomId.value) {
        const session = sessionMap.value[currentSessionRoomId.value]
        if (session?.unreadCount) {
          markSessionRead(currentSessionRoomId.value)
          updateTotalUnreadCount()
        }
      }

      // 重置当前回复的消息
      currentMsgReply.value = {}
    }

    // 当前消息回复
    const currentMsgReply = ref<Partial<MessageType>>({})

    // 将消息列表转换为数组并计算时间间隔
    const chatMessageList = computed(() => {
      if (!currentMessageMap.value || Object.keys(currentMessageMap.value).length === 0) return []
      return Object.values(currentMessageMap.value).sort(
        (a, b) => (a.sendTime || a.message.sendTime || 0) - (b.sendTime || b.message.sendTime || 0)
      )
    })

    const chatMessageListByRoomId = computed(() => (roomId: string) => {
      if (!messageMap[roomId] || Object.keys(messageMap[roomId]).length === 0) return []
      return Object.values(messageMap[roomId]).sort(
        (a, b) => (a.sendTime || a.message.sendTime || 0) - (b.sendTime || b.message.sendTime || 0)
      )
    })

    const findRoomIdByMsgId = (msgId: string) => {
      if (!msgId) return ''
      for (const roomId of Object.keys(messageMap)) {
        const roomMessages = messageMap[roomId]
        if (roomMessages && msgId in roomMessages) {
          return roomId
        }
      }
      return ''
    }

    /**
     * 登录之后，加载一次所有会话的消息
     * @description
     * 使用受控并发加载（p-limit），避免大量会话时阻塞 UI
     * - 优先加载最近活跃的会话
     * - 限制并发数为 5，平衡性能和服务器压力
     * - 使用 Promise.allSettled 确保部分失败不影响其他会话
     */
    const setAllSessionMsgList = async (size = pageSize) => {
      await info('初始设置所有会话消息列表')

      if (sessionList.value.length === 0) return

      // 按活跃时间排序，优先加载最近的会话
      const sortedSessions = [...sessionList.value].sort((a, b) => b.activeTime - a.activeTime)

      const results = await runInBatches(
        sortedSessions,
        (session) => getPageMsg(size, session.roomId, '', true),
        MESSAGES_POLICY.MAX_CONCURRENCY
      )

      // 统计加载结果
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      await info(`会话消息加载完成: 成功 ${successCount}/${sortedSessions.length}, 失败 ${failCount}`)

      // 记录失败的会话（可选）
      if (failCount > 0) {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const rejectedResult = result as PromiseRejectedResult
            logger.warn(`会话 ${sortedSessions[index]?.roomId} 消息加载失败:`, rejectedResult.reason)
          }
        })
      }
    }

    // 获取消息列表
    const getMsgList = async (size = pageSize, async?: boolean) => {
      await info('获取消息列表')
      // 获取当前房间ID，用于后续比较
      const requestRoomId = currentSessionRoomId.value

      await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, async)
    }

    const getPageMsg = async (pageSize: number, roomId: string, cursor: string = '', _async?: boolean) => {
      try {
        let list: MsgType[] = []
        let nextCursor = ''
        let isLast = false

        // Phase 4 Migration: 使用 Matrix SDK 获取消息 (VITE_MATRIX_ENABLED=on 默认)
        const resp = await sdkPageMessagesWithCursor(roomId, pageSize, cursor, true)
        list = (resp.data as MsgType[]) || []
        nextCursor = resp.nextCursor || ''
        isLast = !resp.hasMore || list.length === 0

        messageOptions[roomId] = {
          isLast,
          isLoading: false,
          cursor: nextCursor
        }

        if (!messageMap[roomId]) {
          messageMap[roomId] = {}
        }

        const bucket = messageMap[roomId] || {}
        for (const m of list) {
          if (m?.id) {
            bucket[m.id] = m as unknown as MessageType
          }
        }
        messageMap[roomId] = bucket
      } catch (e) {
        logger.warn('获取消息列表失败:', e)
        // 保持状态可用，调用方不再抛错
        messageOptions[roomId] = {
          isLast: false,
          isLoading: false,
          cursor: ''
        }
        if (!messageMap[roomId]) messageMap[roomId] = {}
      }
    }

    const remoteSyncLocks = new Set<string>()
    const fetchCurrentRoomRemoteOnce = async (size = pageSize) => {
      const roomId = currentSessionRoomId.value
      if (!roomId) return
      if (remoteSyncLocks.has(roomId)) return
      remoteSyncLocks.add(roomId)
      try {
        const opts = messageOptions[roomId] || { isLast: false, isLoading: false, cursor: '' }
        opts.cursor = ''
        messageOptions[roomId] = opts
        await getPageMsg(size, roomId, '')
      } finally {
        remoteSyncLocks.delete(roomId)
      }
    }

    // 获取会话列表
    // Phase 4 Migration: 使用 Matrix SDK 替代 Tauri WebSocket 命令
    const getSessionList = async () => {
      try {
        if (sessionOptions.isLoading) return
        sessionOptions.isLoading = true

        // 使用 Matrix SDK 获取会话列表 (Phase 4 迁移完成)
        const data = await getSessionListFromMatrix()
        logger.info('[ChatStore] 获取会话列表成功 (Matrix SDK)', {
          count: data.length
        })

        if (!data) {
          const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
          if (!isTauri && sessionList.value.length === 0) {
            const now = Date.now()
            const fallback: SessionItem = {
              account: '',
              activeTime: now,
              avatar: '/avatar/001.webp',
              id: 'local_room',
              detailId: 'local_peer',
              hotFlag: 0, // IsAllUserEnum.NOT
              name: '本地测试',
              roomId: 'local_room',
              text: '欢迎使用HuLa',
              type: RoomTypeEnum.SINGLE,
              unreadCount: 0,
              top: false,
              operate: 0, // SessionOperateEnum.DELETE_FRIEND
              hide: false,
              muteNotification: 0, // NotificationTypeEnum.RECEPTION
              shield: false,
              allowScanEnter: true
            }
            sessionList.value = [fallback]
            sessionMap.value[fallback.roomId] = fallback
            sortAndUniqueSessionList()
            updateTotalUnreadCount()
          }
          return
        }

        // logger.debug(
        //   '[SessionDebug] 后端返回的会话列表:',
        //   data.map((item: SessionItem) => ({
        //     roomId: item.roomId,
        //     unreadCount: item.unreadCount,
        //     name: item.name
        //   }))
        // )

        sessionList.value = [...data]
        syncPersistedUnreadCounts()
        sessionOptions.isLoading = false

        // 同步更新 sessionMap
        for (const session of sessionList.value) {
          sessionMap.value[session.roomId] = session
        }

        sortAndUniqueSessionList()

        // 获取会话列表后，更新全局未读计数以确保同步
        updateTotalUnreadCount()
      } catch (e) {
        logger.error('获取会话列表失败11:', e)
        sessionOptions.isLoading = false
      } finally {
        sessionOptions.isLoading = false
      }
    }

    /** 会话列表去重并排序（置顶优先，其次按活跃时间降序） */
    const sortAndUniqueSessionList = () => {
      // 使用 uniqBy 按 roomId 去重
      const base = sessionList.value.filter((s) => s && s.roomId && !hiddenSessions.isHidden(s.roomId))
      const unique = uniqBy(base, (item) => item.roomId)
      // 置顶优先，其次按活跃时间降序
      const uniqueAndSorted = orderBy(unique, [(item) => !!item.top, (item) => item.activeTime], ['desc', 'desc'])
      sessionList.value.splice(0, sessionList.value.length, ...uniqueAndSorted)
    }

    // 更新会话
    const updateSession = (roomId: string, data: Partial<SessionItem>) => {
      const session = sessionMap.value[roomId]
      if (session) {
        const updatedSession = { ...session, ...data }

        // 同步更新 sessionList - 使用 splice 确保响应式更新
        const index = sessionList.value.findIndex((s) => s.roomId === roomId)
        if (index !== -1) {
          sessionList.value.splice(index, 1, updatedSession)
        }

        // 同步更新 sessionMap
        sessionMap.value[roomId] = updatedSession

        if ('unreadCount' in data && typeof updatedSession.unreadCount === 'number') {
          persistUnreadCount(roomId, updatedSession.unreadCount)
          requestUnreadCountUpdate(roomId)
        }

        // 如果更新了免打扰状态，需要重新计算全局未读数
        if ('muteNotification' in data) {
          requestUnreadCountUpdate()
        }
        // 如果更新了置顶状态，重新排序
        if ('top' in data) {
          sortAndUniqueSessionList()
        }
      }
    }

    // 更新会话最后活跃时间, 只要更新的过程中会话不存在，那么将会话刷新出来
    const updateSessionLastActiveTime = (roomId: string) => {
      // O(1) 查找
      const session = sessionMap.value[roomId]
      if (session) {
        Object.assign(session, { activeTime: Date.now() })
      } else {
        addSession(roomId)
      }
      return session
    }

    const addSession = async (roomId: string) => {
      // Phase 4 Migration: 优先使用 Matrix SDK 获取会话
      let resp: SessionItem | null = null
      try {
        resp = await getSessionFromMatrix(roomId)
      } catch (matrixError) {
        logger.warn('[ChatStore] Matrix SDK 获取会话失败，回退到 Tauri 命令:', matrixError)
      }

      // 如果 Matrix SDK 失败，回退到 Tauri 命令
      if (!resp) {
        resp = (await getSessionDetail({ id: roomId })) as SessionItem
      }

      if (!resp) {
        logger.warn('[ChatStore] 无法获取会话:', { roomId })
        return
      }

      syncPersistedUnreadCounts([resp])
      sessionList.value.unshift(resp)
      // 同步更新 sessionMap
      sessionMap.value[roomId] = resp
      sortAndUniqueSessionList()
    }

    // 通过房间ID获取会话信息
    const getSession = (roomId: string) => {
      if (!roomId) {
        return sessionList.value[0]
      }

      // O(1) 查找（页面刷新后自动从持久化恢复）
      return sessionMap.value[roomId]
    }

    // 推送消息
    const pushMsg = async (msg: MessageType, options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
      if (!msg.message.id) {
        msg.message.id = `${msg.message.roomId}_${msg.message.sendTime}_${msg.fromUser.uid}`
      }
      const messageKey = msg.message.id

      const roomIdForPush = msg.message.roomId
      const existedMsg = messageMap[roomIdForPush]?.[messageKey]
      if (!messageMap[roomIdForPush]) messageMap[roomIdForPush] = {}
      messageMap[roomIdForPush][messageKey] = msg

      if (existedMsg) {
        return
      }

      // 处理消息的线程关系
      await handleMessageThreadRelation(msg)

      const targetRoomId = options.activeRoomId ?? currentSessionRoomId.value ?? ''
      let isActiveChatView = options.isActiveChatView
      if (isActiveChatView === undefined) {
        const currentPath = route?.path
        isActiveChatView =
          (currentPath === '/message' || currentPath?.startsWith('/mobile/chatRoom')) &&
          targetRoomId === msg.message.roomId
      }

      // 获取用户信息缓存
      const uid = msg.fromUser.uid
      const member = roomStore.getMember(msg.message.roomId, uid)
      const cacheUser = member ? { name: member.displayName, avatar: member.avatarUrl, uid: member.userId } : undefined

      // 更新会话的文本属性和未读数
      const session = updateSessionLastActiveTime(msg.message.roomId)
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

        // 构建更新补丁，确保 activeTime 和 text 都被更新
        const patch: Partial<SessionItem> = {
          text: formattedText!,
          activeTime: Date.now() // 确保活跃时间被更新
        }

        if (msg.fromUser.uid !== userStore.userInfo!.uid) {
          if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
            patch.unreadCount = (session.unreadCount || 0) + 1
          }
        }

        // 更新会话信息
        updateSession(session.roomId, patch)

        // 清除该会话的消息缓存，强制重新计算显示文本
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: session.roomId })
      }

      // 如果收到的消息里面是艾特自己的就发送系统通知
      if (msg.message.body.atUidList?.includes(userStore.userInfo!.uid) && cacheUser) {
        const content =
          typeof msg.message.body.content === 'string'
            ? msg.message.body.content
            : JSON.stringify(msg.message.body.content)
        // 使用统一通知服务
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
      const current = messageMap[roomId]
      return current && msgId in current
    }

    const clearMsgCheck = () => {
      chatMessageList.value.forEach((msg) => (msg.isCheck = false))
    }

    const addThreadChild = (rootMsgId: string, childMsgId: string, roomId?: string) => {
      const targetRoomId = roomId || currentSessionRoomId.value
      if (!targetRoomId) return
      if (!replyMapping[targetRoomId]) replyMapping[targetRoomId] = {}
      const map = replyMapping[targetRoomId]
      const list = map[rootMsgId] || []
      if (!list.includes(childMsgId)) {
        list.push(childMsgId)
        map[rootMsgId] = list
      }
    }

    // 过滤掉拉黑用户的发言
    // const filterUser = (uid: string) => {
    //   for (const roomId in messageMap) {
    //     const messages = messageMap[roomId]
    //     for (const msgId in messages) {
    //       const msg = messages[msgId]
    //       if (msg.fromUser.uid === uid) {
    //         delete messages[msgId]
    //       }
    //     }
    //   }
    // }

    // 加载更多消息
    const loadMore = async (size?: number) => {
      if (currentMessageOptions.value?.isLast) return
      await getMsgList(size, true)
    }

    /** 清除新消息计数 */
    const clearNewMsgCount = () => {
      currentNewMsgCount.value && (currentNewMsgCount.value.count = 0)
    }

    // 查找消息在列表里面的索引
    const getMsgIndex = (msgId: string) => {
      if (!msgId) return -1
      const keys = currentMessageMap.value ? Object.keys(currentMessageMap.value) : []
      return keys.indexOf(msgId)
    }

    // 更新所有标记类型的数量
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
          // 获取当前的标记状态，如果不存在则初始化
          const currentMarkStat = msgItem.message.messageMarks[String(markType)] || {
            count: 0,
            userMarked: false
          }

          // 根据动作类型更新计数和用户标记状态
          // actType: 1表示确认(添加标记)，2表示取消(移除标记)
          if (actType === 1) {
            // 添加标记
            // 如果是当前用户的操作，设置userMarked为true
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = true
            }
            // 更新计数
            currentMarkStat.count = markCount
          } else if (actType === 2) {
            // 取消标记
            // 如果是当前用户的操作，设置userMarked为false
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = false
            }
            // 更新计数
            currentMarkStat.count = markCount
          }

          // 更新messageMark对象
          msgItem.message.messageMarks[String(markType)] = currentMarkStat
        }
      }
    }

    const recordRecallMsg = (data: { recallUid: string; msg: MessageType }) => {
      // 存储撤回的消息内容和时间
      const recallTime = Date.now()
      const content =
        typeof data.msg.message.body.content === 'string'
          ? data.msg.message.body.content
          : JSON.stringify(data.msg.message.body.content ?? '')
      recalledMessages[data.msg.message.id] = {
        messageId: data.msg.message.id,
        content,
        recallTime,
        originalType: data.msg.message.type
      }

      if (data.recallUid === userStore.userInfo!.uid) {
        // 使用 Worker 来处理定时器
        timerWorker.postMessage({
          type: 'startTimer',
          msgId: data.msg.message.id,
          duration: RECALL_EXPIRATION_TIME
        })
      }

      // 记录这个消息ID已经有了定时器
      expirationTimers[data.msg.message.id] = true
    }

    // 更新消息撤回状态
    const updateRecallMsg = async (data: RevokedMsgType) => {
      const { msgId } = data
      const roomIdFromPayload = data.roomId || currentMessageMap.value?.[msgId]?.message?.roomId
      const resolvedRoomId = roomIdFromPayload || findRoomIdByMsgId(msgId)
      const roomMessages = resolvedRoomId ? messageMap[resolvedRoomId] : undefined
      const message = roomMessages?.[msgId] || currentMessageMap.value?.[msgId]
      let recallMessageBody = ''

      if (message && typeof data.recallUid === 'string') {
        const currentUid = userStore.userInfo!.uid
        // 被撤回消息的原始发送人
        const senderUid = message.fromUser.uid

        const isRecallerCurrentUser = data.recallUid === currentUid
        const isSenderCurrentUser = senderUid === currentUid

        if (isRecallerCurrentUser) {
          // 当前用户是撤回操作执行者
          if (data.recallUid === senderUid) {
            // 自己的视角
            recallMessageBody = '你撤回了一条消息'
          } else {
            // 撤回他人的消息：群主/管理员视角
            const senderMember = resolvedRoomId ? roomStore.getMember(resolvedRoomId, senderUid) : undefined
            const senderName = senderMember?.displayName || senderUid
            recallMessageBody = `你撤回了${senderName}的一条消息`
          }
        } else {
          // 当前用户不是撤回操作执行者
          const recallerMember = resolvedRoomId ? roomStore.getMember(resolvedRoomId, data.recallUid) : undefined
          const isLord = recallerMember?.role === 'owner'
          const isAdmin = recallerMember?.role === 'admin'

          // 构建角色前缀
          let rolePrefix = ''
          if (isLord) {
            rolePrefix = '群主'
          } else if (isAdmin) {
            rolePrefix = '管理员'
          }
          // 普通成员不显示角色前缀
          if (isSenderCurrentUser) {
            // 当前用户是被撤回消息的发送者（被撤回者视角）
            recallMessageBody = `${rolePrefix}撤回了你的一条消息`
          } else {
            // 当前用户是旁观者（其他成员视角）
            recallMessageBody = `${rolePrefix}撤回了一条消息`
          }
        }

        // 更新前端缓存
        message.message.type = MsgEnum.RECALL
        message.message.body.content = recallMessageBody

        // 同步更新 SQLite 数据库
        try {
          await invokeWithErrorHandler(
            TauriCommand.UPDATE_MESSAGE_RECALL_STATUS,
            {
              messageId: message.message.id,
              messageType: MsgEnum.RECALL,
              messageBody: recallMessageBody
            },
            {
              customErrorMessage: '更新撤回消息状态失败',
              errorType: ErrorType.Client
            }
          )
          info(`[RECALL] Successfully updated message recall status in database, message_id: ${msgId}`)
        } catch (error) {
          logger.error(`[RECALL] Failed to update message recall status in database:`, error)
        }
      }

      if (resolvedRoomId) {
        const session = sessionMap.value[resolvedRoomId]
        if (session && recallMessageBody) {
          session.text = recallMessageBody
        }
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: resolvedRoomId })
      }

      // 更新与这条撤回消息有关的消息
      const messageList = currentReplyMap.value?.[msgId]
      if (messageList) {
        for (const id of messageList) {
          const msg = currentMessageMap.value?.[id]
          if (msg && msg.message.body.reply) {
            msg.message.body.reply.body = { content: '原消息已被撤回' } as MessageBody
          }
        }
      }
    }

    // 获取撤回消息
    const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
      return recalledMessages[msgId]
    }

    // 删除消息
    const deleteMsg = (msgId: string) => {
      if (currentMessageMap.value && msgId in currentMessageMap.value) {
        delete currentMessageMap.value[msgId]
      }
    }

    const clearRoomMessages = (roomId: string) => {
      if (!roomId) return

      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      if (replyMapping[roomId]) {
        replyMapping[roomId] = {}
      }

      const defaultOptions = {
        isLast: true,
        isLoading: false,
        cursor: ''
      }

      if (currentSessionRoomId.value === roomId) {
        currentMessageOptions.value = defaultOptions
        currentReplyMap.value = {}
        currentMsgReply.value = {}
      } else {
        messageOptions[roomId] = defaultOptions
      }

      newMsgCount[roomId] = { count: 0, isStart: false }
    }

    // 更新消息
    const updateMsg = ({
      msgId,
      status,
      newMsgId,
      body,
      uploadProgress,
      timeBlock
    }: {
      msgId: string
      status: MessageStatusEnum
      newMsgId?: string
      body?: MessageBody
      uploadProgress?: number
      timeBlock?: number
    }) => {
      const msg = currentMessageMap.value?.[msgId]
      if (msg) {
        msg.message.status = status
        // 只在 timeBlock 有值时才更新，避免覆盖原有值
        if (timeBlock !== undefined) {
          msg.timeBlock = timeBlock
        }
        if (newMsgId) {
          msg.message.id = newMsgId
        }
        if (body) {
          msg.message.body = body
        }
        if (uploadProgress !== undefined) {
          // 确保响应式更新，创建新的消息对象
          const updatedMsg = { ...msg, uploadProgress }
          if (currentMessageMap.value) {
            currentMessageMap.value[msg.message.id] = updatedMsg
          }
          // 强制触发响应式更新
          messageMap[currentSessionRoomId.value] = { ...currentMessageMap.value }
        } else {
          if (currentMessageMap.value) {
            currentMessageMap.value[msg.message.id] = msg
          }
        }
        if (newMsgId && msgId !== newMsgId && currentMessageMap.value) {
          delete currentMessageMap.value[msgId]
        }
      }
    }

    // 标记已读数为 0
    const markSessionRead = (roomId: string) => {
      // O(1) 查找
      const session = sessionMap.value[roomId]
      if (session) {
        // 更新会话的未读数
        session.unreadCount = 0
        persistUnreadCount(roomId, 0)

        // 重新计算全局未读数，使用 chatStore 中的方法以保持一致性
        updateTotalUnreadCount()
      }
    }

    // 根据消息id获取消息体
    const getMessage = (messageId: string) => {
      return currentMessageMap.value?.[messageId]
    }

    /**
     * 删除会话
     * @param roomId 房间ID
     * @param options 选项，包含leaveRoom标志
     * @description
     * 当 leaveRoom=true 时，会调用Matrix leave接口彻底退出房间，
     * 并将房间加入隐藏列表防止重新激活。
     */
    const removeSession = async (roomId: string, options?: RemoveSessionOptions): Promise<void> => {
      const { clearMessages: shouldClearMessages = false, leaveRoom: shouldLeaveRoom = false } = options || {}
      const session = sessionMap.value[roomId]
      if (session) {
        // 如果是彻底删除/退出，调用 Matrix API
        if (shouldLeaveRoom) {
          const { client } = useMatrixClient()
          if (client.value) {
            try {
              const leaveMethod = client.value.leave as ((roomId: string) => Promise<unknown>) | undefined
              await leaveMethod?.(roomId)
              logger.info(`Successfully left room: ${roomId}`)
            } catch (error: unknown) {
              logger.error('Failed to leave room:', error)
              // 即使leave失败，仍然继续本地删除操作
            }
          }
        }

        // 将房间加入隐藏列表，防止重新激活
        hiddenSessions.add(roomId)

        // 从数组中删除
        const index = sessionList.value.findIndex((s) => s.roomId === roomId)
        if (index !== -1) {
          sessionList.value.splice(index, 1)
        }

        // 从 map 中删除
        delete sessionMap.value[roomId]

        if (currentSessionRoomId.value === roomId) {
          const nextId = sessionList.value[0]?.roomId || ''
          setCurrentSessionRoomId(nextId)
        }

        // 删除会话后更新未读计数
        requestUnreadCountUpdate()
      }
      removeUnreadCountCache(roomId)

      // 如果需要，同时清除该房间的聊天记录
      if (shouldClearMessages) {
        clearRoomMessages(roomId)
      }
    }

    // 监听 Worker 消息
    timerWorker.onmessage = (e: MessageEvent<unknown>) => {
      const data = e.data as { type: string; msgId: string }
      const { type, msgId } = data

      if (type === 'timeout') {
        delete recalledMessages[msgId]
        delete expirationTimers[msgId]
      } else if (type === 'allTimersCompleted') {
        // 所有定时器都完成了，可以安全地清理资源
        clearAllExpirationTimers()
        terminateWorker()
      }
    }

    // 终止 worker
    const terminateWorker = () => {
      timerWorker.terminate()
    }

    // 清理所有定时器
    const clearAllExpirationTimers = () => {
      for (const msgId in expirationTimers) {
        // 通知 worker 停止对应的定时器
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId
        })
      }
      for (const msgId in expirationTimers) {
        delete expirationTimers[msgId]
      }
    }

    // 更新未读消息计数
    const updateTotalUnreadCount = () => {
      useMitt.emit(MittEnum.UPDATE_MSG_TOTAL)
    }

    // 设置计数管理器的更新回调
    setUnreadUpdateCallback(() => {
      useMitt.emit(MittEnum.UPDATE_MSG_TOTAL)
    })

    // 使用防抖机制的更新函数
    const requestUnreadCountUpdate = (sessionId?: string) => {
      requestUnreadUpdateSvc(sessionId)
    }

    // 清空所有会话的未读数
    const clearUnreadCount = () => {
      sessionList.value.forEach((session) => {
        session.unreadCount = 0
        persistUnreadCount(session.roomId, 0)
      })
      // 更新全局未读数
      requestUnreadCountUpdate()
    }

    const setCurrentSessionRoomId = (id: string) => {
      currentSessionRoomId.value = id || ''
    }

    const clearRedundantMessages = (roomId: string) => {
      const currentMessages = messageMap[roomId]
      if (!currentMessages) return

      // 将消息转换为数组并按消息ID倒序排序，前面的元素代表最新的消息
      const sortedMessages = Object.values(currentMessages).sort((a, b) => Number(b.message.id) - Number(a.message.id))

      if (sortedMessages.length <= pageSize) {
        return
      }

      const keptMessages = sortedMessages.slice(0, pageSize)
      const keepMessageIds = new Set(keptMessages.map((msg) => msg.message.id))
      const fallbackCursor = keptMessages[keptMessages.length - 1]?.message.id || ''

      // 删除多余的消息
      for (const msgId in currentMessages) {
        if (!keepMessageIds.has(msgId)) {
          delete currentMessages[msgId]
        }
      }

      if (!messageOptions[roomId]) {
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }

      // 更新游标为当前内存里最旧的那条消息ID，确保后续「加载更多」能从数据库补齐更早的消息
      if (fallbackCursor) {
        messageOptions[roomId] = {
          ...messageOptions[roomId],
          cursor: fallbackCursor,
          isLast: false
        }
      }
    }

    /**
     * 重置并刷新当前聊天室的消息列表
     * @description
     * 清空当前聊天室的所有本地消息缓存，并从服务器重新获取最新的消息列表。
     * 主要用于需要强制刷新消息的场景，确保显示的是最新的服务器数据。
     */
    const resetAndRefreshCurrentRoomMessages = async () => {
      if (!currentSessionRoomId.value) return

      // 保存当前房间ID，用于后续比较
      const requestRoomId = currentSessionRoomId.value

      try {
        // 1. 清空消息数据 避免竞态条件
        if (messageMap[requestRoomId]) {
          messageMap[requestRoomId] = {}
        }

        // 2. 重置消息加载状态，强制cursor为空以获取最新消息
        messageOptions[requestRoomId] = {
          isLast: false,
          isLoading: true,
          cursor: ''
        }

        // 3. 清空回复映射
        const currentReplyMapping = replyMapping[requestRoomId]
        if (currentReplyMapping) {
          for (const key in currentReplyMapping) {
            delete currentReplyMapping[key]
          }
        }

        // 4. 直接调用getPageMsg获取最新消息，强制使用空cursor
        await getPageMsg(pageSize, requestRoomId, '')
      } catch (error) {
        logger.error('[Network] 重置并刷新消息列表失败::', { data: error, component: 'chatStore' })
        // 如果获取失败，确保重置加载状态
        if (currentSessionRoomId.value === requestRoomId) {
          messageOptions[requestRoomId] = {
            isLast: false,
            isLoading: false,
            cursor: ''
          }
        }
      }
    }

    // 获取所有群组类型的会话
    const getGroupSessions = () => {
      return sessionList.value.filter((session) => session.type === RoomTypeEnum.GROUP)
    }

    const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
      isMsgMultiChoose.value = flag
      msgMultiChooseMode.value = flag ? mode : 'normal'
    }

    // 重置所有会话选择状态
    const resetSessionSelection = () => {
      sessionList.value.forEach((session) => {
        session.isCheck = false
      })
    }

    // 添加消息到会话列表
    const addMessageToSessionList = (message: MessageType) => {
      if (!message || !message.message || !message.message.roomId) {
        logger.warn('添加消息到会话列表失败: 消息格式不正确', message)
        return
      }

      const roomId = message.message.roomId

      // 如果该房间的消息映射不存在，则创建
      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      // 添加消息到映射
      messageMap[roomId][message.message.id] = message
      logger.debug('消息已添加到会话列表:', { id: message.message.id, roomId })
    }

    // 更新消息状态
    const updateMessageStatus = (msgId: string, status: MessageStatusEnum) => {
      // 使用现有的 updateMsg 函数来更新消息状态
      updateMsg({
        msgId,
        status
      })
    }

    // 更新消息进度
    const updateMessageProgress = (msgId: string, progress: number) => {
      // 使用现有的 updateMsg 函数来更新消息进度
      const msg = currentMessageMap.value?.[msgId]
      if (msg) {
        updateMsg({
          msgId,
          status: msg.message.status as MessageStatusEnum,
          uploadProgress: progress
        })
      }
    }

    // 更新消息文件URL
    const updateMessageFileUrl = (msgId: string, fileUrl: string) => {
      // 使用现有的 updateMsg 函数来更新消息文件URL
      const msg = currentMessageMap.value?.[msgId]
      if (msg) {
        updateMsg({
          msgId,
          status: msg.message.status as MessageStatusEnum,
          body: {
            ...msg.message.body,
            url: fileUrl
          }
        })
      }
    }

    // 更新消息缩略图URL
    const updateMessageThumbnailUrl = (msgId: string, thumbnailUrl: string) => {
      // 使用现有的 updateMsg 函数来更新消息缩略图URL
      const msg = currentMessageMap.value?.[msgId]
      if (msg) {
        const bodyWithInfo = msg.message.body as Record<string, unknown>
        updateMsg({
          msgId,
          status: msg.message.status as MessageStatusEnum,
          body: {
            ...msg.message.body,
            info: {
              ...((bodyWithInfo.info as Record<string, unknown>) || {}),
              thumbnail_url: thumbnailUrl
            }
          }
        })
      }
    }

    // 从会话列表中移除消息
    const removeMessageFromSessionList = (msgId: string) => {
      // 从当前消息映射中移除消息
      if (currentMessageMap.value?.[msgId]) {
        delete currentMessageMap.value[msgId]
        // 强制触发响应式更新
        messageMap[currentSessionRoomId.value] = { ...currentMessageMap.value }
      }
    }

    // 发送消息 - 使用统一消息服务
    const sendMessage = async (roomId: string, msg: SendMessageParams): Promise<MsgType> => {
      try {
        logger.info('[ChatStore] 使用统一消息服务发送消息', { roomId, msg })

        // 使用统一消息服务，它会自动选择最优的路由策略
        const result = await unifiedMessageService.sendMessage({
          roomId,
          type: msg.type,
          body: msg.body || {}
          // 可以通过环境变量或用户设置来强制使用特定路由
          // forceRoute: 'matrix' // 强制使用Matrix
          // forceRoute: 'websocket' // 强制使用WebSocket
          // forceRoute: 'hybrid' // 强制使用混合模式
        })

        logger.info('[ChatStore] 消息发送成功', {
          roomId,
          msgId: result.id,
          msgType: msg.type
        })

        return result
      } catch (error) {
        logger.error('[ChatStore] 消息发送失败:', {
          roomId,
          error: error instanceof Error ? error.message : String(error),
          msgType: msg.type
        })
        throw error
      }
    }

    // ==================== Thread相关方法 ====================

    /**
     * 获取消息的线程信息
     */
    const getThreadInfo = async (eventId: string) => {
      const { client } = useMatrixClient()
      if (!client.value || !currentSessionRoomId.value) return null

      const getRoomMethod = client.value.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(currentSessionRoomId.value)
      if (!room) return null

      return threadService.getThreadRelation(eventId, room as unknown as MatrixRoomLike)
    }

    /**
     * 获取线程根消息
     */
    const getThreadRoot = async (eventId: string) => {
      if (!currentSessionRoomId.value) return null
      return threadService.getThreadRoot(eventId, currentSessionRoomId.value)
    }

    /**
     * 获取房间的所有线程
     */
    const getRoomThreads = async (options?: { limit?: number; sortBy?: 'recent' | 'activity' }) => {
      if (!currentSessionRoomId.value) return []
      return threadService.getRoomThreads(currentSessionRoomId.value, options)
    }

    /**
     * 获取线程中的消息
     */
    const getThreadMessages = async (
      threadRootId: string,
      options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
    ) => {
      if (!currentSessionRoomId.value) return []
      return threadService.getThreadMessages(threadRootId, currentSessionRoomId.value, options)
    }

    /**
     * 发送线程回复
     */
    const sendThreadReply = async (threadRootId: string, type: MsgEnum, body: MessageBody | unknown) => {
      if (!currentSessionRoomId.value) throw new Error('没有选择当前会话')

      const result = await threadService.sendThreadReply(
        threadRootId,
        currentSessionRoomId.value,
        type,
        body as Record<string, unknown> | { text?: string; content?: string; formattedBody?: string }
      )

      // 刷新线程缓存
      threadService.invalidateThreadCache(currentSessionRoomId.value, threadRootId)

      return result
    }

    /**
     * 标记线程为已读
     */
    const markThreadAsRead = async (threadRootId: string) => {
      if (!currentSessionRoomId.value) return
      await threadService.markThreadAsRead(threadRootId, currentSessionRoomId.value)
    }

    /**
     * 获取线程未读数
     */
    const getThreadUnreadCount = async (threadRootId: string) => {
      if (!currentSessionRoomId.value) return 0
      return threadService.getThreadUnreadCount(threadRootId, currentSessionRoomId.value, userStore.userInfo?.uid)
    }

    /**
     * 处理消息的线程关系
     */
    const handleMessageThreadRelation = async (message: MessageType) => {
      if (!currentSessionRoomId.value || !message.message.id) return

      const { client } = useMatrixClient()
      if (!client.value) return

      const getRoomMethod = client.value.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(currentSessionRoomId.value)
      if (!room) return

      const threadRelation = threadService.getThreadRelation(message.message.id, room as unknown as MatrixRoomLike)

      if (threadRelation) {
        // 如果是线程消息，更新回复映射
        if (!threadRelation.isRoot && threadRelation.rootEventId) {
          addThreadChild(threadRelation.rootEventId, message.message.id, currentSessionRoomId.value)
        }

        // 更新消息体的线程信息
        const bodyWithThreadInfo = message.message.body as Record<string, unknown>
        bodyWithThreadInfo.threadInfo = {
          rootEventId: threadRelation.rootEventId,
          threadId: threadRelation.threadId,
          isRoot: threadRelation.isRoot,
          participant: threadRelation.participant
        }
      }
    }

    /**
     * 更新成员信息
     */
    const updateMemberInfo = async (roomId: string, userId: string, info: { name?: string; displayName?: string }) => {
      const { client } = useMatrixClient()
      if (!client.value) return

      const getRoomMethod = client.value.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return

      const roomLike = room as unknown as MatrixRoomLikeForUpdate
      const clientLike = client as unknown as MatrixClientLikeForUpdate
      const member = roomLike.getMember?.(userId)
      if (member) {
        const baseUrl = clientLike.baseUrl || ''
        const avatar = member.getAvatarUrl?.(baseUrl, 64, 64, 'crop', true, true) || ''
        roomStore.updateMember(roomId, userId, {
          displayName: info.name || member.name,
          avatarUrl: avatar
        })
      }
    }

    /**
     * 更新房间信息
     */
    const updateRoomInfo = async (roomId: string, info: { name?: string; topic?: string }) => {
      const session = sessionMap.value[roomId]
      if (session) {
        const patch: Partial<SessionItem> & { topic?: string } = {}
        if (info.name && info.name !== session.name) {
          patch.name = info.name
        }
        if (info.topic !== undefined) {
          // 可以将topic存储在自定义字段中
          patch.topic = info.topic
        }
        if (Object.keys(patch).length > 0) {
          updateSession(roomId, patch)
        }
      }
    }

    return {
      getMsgIndex,
      chatMessageList,
      pushMsg,
      deleteMsg,
      clearRoomMessages,
      clearNewMsgCount,
      updateMarkCount,
      updateRecallMsg,
      recordRecallMsg,
      updateMsg,
      newMsgCount,
      messageMap,
      currentMessageMap,
      currentMessageOptions,
      currentReplyMap,
      currentNewMsgCount,
      loadMore,
      currentMsgReply,
      sessionList,
      sessionMap,
      sessionOptions,
      syncLoading,
      getSessionList,
      updateSession,
      updateSessionLastActiveTime,
      markSessionRead,
      getSession,
      isGroup,
      currentSessionInfo,
      getMessage,
      getRecalledMessage,
      recalledMessages,
      clearAllExpirationTimers,
      updateTotalUnreadCount,
      requestUnreadCountUpdate,
      clearUnreadCount,
      resetAndRefreshCurrentRoomMessages,
      fetchCurrentRoomRemoteOnce,
      getGroupSessions,
      removeSession,
      changeRoom,
      addSession,
      setAllSessionMsgList,
      chatMessageListByRoomId,
      shouldShowNoMoreMessage,
      isMsgMultiChoose,
      clearMsgCheck,
      addThreadChild,
      setMsgMultiChoose,
      msgMultiChooseMode,
      resetSessionSelection,
      checkMsgExist,
      clearRedundantMessages,
      currentSessionRoomId,
      setCurrentSessionRoomId,
      addMessageToSessionList,
      updateMessageStatus,
      updateMessageProgress,
      updateMessageFileUrl,
      updateMessageThumbnailUrl,
      removeMessageFromSessionList,
      sendMessage,
      // Thread相关方法
      getThreadInfo,
      getThreadRoot,
      getRoomThreads,
      getThreadMessages,
      sendThreadReply,
      markThreadAsRead,
      getThreadUnreadCount,
      handleMessageThreadRelation,
      updateMemberInfo,
      updateRoomInfo
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
