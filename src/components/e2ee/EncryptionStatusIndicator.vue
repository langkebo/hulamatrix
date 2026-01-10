<template>
  <div class="encryption-status" :class="statusClass" role="status" :aria-label="statusLabel">
    <svg class="status-icon" :size="iconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Locked icon for encrypted -->
      <path
        v-if="encrypted"
        d="M12 15a2 2 0 100-4 2 2 0 000 4zm0-2a2 2 0 11-4 0 2 2 0 014 0zm6 2a2 2 0 11-4 0 2 2 0 014 0zm2 2a2 2 0 11-4 0 2 2 0 014 0z"
        stroke-linecap="round"
        stroke-linejoin="round" />
      <path
        v-if="encrypted"
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 2a2 2 0 11-4 0 2 2 0 014 0z"
        stroke-linecap="round"
        stroke-linejoin="round" />
      <rect v-if="encrypted" x="8" y="11" width="8" height="10" rx="1" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Unlocked icon for unencrypted -->
      <path
        v-else
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 2a2 2 0 11-4 0 2 2 0 014 0z"
        stroke-linecap="round"
        stroke-linejoin="round" />
    </svg>

    <!-- 验证详情提示 -->
    <n-popover v-if="showDetails && encrypted" trigger="hover" placement="top">
      <template #trigger>
        <svg class="info-icon" :size="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </template>
      <div class="encryption-details">
        <p class="detail-title">{{ $t('e2ee.status.title') }}</p>
        <p class="detail-status">{{ statusDetail }}</p>
        <p v-if="verified" class="verified-info">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ $t('e2ee.status.verified') }}
        </p>
        <p v-else class="unverified-info">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4v.01" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          {{ $t('e2ee.status.unverified') }}
        </p>
      </div>
    </n-popover>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover } from 'naive-ui'

interface Props {
  encrypted: boolean
  verified?: boolean
  algorithm?: string
  showDetails?: boolean
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  verified: false,
  algorithm: 'm.megolm.v1.aes-sha2',
  showDetails: true,
  size: 'medium'
})

const { t } = useI18n()

const statusClass = computed(() => {
  if (!props.encrypted) return 'status-unencrypted'
  if (props.verified) return 'status-verified'
  return 'status-encrypted'
})

const statusLabel = computed(() => {
  if (!props.encrypted) return t('e2ee.status.unencrypted')
  if (props.verified) return t('e2ee.status.verified')
  return t('e2ee.status.encrypted')
})

const statusDetail = computed(() => {
  if (!props.encrypted) return t('e2ee.status.no_encryption')
  return t('e2ee.status.algorithm', { algo: props.algorithm })
})

const iconSize = computed(() => {
  const sizes = { small: 14, medium: 16, large: 20 }
  return sizes[props.size]
})
</script>

<style scoped lang="scss">
.encryption-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-icon {
  transition: color 0.2s var(--ease-out-cubic);
}

.status-encrypted {
  color: var(--color-warning);
}

.status-verified {
  color: var(--color-success);
}

.status-unencrypted {
  color: var(--color-error);
}

.info-icon {
  opacity: 0.6;
  cursor: help;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.verified-info {
  color: var(--color-success);
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 4px 0;
  font-size: 12px;
}

.unverified-info {
  color: var(--color-warning);
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 4px 0;
  font-size: 12px;
}

.encryption-details {
  max-width: 300px;

  p {
    margin: 4px 0;
  }

  .detail-title {
    font-weight: 600;
  }

  .detail-status {
    font-size: 12px;
    opacity: 0.8;
  }
}
</style>
