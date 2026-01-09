/**
 * 房间统计信息 Composable
 * 提供房间成员数量、在线数量等统计信息
 */

import { computed, ref, watch } from 'vue'
import type { MatrixClient } from 'matrix-js-sdk'
import { useGroupStore } from '@/stores/group'
import { useGlobalStore } from '@/stores/global'
import { GroupToRoomAdapter, createGroupToRoomAdapter } from '@/adapters/group-to-room-adapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Type definitions for count info
interface CountInfo {
  memberNum?: number
  onlineNum?: number
  [key: string]: unknown
}

export interface RoomStats {
  totalMembers: number
  onlineMembers: number
  adminCount: number
  moderatorCount: number
  memberCount: number
  guestCount: number
}

export function useRoomStats(roomId?: string) {
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()
  const flags = { matrixEnabled: true }
  const badRoomIds = new Set<string>()

  const stats = ref<RoomStats>({
    totalMembers: 0,
    onlineMembers: 0,
    adminCount: 0,
    moderatorCount: 0,
    memberCount: 0,
    guestCount: 0
  })

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const adapter = ref<GroupToRoomAdapter | null>(null)

  // 当前房间ID
  const currentRoomId = computed(() => {
    return roomId || globalStore.currentSessionRoomId || ''
  })

  // 初始化适配器
  const initializeAdapter = () => {
    try {
      const client = matrixClientService.getClient() as unknown as MatrixClient | null
      if (client && !adapter.value) {
        adapter.value = createGroupToRoomAdapter(client)
      }
    } catch {}
  }

  // 获取房间统计信息
  const fetchRoomStats = async (targetRoomId?: string) => {
    const rid = targetRoomId || currentRoomId.value
    if (!rid) return
    if (badRoomIds.has(rid)) return

    isLoading.value = true
    error.value = null

    try {
      // 优先使用适配器（Matrix 房间）
      if (adapter.value ) {
        const roomStats = await adapter.value.getGroupStats(rid)
        const total = roomStats.totalNum || 0
        if (total === 0) {
          badRoomIds.add(rid)
          // 回退到群组存储（WebSocket）
          const countInfo = groupStore.countInfo as CountInfo | undefined
          if (countInfo) {
            stats.value = {
              totalMembers: countInfo.memberNum || 0,
              onlineMembers: countInfo.onlineNum || 0,
              adminCount: 0,
              moderatorCount: 0,
              memberCount: countInfo.memberNum || 0,
              guestCount: 0
            }
          } else {
            stats.value = {
              totalMembers: 0,
              onlineMembers: 0,
              adminCount: 0,
              moderatorCount: 0,
              memberCount: 0,
              guestCount: 0
            }
          }
        } else {
          stats.value = {
            totalMembers: total,
            onlineMembers: roomStats.onlineNum || 0,
            adminCount: 0,
            moderatorCount: 0,
            memberCount: roomStats.memberCount || 0,
            guestCount: 0
          }
        }
      } else {
        // 回退到群组存储（WebSocket）
        const countInfo = groupStore.countInfo as CountInfo | undefined
        if (countInfo) {
          stats.value = {
            totalMembers: countInfo.memberNum || 0,
            onlineMembers: countInfo.onlineNum || 0,
            adminCount: 0,
            moderatorCount: 0,
            memberCount: countInfo.memberNum || 0,
            guestCount: 0
          }
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err.message
      logger.error('获取房间统计信息失败:', err)
    } finally {
      isLoading.value = false
    }
  }

  // 监听房间变化
  watch(
    () => currentRoomId.value,
    () => {
      initializeAdapter()
      if (currentRoomId.value) {
        fetchRoomStats()
      }
    },
    { immediate: true }
  )

  // 监听群成员变化（WebSocket 模式）
  watch(
    () => [groupStore.memberList, groupStore.countInfo],
    () => {
      if (currentRoomId.value) {
        fetchRoomStats()
      }
    }
  )

  // 格式化的统计信息
  const formattedStats = computed(() => ({
    memberCount: stats.value.totalMembers,
    onlineCount: stats.value.onlineMembers,
    adminCount: stats.value.adminCount,
    hasData: stats.value.totalMembers > 0,
    isLoading: isLoading.value,
    error: error.value
  }))

  return {
    stats,
    formattedStats,
    isLoading,
    error,
    fetchRoomStats,
    initializeAdapter
  }
}
