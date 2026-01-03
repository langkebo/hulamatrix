import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'
import { useCachedStore } from '@/stores/dataCache'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'

/** Announcement item */
interface Announcement {
  id?: string
  content?: string
  top?: boolean
  [key: string]: unknown
}

export const useAnnouncementStore = defineStore(StoresEnum.ANNOUNCEMENT, () => {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()
  const cachedStore = useCachedStore()

  // 公告相关状态
  const announList = ref<Announcement[]>([])
  const announNum = ref(0)
  const announError = ref(false)
  const isAddAnnoun = ref(false)

  const announcementContent = computed(() => (announList.value.length > 0 ? (announList.value[0]?.content ?? '') : ''))

  // 判断当前用户是否有权限添加公告（仅群主和管理员）
  const canAddAnnouncement = computed(() => {
    if (!userStore.userInfo?.uid) return false

    const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
    const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

    return isLord || isAdmin
  })

  /**
   * 清空公告
   */
  const clearAnnouncements = () => {
    announList.value = []
    announNum.value = 0
    announError.value = false
  }

  const formatRecords = (records: Announcement[]) => {
    if (!records || records.length === 0) return []
    const topAnnouncement = records.find((item) => item.top)
    if (!topAnnouncement) return records
    return [topAnnouncement, ...records.filter((item) => !item.top)]
  }

  const loadGroupAnnouncements = async (roomId?: string) => {
    const targetRoomId = roomId ?? globalStore.currentSessionRoomId
    if (!targetRoomId) {
      logger.error('当前会话没有roomId')
      return
    }

    try {
      // 判断是否可以添加公告
      isAddAnnoun.value = canAddAnnouncement.value

      // 获取群公告列表
      const data = await cachedStore.getGroupAnnouncementList(targetRoomId, 1, 10)

      // 会话已切换，避免覆盖其他房间的数据
      if (targetRoomId !== globalStore.currentSessionRoomId) {
        return
      }

      if (data) {
        const dataWithRecords = data as { records?: unknown[]; total?: string | number }
        announList.value = formatRecords((dataWithRecords.records ?? []) as Announcement[])
        announNum.value = parseInt(String(dataWithRecords.total ?? '0'), 10)
        announError.value = false
      } else {
        announList.value = []
        announNum.value = 0
        announError.value = false
      }
    } catch (error) {
      logger.error('加载群公告失败:', error)
      if (targetRoomId === globalStore.currentSessionRoomId) {
        announError.value = true
      }
    }
  }

  return {
    announNum,
    announError,
    isAddAnnoun,
    announcementContent,
    canAddAnnouncement,
    loadGroupAnnouncements,
    clearAnnouncements
  }
})
