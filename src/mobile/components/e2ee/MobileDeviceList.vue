<!-- Mobile Device List - E2EE device list for mobile -->
<template>
  <div class="mobile-device-list">
    <!-- Security Status Banner -->
    <div v-if="showSecurityBanner" class="security-banner" :class="`security-${securityLevel}`">
      <van-icon
        class="banner-icon"
        :name="
          getVantIconName(securityLevel === 'high' ? 'Shield' : securityLevel === 'medium' ? 'ShieldCheck' : 'ShieldX')
        "
        :size="20" />
      <div class="banner-content">
        <div class="banner-title">{{ securityTitle }}</div>
        <div class="banner-desc">{{ securityDescription }}</div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div v-if="progress > 0 && progress < 100" class="progress-section">
      <div class="progress-label">设备验证进度: {{ progress }}%</div>
      <van-progress :percentage="progress" :show-pivot="false" stroke-width="4" />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <van-loading size="24px" />
      <p class="mt-12px">加载设备中...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <van-icon name="close-circle" :size="64" color="var(--hula-error)" class="mb-12px" />
      <div class="state-title">加载失败</div>
      <div class="state-desc">{{ error }}</div>
      <van-button @click="refreshDevices" type="primary" class="mt-16px">重试</van-button>
    </div>

    <!-- Empty State -->
    <div v-else-if="devices.length === 0" class="empty-state">
      <van-icon name="info-o" :size="64" color="var(--hula-success)" class="mb-12px" />
      <div class="state-title">暂无设备</div>
      <div class="state-desc">没有找到任何设备</div>
      <van-button @click="refreshDevices" type="primary" class="mt-16px">刷新</van-button>
    </div>

    <!-- Device List -->
    <div v-else class="device-list-container">
      <!-- Verified Devices -->
      <div v-if="verifiedDevices.length > 0" class="device-section">
        <div class="section-header">
          <div class="section-title">
            <van-icon name="success" :size="16" color="var(--hula-success)" />
            已验证设备 ({{ verifiedDevices.length }})
          </div>
        </div>
        <div class="device-items">
          <div
            v-for="device in verifiedDevices"
            :key="device.deviceId"
            class="device-item verified"
            @click="openDeviceMenu(device)">
            <div class="device-main">
              <van-image :width="44" :height="44" :src="getDeviceAvatar(device)" round>
                <template #error>
                  <div class="avatar-fallback">
                    <van-icon name="phone-o" :size="22" />
                  </div>
                </template>
              </van-image>
              <div class="device-info">
                <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                <div class="device-id">{{ device.deviceId }}</div>
                <div v-if="device.lastSeenTs" class="device-last-seen">
                  {{ formatLastSeen(device.lastSeenTs) }}
                </div>
              </div>
            </div>
            <div class="device-status">
              <van-tag type="success" round>已验证</van-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- Unverified Devices -->
      <div v-if="unverifiedDevices.length > 0" class="device-section">
        <div class="section-header">
          <div class="section-title">
            <van-icon name="warning-o" :size="16" color="var(--hula-warning)" />
            未验证设备 ({{ unverifiedDevices.length }})
          </div>
        </div>
        <div class="device-items">
          <div
            v-for="device in unverifiedDevices"
            :key="device.deviceId"
            class="device-item unverified"
            @click="openDeviceMenu(device)">
            <div class="device-main">
              <van-image :width="44" :height="44" :src="getDeviceAvatar(device)" round>
                <template #error>
                  <div class="avatar-fallback">
                    <van-icon name="phone-o" :size="22" />
                  </div>
                </template>
              </van-image>
              <div class="device-info">
                <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                <div class="device-id">{{ device.deviceId }}</div>
                <div v-if="device.lastSeenTs" class="device-last-seen">
                  {{ formatLastSeen(device.lastSeenTs) }}
                </div>
              </div>
            </div>
            <div class="device-status">
              <van-button type="primary" size="small" round @click.stop="openVerifyDialog(device)">验证</van-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Blocked Devices -->
      <div v-if="blockedDevices.length > 0" class="device-section">
        <div class="section-header">
          <div class="section-title">
            <van-icon name="shield-close" :size="16" color="var(--hula-error)" />
            已屏蔽设备 ({{ blockedDevices.length }})
          </div>
        </div>
        <div class="device-items">
          <div
            v-for="device in blockedDevices"
            :key="device.deviceId"
            class="device-item blocked"
            @click="openDeviceMenu(device)">
            <div class="device-main">
              <van-image :width="44" :height="44" :src="getDeviceAvatar(device)" round>
                <template #error>
                  <div class="avatar-fallback">
                    <van-icon name="phone-o" :size="22" />
                  </div>
                </template>
              </van-image>
              <div class="device-info">
                <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                <div class="device-id">{{ device.deviceId }}</div>
                <div v-if="device.lastSeenTs" class="device-last-seen">
                  {{ formatLastSeen(device.lastSeenTs) }}
                </div>
              </div>
            </div>
            <div class="device-status">
              <van-tag type="danger" round>已屏蔽</van-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div v-if="devices.length > 0" class="action-buttons">
      <van-button type="primary" block size="large" @click="refreshDevices" :loading="loading" icon="replay">
        刷新设备
      </van-button>
    </div>

    <!-- Device Action Menu -->
    <van-popup v-model:show="showActionMenu" position="bottom" :style="{ borderRadius: '16px 16px 0 0' }">
      <div class="action-menu-popup">
        <div class="handle-bar" @click="showActionMenu = false"></div>
        <div class="action-menu">
          <div
            v-for="action in deviceActions"
            :key="action.key"
            class="action-item"
            :class="{ danger: action.danger, disabled: action.disabled }"
            @click="handleDeviceAction(action.key)">
            <van-icon
              v-if="!action.disabled"
              :name="getVantIconName(getActionIconName(action.key))"
              :size="16"
              class="action-icon" />
            <span>{{ action.label }}</span>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- Verification Dialog -->
    <MobileDeviceVerifyDialog
      v-model:show="showVerifyDialog"
      :device="currentDevice ? { device_id: currentDevice.deviceId, display_name: currentDevice.displayName } : null"
      :user-id="userId"
      @verified="handleDeviceVerified" />

    <!-- Rename Dialog -->
    <van-popup
      v-model:show="showRenameDialog"
      position="center"
      :style="{ width: '90%', maxWidth: '400px', borderRadius: '12px' }">
      <div class="rename-dialog">
        <div class="dialog-header">
          <span class="header-title">重命名设备</span>
          <van-icon name="cross" :size="18" @click="showRenameDialog = false" />
        </div>
        <div class="dialog-content">
          <van-field v-model="renameValue" placeholder="请输入设备名称" size="large" @keyup.enter="confirmRename" />
        </div>
        <div class="dialog-footer">
          <div class="button-group">
            <van-button @click="showRenameDialog = false">取消</van-button>
            <van-button type="primary" @click="confirmRename">确定</van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDialog } from '@/utils/vant-adapter'
import { useE2EEStore } from '@/stores/e2ee'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { useE2EEDevices, type DeviceItem } from '@/composables/useE2EEDevices'
import MobileDeviceVerifyDialog from './MobileDeviceVerifyDialog.vue'
import { msg } from '@/utils/SafeUI'

// Icon name mapping for Vant
const getVantIconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    DeviceMobile: 'phone-o',
    Shield: 'shield-o',
    ShieldCheck: 'shield',
    ShieldX: 'shield-close',
    CircleCheck: 'success',
    AlertCircle: 'warning-o',
    Refresh: 'replay',
    DotsVertical: 'ellipsis',
    Check: 'success',
    X: 'close',
    Trash: 'delete'
  }
  return iconMap[iconName] || 'circle'
}

// Get action icon name
const getActionIconName = (actionKey: string): string => {
  const iconMap: Record<string, string> = {
    verify: 'Check',
    rename: 'DotsVertical',
    unverify: 'X',
    block: 'ShieldX',
    unblock: 'Check',
    delete: 'Trash'
  }
  return iconMap[actionKey] || 'CircleCheck'
}

// Store
const e2eeStore = useE2EEStore()
const authStore = useMatrixAuthStore()
const dialog = useDialog()

// Composable
const {
  devices,
  loading,
  error,
  progress,
  securityLevel,
  verifiedDevices,
  unverifiedDevices,
  blockedDevices,
  fetchDevices,
  renameDeviceApi,
  handleDeleteDevice
} = useE2EEDevices()

// State
const showActionMenu = ref(false)
const showVerifyDialog = ref(false)
const showRenameDialog = ref(false)
const renameValue = ref('')
const currentDevice = ref<DeviceItem | null>(null)

// Computed
const userId = computed(() => authStore.userId)

const showSecurityBanner = computed(() => true)

const securityTitle = computed(() => {
  switch (securityLevel.value) {
    case 'high':
      return '安全性高'
    case 'medium':
      return '安全性中等'
    default:
      return '安全性低'
  }
})

const securityDescription = computed(() => {
  switch (securityLevel.value) {
    case 'high':
      return '所有设备已验证，密钥已备份'
    case 'medium':
      return '部分设备已验证，建议验证剩余设备'
    default:
      return '存在未验证设备，建议验证所有设备'
  }
})

const deviceActions = computed(() => {
  if (!currentDevice.value) return []

  const device = currentDevice.value
  const actions: Array<{
    label: string
    key: string
    danger?: boolean
    disabled?: boolean
  }> = [
    {
      label: device.displayName || device.deviceId,
      key: 'header',
      disabled: true
    }
  ]

  if (!device.verified && !device.blocked) {
    actions.push({
      label: '验证设备',
      key: 'verify'
    })
  }

  actions.push({
    label: '重命名',
    key: 'rename'
  })

  if (device.verified && !device.blocked) {
    actions.push({
      label: '取消验证',
      key: 'unverify',
      danger: true
    })
  }

  if (!device.blocked) {
    actions.push({
      label: '屏蔽设备',
      key: 'block',
      danger: true
    })
  } else {
    actions.push({
      label: '取消屏蔽',
      key: 'unblock'
    })
  }

  actions.push({
    label: '删除设备',
    key: 'delete',
    danger: true
  })

  return actions
})

// Methods
const refreshDevices = fetchDevices

const getDeviceAvatar = (device: DeviceItem) => {
  // Placeholder for device avatar logic
  return ''
}

const formatLastSeen = (ts?: number) => {
  if (!ts) return ''

  const now = Date.now()
  const diff = now - ts

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  const date = new Date(ts)
  return date.toLocaleDateString()
}

const openDeviceMenu = (device: DeviceItem) => {
  currentDevice.value = device
  showActionMenu.value = true
}

const openVerifyDialog = (device: DeviceItem) => {
  currentDevice.value = device
  showVerifyDialog.value = true
}

const handleDeviceAction = async (key: string) => {
  if (!currentDevice.value) return
  const device = currentDevice.value
  showActionMenu.value = false

  switch (key) {
    case 'verify':
      openVerifyDialog(device)
      break
    case 'rename':
      renameValue.value = device.displayName || ''
      showRenameDialog.value = true
      break
    case 'unverify':
      await dialog.confirm({
        title: '取消验证',
        content: '确定要取消验证此设备吗？'
      })
      // Implementation missing in store/composable for unverify.
      // Assuming it's not supported or handled elsewhere.
      // For now, let's just log or msg.
      msg.warning('取消验证功能暂未实现')
      break
    case 'block':
      await dialog.confirm({
        title: '屏蔽设备',
        content: '确定要屏蔽此设备吗？'
      })
      await e2eeStore.blockDevice(device.deviceId)
      await fetchDevices()
      break
    case 'unblock':
      await e2eeStore.unblockDevice(device.deviceId)
      await fetchDevices()
      break
    case 'delete':
      await dialog.confirm({
        title: '删除设备',
        content: '确定要删除此设备吗？此操作不可撤销。',
        theme: 'round-button',
      })
      await handleDeleteDevice(device.deviceId)
      break
  }
}

const confirmRename = async () => {
  if (!currentDevice.value) return
  if (!renameValue.value) {
    msg.warning('请输入设备名称')
    return
  }
  
  const success = await renameDeviceApi(currentDevice.value.deviceId, renameValue.value)
  if (success) {
    msg.success('重命名成功')
    showRenameDialog.value = false
  } else {
    msg.error('重命名失败')
  }
}

const handleDeviceVerified = () => {
  showVerifyDialog.value = false
  fetchDevices()
}

onMounted(() => {
  refreshDevices()
})
</script>

<style scoped lang="scss">
.mobile-device-list {
  padding: 16px;
  min-height: 100%;
  background: var(--bg-color);
}

.security-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 16px;

  &.security-high {
    background: rgba(var(--hula-success-rgb), 0.1);
    border: 1px solid rgba(var(--hula-success-rgb), 0.2);

    .banner-icon {
      color: var(--hula-success);
    }
  }

  &.security-medium {
    background: rgba(var(--hula-warning-rgb), 0.1);
    border: 1px solid rgba(var(--hula-warning-rgb), 0.2);

    .banner-icon {
      color: var(--hula-warning);
    }
  }

  &.security-low {
    background: rgba(var(--hula-error-rgb), 0.1);
    border: 1px solid rgba(var(--hula-error-rgb), 0.2);

    .banner-icon {
      color: var(--hula-error);
    }
  }

  .banner-content {
    flex: 1;
  }

  .banner-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 2px;
  }

  .banner-desc {
    font-size: 12px;
    opacity: 0.8;
  }
}

.progress-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--card-color);
  border-radius: 8px;

  .progress-label {
    font-size: 12px;
    color: var(--text-color-3);
    margin-bottom: 8px;
  }
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 32px;
}

.device-list-container {
  .device-section {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .section-header {
    margin-bottom: 8px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color-2);
    }
  }

  .device-items {
    background: var(--card-color);
    border-radius: 12px;
    overflow: hidden;
  }

  .device-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid var(--divider-color);
    cursor: pointer;
    transition: background 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background: var(--item-hover-bg);
    }

    &.verified {
      border-left: 3px solid var(--hula-success);
    }

    &.unverified {
      border-left: 3px solid var(--hula-warning);
    }

    &.blocked {
      border-left: 3px solid var(--hula-error);
      opacity: 0.7;
    }
  }

  .device-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .device-info {
    flex: 1;
    min-width: 0;
  }

  .device-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-1);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-id {
    font-size: 12px;
    color: var(--text-color-3);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-last-seen {
    font-size: 11px;
    color: var(--text-color-3);
  }

  .device-status {
    margin-left: 8px;
  }
}

.action-buttons {
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: var(--bg-color);
  margin-top: 16px;
}

// Utility classes
.mt-12px {
  margin-top: 12px;
}

.mb-12px {
  margin-bottom: 12px;
}

.mt-16px {
  margin-top: 16px;
}

// Avatar fallback
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--primary-color, var(--hula-success));
  color: white;
  border-radius: 50%;
}

// State display
.state-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-1);
  margin-bottom: 8px;
}

.state-desc {
  font-size: 14px;
  color: var(--text-color-3);
  text-align: center;
}

.action-menu-popup {
  padding-bottom: env(safe-area-inset-bottom);
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  margin: 10px auto;
}

.action-menu {
  padding: 0 16px 16px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  font-size: 16px;
  color: var(--text-color-1);
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &.danger {
    color: var(--hula-error);
    
    .action-icon {
      color: var(--hula-error);
    }
  }

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
    font-weight: 600;
    font-size: 14px;
    background: var(--bg-color);
    margin-bottom: 8px;
    border-radius: 8px;
    border-bottom: none;
  }

  .action-icon {
    font-size: 20px;
    color: var(--text-color-2);
  }
}

.rename-dialog {
  background: var(--bg-color);
  
  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--divider-color);
    
    .header-title {
      font-weight: 600;
      font-size: 16px;
    }
  }
  
  .dialog-content {
    padding: 24px 16px;
  }
  
  .dialog-footer {
    padding: 16px;
    border-top: 1px solid var(--divider-color);
    
    .button-group {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
  }
}
</style>
