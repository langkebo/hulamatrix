<template>
  <div class="mobile-e2ee-settings">
    <!-- Navigation Header -->
    <van-nav-bar :title="t('setting.e2ee.title')" left-arrow @click-left="handleBack" />

    <!-- Status Overview -->
    <div class="status-card">
      <van-circle
        :rate="e2eeStatus.rate"
        :speed="100"
        :color="e2eeStatus.color"
        layer-color="var(--hula-gray-200)"
        :text="e2eeStatus.text" />
      <div class="status-info">
        <div class="status-title">{{ e2eeStatus.title }}</div>
        <div class="status-desc">{{ e2eeStatus.description }}</div>
      </div>
    </div>

    <!-- Cross-Signing Section -->
    <van-cell-group :title="t('setting.e2ee.cross_signing.title')" inset>
      <van-cell :title="t('setting.e2ee.cross_signing.status')">
        <template #icon>
          <van-icon name="shield" :color="crossSigningReady ? 'var(--hula-success)' : 'var(--hula-warning)'" />
        </template>
        <template #right-icon>
          <van-tag :type="crossSigningReady ? 'success' : 'warning'">
            {{ crossSigningReady ? t('setting.e2ee.cross_signing.ready') : t('setting.e2ee.cross_signing.not_ready') }}
          </van-tag>
        </template>
      </van-cell>

      <van-cell :title="t('setting.e2ee.cross_signing.master_key')">
        <template #icon>
          <van-icon name="key" />
        </template>
        <template #right-icon>
          <van-tag :type="hasMasterKey ? 'success' : 'default'">
            {{ hasMasterKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
          </van-tag>
        </template>
      </van-cell>

      <van-cell :title="t('setting.e2ee.cross_signing.user_signing_key')">
        <template #icon>
          <van-icon name="user" />
        </template>
        <template #right-icon>
          <van-tag :type="hasUserSigningKey ? 'success' : 'default'">
            {{ hasUserSigningKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
          </van-tag>
        </template>
      </van-cell>

      <van-cell :title="t('setting.e2ee.cross_signing.self_signing_key')">
        <template #icon>
          <van-icon name="phone" />
        </template>
        <template #right-icon>
          <van-tag :type="hasSelfSigningKey ? 'success' : 'default'">
            {{ hasSelfSigningKey ? t('setting.e2ee.cross_signing.set') : t('setting.e2ee.cross_signing.not_set') }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- Key Backup Section -->
    <van-cell-group :title="t('setting.e2ee.key_backup.title')" inset>
      <van-cell :title="t('setting.e2ee.key_backup.storage')" is-link @click="handleManageBackup">
        <template #icon>
          <van-icon name="shield-o" :color="secretStorageReady ? 'var(--hula-success)' : 'var(--hula-warning)'" />
        </template>
        <template #right-icon>
          <van-tag :type="secretStorageReady ? 'success' : 'warning'">
            {{
              secretStorageReady
                ? t('setting.e2ee.key_backup.storage_ready')
                : t('setting.e2ee.key_backup.storage_not_ready')
            }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- Devices Section -->
    <van-cell-group :title="t('setting.e2ee.devices.title')" inset>
      <van-cell
        v-for="device in userDevices"
        :key="device.deviceId"
        :title="device.displayName || t('setting.e2ee.devices.unknown_device')"
        is-link
        @click="handleDeviceClick(device)">
        <template #icon>
          <div class="device-avatar" :class="{ verified: device.verified }">
            {{ (device.displayName || device.deviceId).charAt(0) }}
          </div>
        </template>
        <template #label>
          <van-tag :type="device.verified ? 'success' : 'warning'" size="small">
            {{ device.verified ? t('setting.e2ee.devices.verified') : t('setting.e2ee.devices.unverified') }}
          </van-tag>
          <span v-if="device.lastSeenTs" class="last-seen">
            {{ formatLastSeen(device.lastSeenTs) }}
          </span>
        </template>
      </van-cell>

      <van-cell v-if="userDevices.length === 0">
        <van-empty :description="t('setting.e2ee.devices.no_devices')" />
      </van-cell>
    </van-cell-group>

    <!-- Security Settings -->
    <van-cell-group :title="t('setting.e2ee.security.title')" inset>
      <van-cell :title="t('setting.e2ee.security.auto_verify')">
        <template #right-icon>
          <van-switch v-model="settings.autoVerifyDevices" size="20" />
        </template>
      </van-cell>

      <van-cell :title="t('setting.e2ee.security.block_unverified')">
        <template #right-icon>
          <van-switch v-model="settings.blockUnverifiedDevices" size="20" />
        </template>
      </van-cell>

      <van-cell :title="t('setting.e2ee.security.show_indicator')">
        <template #right-icon>
          <van-switch v-model="settings.showEncryptionIndicator" size="20" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- Mobile Key Backup BottomSheet -->
    <MobileKeyBackupBottomSheet v-model:show="showBackupSheet" @backup-completed="handleBackupCompleted" />

    <!-- Mobile Device Verification Sheet -->
    <MobileDeviceVerificationSheet
      v-model:show="showVerificationSheet"
      :device="selectedDevice"
      @verified="handleDeviceVerified" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast } from 'vant'
import {
  Circle as VanCircle,
  Icon as VanIcon,
  CellGroup as VanCellGroup,
  Cell as VanCell,
  Tag as VanTag,
  Empty as VanEmpty,
  Switch as VanSwitch
} from 'vant'
import { useE2EEStore } from '@/stores/e2ee'
import { logger } from '@/utils/logger'
import MobileKeyBackupBottomSheet from '@/mobile/components/e2ee/MobileKeyBackupBottomSheet.vue'
import MobileDeviceVerificationSheet from '@/mobile/components/e2ee/MobileDeviceVerificationSheet.vue'

interface DeviceInfo {
  deviceId: string
  userId?: string
  displayName?: string
  verified: boolean
  blocked?: boolean
  lastSeenTs?: number
}

interface BackupResult {
  success?: boolean
  recoveryKey?: string
  imported?: number
  total?: number
  error?: string
}

const { t } = useI18n()
const e2eeStore = useE2EEStore()

// State
const showBackupSheet = ref(false)
const showVerificationSheet = ref(false)
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
    rate: isReady ? 100 : 60,
    color: isReady ? 'var(--hula-success)' : 'var(--hula-warning)',
    text: isReady ? '100%' : '60%',
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
const handleManageBackup = () => {
  showBackupSheet.value = true
}

const handleDeviceClick = (device: DeviceInfo) => {
  if (!device.verified) {
    selectedDevice.value = device
    showVerificationSheet.value = true
  }
}

const handleDeviceVerified = async () => {
  showToast.success(t('setting.e2ee.devices.verification_success'))
  await loadDevices()
}

const handleBack = () => {
  window.history.back()
}

const handleBackupCompleted = async (result: BackupResult) => {
  logger.info('[MobileE2EE] Backup completed', result)
  showToast.success(t('setting.e2ee.key_backup.create_success'))
}

const formatLastSeen = (timestamp?: number): string => {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('setting.e2ee.devices.last_seen_now')
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
    logger.error('[MobileE2EE] Failed to load devices:', error)
  }
}

// Lifecycle
onMounted(() => {
  loadDevices()
  // Initialize E2EE store
  if (!e2eeStore.initialized) {
    e2eeStore.initialize()
  }
})
</script>

<style lang="scss" scoped>
.mobile-e2ee-settings {
  min-height: 100vh;
  background: var(--van-background-color);
  padding-bottom: 20px;

  .page-header {
    padding: 16px;
    background: var(--hula-white);

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .status-card {
    margin: 16px;
    padding: 20px;
    background: var(--hula-white);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 16px;

    .status-info {
      flex: 1;

      .status-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .status-desc {
        font-size: 13px;
        color: var(--van-text-color-3);
      }
    }
  }

  .device-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--van-gray-1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--van-text-color-2);

    &.verified {
      background: rgba(7, 193, 96, 0.1);
      color: var(--hula-success);
    }
  }

  .last-seen {
    margin-left: 8px;
    font-size: 12px;
    color: var(--van-text-color-3);
  }

  :deep(.van-cell-group) {
    margin-bottom: 12px;
  }

  :deep(.van-cell) {
    padding: 16px;
  }

  :deep(.van-cell__left-icon) {
    margin-right: 12px;
    font-size: 20px;
  }
}
</style>
