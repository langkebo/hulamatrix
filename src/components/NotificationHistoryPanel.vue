<template>
  <div class="p-12px">
    <n-space align="center" :size="8" class="mb-8px">
      <n-button type="primary" @click="refresh">刷新</n-button>
      <n-tag type="info" size="small">{{ list.length }} 条</n-tag>
    </n-space>
    <n-list>
      <n-list-item v-for="it in list" :key="it.event?.event_id || it.event_id">
        <div class="title">{{ it.room_id }}</div>
        <div class="body">{{ it.event?.content?.body || '事件' }}</div>
      </n-list-item>
    </n-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getNotificationHistory } from '@/integrations/matrix/pushers'

interface NotificationItem {
  event_id?: string
  room_id: string
  event?: {
    event_id?: string
    content?: {
      body?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

const list = ref<NotificationItem[]>([])
const refresh = async () => {
  list.value = (await getNotificationHistory(50)) as NotificationItem[]
}
</script>

<style scoped>
.title {
  font-size: 13px;
  color: var(--text-color);
}
.body {
  font-size: 12px;
  color: var(--chat-text-color);
}
</style>
