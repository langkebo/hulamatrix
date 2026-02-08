import { defineStore } from 'pinia'
import { StoresEnum, TauriCommand } from '@/enums'
import type { CacheBadgeItem, CacheUserItem } from '@/services/types'
import { getBadgeList } from '@/utils/ImRequestUtils'
import { invokeSilently } from '@/utils/TauriInvokeHandler.ts'

// 定义基础用户信息类型，只包含uid、头像和名称
export type BaseUserItem = Pick<CacheUserItem, 'uid' | 'avatar' | 'name' | 'account'>

export const useCachedStore = defineStore(StoresEnum.CACHED, () => {
  const badgeList = ref<CacheBadgeItem[]>([])

  const badgeById = computed(() => (id?: string) => {
    return badgeList.value.find((badge) => badge.itemId === id)
  })

  const getAllBadgeList = async () => {
    await getBadgeList()
      .then((data) => {
        badgeList.value = data
      })
      .catch((e) => {
        console.error('获取徽章列表失败', e)
        window.$message.error('获取徽章列表失败')
      })
  }

  const userAvatarUpdated = ref(false)

  const updateMyRoomInfo = async (data: any) => {
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

  const getGroupAnnouncementList = async (roomId: string, pageNum: number, pageSize: number) => {
    console.log('[CachedStore] getGroupAnnouncementList called:', { roomId, pageNum, pageSize })
    return { records: [], total: '0' }
  }

  return {
    badgeById,
    badgeList,
    userAvatarUpdated,
    updateMyRoomInfo,
    syncRoomMembersToLocal,
    getAllBadgeList,
    getGroupAnnouncementList
  }
})
