<template>
  <n-space align="center" :size="8" class="px-12px py-8px">
    <n-button tertiary type="default" size="small" @click="goAddFriends('user')">添加好友</n-button>
    <n-button tertiary type="default" size="small" @click="goAddFriends('matrix')">企业目录</n-button>
    <n-button tertiary size="small" @click="refreshFriends">刷新</n-button>
  </n-space>
  <n-flex
    @click="handleApply('friend')"
    align="center"
    justify="space-between"
    class="my-10px p-12px hover:(bg-[--list-hover-color] cursor-pointer)">
    <div class="text-(14px [--text-color])">{{ t('home.friends_list.notice.friend') }}</div>
    <n-flex align="center" :size="4">
      <n-badge :value="globalStore.unReadMark.newFriendUnreadCount" :max="15" />
      <!-- <n-badge v-if="globalStore.unReadMark.newFriendUnreadCount > 0" dot color="#d5304f" /> -->
      <svg class="size-16px rotate-270 color-[--text-color]"><use href="#down"></use></svg>
    </n-flex>
  </n-flex>

  <n-flex
    @click="handleApply('group')"
    align="center"
    justify="space-between"
    class="my-10px p-12px hover:(bg-[--list-hover-color] cursor-pointer)">
    <div class="text-(14px [--text-color])">{{ t('home.friends_list.notice.group') }}</div>
    <n-flex align="center" :size="4">
      <n-badge :value="globalStore.unReadMark.newGroupUnreadCount" :max="15" />
      <!-- <n-badge v-if="globalStore.unReadMark.newGroupUnreadCount === 0" dot color="#d5304f" /> -->
      <svg class="size-16px rotate-270 color-[--text-color]"><use href="#down"></use></svg>
    </n-flex>
  </n-flex>
  <n-tabs v-model:value="tabValue" type="segment" animated class="mt-4px p-[4px_10px_0px_8px]">
    <n-tab-pane name="1" :tab="t('home.friends_list.tabs.friend')">
      <n-collapse :display-directive="'show'" accordion :default-expanded-names="['1']">
        <ContextMenu @contextmenu="showMenu($event)" @select="handleSelect($event.label)" :menu="menuList">
          <n-collapse-item :title="t('home.friends_list.collapse.friend')" name="1">
            <template #header-extra>
              <span class="text-(10px #707070)">{{ onlineCount }}/{{ friendsStore.friends.length }}</span>
            </template>
            <n-space class="px-8px md:px-12px pb-8px" align="center" :size="8">
              <n-input size="small" v-model:value="searchQuery" placeholder="搜索用户ID" clearable />
              <n-select
                size="small"
                v-model:value="selectedCategory"
                :options="categoryOptions"
                style="min-width: clamp(120px, 30vw, 220px)" />
              <n-switch v-model:value="showOnlineOnly">仅在线</n-switch>
            </n-space>
            <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 270px)">
              <div class="p-4px">
                <div v-if="friendsStore.loading"><n-skeleton height="20px" :repeat="8" /></div>
                <div v-else-if="friendsStore.error" class="px-8px py-6px">
                  <n-alert type="warning" :show-icon="true">{{ friendsStore.error }}</n-alert>
                  <n-space class="mt-8px">
                    <n-button size="small" type="primary" @click="refreshFriends">重试</n-button>
                    <n-button size="small" tertiary type="default" @click="goAddFriends('user')">打开添加好友页</n-button>
                  </n-space>
                </div>
                <template v-else>
                  <n-empty
                    v-if="friendsStore.friends.length === 0 && friendsStore.categories.length === 0"
                    description="暂无好友" />
                  <div v-for="group in filteredGroupedFriends" :key="group.cat.id" class="mb-10px">
                    <div class="text-12px mb-6px" :style="{ color: group.cat.color || '#909090' }">
                      {{ group.cat.name }}
                    </div>
                    <template v-if="group.items.length > 100">
                      <VirtualList
                        :items="group.items.map((u: FriendItem): FriendVirtualListItem => ({
                          message: { id: u.user_id },
                          user_id: u.user_id,
                          user_info: u // 传递完整的用户信息
                        }))"
                        :estimated-item-height="60">
                        <template #default="slotProps">
                          <!-- Cast slotProps.item to FriendVirtualListItem -->
                          <div
                            v-if="slotProps.item"
                            class="item-box w-full h-56px md:h-60px mb-5px"
                            @click="handleClick((slotProps.item as FriendVirtualListItem).user_id, RoomTypeEnum.SINGLE)">
                            <n-flex align="center" :size="10" class="h-56px md:h-60px pl-6px pr-8px flex-1 truncate">
                          <n-avatar
                            round
                            :size="36"
                            :src="(slotProps.item as FriendVirtualListItem).user_info?.avatar_url || ''"
                            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                              <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                                <span class="text-13px leading-tight flex-1 truncate">
                                  <n-badge :color="isOnline((slotProps.item as FriendVirtualListItem).user_id) ? '#1ab292' : '#909090'" dot />
                                  {{ (slotProps.item as FriendVirtualListItem).user_info?.display_name || (slotProps.item as FriendVirtualListItem).user_info?.name || (slotProps.item as FriendVirtualListItem).user_id }}
                                </span>
                                <span class="text-10px text-gray-500 truncate">
                                  {{ (slotProps.item as FriendVirtualListItem).user_info?.status_text || '' }}
                                </span>
                              </n-flex>
                            </n-flex>
                          </div>
                        </template>
                      </VirtualList>
                    </template>
                    <template v-else>
                      <n-flex
                        :size="10"
                        @click="handleClick(item.user_id, RoomTypeEnum.SINGLE)"
                        :class="{ active: activeItem === item.user_id }"
                        class="item-box w-full h-56px md:h-60px mb-5px"
                        v-for="item in group.items"
                        :key="item.user_id">
                        <n-flex align="center" :size="10" class="h-56px md:h-60px pl-6px pr-8px flex-1 truncate">
                          <n-avatar
                            round
                            :size="36"
                            :src="item.avatar_url || ''"
                            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                          <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                            <span class="text-13px leading-tight flex-1 truncate">
                              <n-badge :color="isOnline(item.user_id) ? '#1ab292' : '#909090'" dot />
                              {{ item.display_name || item.name || item.user_id }}
                            </span>
                            <span class="text-10px text-gray-500 truncate">
                              {{ item.status_text || '' }}
                            </span>
                          </n-flex>
                        </n-flex>
                      </n-flex>
                    </template>
                  </div>
                </template>
              </div>
            </n-scrollbar>
          </n-collapse-item>
          <n-collapse-item title="待处理请求" name="apply">
            <div class="p-8px">
              <div v-if="friendsStore.loading"><n-skeleton height="20px" :repeat="4" /></div>
              <n-alert v-else-if="friendsStore.error" type="warning" :show-icon="true">
                {{ friendsStore.error }}
              </n-alert>
              <n-list v-else>
                <n-list-item v-for="p in friendsStore.pending" :key="p.request_id">
                  <div class="flex items-center justify-between">
                    <span>{{ p.requester_id }} → {{ p.target_id }}</span>
                    <n-space>
                    <n-button
                      size="small"
                      type="primary"
                      @click="friendsStore.accept(p.request_id).then(() => msg.success('已接受'))">
                      接受
                    </n-button>
                    <n-button
                      size="small"
                      type="error"
                      @click="friendsStore.reject(p.request_id).then(() => msg.success('已拒绝'))">
                      拒绝
                    </n-button>
                    </n-space>
                  </div>
                </n-list-item>
              </n-list>
            </div>
          </n-collapse-item>
        </ContextMenu>
      </n-collapse>
    </n-tab-pane>
  </n-tabs>
  
  <!-- 搜索好友对话框 -->
  <SearchFriendModal
    v-model:show="showSearchFriendModal"
    @success="handleAddFriendSuccess"
  />
</template>
<script setup lang="ts" name="friendsList">
import { onMounted, onUnmounted, ref, watch, watchEffect, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MittEnum, RoomTypeEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { DetailsContent } from '@/services/types'
import type { FriendItem } from '@/stores/friends'
import { useFriendsStore } from '@/stores/friends'
import { usePresenceStore } from '@/stores/presence'
import { useGlobalStore } from '@/stores/global'
//
import { useSettingStore } from '@/stores/setting'
//
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import SearchFriendModal from '@/components/friends/SearchFriendModal.vue'

const route = useRoute()
const { t } = useI18n()
const menuList = computed(() => [
  { label: t('home.friends_list.menu.add_group'), icon: 'plus' },
  { label: t('home.friends_list.menu.rename_group'), icon: 'edit' },
  { label: t('home.friends_list.menu.delete_group'), icon: 'delete' }
])
/** 建议把此状态存入localStorage中 */
const activeItem = ref('')
const detailsShow = ref(false)
const shrinkStatus = ref(false)
// const contactStore = useContactStore()
const friendsStore = useFriendsStore()
const presenceStore = usePresenceStore()
//
const globalStore = useGlobalStore()
//
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
//
//
const router = useRouter()
const tabValue = ref('1')

// 搜索好友对话框状态
const showSearchFriendModal = ref(false)

// Type definition for grouped friends
interface GroupedFriendItem {
  cat: { id: string; name: string; color?: string }
  items: FriendItem[]
}

// Local type for VirtualList mapping (avoid conflict with component's VirtualListItem)
interface FriendVirtualListItem {
  message: { id: string }
  user_id: string
  user_info: FriendItem
  _index?: number
  [key: string]: unknown
}

/** 统计在线用户人数（SDK presence 事件） */
const onlineCount = computed(() => {
  const ids = friendsStore.friends.map((f) => f.user_id)
  return presenceStore.onlineCount(ids)
})
/** Synapse 扩展好友分组 */
const groupedFriends = computed(() => {
  const map = friendsStore.friendsByCategory()
  return friendsStore.categories.map((c) => ({ cat: c, items: map[c.id] || [] }))
})
const searchQuery = ref('')
const debouncedQuery = ref('')
const applyDebounce = useDebounceFn(() => {
  debouncedQuery.value = searchQuery.value
}, 120)
watch(searchQuery, () => applyDebounce())
const selectedCategory = ref<string>('all')
const showOnlineOnly = ref(false)
const categoryOptions = computed(() => [
  { label: '全部', value: 'all' },
  ...friendsStore.categories.map((c) => ({ label: c.name, value: c.id }))
])
const isOnline = (uid: string) => presenceStore.isOnline(uid)
const filteredGroupedFriends = computed<GroupedFriendItem[]>(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  return groupedFriends.value
    .filter((g: GroupedFriendItem) => selectedCategory.value === 'all' || g.cat.id === selectedCategory.value)
    .map((g: GroupedFriendItem) => ({
      cat: g.cat,
      items: g.items.filter((it: FriendItem) => {
        const matchQ = !q || String(it.user_id).toLowerCase().includes(q)
        const matchOnline = !showOnlineOnly.value || isOnline(it.user_id)
        return matchQ && matchOnline
      })
    }))
})
/** 监听独立窗口关闭事件 */
watchEffect(() => {
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event: unknown) => {
    shrinkStatus.value = event as boolean
  })
})

const handleClick = (index: string, type: number) => {
  detailsShow.value = true
  activeItem.value = index
  const data = {
    context: {
      type: type,
      uid: index
    },
    detailsShow: detailsShow.value
  }
  useMitt.emit(MittEnum.DETAILS_SHOW, data)
}
// todo 需要循环数组来展示分组
const showMenu = (_event: MouseEvent) => {}

const handleSelect = (_label: string) => {}

const resetSelection = () => {
  detailsShow.value = false
  activeItem.value = ''
  useMitt.emit(MittEnum.DETAILS_SHOW, {
    context: undefined,
    detailsShow: false
  })
}

const handleApply = async (applyType: 'friend' | 'group') => {
  if (applyType === 'friend') {
    await friendsStore.refreshAll()
    globalStore.unReadMark.newFriendUnreadCount = (friendsStore.pending || []).length
  } else {
    await friendsStore.refreshGroupPending()
    globalStore.unReadMark.newGroupUnreadCount = (friendsStore.pendingGroups || []).length
  }
  unreadCountManager.refreshBadge(globalStore.unReadMark)

  useMitt.emit(MittEnum.APPLY_SHOW, {
    context: {
      type: 'apply',
      applyType
    } as DetailsContent
  })
  activeItem.value = ''
}

/** 获取联系人数据 */
const fetchContactData = async () => {
  try {
    await friendsStore.refreshAll()
  } catch (error) {
    logger.error('获取联系人数据失败:', error instanceof Error ? error : new Error(String(error)))
  }
}

const refreshFriends = async () => {
  await friendsStore.refreshAll()
}

const goAddFriends = (_mode: 'user' | 'matrix') => {
  const uaMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const windowWithTauri = window as typeof window & { TAURI_ENV_PLATFORM?: string }
  const isMobile =
    uaMobile ||
    windowWithTauri.TAURI_ENV_PLATFORM === 'ios' ||
    windowWithTauri.TAURI_ENV_PLATFORM === 'android' ||
    (typeof location !== 'undefined' && location.pathname.startsWith('/mobile'))
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

  logger.debug('[goAddFriends] Environment check:', { isMobile, isTauri, hasTauriInWindow: '__TAURI__' in window })

  if (isMobile) {
    logger.debug('[goAddFriends] Mobile mode - navigating to mobile add friends')
    router.push('/mobile/mobileFriends/addFriends')
  } else if (isTauri) {
    // Tauri 桌面环境：跳转到搜索页面
    logger.debug('[goAddFriends] Tauri mode - navigating to /searchFriend')
    router.push('/searchFriend')
  } else {
    // Web 环境：打开对话框
    logger.debug('[goAddFriends] Web mode - opening modal dialog')
    showSearchFriendModal.value = true
  }
}

// 添加好友成功回调
const handleAddFriendSuccess = async () => {
  await friendsStore.refreshAll()
}

// 已移除未使用的辅助方法以通过类型构建

/** 监听路由变化，当切换到消息页面时重置选中状态 */
watch(
  () => route.path,
  (newPath) => {
    if (newPath.includes('/message')) {
      resetSelection()
    }
  },
  { immediate: false }
)

/** 组件挂载时获取数据 */
onMounted(async () => {
  await fetchContactData()
  try {
    await friendsStore.refreshAll()
  } catch {}
  try {
    presenceStore.setup()
  } catch {}
})

onUnmounted(() => {
  resetSelection()
})
</script>

<style scoped lang="scss">
.item-box {
  color: var(--text-color);
  .text {
    color: #808080;
  }
  &:not(.active):hover {
    background: var(--bg-msg-hover);
    border-radius: 12px;
    cursor: pointer;
  }
}

.active {
  background: var(--msg-active-color);
  border-radius: 12px;
  color: #fff;
  .text {
    color: #fff;
  }
}

:deep(.n-collapse .n-collapse-item:not(:first-child)) {
  border: none;
}
:deep(.n-collapse .n-collapse-item) {
  margin: 6px 0 0;
}
</style>
