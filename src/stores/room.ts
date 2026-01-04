import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMatrixClient } from '@/composables'
import { createRoomService } from '@/services/roomService'
import type { RoomDetail, RoomMember } from '@/services/types'
import { logger } from '@/utils/logger'
import { ROOM_POWER_LEVELS } from '@/services/types'
import type { MatrixClient } from 'matrix-js-sdk'

export const useRoomStore = defineStore('room', () => {
  // ==================== State ====================
  const rooms = ref<Record<string, RoomDetail>>({})
  const members = ref<Record<string, RoomMember[]>>({})
  const loading = ref<Record<string, boolean>>({})
  const currentRoomId = ref<string | null>(null)

  // ==================== Getters ====================
  const currentRoom = computed(() => {
    return currentRoomId.value ? rooms.value[currentRoomId.value] : null
  })

  const currentMembers = computed(() => {
    return currentRoomId.value ? members.value[currentRoomId.value] : []
  })

  const currentUserRole = computed(() => {
    if (!currentRoom.value) return null
    const level = currentRoom.value.myPowerLevel
    if (level >= ROOM_POWER_LEVELS.OWNER) return 'owner'
    if (level >= ROOM_POWER_LEVELS.ADMIN) return 'admin'
    if (level >= ROOM_POWER_LEVELS.MODERATOR) return 'moderator'
    return 'member'
  })

  // ==================== Actions ====================

  /**
   * 获取 RoomService 实例
   */
  const getService = () => {
    const { client } = useMatrixClient()
    if (!client.value) {
      // 如果客户端未初始化，可能需要抛错或返回null，但在Store action中通常期望已登录
      // 这里我们做一个简单的保护
      return null
    }
    return createRoomService(client.value as unknown as MatrixClient)
  }

  /**
   * 初始化房间数据 (信息 + 成员)
   */
  const initRoom = async (roomId: string) => {
    if (!roomId) return
    currentRoomId.value = roomId

    // 并行加载
    await Promise.all([loadRoomInfo(roomId), loadRoomMembers(roomId)])
  }

  /**
   * 加载房间基本信息
   */
  const loadRoomInfo = async (roomId: string) => {
    const service = getService()
    if (!service) return

    try {
      loading.value[roomId] = true
      const info = await service.getRoomInfo(roomId)

      // 映射 RoomInfo 到 RoomDetail (类型兼容处理)
      rooms.value[roomId] = {
        ...info,
        alias: '', // RoomService 暂时没返回 alias，后续可补
        myDisplayName: '' // 同上
      } as RoomDetail
    } catch (error) {
      logger.error(`[RoomStore] Failed to load room info for ${roomId}`, error)
    } finally {
      loading.value[roomId] = false
    }
  }

  /**
   * 加载房间成员列表
   */
  const loadRoomMembers = async (roomId: string) => {
    const service = getService()
    if (!service) return

    try {
      const list = await service.getRoomMembers(roomId)
      // 映射成员类型
      members.value[roomId] = list.map((m) => ({
        ...m,
        role: getRoleFromPowerLevel(m.powerLevel)
      })) as RoomMember[]
    } catch (error) {
      logger.error(`[RoomStore] Failed to load members for ${roomId}`, error)
    }
  }

  /**
   * 辅助：根据权限等级获取角色字符串
   */
  const getRoleFromPowerLevel = (level: number) => {
    if (level >= ROOM_POWER_LEVELS.OWNER) return 'owner'
    if (level >= ROOM_POWER_LEVELS.ADMIN) return 'admin'
    if (level >= ROOM_POWER_LEVELS.MODERATOR) return 'moderator'
    return 'member'
  }

  /**
   * 设置当前房间ID
   */
  const setCurrentRoomId = (roomId: string | null) => {
    currentRoomId.value = roomId
  }

  /**
   * 清除房间缓存
   */
  const clearRoomCache = (roomId: string) => {
    delete rooms.value[roomId]
    delete members.value[roomId]
  }

  /**
   * 获取指定房间的成员信息
   */
  const getMember = (roomId: string, userId: string): RoomMember | undefined => {
    const list = members.value[roomId]
    if (!list) return undefined
    return list.find((m) => m.userId === userId)
  }

  /**
   * 更新成员缓存
   */
  const updateMember = (roomId: string, userId: string, data: Partial<RoomMember>) => {
    const list = members.value[roomId]
    if (!list) return

    const index = list.findIndex((m) => m.userId === userId)
    if (index !== -1) {
      // 使用解构更新，保持响应式
      const existing = list[index]
      list[index] = { ...existing, ...data } as RoomMember
    }
  }

  /**
   * 获取消息已读回执列表
   * @param roomId 房间ID
   * @param eventId 事件ID
   * @returns 已读用户列表
   */
  const getReadReceipts = (roomId: string, eventId: string) => {
    const { client } = useMatrixClient()
    if (!client.value) {
      logger.warn('[RoomStore] Cannot get read receipts: Matrix client not available')
      return []
    }

    try {
      const matrixClient = client.value as unknown as {
        getRoom?: (roomId: string) => {
          getReceiptsForEvent?: (eventId: string) => Map<string, { data?: { ts?: number } }>
        } | null
      }

      const room = matrixClient.getRoom?.(roomId)
      if (!room) {
        return []
      }

      const receipts = room.getReceiptsForEvent?.(eventId)
      if (!receipts) {
        return []
      }

      // 转换为数组格式
      return Array.from(receipts.entries()).map(([userId, receipt]) => ({
        userId,
        timestamp: receipt.data?.ts || Date.now()
      }))
    } catch (error) {
      logger.error('[RoomStore] Failed to get read receipts:', error)
      return []
    }
  }

  return {
    // State
    rooms,
    members,
    loading,
    currentRoomId,

    // Getters
    currentRoom,
    currentMembers,
    currentUserRole,

    // Actions
    getService,
    initRoom,
    loadRoomInfo,
    loadRoomMembers,
    setCurrentRoomId,
    clearRoomCache,
    getMember,
    updateMember,
    getReadReceipts
  }
})
