<template>
  <div
    v-show="shouldShowUserList"
    class="w-240px flex-shrink-0 flex flex-col bg-[--center-bg-color] border-r border-solid border-[--line-color]">
    <!-- 搜索栏 -->
    <div class="p-16px pb-12px">
      <n-input
        v-model:value="searchKeyword"
        :placeholder="getSearchPlaceholder()"
        :input-props="{ spellcheck: false }"
        clearable
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        class="rounded-6px border-(solid 1px [--line-color]) w-full relative text-12px"
        size="small">
        <template #prefix>
          <svg class="size-16px text-[--text-color] opacity-60">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- 动态内容区域 -->
    <div class="flex-1 px-8px overflow-hidden">
      <div class="pl-4px mb-12px">
        <span class="text-14px font-500 text-[--text-color]">{{ getSectionTitle() }}</span>
      </div>

      <n-scrollbar style="height: calc(100vh / var(--page-scale, 1) - 110px)">
        <div class="pr-12px">
          <!-- 全部选项 -->
          <UserItem
            :user="getAllOption()"
            :is-selected="selectedUser === '' && selectedRoom === ''"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 动态列表内容 -->
          <component
            :is="getItemComponent()"
            v-for="item in filteredList"
            :key="getItemKey(item)"
            :user="item"
            :room="item"
            :contact="item"
            :is-selected="isItemSelected(item)"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 空状态 -->
          <div v-if="filteredList.length === 0 && searchKeyword && !loading" class="flex-center h-200px">
            <div class="flex-col-center">
              <svg class="size-48px text-[--text-color] opacity-30 mb-12px">
                <use href="#search"></use>
              </svg>
              <p class="text-14px text-[--text-color] opacity-60 m-0">{{ getEmptyMessage() }}</p>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex-center h-200px">
            <n-spin size="small" />
            <span class="ml-8px text-14px text-[--text-color] opacity-60">加载中</span>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed, watch, type Ref } from 'vue'
import { useGroupStore } from '@/stores/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import UserItem from './UserItem.vue'
import { useI18n } from 'vue-i18n'

// Phase 4 Migration: 移除对 Tauri WebSocket 命令的依赖
// 改用 enhancedFriendsService (基于 Synapse 扩展 API)
import { enhancedFriendsService } from '@/services/enhancedFriendsService'
import type { Friend } from '@/services/enhancedFriendsService'

// Unified list item interface for different navigation types
interface ListItem {
  id?: string | number
  uid?: string | number
  roomId?: string | number
  name?: string
  roomName?: string
  groupName?: string
  nickname?: string
  avatar?: string
  [key: string]: unknown
}

type FileManagerState = {
  activeNavigation: Ref<string>
  userList: Ref<ListItem[]>
  selectedUser: Ref<string>
  selectedRoom: Ref<string>
  setSearchKeyword: (keyword: string) => void
  setSelectedUser: (userId: string) => void
  setSelectedRoom: (roomId: string) => void
}

const { t } = useI18n()
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { activeNavigation, selectedUser, selectedRoom, setSelectedUser, setSelectedRoom } = fileManagerState

// Store 实例
import { useFriendsStore } from '@/stores/friends'
import { logger } from '@/utils/logger'
const friendsStore = useFriendsStore()
const groupStore = useGroupStore()

// 本地状态
const searchKeyword = ref('')
const loading = ref(false)
// Phase 4 Migration: 移除 contactList，改用 friendsStore
const sessionList = ref<ListItem[]>([])

// 是否显示用户列表
const shouldShowUserList = computed(() => {
  return activeNavigation.value !== 'myFiles'
})

// 获取当前显示的列表
const currentList = computed(() => {
  switch (activeNavigation.value) {
    case 'senders':
      return enrichedContactsList.value
    case 'sessions':
      return sessionList.value
    case 'groups':
      return groupChatList.value
    default:
      return []
  }
})

// 丰富好友数据
const enrichedContactsList = computed(() => {
  return (friendsStore.friends || []).map((item: { user_id?: string | number }) => {
    const uid = String(item.user_id)
    const userInfo = groupStore.getUserInfo(uid)
    return {
      uid,
      name: userInfo?.name || t('fileManager.common.unknownUser'),
      avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logoD.png'),
      activeStatus: userInfo?.activeStatus
    }
  })
})

// 群聊列表
const groupChatList = computed(() => {
  return [...groupStore.groupDetails]
    .map((item) => ({
      ...item,
      avatar: AvatarUtils.getAvatarUrl(item.avatar)
    }))
    .sort((a, b) => {
      // 将roomId为'1'的群聊排在最前面
      if (a.roomId === '1' && b.roomId !== '1') return -1
      if (a.roomId !== '1' && b.roomId === '1') return 1
      return 0
    })
})

// 过滤后的列表
const filteredList = computed(() => {
  if (!searchKeyword.value) {
    return currentList.value
  }

  return currentList.value.filter((item: unknown) => {
    const i = item as {
      name?: string
      roomName?: string
      groupName?: string
      nickname?: string
    }
    const name = i.name || i.roomName || i.groupName || i.nickname || ''
    return name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  })
})

// 获取搜索占位符
const getSearchPlaceholder = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.searchPlaceholder.senders')
    case 'sessions':
      return t('fileManager.userList.searchPlaceholder.sessions')
    case 'groups':
      return t('fileManager.userList.searchPlaceholder.groups')
    default:
      return t('fileManager.userList.searchPlaceholder.default')
  }
}

// 获取区域标题
const getSectionTitle = () => {
  const count = filteredList.value.length
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.sectionTitle.senders', { count })
    case 'sessions':
      return t('fileManager.userList.sectionTitle.sessions', { count })
    case 'groups':
      return t('fileManager.userList.sectionTitle.groups', { count })
    default:
      return t('fileManager.userList.sectionTitle.default', { count })
  }
}

// 获取全部选项
const getAllOption = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return { id: '', name: t('fileManager.userList.allOptions.senders'), avatar: '' }
    case 'sessions':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.sessions'), avatar: '' }
    case 'groups':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.groups'), avatar: '' }
    default:
      return { id: '', name: t('fileManager.userList.allOptions.default'), avatar: '' }
  }
}

// 获取列表项组件
const getItemComponent = () => {
  // 都使用 UserItem 组件，但传入不同的数据
  return UserItem
}

// 判断项目是否被选中
const isItemSelected = (item: unknown) => {
  const i = item as {
    id?: string | number
    uid?: string | number
    roomId?: string | number
  }
  switch (activeNavigation.value) {
    case 'senders':
      return selectedUser.value === String(i.id || i.uid)
    case 'sessions':
    case 'groups':
      return selectedRoom.value === String(i.roomId || i.id)
    default:
      return false
  }
}

// 获取列表项的唯一标识
const getItemKey = (item: unknown): string | number => {
  const i = item as ListItem
  return String(i.id ?? i.roomId ?? i.uid ?? Math.random())
}

// 获取空状态消息
const getEmptyMessage = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.empty.senders')
    case 'sessions':
      return t('fileManager.userList.empty.sessions')
    case 'groups':
      return t('fileManager.userList.empty.groups')
    default:
      return t('fileManager.userList.empty.default')
  }
}

// 处理项目点击
const handleItemClick = (item: unknown) => {
  const i = item as {
    uid?: string | number
    id?: string | number
    roomId?: string | number
  }
  switch (activeNavigation.value) {
    case 'senders':
      setSelectedUser(String(i.uid || i.id || ''))
      break
    case 'sessions':
    case 'groups':
      setSelectedRoom(String(i.roomId || i.id || ''))
      break
  }
}

// 加载联系人列表
// Phase 4 Migration: 使用 enhancedFriendsService 代替 Tauri WebSocket 命令
const loadContacts = async () => {
  try {
    loading.value = true
    await friendsStore.refreshAll()
  } catch (error) {
    logger.error('加载联系人失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载会话列表
// Phase 4 Migration: 使用 friendsStore 而不是 contactList
const loadSessions = async () => {
  try {
    loading.value = true
    // 使用好友列表作为会话列表，并处理头像
    const friends = friendsStore.friends || []
    sessionList.value = friends.map((item: { user_id?: string | number; avatar?: string }) => {
      const uid = String(item.user_id || '')
      const userInfo = groupStore.getUserInfo(uid)
      return {
        uid,
        roomId: uid,
        roomName: userInfo?.name || t('fileManager.common.unknownUser'),
        avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || item.avatar || '/logoD.png')
      }
    })
  } catch (error) {
    logger.error('加载会话失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载群聊列表 (群组数据通过 groupStore 获取)
const loadGroups = async () => {
  try {
    loading.value = true
    // 群组数据已经在 groupStore 中管理，无需额外加载
    // 如果需要刷新群组数据，可以调用相应的 store 方法
  } catch (error) {
    logger.error('加载群聊失败:', error)
  } finally {
    loading.value = false
  }
}

// 监听导航变化
watch(
  activeNavigation,
  async (newNav) => {
    if (!shouldShowUserList.value) return

    switch (newNav) {
      case 'senders':
        // 发送人列表使用好友列表，确保联系人数据已加载
        if ((friendsStore.friends || []).length === 0) {
          await loadContacts()
        }
        break
      case 'sessions':
        // Phase 4 Migration: 直接使用 loadContacts 和 loadSessions
        if ((friendsStore.friends || []).length === 0) {
          await loadContacts()
        }
        await loadSessions()
        break
      case 'groups':
        await loadGroups()
        break
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss"></style>
