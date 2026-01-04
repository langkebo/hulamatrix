<template>
  <div v-if="isTyping" class="typing-floating">
    <div class="flex items-center gap-6px typing-hint">
      <span class="dot-online" v-if="onlineCount > 0"></span>
      正在输入…
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useTypingStore } from '@/integrations/matrix/typing'
import { usePresenceStore } from '@/stores/presence'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { matrixClientService } from '@/integrations/matrix/client'
import { getRoom } from '@/utils/matrixClientUtils'

const typingStore = useTypingStore()
const presenceStore = usePresenceStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

const typingUsers = computed(() => {
  const list = typingStore.get(globalStore.currentSessionRoomId)
  const selfIds = [userStore.userInfo?.uid, userStore.userInfo?.account].filter(Boolean)
  return list.filter((u) => !selfIds.includes(u))
})
const isTyping = computed(() => typingUsers.value.length > 0)
const onlineCount = computed(() => {
  try {
    const client = matrixClientService.getClient()
    const room = getRoom(client, globalStore.currentSessionRoomId) as {
      getJoinedMembers?: () => { userId: string }[]
    } | null
    const members = room?.getJoinedMembers?.()?.map((m: { userId: string }) => m.userId) || []
    return members.filter((uid: string) => presenceStore.isOnline(uid)).length
  } catch {
    return 0
  }
})
</script>
<style scoped>
.typing-floating {
  position: absolute;
  z-index: 12;
  bottom: 24px;
  left: 22px;
}
</style>
