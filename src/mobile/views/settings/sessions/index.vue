<template>
  <SettingsLayout :title="t('setting.sessions.title')" :loading="loading">
    <div class="sessions-settings">
      <!-- Current Device Info -->
      <div class="current-device-card">
        <div class="device-info">
          <Icon name="smartphone" :size="32" />
          <div class="device-details">
            <div class="device-name">{{ currentDevice.displayName || t('setting.sessions.this_device') }}</div>
            <div class="device-id">{{ currentDevice.device_id || t('setting.sessions.unknown') }}</div>
          </div>
        </div>
        <div class="device-status">
          <span class="status-badge status-current">{{ t('setting.sessions.current') }}</span>
        </div>
      </div>

      <!-- Other Devices -->
      <div class="devices-section">
        <div class="section-header">
          <span class="section-title">{{ t('setting.sessions.other_devices') }}</span>
          <span class="section-count">({{ otherDevices.length }})</span>
        </div>

        <div v-if="otherDevices.length === 0" class="empty-state">
          <Icon name="devices" :size="48" />
          <p>{{ t('setting.sessions.no_other_devices') }}</p>
        </div>

        <div v-else class="devices-list">
          <div
            v-for="device in otherDevices"
            :key="device.device_id"
            class="device-card"
            :class="{ 'device-verified': device.verified }">
            <div class="device-info">
              <Icon :name="getDeviceIcon(device.device_type)" :size="24" />
              <div class="device-details">
                <div class="device-name">
                  {{ device.display_name || t('setting.sessions.unnamed_device') }}
                </div>
                <div class="device-meta">
                  <span class="device-id">{{ device.device_id }}</span>
                  <span v-if="device.last_seen_ts" class="device-seen">
                    {{ formatLastSeen(device.last_seen_ts) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="device-actions">
              <span v-if="device.verified" class="status-badge status-verified">
                {{ t('setting.sessions.verified') }}
              </span>
              <span v-else class="status-badge status-unverified">
                {{ t('setting.sessions.not_verified') }}
              </span>
              <n-button
                v-if="!device.verified"
                size="small"
                type="primary"
                secondary
                @click="handleVerifyDevice(device)">
                {{ t('setting.sessions.verify') }}
              </n-button>
              <n-button size="small" type="error" ghost @click="handleSignOutDevice(device)">
                {{ t('setting.sessions.sign_out') }}
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Link New Device -->
      <div class="link-device-section">
        <div class="settings-item" @click="handleLinkDevice">
          <div class="item-content">
            <div class="item-label">{{ t('setting.sessions.link_device') }}</div>
            <div class="item-description">{{ t('setting.sessions.link_device_desc') }}</div>
          </div>
          <Icon name="qrcode" :size="20" />
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, useMessage, useDialog } from 'naive-ui'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

interface Device {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  device_type?: string
  verified?: boolean
}

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const devices = ref<Device[]>([])

// Current device (this device)
const currentDevice = computed(() => {
  const client = matrixClientService.getClient()
  if (!client) return { device_id: '' }
  return {
    device_id: (client.getDeviceId as () => string)() || '',
    displayName: t('setting.sessions.this_device'),
    device_type: getCurrentDeviceType()
  }
})

// Other devices
const otherDevices = computed(() => {
  const currentId = currentDevice.value.device_id
  return devices.value.filter((d) => d.device_id !== currentId)
})

const getCurrentDeviceType = () => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'mobile'
  if (/Android/i.test(ua)) return 'mobile'
  if (/Mac|Windows|Linux/i.test(ua)) return 'desktop'
  return 'unknown'
}

const getDeviceIcon = (type?: string) => {
  if (!type) return 'devices'
  switch (type.toLowerCase()) {
    case 'mobile':
    case 'android':
    case 'ios':
      return 'smartphone'
    case 'desktop':
    case 'web':
      return 'monitor'
    default:
      return 'devices'
  }
}

const formatLastSeen = (ts: number) => {
  const now = Date.now()
  const diff = now - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('setting.sessions.just_now')
  if (minutes < 60) return t('setting.sessions.minutes_ago', { n: minutes })
  if (hours < 24) return t('setting.sessions.hours_ago', { n: hours })
  if (days < 7) return t('setting.sessions.days_ago', { n: days })
  return new Date(ts).toLocaleDateString()
}

const loadDevices = async () => {
  loading.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error(t('setting.sessions.client_not_initialized'))
      return
    }

    const result = await (client.getDevices as () => { devices: Device[] })()
    devices.value = result.devices || []
  } catch (error) {
    logger.error('Failed to load devices:', error)
    message.error(t('setting.sessions.load_failed'))
  } finally {
    loading.value = false
  }
}

const handleVerifyDevice = (_device: Device) => {
  message.info(t('setting.sessions.verify_coming_soon'))
}

const handleSignOutDevice = (device: Device) => {
  dialog.warning({
    title: t('setting.sessions.sign_out_confirm_title'),
    content: t('setting.sessions.sign_out_confirm_content', { name: device.display_name || device.device_id }),
    positiveText: t('action.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const client = matrixClientService.getClient()
        if (!client) return

        await (client.deleteDevice as (deviceId: string) => Promise<void>)(device.device_id)
        message.success(t('setting.sessions.signed_out', { name: device.display_name || device.device_id }))
        await loadDevices()
      } catch (error) {
        logger.error('Failed to sign out device:', error)
        message.error(t('setting.sessions.sign_out_failed'))
      }
    }
  })
}

const handleLinkDevice = () => {
  message.info(t('setting.sessions.link_device_coming_soon'))
}

onMounted(() => {
  loadDevices()
})
</script>

<style lang="scss" scoped>
.sessions-settings {
  padding: 0;
}

.current-device-card {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-hover, #0f7e6a) 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.device-details {
  flex: 1;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}

.device-id {
  font-size: 12px;
  opacity: 0.8;
  font-family: monospace;
}

.device-status {
  flex-shrink: 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.status-current {
    background: rgba(var(--hula-white-rgb), 0.25);
    color: white;
  }

  &.status-verified {
    background: #e6f7ef;
    color: var(--hula-brand-primary);
  }

  &.status-unverified {
    background: var(--hula-white)4e6;
    color: #fa8c16;
  }
}

.devices-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 0 4px 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--hula-gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-count {
  font-size: 12px;
  color: var(--hula-gray-400);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: white;
  border-radius: 12px;
  color: var(--hula-gray-400);

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--hula-gray-100);

  &.device-verified {
    border-left: 3px solid var(--hula-brand-primary);
  }
}

.device-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-seen {
  font-size: 11px;
  color: var(--hula-gray-400);
}

.device-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.link-device-section {
  margin-bottom: 24px;
}

.settings-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: var(--hula-gray-50);
  }

  .item-content {
    flex: 1;
  }

  .item-label {
    font-size: 16px;
    color: var(--hula-gray-900);
    margin-bottom: 2px;
  }

  .item-description {
    font-size: 12px;
    color: var(--hula-gray-400);
  }
}
</style>
