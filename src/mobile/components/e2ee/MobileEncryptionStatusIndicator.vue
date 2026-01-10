<!-- Mobile Encryption Status Indicator - Shows E2EE encryption status for mobile -->
<template>
  <div
    class="mobile-encryption-status"
    :class="statusClass"
    role="status"
    :aria-label="`加密状态: ${statusTitle}, ${statusDesc}`"
    :aria-live="isEncrypted ? 'polite' : 'assertive'">
    <!-- Compact Mode (Default) -->
    <div
      v-if="compact"
      class="status-compact"
      role="button"
      tabindex="0"
      @click="showDetail = true"
      @keydown.enter="showDetail = true"
      :aria-label="`查看加密详情: ${statusTitle}`">
      <van-icon
        :name="getVantIconName(statusIcon === 'Lock' ? 'Lock' : 'LockOpen')"
        :size="iconSize"
        :color="iconColor"
        :aria-label="statusTitle" />
      <span v-if="showLabel" class="status-label">{{ statusText }}</span>
    </div>

    <!-- Full Mode -->
    <div v-else class="status-full">
      <div
        class="status-header"
        role="button"
        tabindex="0"
        @click="showDetail = true"
        @keydown.enter="showDetail = true"
        :aria-label="`查看加密详情: ${statusTitle}`">
        <van-icon
          :name="getVantIconName(statusIcon === 'Lock' ? 'Lock' : 'LockOpen')"
          :size="20"
          :color="iconColor"
          :aria-label="statusTitle" />
        <div class="status-info">
          <span class="status-title">{{ statusTitle }}</span>
          <span class="status-desc">{{ statusDesc }}</span>
        </div>
        <van-icon name="arrow" :size="16" :color="iconColor" aria-hidden="true" />
      </div>

      <!-- Trust Level Badge -->
      <div v-if="isEncrypted && trustLevel" class="trust-badge" :class="trustClass" role="status" :aria-label="`信任级别: ${trustLevelText}`">
        <van-icon
          :name="
            getVantIconName(
              trustIcon === 'ShieldCheck' ? 'ShieldCheck' : trustIcon === 'Shield' ? 'Shield' : 'AlertTriangle'
            )
          "
          :size="14"
          :aria-label="trustLevelText" />
        <span>{{ trustLevelText }}</span>
      </div>

      <!-- Verified Devices Count -->
      <div v-if="isEncrypted && verifiedCount > 0" class="verified-count" role="status" aria-live="polite">
        <van-icon name="success" :size="14" color="var(--hula-success)" aria-label="已验证" />
        <span>{{ verifiedCount }}/{{ totalDevices }} 个设备已验证</span>
      </div>

      <!-- Warning for Unverified Devices -->
      <div v-if="isEncrypted && unverifiedCount > 0" class="warning-badge" role="alert" aria-live="assertive">
        <van-icon name="warning-o" :size="14" color="var(--hula-warning)" aria-label="警告" />
        <span>{{ unverifiedCount }} 个设备未验证</span>
      </div>
    </div>

    <!-- Detail Modal -->
    <van-popup
      :show="showDetail"
      position="center"
      :style="{ width: '90%', maxWidth: '400px', borderRadius: '12px' }"
      :close-on-click-overlay="true"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="modalTitleId"
      @update:show="showDetail = $event">
      <div class="detail-modal">
        <!-- Header -->
        <div class="detail-modal-header">
          <span :id="modalTitleId" class="header-title">{{ isEncrypted ? '端到端加密详情' : '房间未加密' }}</span>
          <van-icon
            name="cross"
            :size="18"
            @click="showDetail = false"
            role="button"
            tabindex="0"
            aria-label="关闭对话框"
            @keydown.enter="showDetail = false" />
        </div>

        <!-- Scrollable Content -->
        <div class="detail-modal-content">
          <!-- Encryption Status -->
          <div class="detail-section" role="region" aria-label="加密状态">
            <div class="detail-item" role="status" :aria-label="`加密状态: ${statusTitle}, ${statusDesc}`">
              <div class="item-icon" :class="statusClass" aria-hidden="true">
                <van-icon
                  :name="getVantIconName(statusIcon === 'Lock' ? 'Lock' : 'LockOpen')"
                  :size="32"
                  :color="iconColor" />
              </div>
              <div class="item-content">
                <div class="item-title">{{ statusTitle }}</div>
                <div class="item-desc">{{ statusDesc }}</div>
              </div>
            </div>
          </div>

          <!-- Encryption Info -->
          <div v-if="isEncrypted" class="detail-section" role="region" aria-label="加密信息">
            <div class="section-title">加密信息</div>
            <div class="info-list" role="list">
              <div class="info-item" role="listitem">
                <span class="info-label">算法</span>
                <span class="info-value">{{ algorithm || 'm.megolm.v1.aes-sha2' }}</span>
              </div>
              <div v-if="trustLevel" class="info-item" role="listitem">
                <span class="info-label">信任级别</span>
                <span class="info-value" :class="trustClass">{{ trustLevelText }}</span>
              </div>
            </div>
          </div>

          <!-- Device List -->
          <div v-if="isEncrypted && devices.length > 0" class="detail-section" role="region" aria-label="设备列表">
            <div class="section-title">设备列表</div>
            <div class="device-list" role="list" :aria-label="`${devices.length} 个设备`">
              <div
                v-for="device in devices"
                :key="device.deviceId"
                class="device-item"
                role="listitem"
                :aria-label="`设备 ${device.displayName || '未知设备'}, ${formatDeviceId(device.deviceId)}, ${device.verified ? '已验证' : '未验证'}`">
                <div class="device-info">
                  <van-image :width="32" :height="32" round class="device-avatar" :alt="device.displayName || '未知设备'">
                    <template #error>
                      <div class="avatar-fallback" aria-hidden="true">
                        {{ device.displayName?.[0] || '?' }}
                      </div>
                    </template>
                  </van-image>
                  <div class="device-details">
                    <div class="device-name">{{ device.displayName || '未知设备' }}</div>
                    <div class="device-id">{{ formatDeviceId(device.deviceId) }}</div>
                  </div>
                </div>
                <div class="device-status" :class="device.verified ? 'verified' : 'unverified'" role="status" :aria-label="device.verified ? '已验证' : '未验证'">
                  <van-icon :name="getVantIconName(device.verified ? 'ShieldCheck' : 'AlertTriangle')" :size="16" />
                  <span>{{ device.verified ? '已验证' : '未验证' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Warning for Unencrypted Room -->
          <div v-if="!isEncrypted" class="unencrypted-warning">
            <div class="alert-warning" role="alert" aria-live="assertive">
              <van-icon name="warning-o" :size="18" aria-label="警告" />
              <span>此房间未启用端到端加密。消息可能会被服务器管理员查看。</span>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="detail-modal-footer" role="group" aria-label="操作按钮">
          <div v-if="isEncrypted" class="action-buttons">
            <van-button
              type="primary"
              size="small"
              @click="handleVerifyDevices"
              icon="shield-o"
              aria-label="验证设备">验证设备
            </van-button>
            <van-button
              type="default"
              size="small"
              @click="handleResetSession"
              icon="replay"
              aria-label="重置加密会话">重置会话
            </van-button>
          </div>
          <van-button
            v-else
            type="primary"
            size="small"
            block
            @click="handleEnableEncryption"
            icon="lock"
            aria-label="为房间启用端到端加密">
            启用加密
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, useDialog } from '@/utils/vant-adapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Icon name mapping for Vant
const getVantIconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    Lock: 'lock',
    LockOpen: 'lock-open',
    Shield: 'shield-o',
    ShieldCheck: 'success',
    AlertTriangle: 'warning-o',
    ChevronRight: 'arrow',
    Refresh: 'replay'
  }
  return iconMap[iconName] || 'circle'
}

interface DeviceInfo {
  deviceId: string
  displayName?: string
  verified: boolean
  trustLevel?: 'verified' | 'trusted' | 'warning' | 'blacklisted'
}

interface Props {
  roomId: string
  compact?: boolean
  showLabel?: boolean
  iconSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  compact: true,
  showLabel: false,
  iconSize: 18
})

const emit = defineEmits<{
  (e: 'verify-devices'): void
  (e: 'reset-session'): void
  (e: 'enable-encryption'): void
}>()

const message = useMessage()
const dialog = useDialog()

// State
const showDetail = ref(false)
const isEncrypted = ref(false)
const algorithm = ref<string>('')
const trustLevel = ref<'verified' | 'trusted' | 'warning' | 'blacklisted'>()
const devices = ref<DeviceInfo[]>([])

// Accessibility IDs
const modalTitleId = `encryption-status-title-${Math.random().toString(36).substring(2, 9)}`

// Computed
const statusIcon = computed(() => {
  return isEncrypted.value ? 'Lock' : 'LockOpen'
})

const statusClass = computed(() => {
  if (!isEncrypted.value) return 'unencrypted'
  if (trustLevel.value === 'verified') return 'verified'
  if (trustLevel.value === 'trusted') return 'trusted'
  if (trustLevel.value === 'blacklisted') return 'blacklisted'
  return 'warning'
})

const statusText = computed(() => {
  if (!isEncrypted.value) return '未加密'
  if (trustLevel.value === 'verified') return '已验证'
  if (trustLevel.value === 'trusted') return '已信任'
  return '加密'
})

const statusTitle = computed(() => {
  if (!isEncrypted.value) return '未加密房间'
  if (trustLevel.value === 'verified') return '端到端已验证'
  if (trustLevel.value === 'trusted') return '端到端加密'
  return '端到端加密'
})

const statusDesc = computed(() => {
  if (!isEncrypted.value) return '此房间未启用端到端加密'
  if (trustLevel.value === 'verified') return '所有设备已通过验证'
  if (trustLevel.value === 'trusted') return '消息已加密'
  return '部分设备未验证'
})

const iconColor = computed(() => {
  if (!isEncrypted.value) return 'var(--hula-error)'
  if (trustLevel.value === 'verified') return 'var(--hula-success)'
  if (trustLevel.value === 'trusted') return 'var(--hula-success)'
  if (trustLevel.value === 'blacklisted') return 'var(--hula-error)'
  return 'var(--hula-warning)'
})

const trustIcon = computed(() => {
  if (trustLevel.value === 'verified') return 'ShieldCheck'
  if (trustLevel.value === 'trusted') return 'Shield'
  return 'AlertTriangle'
})

const trustClass = computed(() => {
  if (trustLevel.value === 'verified') return 'verified'
  if (trustLevel.value === 'trusted') return 'trusted'
  return 'warning'
})

const trustLevelText = computed(() => {
  if (trustLevel.value === 'verified') return '已验证'
  if (trustLevel.value === 'trusted') return '已信任'
  if (trustLevel.value === 'blacklisted') return '已屏蔽'
  return '未验证'
})

const verifiedCount = computed(() => {
  return devices.value.filter((d) => d.verified || d.trustLevel === 'verified' || d.trustLevel === 'trusted').length
})

const unverifiedCount = computed(() => {
  return devices.value.length - verifiedCount.value
})

const totalDevices = computed(() => devices.value.length)

// Methods
const loadEncryptionStatus = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[EncryptionStatus] Matrix client not initialized')
      return
    }

    const clientMethods = client as Record<string, unknown>

    // Get room
    if (typeof clientMethods.getRoom === 'function') {
      const room = clientMethods.getRoom(props.roomId) as Record<string, unknown> | null

      if (room) {
        // Check if encrypted
        const hasEncryptionState =
          typeof room.hasEncryptionStateEvent === 'function' ? room.hasEncryptionStateEvent() : false

        isEncrypted.value = hasEncryptionState as boolean

        // Get encryption algorithm if available
        if (typeof room.getEncryptionParams === 'function') {
          const params = room.getEncryptionParams() as Record<string, unknown> | null
          if (params?.algorithm) {
            algorithm.value = params.algorithm as string
          }
        }

        // Load devices if encrypted
        if (isEncrypted.value) {
          await loadDevices(client)
        }
      }
    }

    logger.info('[EncryptionStatus] Loaded encryption status:', {
      roomId: props.roomId,
      isEncrypted: isEncrypted.value,
      algorithm: algorithm.value,
      deviceCount: devices.value.length
    })
  } catch (error) {
    logger.error('[EncryptionStatus] Failed to load encryption status:', error)
  }
}

const loadDevices = async (client: Record<string, unknown>) => {
  try {
    // Get current user ID
    const getUserId = typeof client.getUserId === 'function' ? client.getUserId : null
    const currentUserId = getUserId?.() as string | undefined

    if (!currentUserId) return

    // Get device list
    const getDevices = typeof client.getDevices === 'function' ? client.getDevices : null
    const devicesResult = (await getDevices?.()) as Record<string, unknown> | null

    if (devicesResult?.devices) {
      const deviceList = devicesResult.devices as Array<{
        device_id: string
        display_name?: string
      }>

      devices.value = deviceList.map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        verified: false, // In real implementation, check verification status
        trustLevel: 'warning'
      }))
    }

    // Determine overall trust level based on devices
    if (devices.value.length > 0) {
      const allVerified = devices.value.every((d) => d.verified || d.trustLevel === 'verified')
      const anyBlacklisted = devices.value.some((d) => d.trustLevel === 'blacklisted')

      if (allVerified) {
        trustLevel.value = 'verified'
      } else if (anyBlacklisted) {
        trustLevel.value = 'blacklisted'
      } else {
        trustLevel.value = 'warning'
      }
    }
  } catch (error) {
    logger.error('[EncryptionStatus] Failed to load devices:', error)
  }
}

const formatDeviceId = (deviceId: string): string => {
  if (deviceId.length <= 10) return deviceId
  return `${deviceId.slice(0, 5)}...${deviceId.slice(-5)}`
}

const handleVerifyDevices = () => {
  showDetail.value = false
  emit('verify-devices')
  message.info('请使用设备验证功能验证其他用户')
}

const handleResetSession = () => {
  dialog.warning({
    title: '重置会话',
    content: '重置会话将清除所有发送的加密消息历史，此操作不可撤销。确定要继续吗？',
    confirmText: '重置',
    cancelText: '取消',
    onConfirm: () => {
      showDetail.value = false
      emit('reset-session')
      message.success('会话已重置')
    }
  })
}

const handleEnableEncryption = () => {
  dialog.info({
    title: '启用加密',
    content: '此功能需要升级房间配置。启用后，所有新消息都将被加密，但历史消息不会改变。',
    confirmText: '启用',
    cancelText: '取消',
    onConfirm: () => {
      showDetail.value = false
      emit('enable-encryption')
      message.success('正在启用加密...')
    }
  })
}

// Lifecycle
onMounted(() => {
  loadEncryptionStatus()
})

// Expose methods for parent to call
defineExpose({
  loadEncryptionStatus
})
</script>

<style scoped lang="scss">
.mobile-encryption-status {
  display: inline-block;
}

.status-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .status-label {
    font-size: 13px;
    color: var(--text-color-2);
  }
}

.status-full {
  padding: 12px;
  background: var(--card-color);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 8px;

  &:active {
    background: var(--item-hover-bg);
  }

  .status-info {
    flex: 1;
    min-width: 0;

    .status-title {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 2px;
    }

    .status-desc {
      display: block;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }
}

.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;

  &.verified {
    background: rgba(var(--hula-success-rgb), 0.1);
    color: var(--hula-success);
  }

  &.trusted {
    background: rgba(var(--hula-success-rgb), 0.1);
    color: var(--hula-success);
  }

  &.warning {
    background: rgba(var(--hula-warning-rgb), 0.1);
    color: var(--hula-warning);
  }

  &.blacklisted {
    background: rgba(var(--hula-error-rgb), 0.1);
    color: var(--hula-error);
  }
}

.verified-count {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-color-2);
  margin-bottom: 4px;
}

.warning-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--hula-warning);
}

// Detail Modal Styles
.detail-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-2);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;

  .item-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    &.verified {
      background: rgba(var(--hula-success-rgb), 0.1);
    }

    &.unencrypted {
      background: rgba(var(--hula-error-rgb), 0.1);
    }

    &.warning {
      background: rgba(var(--hula-warning-rgb), 0.1);
    }
  }

  .item-content {
    flex: 1;

    .item-title {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 4px;
    }

    .item-desc {
      font-size: 13px;
      color: var(--text-color-3);
    }
  }
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 6px;

  .info-label {
    font-size: 13px;
    color: var(--text-color-3);
  }

  .info-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color-1);
    font-family: 'Monaco', 'Consolas', monospace;

    &.verified {
      color: var(--hula-success);
    }

    &.trusted {
      color: var(--hula-success);
    }

    &.warning {
      color: var(--hula-warning);
    }

    &.blacklisted {
      color: var(--hula-error);
    }
  }
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: var(--bg-color);
  border-radius: 8px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;

  .device-details {
    flex: 1;
    min-width: 0;

    .device-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 2px;
    }

    .device-id {
      font-size: 11px;
      color: var(--text-color-3);
      font-family: 'Monaco', 'Consolas', monospace;
    }
  }
}

.device-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  flex-shrink: 0;

  &.verified {
    background: rgba(var(--hula-success-rgb), 0.1);
    color: var(--hula-success);
  }

  &.unverified {
    background: rgba(var(--hula-warning-rgb), 0.1);
    color: var(--hula-warning);
  }
}

.unencrypted-warning {
  margin-bottom: 16px;
}

.alert-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--hula-warning-rgb), 0.1);
  border: 1px solid rgba(var(--hula-warning-rgb), 0.3);
  border-radius: 8px;
  color: var(--hula-warning);
  font-size: 13px;
}

// Detail Modal Styles
.detail-modal {
  display: flex;
  flex-direction: column;
  background: var(--card-color, var(--hula-white));
  max-height: 80vh;
  border-radius: 12px;
  overflow: hidden;
}

.detail-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, var(--hula-gray-100));
  flex-shrink: 0;

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1, var(--hula-gray-900));
  }
}

.detail-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-modal-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color, var(--hula-gray-100));
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--primary-color, var(--hula-success));
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 500;
}

.device-avatar {
  flex-shrink: 0;
}

// Status variants
.mobile-encryption-status.verified {
  --status-color: var(--hula-success);
}

.mobile-encryption-status.trusted {
  --status-color: var(--hula-success);
}

.mobile-encryption-status.warning {
  --status-color: var(--hula-warning);
}

.mobile-encryption-status.blacklisted {
  --status-color: var(--hula-error);
}

.mobile-encryption-status.unencrypted {
  --status-color: var(--hula-error);
}
</style>
