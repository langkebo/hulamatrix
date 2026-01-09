<template>
  <div class="presence-status" :class="presenceClass">
    <div v-if="showTooltip" class="presence-tooltip">
      <n-text>{{ statusText }}</n-text>
      <n-text v-if="lastActive" depth="3" class="last-active-text">
        {{ formatLastActive(lastActive) }}
      </n-text>
    </div>
    <div class="presence-dot" :class="statusClass" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText } from 'naive-ui'
import { usePresenceStore } from '@/stores/presence'

type PresenceStateType = 'online' | 'offline' | 'unavailable'

interface Props {
  userId: string
  size?: 'small' | 'medium' | 'large'
  showTooltip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  showTooltip: true
})

const { t } = useI18n()
const presenceStore = usePresenceStore()

const presence = computed<PresenceStateType>(() => {
  return (presenceStore.getPresence(props.userId) || 'offline') as PresenceStateType
})

const lastActive = computed(() => {
  return presenceStore.getLastActive?.(props.userId)
})

const presenceClass = computed(() => `presence-${props.size}`)

const statusClass = computed(() => {
  return {
    'status-online': presence.value === 'online',
    'status-offline': presence.value === 'offline',
    'status-unavailable': presence.value === 'unavailable'
  }
})

const statusText = computed(() => {
  switch (presence.value) {
    case 'online':
      return t('presence.online')
    case 'offline':
      return t('presence.offline')
    case 'unavailable':
      return t('presence.unavailable')
    default:
      return t('presence.unknown')
  }
})

function formatLastActive(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('presence.last_seen_now')
  if (diff < 3600000) return t('presence.last_seen_minutes', { minutes: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('presence.last_seen_hours', { hours: Math.floor(diff / 3600000) })
  return t('presence.last_seen_days', { days: Math.floor(diff / 86400000) })
}
</script>

<style lang="scss" scoped>
.presence-status {
  position: relative;
  display: inline-block;

  .presence-dot {
    border-radius: 50%;
    background: currentColor;
    transition: all 0.2s ease;

    &.status-online {
      background: var(--hula-brand-primary);
      box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
    }

    &.status-offline {
      background: var(--hula-brand-primary);
    }

    &.status-unavailable {
      background: var(--hula-brand-primary);
      box-shadow: 0 0 0 2px rgba(240, 160, 32, 0.2);
    }
  }

  &.presence-small .presence-dot {
    width: 8px;
    height: 8px;
  }

  &.presence-medium .presence-dot {
    width: 10px;
    height: 10px;
  }

  &.presence-large .presence-dot {
    width: 12px;
    height: 12px;
  }

  .presence-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: var(--popover-color);
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 1000;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--popover-color);
    }
  }

  &:hover .presence-tooltip {
    opacity: 1;
  }

  .last-active-text {
    font-size: 11px;
  }
}
</style>
