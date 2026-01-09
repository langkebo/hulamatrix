<template>
  <AutoFixHeightPage>
    <template #header>
      <HeaderBar
        ref="headerBar"
        :room-name="currentSession?.remark || currentSession?.name || ''"
        :msg-count="1002"
        :is-official="globalStore.currentSessionRoomId === '1'"
        @room-name-click="handleRoomNameClick" />
    </template>
    <template #container>
      <div @click="handleChatMainClick" class="h-full overflow-hidden">
        <div v-if="!globalStore.currentSessionRoomId" class="flex items-center justify-center h-full">
          <div class="text-center flex flex-col items-center gap-12px">
            <p class="text-(14px [--text-color])">尚未选择会话</p>
            <n-button size="small" tertiary @click="router.push('/mobile/home')">返回首页</n-button>
          </div>
        </div>
        <div v-else>
          <ChatMain @scroll="handleScroll" />
        </div>
      </div>
    </template>
    <div v-if="isTyping" class="typing-floating-mobile">
      <div class="flex items-center gap-6px typing-hint">
        <span class="dot-online" v-if="onlineCount > 0"></span>
        正在输入…
      </div>
    </div>
    <template #footer>
      <FooterBar ref="footerBar"></FooterBar>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'
import { useTypingStore } from '@/integrations/matrix/typing'
import { usePresenceStore } from '@/stores/presence'
import { matrixClientService } from '@/integrations/matrix/client'
defineOptions({
  name: 'mobileChatRoomDefault'
})

const globalStore = useGlobalStore()
const currentSession = computed(() => globalStore.currentSession)

const footerBar = ref<unknown>(null)
const headerBar = ref<unknown>(null)

const props = defineProps<{
  uid?: ''
}>()

const typingStore = useTypingStore()
const presenceStore = usePresenceStore()
const typingUsers = computed(() => {
  const list = typingStore.get(globalStore.currentSessionRoomId)
  const selfIds: string[] = []
  return list.filter((u) => !selfIds.includes(u))
})
const isTyping = computed(() => typingUsers.value.length > 0)
const onlineCount = computed(() => {
  try {
    const client = matrixClientService.getClient()
    const getRoomMethod = client?.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(globalStore.currentSessionRoomId)
    const getJoinedMembersMethod = room?.getJoinedMembers as (() => { userId: string }[]) | undefined
    const members = getJoinedMembersMethod?.()?.map((m: { userId: string }) => m.userId) || []
    return members.filter((uid: string) => presenceStore.isOnline(uid)).length
  } catch {
    return 0
  }
})

const handleChatMainClick = () => {
  // 移动端点击聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleScroll = () => {
  // 移动端滚动聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleRoomNameClick = () => {
  if (props.uid) {
    router.push(`/mobile/mobileFriends/friendInfo/${props.uid}`)
  }
}
</script>

<style lang="scss">
@use '@/styles/scss/render-message';

.typing-floating-mobile {
  position: fixed;
  left: 16px;
  bottom: 78px;
  z-index: 12;
}
</style>
