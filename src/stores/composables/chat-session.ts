/**
 * 聊天Store - 会话管理模块
 *
 * 负责管理会话列表、会话状态、会话切换等功能
 */

import { reactive, ref, computed, type Ref, type ComputedRef } from 'vue'
import { orderBy, uniqBy } from 'es-toolkit'
import { logger } from '@/utils/logger'
import type { SessionItem } from '@/services/types'
import { RoomTypeEnum, SessionOperateEnum, NotificationTypeEnum } from '@/enums'
import { IsAllUserEnum } from '@/services/types'

/** 用户 Store 接口 */
export interface UserStoreLike {
  userInfo?: {
    uid?: string
  }
  [key: string]: unknown
}

/** 会话未读数 Store 接口 */
export interface SessionUnreadStoreLike {
  [key: string]: unknown
}

export interface ChatSessionComposables {
  // 状态
  sessionList: Ref<SessionItem[]>
  sessionMap: Ref<Record<string, SessionItem>>
  sessionOptions: { isLast: boolean; isLoading: boolean; cursor: string }
  syncLoading: Ref<boolean>
  currentSessionRoomId: Ref<string>
  currentSessionInfo: ComputedRef<SessionItem | undefined>
  isGroup: ComputedRef<boolean>

  // 方法
  getSessionList: () => Promise<void>
  sortAndUniqueSessionList: () => void
  updateSession: (roomId: string, data: Partial<SessionItem>) => void
  updateSessionLastActiveTime: (roomId: string) => void
  addSession: (roomId: string) => Promise<void>
  getSession: (roomId: string) => SessionItem | undefined
  removeSession: (roomId: string) => void
  setCurrentSessionRoomId: (id: string) => void
  changeRoom: (roomId?: string) => Promise<void>
}

export interface ChatSessionDeps {
  userStore: UserStoreLike
  sessionUnreadStore: SessionUnreadStoreLike
  syncPersistedUnreadCounts: (targetSessions?: SessionItem[]) => void
  persistUnreadCount: (roomId: string, count: number) => void
  removeUnreadCountCache: (roomId: string) => void
}

/**
 * 会话管理 Composable
 */
export function useChatSessions(deps: ChatSessionDeps): ChatSessionComposables {
  const { persistUnreadCount, removeUnreadCountCache } = deps

  // 当前会话的房间ID
  const currentSessionRoomId = ref('')

  // 会话列表
  const sessionList = ref<SessionItem[]>([])
  // 会话列表的快速查找 Map
  const sessionMap = ref<Record<string, SessionItem>>({})
  // 会话列表的加载状态
  const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
  // 消息同步加载状态
  const syncLoading = ref(false)

  /**
   * 获取会话列表
   * 使用 matrixRoomManager 获取房间列表作为会话列表
   */
  const getSessionList = async () => {
    try {
      sessionOptions.isLoading = true

      // 使用 matrixRoomManager 获取房间列表
      const { matrixRoomManager } = await import('@/matrix/services/room/manager')
      const roomIds = await matrixRoomManager.getJoinedRooms()

      // 将房间转换为会话项
      const sessions: SessionItem[] = roomIds.map((roomId) => {
        const roomSummary = matrixRoomManager.getRoomSummary(roomId)
        return {
          account: '', // Matrix 没有账号概念，使用空字符串
          activeTime: Date.now(),
          avatar: roomSummary?.avatar || '',
          id: roomId,
          detailId: roomId, // Matrix 中 roomId 就是 detailId
          hotFlag: IsAllUserEnum.Not, // 默认为 0 (非全员展示)
          name: roomSummary?.name || roomId,
          roomId: roomSummary?.roomId || roomId,
          text: '',
          type: RoomTypeEnum.GROUP, // Matrix 房间默认为群聊类型
          unreadCount: 0,
          top: false,
          operate: 0 as SessionOperateEnum, // 默认操作
          hide: false,
          muteNotification: NotificationTypeEnum.RECEPTION,
          shield: false,
          allowScanEnter: true
        }
      })

      sessionList.value = sessions
      sortAndUniqueSessionList()

      // 同步持久化的未读数
      deps.syncPersistedUnreadCounts(sessions)

      logger.info('[ChatSessions] 获取会话列表成功:', { count: sessions.length })
    } catch (error) {
      logger.error('[ChatSessions] 获取会话列表失败:', error)
    } finally {
      sessionOptions.isLoading = false
    }
  }

  /**
   * 对会话列表进行排序和去重
   */
  const sortAndUniqueSessionList = () => {
    // 去重
    sessionList.value = uniqBy(sessionList.value, (session) => session.roomId)
    // 排序：按最后活跃时间降序
    sessionList.value = orderBy(sessionList.value, [(session) => session.activeTime || 0], ['desc'])
    // 更新Map
    sessionMap.value = sessionList.value.reduce(
      (map, session) => {
        map[session.roomId] = session
        return map
      },
      {} as Record<string, SessionItem>
    )
  }

  /**
   * 更新会话信息
   */
  const updateSession = (roomId: string, data: Partial<SessionItem>) => {
    const session = sessionMap.value[roomId]
    if (session) {
      Object.assign(session, data)
      // 持久化未读数
      if (data.unreadCount !== undefined) {
        persistUnreadCount(roomId, data.unreadCount)
      }
    }
  }

  /**
   * 更新会话最后活跃时间
   */
  const updateSessionLastActiveTime = (roomId: string) => {
    const now = Date.now()
    updateSession(roomId, { activeTime: now })
    // 重新排序
    sortAndUniqueSessionList()
  }

  /**
   * 添加会话
   * 获取房间信息并添加到会话列表
   */
  const addSession = async (roomId: string) => {
    try {
      logger.info('[ChatSessions] 添加会话:', roomId)

      // 检查会话是否已存在
      if (sessionMap.value[roomId]) {
        logger.warn('[ChatSessions] 会话已存在:', roomId)
        return
      }

      // 使用 matrixRoomManager 获取房间信息
      const { matrixRoomManager } = await import('@/matrix/services/room/manager')
      const roomSummary = matrixRoomManager.getRoomSummary(roomId)

      if (!roomSummary) {
        logger.warn('[ChatSessions] 房间不存在:', roomId)
        return
      }

      // 创建新的会话项
      const newSession: SessionItem = {
        account: '', // Matrix 没有账号概念，使用空字符串
        activeTime: Date.now(),
        avatar: roomSummary.avatar || '',
        id: roomSummary.roomId || roomId,
        detailId: roomSummary.roomId || roomId,
        hotFlag: IsAllUserEnum.Not, // 默认为 0 (非全员展示)
        name: roomSummary.name || roomId,
        roomId: roomSummary.roomId || roomId,
        text: '',
        type: RoomTypeEnum.GROUP, // Matrix 房间默认为群聊类型
        unreadCount: 0,
        top: false,
        operate: SessionOperateEnum.DELETE_FRIEND, // 默认操作
        hide: false,
        muteNotification: NotificationTypeEnum.RECEPTION,
        shield: false,
        allowScanEnter: true
      }

      // 添加到会话列表
      sessionList.value.unshift(newSession)
      sortAndUniqueSessionList()

      logger.info('[ChatSessions] 添加会话成功:', { roomId, name: newSession.name })
    } catch (error) {
      logger.error('[ChatSessions] 添加会话失败:', error)
    }
  }

  /**
   * 获取会话信息
   */
  const getSession = (roomId: string): SessionItem | undefined => {
    return sessionMap.value[roomId]
  }

  /**
   * 移除会话
   */
  const removeSession = (roomId: string) => {
    const index = sessionList.value.findIndex((s) => s.roomId === roomId)
    if (index !== -1) {
      sessionList.value.splice(index, 1)
      delete sessionMap.value[roomId]
      removeUnreadCountCache(roomId)
    }
  }

  /**
   * 设置当前会话房间ID
   */
  const setCurrentSessionRoomId = (id: string) => {
    currentSessionRoomId.value = id
  }

  /**
   * 切换房间
   * 切换到指定房间，并确保会话存在
   */
  const changeRoom = async (roomId?: string) => {
    if (roomId) {
      setCurrentSessionRoomId(roomId)

      // 如果会话不存在，尝试添加
      if (!sessionMap.value[roomId]) {
        await addSession(roomId)
      }

      // 更新会话活跃时间
      updateSessionLastActiveTime(roomId)
    }

    logger.info('[ChatSessions] 切换房间:', roomId)
  }

  // 计算属性
  const currentSessionInfo = computed(() => {
    const roomId = currentSessionRoomId.value
    return sessionMap.value[roomId]
  })

  const isGroup = computed(() => currentSessionInfo.value?.type === RoomTypeEnum.GROUP)

  return {
    // 状态
    sessionList,
    sessionMap,
    sessionOptions,
    syncLoading,
    currentSessionRoomId,
    currentSessionInfo,
    isGroup,

    // 方法
    getSessionList,
    sortAndUniqueSessionList,
    updateSession,
    updateSessionLastActiveTime,
    addSession,
    getSession,
    removeSession,
    setCurrentSessionRoomId,
    changeRoom
  }
}
