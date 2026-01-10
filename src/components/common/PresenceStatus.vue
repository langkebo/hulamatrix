<template>
  <div
    class="presence-status"
    :class="presenceClass"
    :role="showTooltip ? 'img' : 'presentation'"
    :aria-label="showTooltip ? statusText : undefined">
    <div v-if="showTooltip" class="presence-tooltip" role="tooltip" :aria-hidden="true">
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
    transition: opacity 0.2s ease;

    &.status-online {
      background: var(--hula-success);
      box-shadow: 0 0 0 2px rgba(var(--hula-success-rgb), 0.2);
    }

    &.status-offline {
      background: var(--n-text-color-disabled);
    }

    &.status-unavailable {
      background: var(--hula-danger);
      box-shadow: 0 0 0 2px rgba(var(--hula-danger-rgb), 0.2);
    }
  }

  &.presence-small .presence-dot {
    width: var(--hula-spacing-sm);
    height: var(--hula-spacing-sm);
  }

  &.presence-medium .presence-dot {
    width: 10px;
    height: 10px;
  }

  &.presence-large .presence-dot {
    width: var(--hula-spacing-md);
    height: var(--hula-spacing-md);
  }

  .presence-tooltip {
    position: absolute;
    bottom: calc(100% + var(--hula-spacing-sm));
    left: 50%;
    transform: translateX(-50%);
    padding: var(--hula-spacing-xs) var(--hula-spacing-sm);
    background: var(--popover-color);
    border-radius: var(--hula-radius-sm);
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
      border: var(--hula-spacing-xs) solid transparent;
      border-top-color: var(--popover-color);
    }
  }

  &:hover .presence-tooltip {
    opacity: 1;
  }

  .last-active-text {
    font-size: var(--hula-text-xs);
  }
}
</style>
