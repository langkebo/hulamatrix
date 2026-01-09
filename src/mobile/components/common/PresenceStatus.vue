<template>
  <div class="mobile-presence-status">
    <div class="presence-dot" :class="statusClass" />
    <span v-if="showText" class="presence-text">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePresenceStore } from '@/stores/presence'

type PresenceStateType = 'online' | 'offline' | 'unavailable'

interface Props {
  userId: string
  size?: 'small' | 'medium' | 'large'
  showText?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  showText: false
})

const { t } = useI18n()
const presenceStore = usePresenceStore()

const presence = computed<PresenceStateType>(() => {
  return (presenceStore.getPresence(props.userId) || 'offline') as PresenceStateType
})

const statusClass = computed(() => {
  return {
    'status-online': presence.value === 'online',
    'status-offline': presence.value === 'offline',
    'status-unavailable': presence.value === 'unavailable',
    [`size-${props.size}`]: true
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
</script>

<style lang="scss" scoped>
.mobile-presence-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .presence-dot {
    border-radius: 50%;
    background: currentColor;
    transition: all 0.2s ease;

    &.status-online {
      background: var(--hula-success);
    }

    &.status-offline {
      background: var(--hula-gray-400);
    }

    &.status-unavailable {
      background: var(--hula-warning);
    }

    &.size-small {
      width: 8px;
      height: 8px;
    }

    &.size-medium {
      width: 10px;
      height: 10px;
    }

    &.size-large {
      width: 12px;
      height: 12px;
    }
  }

  .presence-text {
    font-size: 12px;
    color: var(--van-text-color-2);
  }
}
</style>
