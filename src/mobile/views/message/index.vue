<template>
  <div class="flex flex-col h-full mobile-page-bg">
    <img :src="bgImage" class="w-100% fixed top-0" alt="hula" />

    <!-- 页面蒙板 (用于添加按钮下拉菜单) -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @mouseup="maskHandler.close"
      class="fixed inset-0 z-[999] bg-black/20 backdrop-blur-sm transition-all duration-3000 ease-in-out opacity-100"></div>

    <NavBar>
      <template #left>
        <n-flex @click="toSimpleBio" align="center" :size="6" class="w-full">
          <n-avatar
            :size="38"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ? userStore.userInfo.avatar : '/logoD.png')"
            fallback-src="/logo.png"
            round />

          <n-flex vertical justify="center" :size="6">
            <p
              style="
                font-weight: bold !important;
                font-family:
                  system-ui,
                  -apple-system,
                  sans-serif;
              "
              class="text-(16px [--text-color])">
              {{ userStore.userInfo?.name ? userStore.userInfo.name : '无名字' }}
            </p>
            <p class="text-(10px [--text-color])">
              {{
                userStore.userInfo?.uid ? groupStore.getUserInfo(userStore.userInfo!.uid)?.locPlace || '中国' : '中国'
              }}
            </p>
          </n-flex>
        </n-flex>
      </template>

      <template #right>
        <n-dropdown
          @on-clickoutside="addIconHandler.clickOutside"
          @select="addIconHandler.select"
          trigger="click"
          :show-arrow="true"
          :options="uiViewsData.addOptions">
          <svg @click="addIconHandler.open" class="size-22px bg-white p-5px rounded-8px">
            <use href="#plus"></use>
          </svg>
        </n-dropdown>
      </template>
    </NavBar>

    <div class="px-16px mt-5px">
      <div class="py-5px shrink-0">
        <n-input
          id="search"
          class="rounded-6px w-full bg-white relative text-12px"
          :maxlength="20"
          clearable
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="搜索"
          @focus="lockScroll"
          @blur="unlockScroll"
          @input="handleSearchInput">
          <template #prefix>
            <svg class="w-12px h-12px">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </div>
      <div class="mt-8px flex items-center gap-10px">
        <n-button size="small" secondary @click="joinPublicRoom">进入公共大厅</n-button>
      </div>
      <div class="border-b-1 border-solid color-gray-200 px-18px mt-5px"></div>
    </div>

    <!-- 统一的会话列表组件 (移动端) -->
    <div class="flex-1 relative">
      <ChatList
        :sessions="sessionList"
        :current-room-id="globalStore.currentSessionRoomId"
        :show-search="false"
        :loading="loading"
        @click="intoRoom" />
    </div>

    <IncomingCallSheet />
  </div>
</template>

<script setup lang="ts">
import { logger } from '@/utils/logger'
import { computed, onMounted, ref, h } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '#/layout/navBar/index.vue'
import ChatList from '@/components/common/ChatList.vue'
import addFriendIcon from '@/assets/mobile/chat-home/add-friend.webp'
import groupChatIcon from '@/assets/mobile/chat-home/group-chat.webp'
import bgImage from '@/assets/mobile/chat-home/background.webp'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import {} from '@/hooks/useMessage'
import { useReplaceMsg } from '@/hooks/useReplaceMsg'
import { IsAllUserEnum, type SessionItem, type UserItem } from '@/services/types'
// WebSocket 已废弃，使用 Matrix SDK
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { useFriendsStore } from '@/stores/friendsSDK'
import IncomingCallSheet from '@/mobile/components/IncomingCallSheet.vue'
import { matrixClientService } from '@/integrations/matrix/client'
import type { Room } from 'matrix-js-sdk'
import { PUBLIC_ROOM_ALIASES, PUBLIC_ROOM_ALIAS } from '@/config/matrix-config'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { msg } from '@/utils/SafeUI'

const loading = ref(false)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const friendsStore = useFriendsStore()

const allUserMap = computed(() => {
  const map = new Map<string, UserItem>()
  groupStore.allUserInfo.forEach((user) => {
    map.set(user.uid, user)
  })
  return map
})

// 会话列表
const sessionList = computed(() => {
  return (
    chatStore.sessionList
      .map((item) => {
        // 获取最新的头像
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.id) {
          latestAvatar = groupStore.getUserInfo(item.id)?.avatar || item.avatar
        }

        // 获取群聊备注名称（如果有）
        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          // 使用群组备注（如果存在）
          displayName = item.remark
        }

        const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
        // 获取该会话的所有消息用于检查@我
        const messages = chatStore.chatMessageListByRoomId(item.roomId)
        // 检查是否有@我的消息
        const isAtMe = checkRoomAtMe(
          item.roomId,
          item.type,
          globalStore.currentSessionRoomId!,
          messages,
          item.unreadCount
        )

        // 处理显示消息
        let displayMsg = ''

        const lastMsg = messages[messages.length - 1]
        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)
        }

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName, // 使用可能修改过的显示名称
          lastMsg: displayMsg || '欢迎使用HuLa',
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe
        }
      })
      // 添加排序逻辑：先按置顶状态排序，再按活跃时间排序
      .sort((a, b) => {
        // 1. 先按置顶状态排序（置顶的排在前面）
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 2. 在相同置顶状态下，按最后活跃时间降序排序（最新的排在前面）
        return b.activeTime - a.activeTime
      })
  )
})

onMounted(async () => {
  await friendsStore.refreshAll()
  // WebSocket 已废弃，使用 Matrix SDK 同步消息
})

/**
 * 渲染图片图标的函数工厂
 * @param {string} src - 图标图片路径
 * @returns {() => import('vue').VNode} 返回一个渲染图片的函数组件
 */
const renderImgIcon = (src: string) => {
  return () =>
    h('img', {
      src,
      style: 'display:block; width: 26px; height: 26px; vertical-align: middle;'
    })
}

/**
 * UI 视图数据，包含菜单选项及其图标
 * @type {import('vue').Ref<{ addOptions: { label: string; key: string; icon: () => import('vue').VNode }[] }>}
 */
const uiViewsData = ref({
  addOptions: [
    {
      label: '私密聊天',
      key: '/mobile/private-chat',
      icon: () =>
        h('svg', { class: 'size-22px', style: 'display:block; width: 26px; height: 26px; vertical-align: middle;' }, [
          h('use', { href: '#lock' })
        ])
    },
    {
      label: '发起群聊',
      key: '/mobile/mobileFriends/startGroupChat',
      icon: renderImgIcon(groupChatIcon)
    },
    {
      label: '加好友/群',
      key: '/mobile/mobileFriends/addFriends',
      icon: renderImgIcon(addFriendIcon)
    }
  ]
})

// 页面蒙板相关处理（开始）

/**
 * 页面蒙板显示状态
 * @type {import('vue').Ref<boolean>}
 */
const showMask = ref(false)

/**
 * 当前页面滚动的纵向位置，避免打开蒙板时页面跳动
 * @type {number}
 */
let scrollY = 0

/**
 * 控制页面蒙板的对象，包含打开和关闭方法
 */
const maskHandler = {
  /**
   * 打开蒙板，并锁定滚动位置
   */
  open: () => {
    scrollY = window.scrollY
    showMask.value = true
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
  },

  /**
   * 关闭蒙板，恢复滚动状态和位置
   */
  close: () => {
    const closeModal = () => {
      showMask.value = false
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY) // 恢复滚动位置
    }

    setTimeout(closeModal, 60)
  }
}

// 页面蒙板相关处理（结束）

/**
 * 添加按钮相关事件处理对象
 */
const addIconHandler = {
  /**
   * 选项选择时关闭蒙板
   */
  select: (item: string) => {
    logger.debug('选择的项：:', { data: item, component: 'index' })
    router.push(item)
    maskHandler.close()
  },

  /**
   * 点击加号按钮打开蒙板
   */
  open: () => {
    maskHandler.open()
  },

  /**
   * 点击下拉菜单外部区域关闭蒙板
   */
  clickOutside: () => {
    maskHandler.close()
  }
}

const router = useRouter()
const handleMsgClick = (item: SessionItem) => {
  globalStore.updateCurrentSessionRoomId(item.roomId)
}
const handleMsgDelete = async (roomId: string) => {
  // 删除会话，同时清除聊天记录，并调用Matrix leave接口
  await chatStore.removeSession(roomId, { clearMessages: true, leaveRoom: true })
}

// Handle search input from the search box
const handleSearchInput = (value: string) => {
  // Search is now handled internally by ChatList component
  logger.debug('[MobileMessageList] Search input:', { value })
}

const intoRoom = (item: SessionItem) => {
  // ChatList handles long-press internally, so we don't need to check longPressState here
  handleMsgClick(item)
  const foundedUser = allUserMap.value.get(item.detailId)

  setTimeout(() => {
    // 如果找到用户，就表示该会话属于好友，那就传入好友的uid;同时排除id为1的hula小管家
    if (foundedUser && foundedUser.uid !== '1') {
      router.push({
        name: 'mobileChatMain',
        params: {
          uid: item.detailId
        }
      })
    } else {
      router.push({
        name: 'mobileChatMain'
      })
    }
  }, 0)
}
const toSimpleBio = () => {
  // 切成你想要的离场动画
  router.push('/mobile/mobileMy/simpleBio')
}

// 锁滚动（和蒙板一样）
const lockScroll = () => {
  logger.debug('锁定触发:', { component: 'index' })
  const scrollEl = document.querySelector('.flex-1.overflow-auto') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'hidden'
  }
}

const unlockScroll = () => {
  logger.debug('锁定解除:', { component: 'index' })
  const scrollEl = document.querySelector('.flex-1.overflow-auto') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'auto'
  }
}

const joinPublicRoom = async () => {
  try {
    let client = matrixClientService.getClient()
    if (!client) {
      const { store } = useMatrixAuth()
      if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
      const base = store.getHomeserverBaseUrl() || ''
      await matrixClientService.initialize({ baseUrl: base, accessToken: store.accessToken, userId: store.userId })
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      client = matrixClientService.getClient()
    }
    if (!client) {
      msg.error?.('Matrix client initialization failed')
      return
    }
    const aliases = PUBLIC_ROOM_ALIASES.length ? PUBLIC_ROOM_ALIASES : [PUBLIC_ROOM_ALIAS]
    for (const a of aliases) {
      try {
        const joinRoomMethod = client.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
        if (joinRoomMethod) await joinRoomMethod(a)
        break
      } catch {}
    }
    const getRoomsMethod = client.getRooms as (() => Room[]) | undefined
    const rooms = getRoomsMethod ? getRoomsMethod() : []
    const target =
      rooms.find((r: Room) => {
        const alias = r?.getCanonicalAlias?.()
        return alias ? aliases.includes(alias) : false
      }) ||
      rooms.find((r: Room) => {
        // Use getMyMembership instead of getMembership for matrix-sdk
        // Type-safe approach using unknown as intermediate
        const roomUnknown = r as unknown as Record<string, unknown>
        const getMyMembership = roomUnknown.getMyMembership as (() => string) | undefined
        const membership = typeof getMyMembership === 'function' ? getMyMembership() : undefined
        return membership === 'join'
      }) ||
      rooms[0]
    if (target?.roomId) {
      await chatStore.getSessionList()
      globalStore.updateCurrentSessionRoomId(target.roomId)
      router.push({ name: 'mobileChatMain' })
    } else {
      msg.warning('未找到公共房间')
    }
  } catch (e) {
    logger.warn('加入公共房间失败:', e)
    msg.error?.('加入公共房间失败')
  }
}
</script>

<style scoped lang="scss">
.keyboard-mask {
  position: fixed;
  inset: 0;
  background: transparent; // 透明背景
  z-index: 1400; // 低于 Naive 弹层，高于页面内容
  pointer-events: auto; // 确保能接收事件
  touch-action: none; // 禁止滚动
}

::deep(#search) {
  position: relative;
  z-index: 1500; // 高于键盘蒙层，低于 Naive 弹层
}
</style>
