<template>
  <n-flex vertical :size="12">
    <n-flex align="center" :size="8">
      <n-input v-model:value="roomId" placeholder="room_id" style="max-width: 260px" />
      <n-input-number v-model:value="days" :min="1" :max="365" />
      <n-button type="warning" @click="purge">清理历史媒体</n-button>
    </n-flex>
    <n-alert type="info">按房间清理历史消息，以便回收媒体与历史占用</n-alert>
  </n-flex>
</template>
<script setup lang="ts">
/**
 * AdminMedia.vue - 媒体管理界面
 * Requirements 10.5: Update Admin UI components to use SDK methods
 */
import { ref } from 'vue'
import { adminClient } from '@/services/adminClient'

const roomId = ref('')
const days = ref<number>(30)

const purge = async () => {
  if (!roomId.value) return
  const ts = Date.now() - days.value * 24 * 3600 * 1000
  await adminClient.purgeHistory(roomId.value, ts)
}
</script>
