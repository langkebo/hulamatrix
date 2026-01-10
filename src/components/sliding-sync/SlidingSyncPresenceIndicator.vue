<!--
  SlidingSyncPresenceIndicator Component
  Display user presence status from Sliding Sync
-->
<template>
  <div class="presence-indicator" :class="statusClass">
    <n-tooltip trigger="hover">
      <template #trigger>
        <div class="indicator-dot" />
      </template>
      <div class="presence-tooltip">
        <div class="user-info">
          <n-avatar v-if="userInfo?.avatar_url" :src="userInfo.avatar_url" size="small" round />
          <span class="username">{{ displayName }}</span>
        </div>
        <div class="status-info">
          <n-icon :component="statusIcon" size="14" />
          <span>{{ statusText }}</span>
        </div>
        <div v-if="lastActive" class="last-active">
          {{ lastActiveText }}
        </div>
      </div>
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSlidingSyncPresence } from '@/hooks/useSlidingSync'
import { logger } from '@/utils/logger'
import { NTooltip, NAvatar, NIcon } from 'naive-ui'
import { Circle, Clock, AlertCircle } from '@vicons/tabler'

// Props
interface Props {
  userId: string
  displayName?: string
  userInfo?: {
    avatar_url?: string
    display_name?: string
  }
  showTooltip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  displayName: '',
  showTooltip: true
})

// Composables
const { getPresence, isOnline } = useSlidingSyncPresence()

// Computed
const presence = computed(() => {
  return getPresence(props.userId)
})

const status = computed(() => {
  return presence.value?.presence || 'offline'
})

const statusClass = computed(() => {
  return `status-${status.value}`
})

const statusText = computed(() => {
  const statusMap = {
    online: '在线',
    offline: '离线',
    unavailable: '离开'
  }
  return statusMap[status.value] || '未知'
})

const statusIcon = computed(() => {
  const iconMap = {
    online: Circle,
    offline: Circle,
    unavailable: Clock
  }
  return iconMap[status.value] || AlertCircle
})

const lastActive = computed(() => {
  return presence.value?.last_active_ago
})

const lastActiveText = computed(() => {
  if (!lastActive.value) return ''

  const minutes = Math.floor(lastActive.value / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return '刚刚活跃'
  if (minutes < 60) return `${minutes}分钟前活跃`
  if (hours < 24) return `${hours}小时前活跃`
  if (days < 7) return `${days}天前活跃`

  return '很久未活跃'
})

const displayName = computed(() => {
  return props.displayName || props.userInfo?.display_name || props.userId
})

// Methods
const updatePresence = () => {
  // Force refresh presence data
  const currentPresence = getPresence(props.userId)
  logger.debug('[PresenceIndicator] Presence updated:', {
    userId: props.userId,
    presence: currentPresence
  })
}

defineExpose({
  updatePresence
})
</script>

<style lang="scss" scoped>
.presence-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;

  .indicator-dot {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  &.status-online .indicator-dot {
    background-color: var(--hula-brand-primary);
    box-shadow: 0 0 0 2px rgba(var(--hula-success-rgb), 0.2);
  }

  &.status-offline .indicator-dot {
    background-color: var(--hula-brand-primary);
  }

  &.status-unavailable .indicator-dot {
    background-color: var(--hula-brand-primary);
    box-shadow: 0 0 0 2px rgba(var(--hula-warning-rgb), 0.2);
  }
}

.presence-tooltip {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
  padding: 4px 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .username {
    font-weight: 500;
    font-size: 13px;
  }
}

.status-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--n-text-color-2);
}

.last-active {
  font-size: 11px;
  color: var(--n-text-color-3);
  padding-top: 4px;
  border-top: 1px solid var(--n-divider-color);
}

// Variant: Large indicator
.presence-indicator.large {
  width: 16px;
  height: 16px;

  .indicator-dot {
    width: 100%;
    height: 100%;
  }
}

// Variant: Small indicator
.presence-indicator.small {
  width: 8px;
  height: 8px;
}

// Variant: With label
.presence-indicator.with-label {
  display: flex;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  background-color: var(--n-color-modal);

  .indicator-dot {
    flex-shrink: 0;
  }

  .status-label {
    font-size: 11px;
    color: var(--n-text-color-2);
  }
}

// Animation for status changes
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.presence-indicator.status-online .indicator-dot {
  animation: pulse 2s ease-in-out infinite;
}
</style>
