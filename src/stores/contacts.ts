import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { FriendItem, NoticeItem } from '@/services/types'
import { RequestNoticeAgreeStatus } from '@/services/types'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import FriendsService from '@/services/matrix/FriendsService'
import { unreadCountManager } from '@/utils/UnreadCountManager'

// 定义分页大小常量
export const pageSize = 20
export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()

  /** 联系人列表 */
  const contactsList = ref<FriendItem[]>([])
  /** 好友请求列表 */
  const requestFriendsList = ref<NoticeItem[]>([])

  /** 联系人列表分页选项 */
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  /** 好友请求列表分页选项 */
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })

  /**
   * 获取联系人列表
   * @param isFresh 是否刷新列表，true则重新加载，false则加载更多
   */
  const getContactList = async (isFresh = false) => {
    // 非刷新模式下，如果已经加载完或正在加载中，则直接返回
    if (!isFresh) {
      if (contactsOptions.value.isLast) return
    }
    if (isFresh) {
      contactsOptions.value.cursor = ''
      contactsOptions.value.isLast = false
    }
    contactsOptions.value.isLoading = true
    try {
      const friendsService = FriendsService.getInstance()
      const page = isFresh ? 1 : Math.floor(contactsList.value.length / pageSize) + 1
      const data = await friendsService.getFriends(page, pageSize)

      // Use getFriendsBatch to enrich data if needed, or if getFriends returns partial data
      // Currently getFriends returns full data, but we can use getFriendsBatch to refresh specific fields if we had a list of IDs
      // For now, we rely on getFriends as it's paginated.

      const mappedList: FriendItem[] = data.items.map((f) => ({
        uid: f.userId,
        remark: f.remark || f.displayName || f.userId,
        activeStatus: 1, // TODO: Get real online status
        lastOptTime: f.lastActive ? new Date(f.lastActive).getTime() : Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      }))

      if (isFresh) {
        contactsList.value = mappedList
      } else {
        contactsList.value.push(...mappedList)
      }
      // Update pagination
      contactsOptions.value.isLast = !data.hasMore
    } catch (error) {
      console.error('获取联系人列表失败:', error)
    } finally {
      contactsOptions.value.isLoading = false
    }
  }

  /**
   * 批量刷新好友详情 (使用 getFriendsBatch)
   * @param uids 用户ID列表
   */
  const refreshContactsBatch = async (uids: string[]) => {
    if (!uids.length) return
    try {
      const friendsService = FriendsService.getInstance()
      const details = await friendsService.getFriendsBatch(uids)

      // Update local list
      details.forEach((detail) => {
        const index = contactsList.value.findIndex((c) => c.uid === detail.userId)
        if (index !== -1) {
          const existing = contactsList.value[index]
          contactsList.value[index] = {
            ...existing,
            remark: detail.remark || detail.displayName || detail.userId
            // activeStatus: detail.isOnline ? 1 : 2, // If supported
          }
        }
      })
    } catch (error) {
      console.error('批量刷新好友详情失败:', error)
    }
  }

  /**
   * 获取好友申请未读数
   * 更新全局store中的未读计数
   */
  const getApplyUnReadCount = async () => {
    try {
      const stats = await FriendsService.getInstance().getStatistics()
      // 更新全局store中的未读计数
      globalStore.unReadMark.newFriendUnreadCount = stats.pendingRequests
      // globalStore.unReadMark.newGroupUnreadCount = ... // Group stats not in FriendsService

      unreadCountManager.refreshBadge(globalStore.unReadMark, 0)
    } catch (error) {
      console.error('获取未读数失败', error)
    }
  }

  /**
   * 获取好友申请列表
   * @param isFresh 是否刷新列表，true则重新加载，false则加载更多
   * @param click 是否点击刷新，true则点击清空通知未读，false则仅仅请求通知列表
   */
  const getApplyPage = async (applyType: string, isFresh = false, _click = false) => {
    // 非刷新模式下，如果已经加载完或正在加载中，则直接返回
    if (!isFresh) {
      if (applyPageOptions.value.isLast) return
    }

    // 刷新时重置页码
    if (isFresh) {
      applyPageOptions.value.pageNo = 1
      applyPageOptions.value.cursor = ''
    }

    try {
      if (applyType === 'friend') {
        const requests = await FriendsService.getInstance().getPendingRequests()

        // Map to NoticeItem
        const list: NoticeItem[] = requests.map((req) => ({
          id: req.requestId,
          eventType: 1, // Friend Apply
          type: 2, // Friend
          senderId: req.senderId,
          receiverId: req.receiverId,
          applyId: req.requestId,
          roomId: '', // Friend request doesn't usually have room id yet
          content: req.message || '',
          status: req.status === 'pending' ? 0 : req.status === 'accepted' ? 1 : 2,
          isRead: false,
          createTime: new Date(req.createdAt).getTime()
        }))

        if (isFresh) {
          requestFriendsList.value = list
        } else {
          // Since getPendingRequests returns ALL, we don't push, we just replace.
          // Pagination is not supported by backend yet for pending requests?
          // FriendsService.getPendingRequests returns array.
          requestFriendsList.value = list
        }

        applyPageOptions.value.isLast = true // Assume all fetched
      } else {
        // Group invites logic placeholder
      }
    } catch (error) {
      console.error('获取好友申请列表失败:', error)
    }
  }

  const deleteContact = (uid: string) => {
    contactsList.value = contactsList.value.filter((item) => item.uid !== uid)
  }

  /**
   * 处理好友/群申请
   * @param apply 好友申请信息
   * @param state 处理状态 0拒绝 2同意 3忽略
   */
  const resolveApplyType = (applyType?: 'friend' | 'group', type?: number): 'friend' | 'group' => {
    if (applyType === 'friend' || applyType === 'group') return applyType
    // 后端 type: 1 群聊通知, 2 好友通知
    return type === 2 ? 'friend' : 'group'
  }

  const onHandleInvite = async (apply: {
    applyId: string
    state: number
    roomId?: string
    type?: number
    applyType?: 'friend' | 'group'
    markAsRead?: boolean
  }) => {
    const targetApplyType = resolveApplyType(apply.applyType, apply.type)
    const markAsRead = apply.markAsRead ?? false

    try {
      if (targetApplyType === 'friend') {
        if (apply.state === RequestNoticeAgreeStatus.ACCEPTED) {
          // 2?
          await FriendsService.getInstance().acceptFriendRequest(apply.applyId)
        } else if (apply.state === RequestNoticeAgreeStatus.REJECTED) {
          // 3?
          await FriendsService.getInstance().rejectFriendRequest(apply.applyId)
        }
      } else {
        // Group invite handling
      }

      // 刷新好友申请列表
      await getApplyPage(targetApplyType, true, markAsRead)
      if (markAsRead) {
        targetApplyType === 'friend'
          ? (globalStore.unReadMark.newFriendUnreadCount = 0)
          : (globalStore.unReadMark.newGroupUnreadCount = 0)
        unreadCountManager.refreshBadge(globalStore.unReadMark, 0)
      }
      // 刷新好友列表
      await getContactList(true)
      // 获取最新的未读数
      await getApplyUnReadCount()

      // ... group logic ...
      const isGroupApply =
        apply.state === RequestNoticeAgreeStatus.ACCEPTED &&
        targetApplyType === 'group' &&
        apply.roomId &&
        Number(apply.roomId) > 0

      if (isGroupApply) {
        try {
          await groupStore.addGroupDetail(apply.roomId!)
          await groupStore.getGroupUserList(apply.roomId!, true)
        } catch (error) {
          console.error('刷新群成员信息失败:', error)
        }
      }

      // 更新当前选中联系人的状态
      if (globalStore.currentSelectedContact) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        globalStore.currentSelectedContact.status = RequestNoticeAgreeStatus.ACCEPTED
      }
    } catch (error) {
      console.error('处理好友/群申请失败:', error)
      throw error
    }
  }

  /**
   * 删除好友
   * @param uid 要删除的好友用户ID
   * 处理流程：
   * 1. 调用删除好友接口
   * 2. 刷新好友列表
   */
  const onDeleteFriend = async (uid: string) => {
    if (!uid) return
    // 删除好友
    await FriendsService.getInstance().removeFriend(uid)
    // 刷新好友列表
    await getContactList(true)
  }

  return {
    getContactList,
    getApplyPage,
    getApplyUnReadCount,
    contactsList,
    requestFriendsList,
    contactsOptions,
    applyPageOptions,
    onDeleteFriend,
    onHandleInvite,
    deleteContact,
    refreshContactsBatch
  }
})
