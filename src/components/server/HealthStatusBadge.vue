<template>
  <div class="health-status-badge" :class="statusClass">
    <div class="status-indicator" :class="statusIndicatorClass"></div>
    <span class="status-text">{{ statusText }}</span>
    <span v-if="showResponseTime && responseTime" class="response-time">{{ responseTime }}ms</span>
    <n-button v-if="showRefreshButton" text size="tiny" @click="$emit('refresh')">
      <template #icon>
        <n-icon size="14"><Refresh /></n-icon>
      </template>
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NIcon, NButton } from 'naive-ui'
import { Refresh } from '@vicons/tabler'
import type { HealthStatus } from '@/types/server'

interface Props {
  healthStatus: HealthStatus | null
  showResponseTime?: boolean
  showRefreshButton?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showResponseTime: true,
  showRefreshButton: true,
  compact: false
})

defineEmits<(e: 'refresh') => void>()

const statusClass = computed(() => {
  if (!props.healthStatus) return 'unknown'
  if (props.healthStatus.reachable) return 'healthy'
  return 'unhealthy'
})

const statusIndicatorClass = computed(() => {
  if (!props.healthStatus) return 'unknown'
  if (props.healthStatus.reachable) return 'healthy'
  return 'unhealthy'
})

const statusText = computed(() => {
  if (!props.healthStatus) return '未检查'

  if (props.healthStatus.reachable) {
    return props.compact ? '在线' : '正常'
  }

  if (props.healthStatus.error) {
    return props.compact ? '离线' : props.healthStatus.error
  }

  return props.compact ? '离线' : '无法连接'
})

const responseTime = computed(() => {
  if (props.healthStatus?.responseTime) {
    return Math.round(props.healthStatus.responseTime)
  }
  return null
})

const showResponseTime = computed(() => {
  return props.showResponseTime && props.healthStatus?.reachable && props.healthStatus.responseTime
})
</script>

<style scoped lang="scss">
.health-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;

  &.healthy {
    background: rgba(var(--n-success-color), 0.1);
    color: var(--n-success-color);
  }

  &.unhealthy {
    background: rgba(var(--n-error-color), 0.1);
    color: var(--n-error-color);
  }

  &.unknown {
    background: rgba(var(--n-text-color-3), 0.1);
    color: var(--n-text-color-3);
  }
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.healthy {
    background: var(--n-success-color);
    box-shadow: 0 0 4px var(--n-success-color);
  }

  &.unhealthy {
    background: var(--n-error-color);
  }

  &.unknown {
    background: var(--n-text-color-3);
  }
}

.response-time {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 4px;
}

.status-text {
  white-space: nowrap;
}
</style>
