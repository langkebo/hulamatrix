<template>
  <div class="mobile-presence-status" :class="`size-${size}`">
    <div class="presence-dot" :class="statusClass" />
    <van-popup v-if="showTooltip" v-model:show="showPopup" position="top">
      <div class="presence-tooltip">
        <div class="tooltip-text">{{ statusText }}</div>
        <div v-if="lastActive" class="tooltip-time">
          {{ formatLastActive(lastActive) }}
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popup as VanPopup } from 'vant'
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

const showPopup = ref(false)

const presence = computed<PresenceStateType>(() => {
  return (presenceStore.getPresence(props.userId) || 'offline') as PresenceStateType
})

const lastActive = computed(() => {
  return presenceStore.getLastActive?.(props.userId)
})

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
.mobile-presence-status {
  position: relative;
  display: inline-block;

  .presence-dot {
    border-radius: 50%;
    background: currentColor;
    transition: all 0.2s ease;

    &.status-online {
      background: #07c160;
      box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
    }

    &.status-offline {
      background: #909399;
    }

    &.status-unavailable {
      background: #ff976a;
      box-shadow: 0 0 0 2px rgba(255, 151, 106, 0.2);
    }
  }

  &.size-small .presence-dot {
    width: 8px;
    height: 8px;
  }

  &.size-medium .presence-dot {
    width: 10px;
    height: 10px;
  }

  &.size-large .presence-dot {
    width: 12px;
    height: 12px;
  }

  .presence-tooltip {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    color: #fff;
    white-space: nowrap;

    .tooltip-text {
      font-size: 14px;
    }

    .tooltip-time {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 2px;
    }
  }
}
</style>
