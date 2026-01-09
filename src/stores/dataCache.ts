import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TauriCommand } from '@/enums'
import type { CacheUserItem } from '@/services/types'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

// 定义基础用户信息类型，只包含uid、头像和名称
export type BaseUserItem = Pick<CacheUserItem, 'uid' | 'avatar' | 'name' | 'account'>

export const useCachedStore = defineStore('dataCache', () => {
  const userAvatarUpdated = ref(false)

  /**
   * 获取群组公告
   *
   * @deprecated 此 API 已废弃，Matrix 没有直接对应的公告功能。
   * 建议使用 Matrix Room State Events (m.room.topic) 或自定义事件来实现公告功能。
   * @see https://spec.matrix.org/v1.11/client-server-api/#mroomtopic
   *
   * 替代方案：
   * 1. 使用 room topic 作为公告：client.setRoomTopic(roomId, topic)
   * 2. 使用自定义房间事件：client.sendEvent(roomId, 'm.room.custom.announcement', content)
   * 3. 使用 room state events 存储结构化公告数据
   *
   * @roomId 群组ID
   * @param page 页码（废弃）
   * @param size 每页大小（废弃）
   * @returns 群组公告列表
   */
  const getGroupAnnouncementList = async (_roomId: string, _page: number, _size: number) => {
    throw new Error(
      'getGroupAnnouncementList API is deprecated. Please use Matrix Room State Events or room topic instead.'
    )
    // return await requestWithFallback({
    //   url: 'get_announcement_list',
    //   params: { roomId, page, pageSize: size }
    // })
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
