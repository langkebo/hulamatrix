<template>
  <div
    class="message-status-indicator"
    :class="[`status-${status}`, { 'status-clickable': clickable }]"
    :role="clickable ? 'button' : 'status'"
    :tabindex="clickable ? 0 : -1"
    :aria-label="statusAriaLabel"
    @click="handleClick"
    @keydown.enter="handleClick">
    <!-- 发送中 -->
    <svg
      v-if="status === 'sending'"
      class="spin"
      :size="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <circle cx="12" cy="12" r="10" />
    </svg>

    <!-- 已发送 -->
    <svg
      v-else-if="status === 'sent'"
      :size="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    <!-- 已送达 -->
    <svg
      v-else-if="status === 'delivered'"
      :size="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M20 13l-7 7-5-5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    <!-- 已读 -->
    <svg
      v-else-if="status === 'read'"
      :size="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="status-read">
      <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M20 13l-7 7-5-5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    <!-- 失败 -->
    <n-popover v-else-if="status === 'failed'" trigger="hover" placement="top">
      <template #trigger>
        <svg :size="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-error">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" stroke-linecap="round" />
          <path d="M12 16h.01" stroke-linecap="round" />
        </svg>
      </template>
      <span>{{ $t('message.status.failed_hint') }}</span>
    </n-popover>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover } from 'naive-ui'

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

interface Props {
  status: MessageStatus
  clickable?: boolean
  readBy?: string[]
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
  readBy: () => [],
  size: 14
})

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const statusAriaLabel = computed(() => {
  const labels: Record<MessageStatus, string> = {
    sending: t('message.status.sending'),
    sent: t('message.status.sent'),
    delivered: t('message.status.delivered'),
    read:
      props.readBy.length > 0
        ? t('message.status.read_by', { users: props.readBy.join(', ') })
        : t('message.status.read'),
    failed: t('message.status.failed')
  }
  return labels[props.status]
})

const handleClick = () => {
  if (props.clickable && props.status === 'failed') {
    emit('retry')
  }
}
</script>

<style scoped lang="scss">
.message-status-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-3);
  transition: color 0.2s var(--ease-out-cubic);
}

.message-status-indicator.status-clickable {
  cursor: pointer;
}

.message-status-indicator.status-clickable:hover {
  color: var(--color-error);
}

.status-read {
  color: var(--color-success);
}

.status-error {
  color: var(--color-error);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
