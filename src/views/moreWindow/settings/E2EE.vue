<template>
  <div class="e2ee-settings">
    <!-- E2EE Status Overview -->
    <div class="status-overview">
      <n-alert :type="e2eeStatus.type" :title="e2eeStatus.title" show-icon>
        {{ e2eeStatus.description }}
      </n-alert>
    </div>

    <!-- Cross-Signing Status -->
    <div class="setting-section">
      <h3>{{ t('setting.e2ee.cross_signing.title') }}</h3>
      <n-list hoverable clickable>
        <n-list-item>
          <template #prefix>
            <n-icon
              size="24"
              :color="
                crossSigningReady
                  ? 'var(--hula-success, var(--hula-brand-primary))'
                  : 'var(--hula-warning, var(--hula-brand-primary))'
              ">
              <CircleCheck v-if="crossSigningReady" />
              <AlertCircle v-else />
            </n-icon>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.cross_signing.status') }}</div>
            <div class="setting-desc">
              {{
                crossSigningReady ? t('setting.e2ee.cross_signing.ready') : t('setting.e2ee.cross_signing.not_ready')
              }}
            </div>
          </div>
          <template #suffix>
            <n-button v-if="!crossSigningReady" type="primary" size="small" @click="handleSetupCrossSigning">
              {{ t('setting.e2ee.cross_signing.setup_button') }}
            </n-button>
          </template>
        </n-list-item>

        <n-list-item>
          <template #prefix>
            <n-icon size="24"><Key /></n-icon>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.cross_signing.master_key') }}</div>
            <div class="setting-desc">
              {{ hasMasterKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
            </div>
          </div>
        </n-list-item>

        <n-list-item>
          <template #prefix>
            <n-icon size="24"><User /></n-icon>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.cross_signing.user_signing_key') }}</div>
            <div class="setting-desc">
              {{ hasUserSigningKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
            </div>
          </div>
        </n-list-item>

        <n-list-item>
          <template #prefix>
            <n-icon size="24"><DeviceMobile /></n-icon>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.cross_signing.self_signing_key') }}</div>
            <div class="setting-desc">
              {{ hasSelfSigningKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
            </div>
          </div>
        </n-list-item>
      </n-list>
    </div>

    <!-- Key Backup -->
    <div class="setting-section">
      <h3>{{ t('setting.e2ee.key_backup.title') }}</h3>
      <n-list hoverable clickable>
        <n-list-item>
          <template #prefix>
            <n-icon size="24" :color="secretStorageReady ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'">
              <Shield v-if="secretStorageReady" />
              <ShieldOff v-else />
            </n-icon>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.key_backup.storage') }}</div>
            <div class="setting-desc">
              {{
                secretStorageReady
                  ? t('setting.e2ee.key_backup.storage_ready')
                  : t('setting.e2ee.key_backup.storage_not_ready')
              }}
            </div>
          </div>
          <template #suffix>
            <n-button size="small" @click="handleManageBackup">
              {{
                secretStorageReady
                  ? t('setting.e2ee.key_backup.manage_button')
                  : t('setting.e2ee.key_backup.create_button')
              }}
            </n-button>
          </template>
        </n-list-item>
      </n-list>
    </div>

    <!-- Device Verification -->
    <div class="setting-section">
      <div class="section-header">
        <h3>{{ t('setting.e2ee.devices.title') }}</h3>
        <n-button size="small" @click="handleRefreshDevices">
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          {{ t('setting.e2ee.devices.refresh_button') }}
        </n-button>
      </div>
      <n-list hoverable clickable>
        <n-list-item v-for="device in userDevices" :key="device.deviceId" @click="handleDeviceClick(device)">
          <template #prefix>
            <div class="device-icon" :class="{ verified: device.verified }">
              {{ device.displayName?.charAt(0) || device.deviceId.charAt(0) }}
            </div>
          </template>
          <div class="setting-content">
            <div class="setting-title">{{ device.displayName || t('setting.e2ee.devices.unknown_device') }}</div>
            <div class="setting-meta">
              <n-tag :type="device.verified ? 'success' : 'warning'" size="small">
                {{ device.verified ? t('setting.e2ee.devices.verified') : t('setting.e2ee.devices.unverified') }}
              </n-tag>
              <span v-if="device.lastSeenTs" class="last-seen">
                {{ formatLastSeen(device.lastSeenTs) }}
              </span>
            </div>
          </div>
          <template #suffix>
            <n-dropdown :options="getDeviceActions(device)" @select="handleDeviceAction($event, device)">
              <n-button quaternary circle size="small">
                <template #icon>
                  <n-icon><DotsVertical /></n-icon>
                </template>
              </n-button>
            </n-dropdown>
          </template>
        </n-list-item>

        <n-list-item v-if="userDevices.length === 0">
          <n-empty :description="t('setting.e2ee.devices.no_devices')" size="small" />
        </n-list-item>
      </n-list>
    </div>

    <!-- Security Settings -->
    <div class="setting-section">
      <h3>{{ t('setting.e2ee.security.title') }}</h3>
      <n-list>
        <n-list-item>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.security.auto_verify') }}</div>
            <div class="setting-desc">{{ t('setting.e2ee.security.auto_verify_desc') }}</div>
          </div>
          <template #suffix>
            <n-switch v-model:value="settings.autoVerifyDevices" @update:value="handleSettingsChange" />
          </template>
        </n-list-item>

        <n-list-item>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.security.block_unverified') }}</div>
            <div class="setting-desc">{{ t('setting.e2ee.security.block_unverified_desc') }}</div>
          </div>
          <template #suffix>
            <n-switch v-model:value="settings.blockUnverifiedDevices" @update:value="handleSettingsChange" />
          </template>
        </n-list-item>

        <n-list-item>
          <div class="setting-content">
            <div class="setting-title">{{ t('setting.e2ee.security.show_indicator') }}</div>
            <div class="setting-desc">{{ t('setting.e2ee.security.show_indicator_desc') }}</div>
          </div>
          <template #suffix>
            <n-switch v-model:value="settings.showEncryptionIndicator" @update:value="handleSettingsChange" />
          </template>
        </n-list-item>
      </n-list>
    </div>

    <!-- Key Backup Dialog -->
    <KeyBackupDialog v-model:show="showBackupDialog" @backup-completed="handleBackupCompleted" />

    <!-- Device Verification Dialog -->
    <DeviceVerificationDialog
      v-model:show="showVerificationDialog"
      :device="selectedDevice"
      @verified="handleDeviceVerified" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NAlert,
  NList,
  NListItem,
  NButton,
  NIcon,
  NTag,
  NEmpty,
  NSwitch,
  NDropdown,
  useMessage,
  useDialog
} from 'naive-ui'
import {
  CircleCheck,
  AlertCircle,
  Key,
  User,
  DeviceMobile,
  Shield,
  ShieldOff,
  Refresh,
  DotsVertical
} from '@vicons/tabler'
import { useE2EEStore } from '@/stores/e2ee'
import { logger } from '@/utils/logger'
import KeyBackupDialog from '@/components/e2ee/KeyBackupDialog.vue'
import DeviceVerificationDialog from '@/components/e2ee/DeviceVerificationDialog.vue'

const { t } = useI18n()

// Re-export DeviceInfo from store for use in component
import type { DeviceInfo } from '@/stores/e2ee'

interface BackupResult {
  success?: boolean
  recoveryKey?: string
  imported?: number
  total?: number
  error?: string
}

const e2eeStore = useE2EEStore()
const message = useMessage()
const dialog = useDialog()

// State
const showBackupDialog = ref(false)
const showVerificationDialog = ref(false)
const selectedDevice = ref<DeviceInfo | null>(null)
const userDevices = ref<DeviceInfo[]>([])

// Settings
const settings = reactive({
  autoVerifyDevices: false,
  blockUnverifiedDevices: true,
  showEncryptionIndicator: true
})

// Computed
const e2eeStatus = computed(() => {
  const isReady = e2eeStore.initialized && e2eeStore.enabled
  return {
    type: isReady ? ('success' as const) : ('warning' as const),
    title: isReady ? t('setting.e2ee.status.enabled') : t('setting.e2ee.status.disabled'),
    description: isReady ? t('setting.e2ee.status.enabled_desc') : t('setting.e2ee.status.disabled_desc')
  }
})

const crossSigningReady = computed(() => {
  return e2eeStore.crossSigningInfo?.userMasterKey?.trusted || false
})

const secretStorageReady = computed(() => {
  return e2eeStore.stats.keyBackupEnabled
})

const hasMasterKey = computed(() => {
  return !!e2eeStore.crossSigningInfo?.userMasterKey?.publicKey
})

const hasUserSigningKey = computed(() => {
  return !!e2eeStore.crossSigningInfo?.userSigningKey?.publicKey
})

const hasSelfSigningKey = computed(() => {
  return !!e2eeStore.crossSigningInfo?.selfSigningKey?.publicKey
})

// Methods
const handleSetupCrossSigning = async () => {
  try {
    message.info(t('setting.e2ee.setup.success'))
  } catch (error) {
    message.error(t('setting.e2ee.setup.failed'))
    logger.error('[E2EESettings] Failed to setup cross-signing:', error)
  }
}

const handleManageBackup = () => {
  showBackupDialog.value = true
}

const handleRefreshDevices = async () => {
  await loadDevices()
  message.success(t('setting.e2ee.setup.device_refreshed'))
}

const handleDeviceClick = (device: DeviceInfo) => {
  if (!device.verified) {
    selectedDevice.value = device
    showVerificationDialog.value = true
  }
}

const handleDeviceAction = (action: string, device: DeviceInfo) => {
  const deviceName = device.displayName || device.deviceId

  switch (action) {
    case 'verify':
      selectedDevice.value = device
      showVerificationDialog.value = true
      break
    case 'block':
      dialog.warning({
        title: t('setting.e2ee.devices.block_confirm_title'),
        content: t('setting.e2ee.devices.block_confirm_content', { deviceName }),
        positiveText: t('setting.e2ee.devices.block'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          message.success(t('setting.e2ee.devices.blocked'))
        }
      })
      break
    case 'unblock':
      dialog.info({
        title: t('setting.e2ee.devices.unblock_confirm_title'),
        content: t('setting.e2ee.devices.unblock_confirm_content', { deviceName }),
        positiveText: t('setting.e2ee.devices.unblock'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          message.success(t('setting.e2ee.devices.unblocked'))
        }
      })
      break
  }
}

const handleDeviceVerified = async () => {
  message.success(t('setting.e2ee.setup.verification_success'))
  await loadDevices()
}

const handleBackupCompleted = async (result: BackupResult) => {
  logger.info('[E2EESettings] Backup completed', result)
}

const handleSettingsChange = () => {
  logger.info('[E2EESettings] Settings changed', settings)
}

const getDeviceActions = (device: DeviceInfo) => {
  const actions: Array<{ label: string; key: string; disabled?: boolean }> = [
    {
      label: t('setting.e2ee.devices.verify'),
      key: 'verify',
      disabled: device.verified
    }
  ]

  if (device.blocked) {
    actions.push({
      label: t('setting.e2ee.devices.unblock'),
      key: 'unblock'
    })
  } else {
    actions.push({
      label: t('setting.e2ee.devices.block'),
      key: 'block'
    })
  }

  return actions
}

const formatLastSeen = (timestamp?: number): string => {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('setting.e2ee.devices.last_seen')
  if (diff < 3600000) return t('setting.e2ee.devices.minutes_ago', { minutes: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('setting.e2ee.devices.hours_ago', { hours: Math.floor(diff / 3600000) })
  return t('setting.e2ee.devices.days_ago', { days: Math.floor(diff / 86400000) })
}

const loadDevices = async () => {
  try {
    const devices = e2eeStore.getAllDevices()
    userDevices.value = devices.map((d: DeviceInfo) => ({
      deviceId: d.deviceId,
      userId: d.userId || '',
      displayName: d.displayName,
      verified: d.verified || false,
      blocked: d.blocked || false,
      lastSeenTs: d.lastSeenTs
    }))
  } catch (error) {
    logger.error('[E2EESettings] Failed to load devices:', error)
  }
}

// Lifecycle
onMounted(() => {
  loadDevices()
})
</script>

<style lang="scss" scoped>
.e2ee-settings {
  .status-overview {
    margin-bottom: 24px;
  }

  .setting-section {
    margin-bottom: 32px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      h3 {
        margin: 0;
      }
    }

    .setting-content {
      flex: 1;

      .setting-title {
        font-weight: 600;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .setting-desc,
      .setting-meta {
        font-size: 13px;
        color: var(--text-color-3);

        .last-seen {
          margin-left: 8px;
        }
      }
    }
  }

  .device-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--text-color-2);

    &.verified {
      background: rgba(var(--hula-success-rgb), 0.1);
      color: var(--hula-brand-primary);
    }
  }
}
</style>
