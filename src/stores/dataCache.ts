import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TauriCommand } from '@/enums'
import type { CacheUserItem } from '@/services/types'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

// 定义基础用户信息类型，只包含uid、头像和名称
export type BaseUserItem = Pick<CacheUserItem, 'uid' | 'avatar' | 'name' | 'account'>

export const useCachedStore = defineStore('dataCache', () => {
  const userAvatarUpdated = ref(false)

  /**
   * 获取群组公告
   * @roomId 群组ID
   * @reload 是否强制重新加载
   * @returns 群组公告列表
   */
  const getGroupAnnouncementList = async (roomId: string, page: number, size: number) => {
    return await requestWithFallback({
      url: 'get_announcement_list',
      params: { roomId, page, pageSize: size }
    })
  }

  const updateMyRoomInfo = async (data: Record<string, unknown>) => {
    const result = await invokeSilently(TauriCommand.UPDATE_MY_ROOM_INFO, {
      myRoomInfo: data
    })
    return result !== null
  }

  const syncRoomMembersToLocal = async (roomId: string) => {
    const result = await invokeSilently(TauriCommand.GET_ROOM_MEMBERS, {
      room_id: roomId,
      roomId
    })
    return result !== null
  }

  return {
    userAvatarUpdated,
    getGroupAnnouncementList,
    updateMyRoomInfo,
    syncRoomMembersToLocal
  }
})
