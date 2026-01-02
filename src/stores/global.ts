import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { reactive, computed, ref, watch } from 'vue'
import { MittEnum, StoresEnum } from '@/enums'
import type { FriendItem, RequestFriendItem, SessionItem } from '@/services/types'
import { clearQueue, readCountQueue } from '@/utils/ReadCountQueue'
import { useChatStore } from '@/stores/chat'
import { useMitt } from '@/hooks/useMitt'
import { calculateGlobalUnread, setUnreadUpdateCallback } from '@/services/session'
import { sdkMarkRoomRead } from '@/services/messages'
import { useTimerManager } from '@/composables/useTimerManager'
import { logger } from '@/utils/logger'

export const useGlobalStore = defineStore(
  StoresEnum.GLOBAL,
  () => {
    const chatStore = useChatStore()

    // 未读消息标记：好友请求未读数和新消息未读数
    const unReadMark = reactive<{
      newFriendUnreadCount: number
      newMsgUnreadCount: number
      newGroupUnreadCount: number
    }>({
      newFriendUnreadCount: 0,
      newGroupUnreadCount: 0,
      newMsgUnreadCount: 0
    })

    // 当前阅读未读列表状态
    const currentReadUnreadList = reactive<{ show: boolean; msgId: number | null }>({
      show: false,
      msgId: null
    })

    const currentSessionRoomId = ref('')
    const lastKnownSession = ref<SessionItem | null>(null)
    // 当前会话信息：包含房间ID和房间类型
    const currentSession = computed((): SessionItem | null => {
      const cachedRoomId = currentSessionRoomId.value
      if (!cachedRoomId) {
        lastKnownSession.value = null
        return null
      }

      let session: SessionItem | undefined = chatStore.getSession(cachedRoomId)
      if (!session) {
        session = chatStore.sessionList.find((item: SessionItem) => item.roomId === cachedRoomId)
      }
      if (session) {
        lastKnownSession.value = session
        return session
      }

      return lastKnownSession.value && lastKnownSession.value.roomId === cachedRoomId ? lastKnownSession.value : null
    })

    /** 当前选中的联系人信息 */
    const currentSelectedContact = ref<FriendItem | RequestFriendItem>()

    // 添加好友模态框信息 TODO: 虚拟列表添加好友有时候会不展示对应的用户信息
    const addFriendModalInfo = ref<{ show: boolean; uid?: string }>({
      show: false
    })

    // 添加群聊模态框信息
    const addGroupModalInfo = ref<{ show: boolean; name?: string; avatar?: string; account?: string }>({
      show: false,
      name: '',
      avatar: '',
      account: ''
    })

    // 创建群聊模态框信息
    const createGroupModalInfo = reactive<{
      show: boolean
      isInvite: boolean // 是否为邀请模式
      selectedUid: number[] // 选中的用户ID列表
    }>({
      show: false,
      isInvite: false,
      selectedUid: []
    })

    /** 提示框显示状态 */
    const tipVisible = ref<boolean>(false)
    /** 系统托盘菜单显示的状态 */
    const isTrayMenuShow = ref<boolean>(false)

    // 设置提示框显示状态
    const setTipVisible = (visible: boolean) => {
      tipVisible.value = visible
    }

    // 更新全局未读消息计数
    const updateGlobalUnreadCount = () => {
      info('[global]更新全局未读消息计数')
      calculateGlobalUnread(chatStore.sessionList, unReadMark)
    }

    setUnreadUpdateCallback(updateGlobalUnreadCount)
    useMitt.on(MittEnum.UPDATE_MSG_TOTAL, updateGlobalUnreadCount)

    // 监听当前会话变化，添加防重复触发逻辑
    watch(currentSessionRoomId, async (val, oldVal) => {
      if (!val || val === oldVal) {
        return
      }

      try {
        await chatStore.changeRoom()
      } catch (error) {
        logger.error('[global] 切换会话时加载消息失败:', error)
        return
      }

      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      if (isTauri) {
        const webviewWindowLabel = WebviewWindow.getCurrent()
        if (webviewWindowLabel.label !== 'home' && webviewWindowLabel.label !== '/mobile/message') {
          useMitt.emit(MittEnum.SESSION_CHANGED, {
            roomId: val,
            oldRoomId: oldVal ?? null
          })
          return
        }
      }

      const session = chatStore.getSession(val)
      if (session?.unreadCount) {
        info(`[global]当前会话发生实际变化: ${oldVal} -> ${val}`)
        // 清理已读数查询队列
        clearQueue()
        // 延攱1秒后开始查询已读数
        useTimerManager().setTimer(readCountQueue, 1000)
        sdkMarkRoomRead(val)
        chatStore.markSessionRead(val)
      }

      useMitt.emit(MittEnum.SESSION_CHANGED, {
        roomId: val,
        oldRoomId: oldVal ?? null
      })
    })

    const updateCurrentSessionRoomId = (id: string) => {
      currentSessionRoomId.value = id
      chatStore.setCurrentSessionRoomId(id)
    }

    // 更新最后发送时间
    const updateLastSendTime = () => {
      // 这里可以添加实际的最后发送时间更新逻辑
      // 例如：更新本地存储的最后发送时间戳
      const currentTime = Date.now()
      logger.debug('更新最后发送时间:', currentTime)

      // 可以在这里添加更多的逻辑，比如限制发送频率等
      // 目前先作为一个空实现，保持接口兼容性
    }

    return {
      unReadMark,
      currentSession,
      addFriendModalInfo,
      addGroupModalInfo,
      currentSelectedContact,
      currentReadUnreadList,
      createGroupModalInfo,
      tipVisible,
      isTrayMenuShow,
      setTipVisible,
      updateGlobalUnreadCount,
      updateCurrentSessionRoomId,
      currentSessionRoomId,
      updateLastSendTime
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
