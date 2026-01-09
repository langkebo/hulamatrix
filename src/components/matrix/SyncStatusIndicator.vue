<template>
  <n-flex align="center" :size="8" class="sync-status-indicator">
    <!-- Syncing spinner -->
    <n-spin v-if="syncState === 'SYNCING'" size="small" />

    <!-- Error icon -->
    <n-icon v-else-if="syncState === 'ERROR'" :size="16" :color="statusColor">
      <AlertCircleIcon />
    </n-icon>

    <!-- Reconnecting icon with animation -->
    <n-icon v-else-if="syncState === 'RECONNECTING'" :size="16" class="rotating-icon" :color="statusColor">
      <RefreshIcon />
    </n-icon>

    <!-- Prepared/Success icon -->
    <n-icon v-else-if="syncState === 'PREPARED'" :size="16" :color="statusColor">
      <CheckmarkIcon />
    </n-icon>

    <!-- Stopped icon -->
    <n-icon v-else-if="syncState === 'STOPPED'" :size="16" :color="statusColor">
      <StopIcon />
    </n-icon>

    <!-- Status text -->
    <span class="status-text" :style="{ color: statusColor }">{{ statusText }}</span>

    <!-- Reconnect info -->
    <n-tooltip v-if="syncState === 'RECONNECTING'" trigger="hover">
      <template #trigger>
        <n-text depth="3" class="reconnect-info">{{ reconnectInfo }}</n-text>
      </template>
      <span>正在尝试重新连接服务器...</span>
    </n-tooltip>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import {
  AlertCircle as AlertCircleIcon,
  Refresh as RefreshIcon,
  Check as CheckmarkIcon,
  Square as StopIcon
} from '@vicons/tabler'

const syncState = computed(() => matrixClientService.getSyncState())

// Expose reconnect info if available
const reconnectAttempts = computed(() => {
  return (matrixClientService as unknown as { reconnectAttempts?: number }).reconnectAttempts || 0
})

const reconnectInfo = computed(() => {
  const max = (matrixClientService as unknown as { maxReconnectAttempts?: number }).maxReconnectAttempts || 5
  return `${reconnectAttempts.value}/${max}`
})

const statusText = computed(() => {
  switch (syncState.value) {
    case 'SYNCING':
      return '同步中'
    case 'PREPARED':
      return '已连接'
    case 'RECONNECTING':
      return '重连中'
    case 'ERROR':
      return '连接错误'
    case 'STOPPED':
      return '已停止'
    default:
      return '未知状态'
  }
})

const statusColor = computed(() => {
  switch (syncState.value) {
    case 'SYNCING':
      return 'var(--hula-brand-primary)' // green
    case 'PREPARED':
      return 'var(--hula-brand-primary)' // blue
    case 'RECONNECTING':
      return 'var(--hula-brand-primary)' // orange
    case 'ERROR':
      return 'var(--hula-brand-primary)' // red
    case 'STOPPED':
      return 'var(--hula-brand-primary)' // gray
    default:
      return 'var(--hula-brand-primary)'
  }
})
</script>

<style scoped>
.sync-status-indicator {
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
}

.reconnect-info {
  font-size: 11px;
  opacity: 0.8;
}

.rotating-icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
