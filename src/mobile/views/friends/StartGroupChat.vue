<template>
  <MobileLayout>
    <div class="flex w-full flex-col h-full">
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="发起群聊" />

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

      <!-- 联系人列表 -->
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
                <template var(--hula-gray-100)ult>
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
                        <!-- 在线状态暂未同步 -->
                        <!-- <n-badge :color="(item.activeStatus === OnlineEnum.ONLINE) ? '#1ab292' : 'var(--hula-gray-400)'" dot /> -->
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
        <n-button type="primary" :disabled="selectedList.length === 0" :loading="isLoading" @click="createGroup">
          发起群聊
        </n-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useFriendsStore } from '@/stores/friendsSDK'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import router from '@/router'

// store
const friendsStore = useFriendsStore()
const roomStore = useRoomStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()

// 搜索关键字
const keyword = ref('')

// 选中的联系人 uid 数组
const selectedList = ref<string[]>([])
const isLoading = ref(false)

// 滚动高度计算
const scrollHeight = ref(600)
onMounted(() => {
  scrollHeight.value = window.innerHeight - 180
})

// 搜索逻辑
const doSearch = () => {
  // 这里只是触发响应式，实际过滤逻辑写在 computed 里
}

const filteredContacts = computed(() => {
  const contactsList = (friendsStore.friends || [])
    .filter((f) => f.user_id) // 过滤掉没有 user_id 的好友
    .map((f) => ({
      uid: String(f.user_id),
      name: String(f.display_name || f.name || f.user_id),
      avatar: f.avatar_url
    }))
    .filter((c) => {
      if (c.uid === '1') {
        // 排除hula小管家
        return false
      }
      return true
    })

  if (!keyword.value) return contactsList
  return contactsList.filter((c) => {
    return (c.name || '').toLowerCase().includes(keyword.value.toLowerCase())
  })
})

// 点击发起群聊
const createGroup = async () => {
  if (selectedList.value.length === 0) {
    msg.warning('请选择联系人')
    return
  }

  isLoading.value = true
  try {
    const service = roomStore.getService()
    if (!service) throw new Error('Service not initialized')

    const myName = userStore.userInfo?.name || '我'
    const roomName = `${myName}创建的群聊`

    // 创建房间
    const roomId = await service.createRoom({
      name: roomName,
      invite: selectedList.value,
      isPrivate: true
    })

    // 进入房间
    globalStore.updateCurrentSessionRoomId(roomId)
    await roomStore.initRoom(roomId)

    msg.success('创建群聊成功')
    resetCreateGroupState()

    // 跳转到聊天页
    router.push(`/mobile/chatRoom/chatMain/${roomId}`)
  } catch (error) {
    logger.error('创建群聊失败:', error)
    msg.error('创建群聊失败')
  } finally {
    isLoading.value = false
  }
}

const resetCreateGroupState = () => {
  selectedList.value = []
  keyword.value = ''
}
</script>

<style lang="scss" scoped>
.member-scrollbar {
  max-height: calc(100vh - 150px);
}

.avatar-bordered {
  border: 1px solid var(--avatar-border-color);
}
</style>
