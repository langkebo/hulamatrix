<template>
  <div class="matrix-message-quote">
    <!-- Placeholder for message quote functionality -->
    <div v-if="message" class="quote-content">
      <span class="quote-author">{{ message.sender || 'Unknown' }}</span>
      <span class="quote-text">{{ truncate(getContentText(message.content), 50) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatrixMessage } from '@/types/matrix'

interface Props {
  message?: MatrixMessage | null
}

defineProps<Props>()

function getContentText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const c = content as Record<string, unknown>
  return (c.body as string) || (c.msgtype as string) || ''
}

function truncate(text: string, length: number): string {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}
</script>

<style scoped>
.matrix-message-quote {
  padding: 8px;
  border-left: 3px solid #888;
  background: rgba(var(--hula-black-rgb), 0.05);
  border-radius: 4px;
}

.quote-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quote-author {
  font-weight: 600;
  font-size: 12px;
  color: #888;
}

.quote-text {
  font-size: 13px;
  color: var(--hula-gray-900);
}
</style>
