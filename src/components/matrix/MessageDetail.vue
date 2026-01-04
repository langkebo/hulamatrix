<template>
  <div class="message-detail">
    <!-- Placeholder for message detail functionality -->
    <div v-if="message" class="detail-content">
      <h3>消息详情</h3>
      <div class="detail-item">
        <span class="label">发送者:</span>
        <span>{{ message.sender || 'Unknown' }}</span>
      </div>
      <div class="detail-item">
        <span class="label">时间:</span>
        <span>{{ formatTime(message.timestamp || 0) }}</span>
      </div>
      <div class="detail-item">
        <span class="label">类型:</span>
        <span>{{ message.type }}</span>
      </div>
      <div class="detail-item">
        <span class="label">内容:</span>
        <span>{{ getContentText(message.content) || '(无内容)' }}</span>
      </div>
      <div class="detail-item">
        <span class="label">事件ID:</span>
        <span class="event-id">{{ message.eventId }}</span>
      </div>
    </div>
    <div v-else class="no-message">
      <p>没有选择的消息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatrixMessage } from '@/types/matrix'

interface Props {
  show?: boolean
  message?: MatrixMessage | null
}

defineProps<Props>()

function getContentText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const c = content as Record<string, unknown>
  return (c.body as string) || (c.msgtype as string) || ''
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped>
.message-detail {
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  gap: 8px;
}

.label {
  font-weight: 600;
  min-width: 60px;
}

.event-id {
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

.no-message {
  text-align: center;
  color: #888;
  padding: 40px 0;
}
</style>
