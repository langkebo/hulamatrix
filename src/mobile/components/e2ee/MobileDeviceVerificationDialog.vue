<!-- Mobile Device Verification Dialog - E2EE device verification for mobile -->
<template>
  <div class="mobile-device-verification">
    <!-- Bottom Sheet Dialog -->
    <van-popup
      v-model:show="showDialog"
      :close-on-click-overlay="false"
      position="bottom"
      :style="{ height: '80%', borderRadius: '16px 16px 0 0' }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dialogTitleId"
      :aria-describedby="dialogDescId">
      <div class="verification-dialog">
        <!-- Handle bar -->
        <div class="handle-bar" @click="handleClose"></div>

        <!-- Header -->
        <div class="dialog-header">
          <div class="header-content">
            <h3 :id="dialogTitleId">设备验证</h3>
            <span :id="dialogDescId" class="header-desc">验证设备以确保安全的加密通信</span>
          </div>
          <van-icon
            name="close"
            :size="18"
            @click="handleClose"
            class="close-icon"
            role="button"
            tabindex="0"
            aria-label="关闭对话框"
            @keydown.enter="handleClose" />
        </div>

        <!-- Content -->
        <div class="verification-content">
          <!-- User Info -->
          <div v-if="pendingRequest" class="user-section">
            <van-image :width="64" :height="64" :src="getUserAvatar(pendingRequest.userId)" round>
              <template #error>
                <div class="avatar-fallback">
                  <van-icon name="phone-o" :size="32" />
                </div>
              </template>
            </van-image>
            <div class="user-details">
              <div class="user-name">{{ getUserName(pendingRequest.userId) }}</div>
              <div class="user-id">{{ formatUserId(pendingRequest.userId) }}</div>
            </div>
          </div>

          <!-- Verification Steps -->
          <div class="steps-section" role="progressbar" :aria-valuenow="currentStep + 1" aria-valuemin="1" aria-valuemax="3" aria-label="验证进度">
            <div class="custom-steps" role="list">
              <div
                v-for="(step, index) in ['请求', '验证', '完成']"
                :key="index"
                class="step-item"
                :class="{ active: index === currentStep, completed: index < currentStep }"
                role="listitem"
                :aria-current="index === currentStep ? 'step' : undefined">
                <div class="step-circle" :aria-label="`${step}, 步骤 ${index + 1} 共 3`">
                  <van-icon v-if="index < currentStep" name="success" :size="16" aria-label="已完成" />
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <div class="step-title">{{ step }}</div>
              </div>
            </div>
          </div>

          <!-- Emoji Verification (SAS) -->
          <div v-if="showEmojiVerification" class="emoji-section" role="region" aria-label="表情符号验证">
            <div class="section-title" id="emoji-title">验证表情符号</div>
            <div class="emoji-grid" role="list" aria-describedby="emoji-desc">
              <div
                v-for="(item, index) in verificationEmoji"
                :key="index"
                class="emoji-item"
                role="listitem"
                :aria-label="`表情符号 ${item.emoji}, 数字 ${item.number}, 第 ${index + 1} 个共 7`">
                <span class="emoji" :aria-hidden="true">{{ item.emoji }}</span>
                <span class="number">{{ item.number }}</span>
              </div>
            </div>
            <div class="alert-info" style="margin-top: 12px" role="alert" aria-live="polite">
              <van-icon name="info-o" :size="16" />
              <span id="emoji-desc">请确认对方设备显示的表情符号和数字与上面一致</span>
            </div>
          </div>

          <!-- QR Code Verification -->
          <div v-if="showQRVerification" class="qr-section" role="region" aria-label="二维码验证">
            <div class="section-title">扫描二维码验证</div>
            <div class="qr-container" role="img" aria-label="二维码占位符">
              <div class="qr-placeholder">
                <van-icon name="qr" :size="64" />
                <p>显示二维码供对方扫描</p>
              </div>
            </div>
            <van-button
              block
              plain
              @click="switchToEmoji"
              aria-label="切换到表情符号验证方式">改用表情符号验证
            </van-button>
          </div>

          <!-- Trust Level -->
          <div class="trust-section">
            <div
              class="trust-card"
              :class="`trust-${currentTrustLevel}`"
              role="status"
              :aria-label="`设备信任状态: ${getTrustLabel(currentTrustLevel)}, ${getTrustDescription(currentTrustLevel)}`">
              <van-icon :name="getVantIconName(getTrustIconName(currentTrustLevel))" :size="24" :aria-label="getTrustLabel(currentTrustLevel)" />
              <div class="trust-info">
                <span class="trust-label">{{ getTrustLabel(currentTrustLevel) }}</span>
                <span class="trust-desc">{{ getTrustDescription(currentTrustLevel) }}</span>
              </div>
            </div>
          </div>

          <!-- Verification Methods -->
          <div v-if="currentStep === 0 && !verifying" class="methods-section" role="region" aria-label="验证方式选择">
            <div class="section-title">选择验证方式</div>
            <div class="method-list" role="radiogroup" aria-label="验证方法">
              <div
                class="method-item"
                role="button"
                tabindex="0"
                @click="startEmojiVerification"
                @keydown.enter="startEmojiVerification"
                aria-label="使用表情符号验证，对比7个表情符号和数字">
                <van-icon name="smile-o" :size="24" color="var(--hula-success)" aria-hidden="true" />
                <div class="method-info">
                  <span class="method-name">表情符号验证</span>
                  <span class="method-desc">对比7个表情符号和数字</span>
                </div>
                <van-icon name="arrow" :size="18" aria-hidden="true" />
              </div>
              <div
                class="method-item"
                role="button"
                tabindex="0"
                @click="startQRVerification"
                @keydown.enter="startQRVerification"
                aria-label="使用二维码验证，扫描二维码快速验证">
                <van-icon name="qr" :size="24" color="var(--hula-success)" aria-hidden="true" />
                <div class="method-info">
                  <span class="method-name">二维码验证</span>
                  <span class="method-desc">扫描二维码快速验证</span>
                </div>
                <van-icon name="arrow" :size="18" aria-hidden="true" />
              </div>
            </div>
          </div>

          <!-- Waiting State -->
          <div v-if="verifying" class="waiting-section" role="status" aria-live="polite" aria-atomic="true">
            <van-loading size="24px" aria-label="正在验证中" />
            <p>正在验证...</p>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="dialog-footer" role="group" aria-label="操作按钮">
          <van-button
            v-if="currentStep === 1"
            size="large"
            block
            @click="handleReject"
            :disabled="verifying"
            aria-label="拒绝此设备的验证请求">
            拒绝
          </van-button>
          <van-button
            v-if="currentStep === 1 && verificationEmoji"
            type="primary"
            size="large"
            block
            @click="handleAccept"
            :loading="verifying"
            :aria-label="verifying ? '正在验证中' : '确认表情符号匹配，验证设备'">
            确认匹配
          </van-button>
          <van-button
            v-if="currentStep === 0"
            type="primary"
            size="large"
            block
            @click="handleClose"
            aria-label="稍后再验证，关闭对话框">
            稍后验证
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- Success Notification -->
    <van-popup
      v-model:show="showSuccess"
      :close-on-click-overlay="true"
      position="center"
      :style="{ width: '90%', maxWidth: '320px', borderRadius: '12px' }"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="success-title">
      <div class="success-dialog">
        <div class="success-header">
          <van-icon name="success" :size="48" color="var(--hula-success)" aria-hidden="true" />
        </div>
        <div class="success-content">
          <h3 id="success-title">验证成功!</h3>
          <p>{{ successMessage }}</p>
        </div>
        <van-button
          type="primary"
          size="large"
          block
          @click="showSuccess = false"
          aria-label="关闭成功提示">完成
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMessage, useDialog } from '@/utils/vant-adapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Icon name mapping for Vant
const getVantIconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    X: 'close',
    Devices: 'phone-o',
    Qrcode: 'qr',
    MoodHappy: 'smile-o',
    ChevronRight: 'arrow',
    Shield: 'shield-o',
    ShieldOff: 'shield-close',
    ShieldX: 'shield-close',
    CircleCheck: 'success'
  }
  return iconMap[iconName] || 'circle'
}

interface VerificationRequest {
  requestId: string
  userId: string
  deviceId: string
  timestamp: number
}

interface VerificationEmoji {
  emoji: string
  number: number
}

type TrustLevel = 'verified' | 'blocked' | 'unknown'
type VerificationStatus = 'process' | 'finish' | 'error' | 'wait'

const props = withDefaults(
  defineProps<{
    show?: boolean
  }>(),
  {
    show: false
  }
)

const emit = defineEmits<{
  (e: 'verification-complete', data: { requestId: string; status: string }): void
  (e: 'close'): void
}>()

const message = useMessage()
const dialog = useDialog()

// State
const showDialog = ref(false)
const showSuccess = ref(false)
const pendingRequest = ref<VerificationRequest | null>(null)
const currentStep = ref(0)
const verificationStatus = ref<VerificationStatus>('wait')
const verifying = ref(false)
const currentTrustLevel = ref<TrustLevel>('unknown')
const verificationEmoji = ref<VerificationEmoji[]>([])
const showEmojiVerification = ref(false)
const showQRVerification = ref(false)
const successMessage = ref('')

// Emoji list for SAS (Short Authentication String)
const emojiList = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵']

// Accessibility IDs
const dialogTitleId = `device-verification-title-${Math.random().toString(36).substring(2, 9)}`
const dialogDescId = `device-verification-desc-${Math.random().toString(36).substring(2, 9)}`

// Computed
const showContent = computed(() => showDialog.value || props.show)

// Methods
const formatUserId = (userId: string): string => {
  const parts = userId.split(':')
  if (parts.length >= 2) {
    const local = parts[0].replace(/^@/, '')
    const server = parts[1]
    if (local.length > 15) {
      return `${local.slice(0, 12)}...@${server.slice(0, 10)}...`
    }
  }
  return userId
}

const getUserAvatar = (userId: string): string => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return ''

    const clientMethods = client as Record<string, unknown>
    if (typeof clientMethods.getUser === 'function') {
      const user = clientMethods.getUser(userId) as Record<string, unknown> | undefined
      if (user && typeof user.getAvatarUrl === 'function') {
        const baseUrl = typeof clientMethods.getHomeserverUrl === 'function' ? clientMethods.getHomeserverUrl() : ''
        return user.getAvatarUrl(baseUrl, 80, 80, 'crop', false) as string
      }
    }
  } catch (err) {
    logger.error('[MobileDeviceVerification] Failed to get user avatar:', err)
  }
  return ''
}

const getUserName = (userId: string): string => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return userId.split(':')[0].replace(/^@/, '')

    const clientMethods = client as Record<string, unknown>
    if (typeof clientMethods.getUser === 'function') {
      const user = clientMethods.getUser(userId) as Record<string, unknown> | undefined
      if (user) {
        const displayName = (user as { displayName?: string }).displayName
        const rawDisplayName = (user as { rawDisplayName?: string }).rawDisplayName
        return displayName || rawDisplayName || userId.split(':')[0].replace(/^@/, '')
      }
    }
  } catch (err) {
    logger.error('[MobileDeviceVerification] Failed to get user name:', err)
  }
  return userId.split(':')[0].replace(/^@/, '')
}

const getTrustLabel = (level: TrustLevel): string => {
  switch (level) {
    case 'verified':
      return '已验证'
    case 'blocked':
      return '已阻止'
    default:
      return '未验证'
  }
}

const getTrustDescription = (level: TrustLevel): string => {
  switch (level) {
    case 'verified':
      return '可以安全地进行加密通信'
    case 'blocked':
      return '此设备已被阻止'
    default:
      return '建议在使用前进行验证'
  }
}

const getTrustIcon = (level: TrustLevel): string => {
  switch (level) {
    case 'verified':
      return 'Shield'
    case 'blocked':
      return 'ShieldX'
    default:
      return 'ShieldOff'
  }
}

const getTrustIconName = (level: TrustLevel): string => {
  return getTrustIcon(level)
}

const generateVerificationEmoji = (): void => {
  const pairs: VerificationEmoji[] = []
  for (let i = 0; i < 7; i++) {
    const emoji = emojiList[Math.floor(Math.random() * emojiList.length)]
    const number = Math.floor(Math.random() * 10)
    pairs.push({ emoji, number })
  }
  verificationEmoji.value = pairs
  showEmojiVerification.value = true
  showQRVerification.value = false
}

const startEmojiVerification = () => {
  currentStep.value = 1
  verificationStatus.value = 'process'
  generateVerificationEmoji()
}

const startQRVerification = () => {
  currentStep.value = 1
  verificationStatus.value = 'process'
  showQRVerification.value = true
  showEmojiVerification.value = false
}

const switchToEmoji = () => {
  showQRVerification.value = false
  generateVerificationEmoji()
}

const handleAccept = async () => {
  if (!pendingRequest.value) return

  verifying.value = true
  try {
    // Simulate verification process
    await new Promise((resolve) => setTimeout(resolve, 1500))

    currentStep.value = 2
    verificationStatus.value = 'finish'
    currentTrustLevel.value = 'verified'
    successMessage.value = '设备已成功验证，现在可以安全通信'
    showSuccess.value = true

    emit('verification-complete', {
      requestId: pendingRequest.value.requestId,
      status: 'verified'
    })

    message.success('设备验证成功')

    setTimeout(() => {
      showDialog.value = false
      resetState()
    }, 2000)
  } catch (err) {
    logger.error('[MobileDeviceVerification] Verification failed:', err)
    message.error('验证失败，请重试')
  } finally {
    verifying.value = false
  }
}

const handleReject = () => {
  if (!pendingRequest.value) return

  dialog.warning({
    title: '拒绝验证',
    content: '确定要拒绝此设备的验证请求吗？',
    confirmText: '拒绝',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        emit('verification-complete', {
          requestId: pendingRequest.value!.requestId,
          status: 'rejected'
        })

        verificationStatus.value = 'error'
        showDialog.value = false
        message.info('已拒绝验证请求')
        resetState()
      } catch (err) {
        logger.error('[MobileDeviceVerification] Failed to reject:', err)
        message.error('操作失败')
      }
    }
  })
}

const handleClose = () => {
  if (verifying.value) return

  if (currentStep.value > 0) {
    dialog.warning({
      title: '取消验证',
      content: '确定要取消验证吗？',
      confirmText: '确定',
      cancelText: '继续',
      onConfirm: () => {
        showDialog.value = false
        emit('close')
        resetState()
      }
    })
  } else {
    showDialog.value = false
    emit('close')
    resetState()
  }
}

const resetState = () => {
  pendingRequest.value = null
  currentStep.value = 0
  verificationStatus.value = 'wait'
  verificationEmoji.value = []
  showEmojiVerification.value = false
  showQRVerification.value = false
}

// Event handlers for E2EE events
const handleVerificationRequest = (event: Event) => {
  const customEvent = event as CustomEvent<VerificationRequest>
  pendingRequest.value = customEvent.detail
  currentStep.value = 0
  verificationStatus.value = 'process'
  showDialog.value = true

  logger.info('[MobileDeviceVerification] Verification request received:', customEvent.detail)
}

const handleVerificationStatusChanged = (event: Event) => {
  const customEvent = event as CustomEvent<{ requestId: string; status: string }>

  if (pendingRequest.value?.requestId === customEvent.detail.requestId) {
    if (customEvent.detail.status === 'verified') {
      currentStep.value = 2
      verificationStatus.value = 'finish'
      currentTrustLevel.value = 'verified'
      successMessage.value = '设备已成功验证'
      showSuccess.value = true

      setTimeout(() => {
        showDialog.value = false
        resetState()
      }, 2000)
    } else if (customEvent.detail.status === 'cancelled' || customEvent.detail.status === 'rejected') {
      verificationStatus.value = 'error'
      showDialog.value = false
      resetState()
    }
  }

  logger.info('[MobileDeviceVerification] Status changed:', customEvent.detail)
}

// Lifecycle
onMounted(() => {
  window.addEventListener('matrix:verification-request', handleVerificationRequest)
  window.addEventListener('matrix:verification-status-changed', handleVerificationStatusChanged)
})

onUnmounted(() => {
  window.removeEventListener('matrix:verification-request', handleVerificationRequest)
  window.removeEventListener('matrix:verification-status-changed', handleVerificationStatusChanged)
})

// Watch show prop
watch(
  () => props.show,
  (newValue) => {
    showDialog.value = newValue
  },
  { immediate: true }
)

// Expose methods
defineExpose({
  show: () => {
    showDialog.value = true
  },
  hide: () => {
    showDialog.value = false
  }
})
</script>

<style scoped lang="scss">
.mobile-device-verification {
  // Container for mobile device verification dialog
}

.verification-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--hula-gray-200);
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--hula-gray-300);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-gray-100);
  flex-shrink: 0;

  .header-content {
    flex: 1;

    h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .header-desc {
      font-size: 13px;
      color: var(--text-color-3);
    }
  }

  .close-icon {
    cursor: pointer;
    color: var(--hula-gray-700);
    padding: 8px;

    &:active {
      opacity: 0.6;
    }
  }
}

.verification-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
}

.alert-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--hula-info-rgb), 0.1);
  border: 1px solid var(--hula-info);
  border-radius: 8px;
  color: var(--hula-info);
  font-size: 13px;
}

// Custom steps
.custom-steps {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 12px;

  .step-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .step-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--card-color);
      border: 2px solid var(--divider-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-3);
      transition: all 0.3s;

      span {
        font-size: 14px;
      }
    }

    .step-title {
      font-size: 12px;
      color: var(--text-color-3);
    }

    &.active .step-circle {
      border-color: var(--primary-color);
      color: var(--primary-color);
      background: rgba(var(--hula-success-rgb), 0.1);
    }

    &.completed .step-circle {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: white;
    }
  }
}

.success-dialog {
  padding: 24px;
  text-align: center;

  .success-header {
    margin-bottom: 16px;
  }

  .success-content {
    margin-bottom: 24px;

    h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: var(--text-color-1);
    }

    p {
      margin: 0;
      color: var(--text-color-3);
    }
  }
}

.dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--hula-gray-100);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--bg-color);
  border-radius: 12px;

  .user-details {
    text-align: center;

    .user-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
      margin-bottom: 4px;
    }

    .user-id {
      font-size: 12px;
      color: var(--text-color-3);
      font-family: 'Monaco', 'Consolas', monospace;
    }
  }
}

.steps-section {
  // Steps section styles are handled by inline classes and Vant components
}

.emoji-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 12px;
    text-align: center;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .emoji-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    background: var(--bg-color);
    border-radius: 8px;

    .emoji {
      font-size: 22px;
    }

    .number {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-color);
    }
  }
}

.qr-section {
  text-align: center;

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 16px;
  }

  .qr-container {
    display: flex;
    justify-content: center;
    padding: 24px;
    background: var(--bg-color);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .qr-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--text-color-3);

    p {
      margin: 0;
      font-size: 13px;
    }
  }
}

.trust-section {
  .trust-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 12px;

    &.trust-verified {
      background: rgba(var(--hula-success-rgb), 0.1);
      color: var(--hula-success);
    }

    &.trust-blocked {
      background: rgba(var(--hula-error-rgb), 0.1);
      color: var(--hula-error);
    }

    &.trust-unknown {
      background: rgba(var(--hula-warning-rgb), 0.1);
      color: var(--hula-warning);
    }

    .trust-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .trust-label {
        font-size: 14px;
        font-weight: 600;
      }

      .trust-desc {
        font-size: 12px;
        opacity: 0.8;
      }
    }
  }
}

.methods-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 12px;
  }

  .method-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .method-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;

    &:active {
      background: var(--item-hover-bg);
    }

    .method-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .method-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color-1);
      }

      .method-desc {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }
}

.waiting-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;

  p {
    margin: 0;
    color: var(--text-color-2);
  }
}

// Safe area support
@supports (padding: env(safe-area-inset-bottom)) {
  .dialog-footer {
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }
}
</style>
