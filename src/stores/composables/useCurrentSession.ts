/**
 * 当前会话相关的状态管理
 * 解决 chat 和 global store 之间的循环依赖
 */

import { computed } from 'vue'
import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'

// 全局存储当前会话相关状态
let currentSessionRoomId: string | null = null
let currentSession: SessionItem | null = null

export const useCurrentSession = () => {
  // 获取当前会话ID
  const getCurrentSessionRoomId = () => currentSessionRoomId

  // 获取当前会话
  const getCurrentSession = () => currentSession

  // 设置当前会话
  const setCurrentSession = (roomId: string | null, session?: SessionItem | null) => {
    currentSessionRoomId = roomId
    currentSession = session || null
  }

  // 判断是否是群聊
  const isGroup = computed(() => currentSession?.type === RoomTypeEnum.GROUP)

  return {
    getCurrentSessionRoomId,
    getCurrentSession,
    setCurrentSession,
    isGroup
  }
}
