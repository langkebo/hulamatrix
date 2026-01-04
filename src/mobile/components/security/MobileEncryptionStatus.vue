<!-- Mobile Encryption Status Indicator - Compact E2EE status display for mobile -->
<template>
  <div class="mobile-encryption-status" :class="statusClass">
    <!-- Status Icon -->
    <div class="status-icon" @click="showDetails = true">
      <van-icon :name="statusIcon" :size="iconSize" />
      <div v-if="showPulse" class="pulse-ring"></div>
    </div>

    <!-- Status Text (compact) -->
    <div v-if="showLabel" class="status-text" @click="showDetails = true">
      <span class="status-label">{{ statusLabel }}</span>
      <span v-if="showDetail && encryptionStatus.deviceCount > 0" class="status-detail">
        {{ encryptionStatus.verifiedDeviceCount }}/{{ encryptionStatus.deviceCount }}
      </span>
    </div>

    <!-- Details Modal -->
    <van-popup
      v-model:show="showDetails"
      position="bottom"
      :style="{ height: '80%', borderRadius: '16px 16px 0 0' }"
    >
      <div class="encryption-details-popup">
        <!-- Handle bar -->
        <div class="handle-bar" @click="showDetails = false"></div>

        <!-- Header -->
        <div class="popup-header">
          <span class="header-title">加密状态详情</span>
          <van-icon name="cross" :size="20" @click="showDetails = false" />
        </div>

        <!-- Content -->
        <div class="popup-content">
          <div class="encryption-details">
            <!-- Status Summary -->
            <div class="status-summary">
              <van-icon :name="statusIcon" :size="48" :color="statusColor" />
              <div class="summary-text">
                <div class="summary-title">{{ statusTitle }}</div>
                <div class="summary-desc">{{ statusDescription }}</div>
              </div>
            </div>

            <!-- Encryption Details List -->
            <div class="encryption-list">
              <div class="list-item">
                <van-icon name="lock" :size="20" class="item-icon" />
                <div class="detail-item">
                  <span class="detail-label">端到端加密</span>
                  <van-tag :type="encryptionStatus.enabled ? 'success' : 'danger'">
                    {{ encryptionStatus.enabled ? '已启用' : '未启用' }}
                  </van-tag>
                </div>
              </div>

              <div class="list-item">
                <van-icon name="key" :size="20" class="item-icon" />
                <div class="detail-item">
                  <span class="detail-label">交叉签名</span>
                  <van-tag :type="encryptionStatus.crossSigningReady ? 'success' : 'warning'">
                    {{ encryptionStatus.crossSigningReady ? '已设置' : '未设置' }}
                  </van-tag>
                </div>
              </div>

              <div class="list-item">
                <van-icon name="records" :size="20" class="item-icon" />
                <div class="detail-item">
                  <span class="detail-label">安全存储</span>
                  <van-tag :type="encryptionStatus.secretStorageReady ? 'success' : 'warning'">
                    {{ encryptionStatus.secretStorageReady ? '已启用' : '未启用' }}
                  </van-tag>
                </div>
              </div>

              <div class="list-item">
                <van-icon name="phone-o" :size="20" class="item-icon" />
                <div class="detail-item">
                  <span class="detail-label">已验证设备</span>
                  <span class="detail-value">
                    {{ encryptionStatus.verifiedDeviceCount }} / {{ encryptionStatus.deviceCount }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Warning Message -->
            <div v-if="!encryptionStatus.crossSigningReady" class="alert-warning mt-3">
              <van-icon name="warning-o" :size="18" />
              <span>交叉签名未设置，建议设置以增强安全性</span>
            </div>

            <!-- Room-specific info -->
            <div v-if="roomId && isRoomEncrypted" class="room-info mt-3">
              <div class="alert-success">
                <van-icon name="shield-o" :size="18" />
                <span>此聊天已启用端到端加密</span>
              </div>
            </div>
            <div v-else-if="roomId && !isRoomEncrypted" class="room-info mt-3">
              <div class="alert-warning">
                <van-icon name="shield-close" :size="18" />
                <span>此聊天未加密</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons mt-4">
              <van-button
                v-if="!encryptionStatus.crossSigningReady"
                type="primary"
                block
                @click="handleSetupCrossSigning"
                class="mb-2"
              >
                <van-icon name="key" :size="18" />
                设置交叉签名
              </van-button>
              <van-button block @click="handleViewDevices">
                <van-icon name="phone-o" :size="18" />
                管理设备
              </van-button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="popup-footer">
          <van-button block @click="showDetails = false">关闭</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from '@/utils/vant-adapter'
import { e2eeService, type DeviceInfo } from '@/services/e2eeService'
import { useHaptic } from '@/composables/useMobileGestures'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'

interface Props {
  roomId?: string
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  showDetail?: boolean
  showPulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  showLabel: true,
  showDetail: false,
  showPulse: false
})

const router = useRouter()
const message = useMessage()
const { selection } = useHaptic()

// State
const showDetails = ref(false)
const encryptionStatus = ref({
  enabled: false,
  crossSigningReady: false,
  secretStorageReady: false,
  deviceCount: 0,
  verifiedDeviceCount: 0
})
const isRoomEncrypted = ref(false)

// Computed
const iconSize = computed(() => {
  switch (props.size) {
    case 'small':
      return 16
    case 'large':
      return 24
    default:
      return 20
  }
})

const statusIcon = computed(() => {
  if (!encryptionStatus.value.enabled) return 'lock-open'
  if (encryptionStatus.value.crossSigningReady && encryptionStatus.value.secretStorageReady) {
    return 'shield'
  }
  return 'shield-close'
})

const getIconName = (iconType: string): string => {
  const iconMap: Record<string, string> = {
    Lock: 'lock',
    LockOpen: 'lock-open',
    Shield: 'shield-o',
    ShieldOff: 'shield-close',
    Key: 'key',
    Database: 'records',
    DeviceMobile: 'phone-o',
    AlertTriangle: 'warning-o',
    Check: 'success'
  }
  return iconMap[iconType] || 'circle'
}

const statusClass = computed(() => {
  if (!encryptionStatus.value.enabled) return 'status-disabled'
  if (encryptionStatus.value.crossSigningReady && encryptionStatus.value.secretStorageReady) {
    return 'status-secure'
  }
  return 'status-warning'
})

const statusColor = computed(() => {
  if (!encryptionStatus.value.enabled) return '#d03050'
  if (encryptionStatus.value.crossSigningReady && encryptionStatus.value.secretStorageReady) {
    return '#18a058'
  }
  return '#f0a020'
})

const statusLabel = computed(() => {
  if (!encryptionStatus.value.enabled) return '未加密'
  if (encryptionStatus.value.crossSigningReady && encryptionStatus.value.secretStorageReady) {
    return '已加密'
  }
  return '部分加密'
})

const statusTitle = computed(() => {
  if (!encryptionStatus.value.enabled) return '加密未启用'
  if (encryptionStatus.value.crossSigningReady && encryptionStatus.value.secretStorageReady) {
    return '完全加密保护'
  }
  return '加密设置未完成'
})

const statusDescription = computed(() => {
  if (!encryptionStatus.value.enabled) {
    return '端到端加密未启用，消息可能不安全'
  }
  if (!encryptionStatus.value.crossSigningReady) {
    return '交叉签名未设置，无法验证其他用户身份'
  }
  if (!encryptionStatus.value.secretStorageReady) {
    return '安全存储未启用，密钥可能丢失'
  }
  return '您的聊天已受到端到端加密保护'
})

// Methods
const loadStatus = async () => {
  try {
    encryptionStatus.value = await e2eeService.getEncryptionStatus()
    if (props.roomId) {
      isRoomEncrypted.value = e2eeService.isRoomEncrypted(props.roomId)
    }
  } catch (error) {
    logger.error('Failed to load encryption status:', error)
  }
}

const handleSetupCrossSigning = () => {
  selection()
  message.info('交叉签名设置功能即将推出')

  // 交叉签名设置流程导航说明：
  //
  // Matrix 交叉签名（Cross-signing）是用于验证设备身份的 E2EE 功能
  //
  // 实现步骤：
  // 1. 创建交叉签名设置页面 /mobile/e2ee/cross-signing-setup
  // 2. 页面应包含：
  //    - 显示当前设备的交叉签名状态
  //    - 创建新交叉签名密钥的选项
  //    - 验证其他设备的流程
  //    - 备份恢复密钥的选项
  // 3. 集成 Matrix SDK 的交叉签名 API：
  //    - client.getCrossSigningId() - 获取交叉签名 ID
  //    - client.bootstrapCrossSigning() - 初始化交叉签名
  //    - client.checkOwnCrossSigningTrust() - 验证信任状态
  //
  // 路由导航示例：
  // router.push('/mobile/e2ee/cross-signing-setup')
  //
  // 参考资料：
  // - Matrix E2EE: https://spec.matrix.org/v1.5/client-server-api/#cross-signing
  // - matrix-js-sdk: https://github.com/matrix-org/matrix-js-sdk#encryption
  logger.info('[MobileEncryptionStatus] Cross-signing setup not implemented yet')
}

const handleViewDevices = () => {
  selection()
  router.push('/mobile/my/devices')
}

// Event handlers
const handleDeviceChange = () => {
  loadStatus()
}

const handleRoomEncryptionUpdate = (event: Event) => {
  const customEvent = event as CustomEvent<{ roomId: string; encrypted: boolean }>
  if (customEvent.detail.roomId === props.roomId) {
    isRoomEncrypted.value = customEvent.detail.encrypted
  }
}

// Lifecycle
onMounted(() => {
  loadStatus()

  // Listen for E2EE events
  window.addEventListener('e2ee:device-list-changed', handleDeviceChange)
  window.addEventListener('e2ee:device-verified', handleDeviceChange)
  window.addEventListener('e2ee:device-blocked', handleDeviceChange)
  window.addEventListener('e2ee:room-encryption-updated', handleRoomEncryptionUpdate)
})

onUnmounted(() => {
  window.removeEventListener('e2ee:device-list-changed', handleDeviceChange)
  window.removeEventListener('e2ee:device-verified', handleDeviceChange)
  window.removeEventListener('e2ee:device-blocked', handleDeviceChange)
  window.removeEventListener('e2ee:room-encryption-updated', handleRoomEncryptionUpdate)
})

// Expose refresh method
defineExpose({
  refresh: loadStatus
})
</script>

<style scoped lang="scss">
.mobile-encryption-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:active {
    opacity: 0.7;
  }
}

.status-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.status-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;

  .status-label {
    font-size: 12px;
    font-weight: 500;
  }

  .status-detail {
    font-size: 10px;
    opacity: 0.7;
  }
}

.status-disabled {
  color: #d03050;
}

.status-secure {
  color: #18a058;
}

.status-warning {
  color: #f0a020;
}

.encryption-details-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: #d0d0d0;
  }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .van-icon {
    cursor: pointer;
    color: #666;
    padding: 8px;

    &:active {
      opacity: 0.6;
    }
  }
}

.popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.popup-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.encryption-details {
  .status-summary {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: var(--bg-color);
    border-radius: 12px;
    margin-bottom: 16px;

    .summary-text {
      flex: 1;

      .summary-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .summary-desc {
        font-size: 13px;
        color: var(--text-color-2);
      }
    }
  }

  .encryption-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 16px;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-color);
    border-radius: 8px;

    .item-icon {
      color: var(--text-color-2);
      flex-shrink: 0;
    }

    .detail-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 12px;

      .detail-label {
        font-size: 14px;
        color: var(--text-color-1);
      }

      .detail-value {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color-1);
      }
    }
  }

  .alert-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #fff7e6;
    border: 1px solid #ffd591;
    border-radius: 8px;
    color: #d46b08;
    font-size: 13px;

    .van-icon {
      color: #fa8c16;
      flex-shrink: 0;
    }
  }

  .alert-success {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #f6ffed;
    border: 1px solid #b7eb8f;
    border-radius: 8px;
    color: #389e0d;
    font-size: 13px;

    .van-icon {
      color: #52c41a;
      flex-shrink: 0;
    }
  }

  .room-info {
    margin-top: 12px;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .van-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }

  .mt-3 {
    margin-top: 12px;
  }

  .mt-4 {
    margin-top: 16px;
  }

  .mb-2 {
    margin-bottom: 8px;
  }
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .popup-footer {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
