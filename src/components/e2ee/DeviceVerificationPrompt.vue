<!--
  DeviceVerificationPrompt Component - Prompt user to verify unverified devices

  Usage:
  <DeviceVerificationPrompt
    :unverified-devices="unverifiedDevices"
    :show="showPrompt"
    @verify="handleVerify"
    @dismiss="handleDismiss"
  />
-->
<template>
  <n-alert
    v-if="show && hasUnverifiedDevices"
    type="warning"
    closable
    :title="alertTitle"
    @close="handleDismiss"
    class="device-verification-prompt"
    role="alert"
    aria-live="polite">
    <template #icon>
      <Icon icon="mdi:shield-alert" :size="22" />
    </template>

    <div class="prompt-content">
      <p class="prompt-message">
        {{ $t('e2ee.verification.prompt_message', { count: unverifiedDevices.length }) }}
      </p>

      <!-- Unverified Devices List -->
      <collapse-transition>
        <div v-if="expanded" class="devices-list">
          <div
            v-for="device in unverifiedDevices.slice(0, maxDisplayDevices)"
            :key="device.device_id"
            class="device-item"
            role="listitem">
            <div class="device-info">
              <div class="device-name">
                <Icon icon="mdi:phone" :size="16" />
                <span>{{ device.display_name || device.device_id }}</span>
              </div>
              <n-tag size="small" type="warning">
                {{ $t('e2ee.verification.unverified') }}
              </n-tag>
            </div>
            <n-button
              size="small"
              type="primary"
              @click="handleVerifyDevice(device)"
              :aria-label="$t('e2ee.verification.verify_device', { name: device.display_name || device.device_id })">
              {{ $t('e2ee.verification.verify') }}
            </n-button>
          </div>

          <!-- Show More/Less -->
          <div v-if="unverifiedDevices.length > maxDisplayDevices" class="show-more">
            <n-button text @click="showAll = !showAll">
              {{ showAll ? $t('common.show_less') : $t('common.show_more', { count: unverifiedDevices.length - maxDisplayDevices }) }}
            </n-button>
          </div>
        </div>
      </collapse_transition>

      <!-- Actions -->
      <div class="prompt-actions">
        <n-button size="small" @click="handleExpandToggle">
          {{ expanded ? $t('e2ee.verification.hide_devices') : $t('e2ee.verification.show_devices') }}
        </n-button>
        <n-button
          size="small"
          type="primary"
          @click="handleVerifyAll"
          :loading="verifying">
          {{ $t('e2ee.verification.verify_all') }}
        </n-button>
      </div>
    </div>
  </n-alert>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NIcon, NTag, type AlertProps } from 'naive-ui'
import { Icon } from '@iconify/vue'
import CollapseTransition from '@/components/transitions/CollapseTransition.vue'

export interface DeviceInfo {
  device_id: string
  display_name?: string
  last_seen_ts?: number
}

interface Props {
  unverifiedDevices: DeviceInfo[]
  show?: boolean
  maxDisplayDevices?: number
  type?: AlertProps['type']
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  maxDisplayDevices: 3,
  type: 'warning'
})

const emit = defineEmits<{
  verify: [device: DeviceInfo]
  'verify-all': []
  dismiss: []
}>()

const { t } = useI18n()

// State
const expanded = ref(false)
const showAll = ref(false)
const verifying = ref(false)

// Computed
const hasUnverifiedDevices = computed(() => props.unverifiedDevices.length > 0)

const alertTitle = computed(() => {
  if (props.unverifiedDevices.length === 1) {
    return t('e2ee.verification.single_device_title')
  }
  return t('e2ee.verification.multiple_devices_title', { count: props.unverifiedDevices.length })
})

// Methods
const handleExpandToggle = () => {
  expanded.value = !expanded.value
}

const handleVerifyDevice = (device: DeviceInfo) => {
  emit('verify', device)
}

const handleVerifyAll = async () => {
  verifying.value = true
  try {
    emit('verify-all')
  } finally {
    setTimeout(() => {
      verifying.value = false
    }, 1000)
  }
}

const handleDismiss = () => {
  emit('dismiss')
}

// Auto-expand when prompt appears
watch(
  () => props.show,
  (show) => {
    if (show && hasUnverifiedDevices.value) {
      expanded.value = true
    }
  },
  { immediate: true }
)

// Expose methods
defineExpose({
  expand: () => {
    expanded.value = true
  },
  collapse: () => {
    expanded.value = false
  }
})
</script>

<style scoped lang="scss">
.device-verification-prompt {
  margin: 16px 0;
}

.prompt-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompt-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color-2);
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hula-spacing-md);
  padding: var(--hula-spacing-sm);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--hula-radius-sm);
  transition: background 0.2s var(--ease-out-cubic), border-color 0.2s var(--ease-out-cubic);

  &:hover {
    border-color: var(--border-active-color);
    background: var(--hover-color);
  }
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: calc(var(--hula-spacing-xs) * 1.5);
  flex: 1;
  min-width: 0;
}

.device-name {
  display: flex;
  align-items: center;
  gap: calc(var(--hula-spacing-xs) * 1.5);
  font-size: var(--hula-text-sm);
  font-weight: 500;
  color: var(--text-color-1);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.show-more {
  display: flex;
  justify-content: center;
  padding-top: var(--hula-spacing-xs);
}

.prompt-actions {
  display: flex;
  gap: var(--hula-spacing-xs);
  justify-content: flex-end;
  flex-wrap: wrap;
}

// Collapse transition styles
.collapse-enter-active,
.collapse-leave-active {
  transition: height 0.3s var(--ease-out-cubic), opacity 0.3s var(--ease-out-cubic);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
  opacity: 1;
}

// Mobile optimization
@media (max-width: 768px) {
  .device-item {
    flex-direction: column;
    align-items: stretch;
  }

  .prompt-actions {
    flex-direction: column;

    .n-button {
      width: 100%;
    }
  }
}
</style>
