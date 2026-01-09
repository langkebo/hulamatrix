<template>
  <MobileLayout>
    <div class="flex w-full flex-col h-full">
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="邀请群友" />

      <!-- 顶部搜索框 -->
      <div class="px-16px mt-10px flex gap-3">
        <div class="flex-1 py-5px shrink-0">
          <n-input
            v-model:value="keyword"
            class="rounded-10px w-full bg-gray-100 relative text-14px"
            placeholder="搜索联系人~"
            clearable
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off">
            <template #prefix>
              <svg class="w-12px h-12px"><use href="#search"></use></svg>
            </template>
          </n-input>
        </div>
        <div class="flex justify-end items-center">
          <n-button class="py-5px" @click="doSearch">搜索</n-button>
        </div>
      </div>

      <!-- 好友列表 -->
      <div ref="scrollArea" class="flex-1 overflow-y-auto px-16px mt-10px" :style="{ height: scrollHeight + 'px' }">
        <n-scrollbar class="member-scrollbar">
          <n-checkbox-group v-model:value="selectedList" class="flex flex-col gap-2">
            <div
              v-for="item in filteredContacts"
              :key="item.uid"
              class="rounded-10px border border-gray-200 overflow-hidden">
              <n-checkbox
                :value="item.uid"
                size="large"
                class="w-full flex items-center px-5px"
                :class="[
                  'cursor-pointer select-none transition-colors duration-150',
                  selectedList.includes(item.uid) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                ]">
                <template #default>
                  <div class="flex items-center gap-10px px-8px py-10px">
                    <!-- 头像 -->
                    <n-avatar
                      round
                      :size="44"
                      :src="AvatarUtils.getAvatarUrl(item.avatar!)"
                      fallback-src="/logo.png"
                      class="avatar-bordered" />
                    <!-- 文字信息 -->
                    <div class="flex flex-col leading-tight truncate">
                      <span class="text-14px font-medium truncate">
                        {{ item.name }}
                      </span>
                      <div class="text-12px text-gray-500 flex items-center gap-4px truncate">
                        <!-- 在线状态暂未从FriendsStore完全同步，默认离线或隐藏 -->
                        <!-- <n-badge :color="(item.activeStatus === OnlineEnum.ONLINE) ? 'var(--hula-success)' : 'var(--hula-gray-400)'" dot /> -->
                        <!-- {{ (item.activeStatus === OnlineEnum.ONLINE) ? '在线' : '离线' }} -->
                      </div>
                    </div>
                  </div>
                </template>
              </n-checkbox>
            </div>
          </n-checkbox-group>
        </n-scrollbar>
      </div>

      <!-- 底部操作栏 -->
      <div class="px-16px py-10px bg-white border-t border-gray-200 flex justify-between items-center">
        <span class="text-14px">已选择 {{ selectedList.length }} 人</span>
        <n-button type="primary" :disabled="selectedList.length === 0" :loading="isLoading" @click="handleInvite">
          邀请
        </n-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import { useFriendsStore } from '@/stores/friendsSDK'
import { useGlobalStore } from '@/stores/global'
import { useRoomStore } from '@/stores/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import router from '@/router'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

defineOptions({
  name: 'mobileInviteGroupMember'
})

const friendsStore = useFriendsStore()
const globalStore = useGlobalStore()
const roomStore = useRoomStore()

const keyword = ref('')
const selectedList = ref<string[]>([])
const isLoading = ref(false)
const scrollHeight = ref(0)
const scrollArea = ref<HTMLElement>()

// 获取所有好友列表（排除已在群中的成员和机器人）
const allContacts = computed(() => {
  const contacts = (friendsStore.friends || [])
    .filter((f) => f.user_id) // 过滤掉没有 user_id 的好友
    .map((f) => ({
      uid: f.user_id!,
      name: f.display_name || f.name || f.user_id!,
      avatar: f.avatar_url
      // activeStatus: ... // FriendsStore info
    }))

  return contacts.filter((item) => {
    // 排除机器人（uid === '1'）
    if (item.uid === '1') {
      return false
    }

    // 排除已在群中的成员
    const isInGroup = !!roomStore.getMember(globalStore.currentSessionRoomId, item.uid)
    return !isInGroup
  })
})

// 搜索过滤
const filteredContacts = computed(() => {
  if (!keyword.value.trim()) {
    return allContacts.value
  }

  const searchKeyword = keyword.value.toLowerCase()
  return allContacts.value.filter((item) => {
    const name = (item.name || '').toLowerCase()
    const uid = (item.uid || '').toLowerCase()
    return name.includes(searchKeyword) || uid.includes(searchKeyword)
  })
})

// 搜索功能
const doSearch = () => {
  // 搜索逻辑已在 filteredContacts 中实现
}

// 处理邀请
const handleInvite = async () => {
  if (selectedList.value.length === 0) {
    msg.warning('请选择要邀请的好友')
    return
  }

  isLoading.value = true
  try {
    const service = roomStore.getService()
    if (!service) {
      throw new Error('Service not initialized')
    }

    // 批量邀请
    const invitePromises = selectedList.value.map((uid) => service.inviteUser(globalStore.currentSessionRoomId, uid))
    await Promise.all(invitePromises)

    msg.success(`成功邀请 ${selectedList.value.length} 位好友`)
    // 返回群设置页面
    router.back()
  } catch (error) {
    logger.error('邀请失败:', error)
    msg.error('邀请失败，请重试')
  } finally {
    isLoading.value = false
  }
}

// 计算滚动区域高度
const calculateScrollHeight = () => {
  if (scrollArea.value) {
    const rect = scrollArea.value.getBoundingClientRect()
    scrollHeight.value = window.innerHeight - rect.top - 60
  }
}

// 初始化时获取群成员列表
onMounted(async () => {
  try {
    // 加载当前群的成员列表
    if (globalStore.currentSessionRoomId) {
      await roomStore.initRoom(globalStore.currentSessionRoomId)
    }
  } catch (error) {
    logger.error('加载用户信息失败:', error)
  }

  calculateScrollHeight()
  window.addEventListener('resize', calculateScrollHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateScrollHeight)
})
</script>

<style scoped>
.member-scrollbar {
  max-height: calc(100vh - 150px);
}

.avatar-bordered {
  border: 1px solid var(--avatar-border-color);
}
</style>
