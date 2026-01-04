/**
 * 聊天Store - 未读数管理模块
 *
 * 负责管理未读消息计数、未读更新等功能
 */

import { logger } from '@/utils/logger'
import { NotificationTypeEnum } from '@/enums'

/** Ref类型 */
type RefLike<T> = { value?: T }

/** 会话未读数Store */
interface SessionUnreadStore {
  setTotalUnread?: (count: number) => void
  currentUserRoomId?: string
  currentSessionRoomId?: string
}

/** 用户Store */
interface UserStore {
  id?: string
}

/** 会话项 */
interface SessionItem {
  id: string
  roomId: string
  unreadCount: number
  muteNotification?: NotificationTypeEnum
  shield?: boolean
  [key: string]: unknown
}

/** 会话更新参数 */
interface SessionUpdate {
  unreadCount?: number
  [key: string]: unknown
}

export interface ChatUnreadComposables {
  // 方法
  updateTotalUnreadCount: () => void
  requestUnreadCountUpdate: (sessionId?: string) => void
  clearUnreadCount: (sessionId?: string) => void
  clearAllUnreadCount: () => void
  getSessionUnreadCount: (sessionId: string) => number
  getTotalUnreadCount: () => number
}

export interface ChatUnreadDeps {
  sessionList?: RefLike<SessionItem[]>
  sessionUnreadStore?: SessionUnreadStore
  userStore?: UserStore
  updateSession?: (sessionId: string, updates: SessionUpdate) => void
}

/**
 * 未读数管理 Composable
 */
export function useChatUnread(deps?: ChatUnreadDeps): ChatUnreadComposables {
  const { sessionList, sessionUnreadStore, updateSession } = deps || {}

  /**
   * 更新总未读数
   */
  const updateTotalUnreadCount = () => {
    try {
      const totalUnread =
        sessionList?.value?.reduce((sum: number, session: SessionItem) => {
          // 不统计免打扰的会话
          if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
            return sum
          }
          // 不统计屏蔽的会话
          if (session.shield) {
            return sum
          }
          return sum + Math.max(0, session.unreadCount || 0)
        }, 0) || 0

      // 更新到 sessionUnreadStore
      if (sessionUnreadStore) {
        sessionUnreadStore.setTotalUnread?.(totalUnread)
      }

      logger.debug('[ChatUnread] 更新总未读数:', totalUnread)
      return totalUnread
    } catch (error) {
      logger.error('[ChatUnread] 更新总未读数失败:', error)
      return 0
    }
  }

  /**
   * 请求未读数更新
   * @param sessionId 可选的会话ID，如果提供则只更新特定会话的未读数
   */
  const requestUnreadCountUpdate = (sessionId?: string) => {
    try {
      if (sessionId) {
        // 触发特定会话的未读数重新计算
        const session = sessionList?.value?.find((s: SessionItem) => s.id === sessionId || s.roomId === sessionId)
        if (session) {
          logger.debug('[ChatUnread] 请求未读数更新:', { sessionId, currentCount: session.unreadCount })
          // 这里可以触发从服务器重新获取未读数的逻辑
        }
      } else {
        // 触发所有会话的未读数重新计算
        logger.debug('[ChatUnread] 请求所有会话未读数更新')
        updateTotalUnreadCount()
      }
    } catch (error) {
      logger.error('[ChatUnread] 请求未读数更新失败:', error)
    }
  }

  /**
   * 清空指定会话的未读数
   * @param sessionId 会话ID，如果不提供则清空当前会话
   */
  const clearUnreadCount = (sessionId?: string) => {
    try {
      if (!sessionId) {
        // 如果没有指定会话，尝试获取当前会话ID
        sessionId = sessionUnreadStore?.currentSessionRoomId || sessionUnreadStore?.currentUserRoomId
      }

      if (!sessionId) {
        logger.warn('[ChatUnread] 清空未读数失败: 没有提供会话ID')
        return
      }

      const session = sessionList?.value?.find((s: SessionItem) => s.id === sessionId || s.roomId === sessionId)
      if (session) {
        // 更新会话未读数为0
        if (updateSession) {
          updateSession(sessionId, { unreadCount: 0 })
        } else {
          session.unreadCount = 0
        }

        logger.debug('[ChatUnread] 清空会话未读数:', { sessionId, previousCount: session.unreadCount })

        // 更新总未读数
        updateTotalUnreadCount()
      }
    } catch (error) {
      logger.error('[ChatUnread] 清空未读数失败:', error)
    }
  }

  /**
   * 清空所有会话的未读数
   */
  const clearAllUnreadCount = () => {
    try {
      const list = sessionList?.value || []
      let clearedCount = 0

      for (const session of list) {
        if (session.unreadCount > 0) {
          if (updateSession) {
            updateSession(session.roomId || session.id, { unreadCount: 0 })
          } else {
            session.unreadCount = 0
          }
          clearedCount++
        }
      }

      logger.info('[ChatUnread] 清空所有未读数:', { totalCleared: clearedCount })

      // 更新总未读数
      updateTotalUnreadCount()
    } catch (error) {
      logger.error('[ChatUnread] 清空所有未读数失败:', error)
    }
  }

  /**
   * 获取指定会话的未读数
   * @param sessionId 会话ID
   * @returns 未读数
   */
  const getSessionUnreadCount = (sessionId: string): number => {
    try {
      const session = sessionList?.value?.find((s: SessionItem) => s.id === sessionId || s.roomId === sessionId)
      return session?.unreadCount || 0
    } catch {
      return 0
    }
  }

  /**
   * 获取总未读数
   * @returns 总未读数
   */
  const getTotalUnreadCount = (): number => {
    try {
      return (
        sessionList?.value?.reduce((sum: number, session: SessionItem) => {
          // 不统计免打扰的会话
          if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
            return sum
          }
          // 不统计屏蔽的会话
          if (session.shield) {
            return sum
          }
          return sum + Math.max(0, session.unreadCount || 0)
        }, 0) || 0
      )
    } catch {
      return 0
    }
  }

  return {
    updateTotalUnreadCount,
    requestUnreadCountUpdate,
    clearUnreadCount,
    clearAllUnreadCount,
    getSessionUnreadCount,
    getTotalUnreadCount
  }
}
