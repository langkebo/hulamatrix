import { logger } from '@/utils/logger'

<template>
  <!--! 这里最好不要使用n-flex,滚动高度会有问题  -->
  <main
    style="height: 100%"
    class="flex-shrink-0"
    :class="[
      isGroup
        ? isCollapsed
          ? 'w-0 pr-1px'
          : 'w-180px border-l-(1px solid [--right-chat-footer-line-color]) p-[12px_0_12px_6px] custom-shadow'
        : 'w-0 pr-1px',
      'item-box'
    ]">
    <!-- 收缩按钮 -->
    <div
      v-show="isGroup"
      @click.stop="isCollapsed = !isCollapsed"
      style="border-radius: 18px 0 0 18px"
      class="contraction transition-all duration-600 ease-in-out absolute top-35% left--14px cursor-pointer opacity-0 bg-#c8c8c833 h-60px w-14px">
      <svg
        :class="isCollapsed ? 'rotate-0' : 'rotate-180'"
        class="size-16px color-#909090 dark:color-#303030 absolute top-38%">
        <use href="#left-arrow"></use>
      </svg>
    </div>

    <div v-if="isGroup && !isCollapsed">
      <!-- 群公告 -->
      <n-flex vertical :size="14" class="px-4px py-10px">
        <n-flex align="center" justify="space-between" :size="8" class="cursor-pointer">
          <p
            class="text-(14px --text-color) truncate flex-1 min-w-0"
            @click="handleOpenAnnoun(announNum === 0 && isAddAnnoun)">
            {{ t('home.chat_sidebar.announcement.title') }}
          </p>
          <svg
            class="size-16px rotate-270 color-[--text-color] shrink-0"
            @click="handleOpenAnnoun(announNum === 0 && isAddAnnoun)">
            <use v-if="announNum === 0 && isAddAnnoun" href="#plus"></use>
            <use v-else href="#down"></use>
          </svg>
        </n-flex>

        <!-- 公告加载失败提示 -->
        <n-flex v-if="announError" class="h-74px" align="center" justify="center">
          <div class="text-center">
            <p class="text-(12px #909090) mb-8px">{{ t('home.chat_sidebar.announcement.load_failed') }}</p>
            <n-button size="tiny" @click="announcementStore.loadGroupAnnouncements()">
              {{ t('home.chat_sidebar.actions.retry') }}
            </n-button>
          </div>
        </n-flex>

        <!-- 公告内容 -->
        <n-scrollbar v-else class="h-74px">
          <p class="text-(12px #909090) leading-6 line-clamp-4 max-w-99%" v-if="announNum === 0">
            {{ t('home.chat_sidebar.announcement.default') }}
          </p>
          <p
            v-else
            style="user-select: text"
            class="announcement-text text-(12px #909090) leading-6 line-clamp-4 max-w-99% break-words">
            <template v-if="announcementSegments.length > 0">
              <template v-for="(segment, index) in announcementSegments" :key="index">
                <span
                  v-if="segment.isLink"
                  class="cursor-pointer hover:underline hover:opacity-80 text-brand"
                  @click.stop="openAnnouncementLink(segment.text)">
                  {{ segment.text }}
                </span>
                <template v-else>{{ segment.text }}</template>
              </template>
            </template>
            <template v-else>{{ announcementContent }}</template>
          </p>
        </n-scrollbar>
      </n-flex>

      <n-flex v-if="!isSearch" align="center" justify="space-between" class="pr-8px pl-8px h-42px">
        <span class="text-14px">{{ t('home.chat_sidebar.online_members', { count: onlineCountDisplay }) }}</span>
        <svg @click="handleSelect" class="size-14px">
          <use href="#search"></use>
        </svg>
      </n-flex>
      <!-- 搜索框 -->
      <n-flex v-else align="center" class="pr-8px h-42px">
        <n-input
          :on-input="handleSearch"
          @blur="handleBlur"
          ref="inputInstRef"
          v-model:value="searchRef"
          clearable
          :placeholder="t('home.chat_sidebar.search.placeholder')"
          type="text"
          size="tiny"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          class="h-26px w-95% lh-26px rounded-6px">
          <template #prefix>
            <svg class="w-12px h-12px">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </n-flex>

      <!-- 排序选择器 (搜索时不显示) -->
      <n-flex v-if="!isSearch" align="center" justify="space-between" class="pr-8px pl-8px h-32px">
        <span class="text-12px text-[--chat-text-color]">{{ t('home.chat_sidebar.sort.label') }}</span>
        <n-select
          :value="memberSortOrder"
          @update:value="handleSortChange"
          :options="sortOptions"
          size="tiny"
          style="width: 140px"
          :consistent-menu-width="false" />
      </n-flex>

      <!-- 成员列表 -->
      <n-virtual-list
        id="image-chat-sidebar"
        style="max-height: calc(100vh / var(--page-scale, 1) - 250px)"
        item-resizable
        @scroll="handleScroll($event)"
        :item-size="46"
        :items="displayedUserList">
        <template #default="{ item }">
          <n-popover
            :ref="(el: unknown) => (infoPopoverRefs[item.uid] = el)"
            @update:show="handlePopoverUpdate(item.uid, $event)"
            trigger="click"
            placement="left"
            :show-arrow="false"
            class="chat-sidebar-popover">
            <template #trigger>
              <ContextMenu
                :content="item"
                @select="$event.click(item, 'Sidebar')"
                :menu="optionsList as unknown as ContextMenuItem[]"
                :special-menu="report as unknown as ContextMenuItem[]">
                <n-flex
                  @click="onClickMember(item)"
                  :key="item.uid"
                  :size="10"
                  align="center"
                  justify="space-between"
                  class="item">
                  <n-flex align="center" :size="8" class="flex-1 truncate">
                    <div class="relative inline-flex items-center justify-center">
                      <n-avatar
                        round
                        class="grayscale"
                        :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE }"
                        :size="26"
                        :color="themes.content === ThemeEnum.DARK ? '#242424' : '#fff'"
                        :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                        :src="AvatarUtils.getAvatarUrl(item.avatar)"
                        @load="userLoadedMap[item.uid] = true"
                        @error="userLoadedMap[item.uid] = true" />
                    </div>
                    <n-flex vertical :size="2" class="flex-1 truncate">
                      <p :title="item.name" class="text-12px truncate flex-1 leading-tight">
                        {{ item.myName ? item.myName : item.name }}
                      </p>
                      <n-flex
                        v-if="item.userStateId && getUserState(item.userStateId)"
                        align="center"
                        :size="4"
                        class="flex-1">
                        <img class="size-12px" :src="getUserState(item.userStateId)?.url" alt="" />
                        <span
                          class="text-10px text-[--chat-text-color] flex-1 min-w-0 truncate"
                          :title="translateStateTitle(getUserState(item.userStateId)?.title)">
                          {{ translateStateTitle(getUserState(item.userStateId)?.title) }}
                        </span>
                      </n-flex>
                    </n-flex>
                  </n-flex>

                  <div
                    v-if="item.roleId === RoleEnum.LORD"
                    class="flex px-4px bg-#d5304f30 py-3px rounded-4px size-fit select-none">
                    <p class="text-(10px #d5304f)">{{ t('home.chat_sidebar.roles.owner') }}</p>
                  </div>
                  <div
                    v-if="item.roleId === RoleEnum.ADMIN"
                    class="flex px-4px bg-#1a7d6b30 py-3px rounded-4px size-fit select-none">
                    <p class="text-(10px #008080)">{{ t('home.chat_sidebar.roles.admin') }}</p>
                  </div>
                </n-flex>
              </ContextMenu>
            </template>
            <!-- 用户个人信息框 -->
            <InfoPopover v-if="selectKey === item.uid" :uid="item.uid" :activeStatus="item.activeStatus" />
          </n-popover>
        </template>
      </n-virtual-list>
    </div>
  </main>
</template>
<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import type { InputInst } from 'naive-ui'
import { MittEnum, OnlineEnum, RoleEnum, ThemeEnum, RoomTypeEnum } from '@/enums'
import { useChatMain } from '@/hooks/useChatMain'
import { useMitt } from '@/hooks/useMitt'
import { usePopover } from '@/hooks/usePopover'
import { useWindow } from '@/hooks/useWindow'
import { useLinkSegments } from '@/hooks/useLinkSegments'
import type { UserItem } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useGlobalStore } from '@/stores/global'
import { MemberSortEnum } from '@/stores/setting'

// Tauri WebviewWindow 扩展接口
interface WebviewWindowWithListen {
  listen?: (event: string, handler: (event: unknown) => void) => Promise<UnlistenFn>
  [key: string]: unknown
}

// UnlistenFn 类型
type UnlistenFn = () => Promise<void>

// 事件接口定义
interface AnnouncementUpdatedEvent {
  payload?: {
    hasAnnouncements?: boolean
  }
}

interface InfoPopoverEvent {
  uid: string
}
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting'
import { useUserStatusStore } from '@/stores/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { logger } from '@/utils/logger'
import { useAnnouncementStore } from '@/stores/announcement'

const { t } = useI18n()
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const appWindow = isTauri ? WebviewWindow.getCurrent() : { label: 'web' }
const emit = defineEmits<(e: 'ready') => void>()
const { createWebviewWindow } = useWindow()
const globalStore = useGlobalStore()
const roomStore = useRoomStore()
const settingStore = useSettingStore()
const announcementStore = useAnnouncementStore()
const { clearAnnouncements } = announcementStore
const themes = computed(() => settingStore.themes)
// 当前加载的群聊ID
const onlineCountDisplay = computed(() => {
  // 临时使用成员总数，后续接入Presence
  return roomStore.currentRoom?.memberCount || 0
})
const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)
// 公告相关计算属性
const announcementContent = computed(() => announcementStore.announcementContent)
const announNum = computed(() => announcementStore.announNum)
const announError = computed(() => announcementStore.announError)
const isAddAnnoun = computed(() => announcementStore.isAddAnnoun)
const { segments: announcementSegments, openLink: openAnnouncementLink } = useLinkSegments(announcementContent)

/** 是否是搜索模式 */
const isSearch = ref(false)
const searchRef = ref('')
const searchRequestId = ref(0)
/** List中的Popover组件实例 */
const infoPopoverRefs = ref<Record<string, unknown>>({})
const inputInstRef = ref<InputInst | null>(null)
const isCollapsed = ref(false)
const { optionsList, report, selectKey } = useChatMain()

// 成员排序状态
const memberSortOrder = ref<MemberSortEnum>(settingStore.layout?.memberSortOrder || MemberSortEnum.ONLINE_FIRST)

// 排序选项 (i18n)
const sortOptions = computed(() => [
  {
    label: t('home.chat_sidebar.sort.online_first'),
    value: MemberSortEnum.ONLINE_FIRST
  },
  {
    label: t('home.chat_sidebar.sort.role_first'),
    value: MemberSortEnum.ROLE_FIRST
  },
  {
    label: t('home.chat_sidebar.sort.alphabetical'),
    value: MemberSortEnum.ALPHABETICAL
  }
])

// Type for ContextMenu menu items
interface ContextMenuItem {
  label?: string | (() => string)
  icon?: string
  action?: (item: unknown) => void | Promise<void>
  visible?: (item: unknown) => boolean
  children?: ContextMenuItem[]
  key?: string
  [key: string]: unknown
}
const { handlePopoverUpdate, enableScroll } = usePopover(selectKey, 'image-chat-sidebar')
provide('popoverControls', { enableScroll })

// 用于稳定展示的用户列表
const displayedUserList = ref<UserItem[]>([])
/** 用户信息加载状态 */
const userLoadedMap = ref<Record<string, boolean>>({})

// 当前群组成员列表（适配 UserItem 类型）
const currentMembers = computed<UserItem[]>(() => {
  return (roomStore.currentMembers || []).map((m) => ({
    uid: m.userId,
    account: m.userId,
    name: m.displayName || m.userId,
    myName: m.displayName, // RoomStore currently stores displayname in both
    avatar: m.avatarUrl || '',
    roleId: m.role === 'owner' ? RoleEnum.LORD : m.role === 'admin' ? RoleEnum.ADMIN : RoleEnum.NORMAL,
    activeStatus: OnlineEnum.OFFLINE, // 暂不支持在线状态
    lastOptTime: 0
  }))
})

/** 根据选择偏好对成员排序 */
const sortMembers = (members: UserItem[]): UserItem[] => {
  const sorted = [...members]

  switch (memberSortOrder.value) {
    case MemberSortEnum.ONLINE_FIRST:
      // 在线状态 > 角色 > 字母
      sorted.sort((a, b) => {
        // 在线状态优先
        if (a.activeStatus !== b.activeStatus) {
          return (b.activeStatus === OnlineEnum.ONLINE ? 1 : 0) - (a.activeStatus === OnlineEnum.ONLINE ? 1 : 0)
        }
        // 然后按角色 (群主 > 管理员 > 普通)
        if (a.roleId !== b.roleId) {
          return (
            (b.roleId === RoleEnum.LORD ? 2 : b.roleId === RoleEnum.ADMIN ? 1 : 0) -
            (a.roleId === RoleEnum.LORD ? 2 : a.roleId === RoleEnum.ADMIN ? 1 : 0)
          )
        }
        // 最后按字母
        const nameA = (a.myName || a.name || '').toLowerCase()
        const nameB = (b.myName || b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
      break

    case MemberSortEnum.ROLE_FIRST:
      // 角色 > 在线状态 > 字母
      sorted.sort((a, b) => {
        // 角色优先
        if (a.roleId !== b.roleId) {
          return (
            (b.roleId === RoleEnum.LORD ? 2 : b.roleId === RoleEnum.ADMIN ? 1 : 0) -
            (a.roleId === RoleEnum.LORD ? 2 : a.roleId === RoleEnum.ADMIN ? 1 : 0)
          )
        }
        // 然后按在线状态
        if (a.activeStatus !== b.activeStatus) {
          return (b.activeStatus === OnlineEnum.ONLINE ? 1 : 0) - (a.activeStatus === OnlineEnum.ONLINE ? 1 : 0)
        }
        // 最后按字母
        const nameA = (a.myName || a.name || '').toLowerCase()
        const nameB = (b.myName || b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
      break

    case MemberSortEnum.ALPHABETICAL:
      // 纯字母排序
      sorted.sort((a, b) => {
        const nameA = (a.myName || a.name || '').toLowerCase()
        const nameB = (b.myName || b.name || '').toLowerCase()
        return nameA.localeCompare(nameB, 'zh-CN')
      })
      break
  }

  return sorted
}

/** 处理排序方式变更 */
const handleSortChange = (value: MemberSortEnum) => {
  memberSortOrder.value = value
  settingStore.setMemberSortOrder(value)
  // 重新排序列表
  displayedUserList.value = sortMembers(currentMembers.value)
}

watch(
  () => [globalStore.currentSessionRoomId, isGroup.value] as const,
  async ([roomId, isGroupChat], prevValue) => {
    const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
    if (!roomId || !isGroupChat) {
      clearAnnouncements()
      return
    }

    if (roomId === prevRoomId && prevIsGroup === isGroupChat) {
      return
    }

    try {
      await announcementStore.loadGroupAnnouncements(roomId)
    } catch (error) {
      logger.error('刷新群公告失败:', error instanceof Error ? error : new Error(String(error)))
    }
  },
  { immediate: true }
)

const onClickMember = async (item: UserItem) => {
  logger.debug('点击用户', item)
  selectKey.value = item.uid

  // 获取用户的最新数据，并更新 pinia
  requestWithFallback({
    url: 'get_user_by_ids',
    params: { uids: [item.uid] }
  }).then((users) => {
    const userList = users as { name?: string; avatar?: string }[] | undefined
    if (userList && userList.length > 0) {
      const firstUser = userList[0]
      if (!firstUser) return
      // Build update object with only defined properties
      const updateData: { displayName?: string; avatarUrl?: string } = {}
      if (firstUser.name !== undefined) {
        updateData.displayName = firstUser.name
      }
      if (firstUser.avatar !== undefined) {
        updateData.avatarUrl = firstUser.avatar
      }
      roomStore.updateMember(globalStore.currentSessionRoomId, item.uid, updateData)
    }
  })
}

// 监听成员源列表变化
watch(
  () => currentMembers.value,
  (newList) => {
    if (searchRef.value.trim()) {
      return
    }

    // 应用排序
    displayedUserList.value = sortMembers(Array.isArray(newList) ? newList : [])
  },
  { immediate: true }
)

/**
 * 监听搜索输入过滤用户
 * @param value 输入值
 */
const handleSearch = useDebounceFn((value: string) => {
  searchRef.value = value
  const keyword = value.trim().toLowerCase()

  // 如果没有搜索关键字,显示全部成员并排序
  if (!keyword) {
    displayedUserList.value = sortMembers(Array.isArray(currentMembers.value) ? [...currentMembers.value] : [])
    return
  }

  // 前端本地过滤成员列表
  const filteredList = currentMembers.value.filter((member: UserItem) => {
    const matchName = member.name?.toLowerCase().includes(keyword)
    const matchMyName = member.myName?.toLowerCase().includes(keyword)
    return matchName || matchMyName
  })

  // 过滤后也应用排序
  displayedUserList.value = sortMembers(filteredList)
}, 10)

const handleBlur = () => {
  if (searchRef.value) return
  isSearch.value = false
  searchRequestId.value++
  displayedUserList.value = sortMembers(Array.isArray(currentMembers.value) ? [...currentMembers.value] : [])
}

/**
 * 处理滚动事件
 * @param event 滚动事件
 */
const handleScroll = (event: Event) => {
  if (searchRef.value.trim()) {
    return
  }

  const target = event.target as HTMLElement
  const isBottom = target.scrollHeight - target.scrollTop === target.clientHeight

  if (isBottom) {
    roomStore.loadRoomMembers(globalStore.currentSessionRoomId)
  }
}

/**
 * 切换搜索模式并自动聚焦输入框
 */
const handleSelect = () => {
  isSearch.value = !isSearch.value

  if (isSearch.value) {
    nextTick(() => {
      inputInstRef.value?.select()
    })
  } else {
    searchRequestId.value++
    searchRef.value = ''
    displayedUserList.value = sortMembers(Array.isArray(currentMembers.value) ? [...currentMembers.value] : [])
  }
}

/**
 * 打开群公告
 */
const handleOpenAnnoun = (isAdd: boolean) => {
  nextTick(async () => {
    const roomId = globalStore.currentSessionRoomId
    await createWebviewWindow(
      isAdd ? t('home.chat_sidebar.announcement.window.add') : t('home.chat_sidebar.announcement.window.view'),
      `announList/${roomId}/${isAdd ? 0 : 1}`,
      420,
      620
    )
  })
}

const userStatusStore = useUserStatusStore()
const stateList = computed(() => userStatusStore.stateList)

const getUserState = (stateId: string) => {
  return stateList.value.find((state: { id: string }) => state.id === stateId)
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

if (isTauri && appWindow) {
  const windowWithListen = appWindow as unknown as WebviewWindowWithListen
  if (windowWithListen.listen) {
    windowWithListen.listen('announcementUpdated', async (event: unknown) => {
      const announcementEvent = event as AnnouncementUpdatedEvent
      if (announcementEvent.payload) {
        const { hasAnnouncements } = announcementEvent.payload
        if (hasAnnouncements) {
          // 初始化群公告
          await announcementStore.loadGroupAnnouncements()
          await nextTick()
        }
      }
    })
  }
}

onMounted(async () => {
  // 通知父级：Sidebar 已挂载，可移除占位
  emit('ready')

  useMitt.on(`${MittEnum.INFO_POPOVER}-Sidebar`, (event: unknown) => {
    const popoverEvent = event as InfoPopoverEvent
    selectKey.value = popoverEvent.uid
    const popoverRef = infoPopoverRefs.value[popoverEvent.uid] as { setShow: (show: boolean) => void } | undefined
    popoverRef?.setShow(true)
    handlePopoverUpdate(popoverEvent.uid)
  })

  if (isTauri && appWindow) {
    const windowWithListen = appWindow as unknown as WebviewWindowWithListen
    if (windowWithListen.listen) {
      windowWithListen.listen('announcementClear', async () => {
        clearAnnouncements()
      })
    }
  }

  // 初始化时获取当前群组用户的信息
  if (currentMembers.value.length > 0) {
    // 初始展示当前列表（应用排序）
    displayedUserList.value = sortMembers([...currentMembers.value])
    // const currentRoom = globalStore.currentSessionRoomId
    // if (currentRoom) {
    //   groupStore.updateMemberCache(currentRoom, displayedUserList.value)
    // }
    const handleAnnounInitOnEvent = (shouldReload: boolean) => {
      return async (event: unknown) => {
        if (shouldReload || event) {
          await announcementStore.loadGroupAnnouncements()
        }
      }
    }
    // 监听群公告消息
    useMitt.on(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
    useMitt.on(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
  }
})

onUnmounted(() => {
  // groupStore.cleanupSession()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/chat-sidebar';

.chat-sidebar-popover {
  padding: 0;
  background: var(--bg-info);
}
</style>
