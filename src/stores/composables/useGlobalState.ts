/**
 * 全局状态管理
 * 避免循环依赖
 */

import { reactive } from 'vue'
import type { SessionItem } from '@/services/types'

// 全局状态
const globalState = reactive({
  /** 当前会话的房间ID */
  currentSessionRoomId: null as string | null,
  /** 当前会话信息 */
  currentSession: null as SessionItem | null,
  /** 未读消息标记 */
  unReadMark: {
    newFriendUnreadCount: 0,
    newMsgUnreadCount: 0,
    newGroupUnreadCount: 0
  },
  /** 当前阅读未读列表状态 */
  currentReadUnreadList: {
    show: false,
    msgId: null as number | null
  }
})

export const useGlobalState = () => {
  const updateCurrentSessionRoomId = (roomId: string | null) => {
    globalState.currentSessionRoomId = roomId
  }

  const updateCurrentSession = (session: SessionItem | null) => {
    globalState.currentSession = session
  }

  const getCurrentSessionRoomId = () => globalState.currentSessionRoomId
  const getCurrentSession = () => globalState.currentSession
  const getUnReadMark = () => globalState.unReadMark
  const getCurrentReadUnreadList = () => globalState.currentReadUnreadList

  return {
    globalState,
    updateCurrentSessionRoomId,
    updateCurrentSession,
    getCurrentSessionRoomId,
    getCurrentSession,
    getUnReadMark,
    getCurrentReadUnreadList
  }
}
