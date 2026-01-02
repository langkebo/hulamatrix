<!-- Mobile Device Verification Dialog - E2EE device verification for mobile -->
<template>
  <div class="mobile-device-verification">
    <!-- Bottom Sheet Dialog -->
    <n-modal
      v-model:show="showDialog"
      :mask-closable="false"
      :style="{
        width: '100%',
        maxWidth: '100%',
        position: 'fixed',
        bottom: '0',
        margin: '0',
        borderRadius: '16px 16px 0 0'
      }"
      preset="card"
      @close="handleClose"
    >
      <template #header>
        <div class="dialog-header">
          <div class="header-content">
            <h3>设备验证</h3>
            <span class="header-desc">验证设备以确保安全的加密通信</span>
          </div>
          <n-button quaternary circle size="small" @click="handleClose">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>
      </template>

      <!-- Content -->
      <div class="verification-content">
        <!-- User Info -->
        <div v-if="pendingRequest" class="user-section">
          <n-avatar :size="64" :src="getUserAvatar(pendingRequest.userId)" round>
            <template #fallback>
              <n-icon :size="32"><Devices /></n-icon>
            </template>
          </n-avatar>
          <div class="user-details">
            <div class="user-name">{{ getUserName(pendingRequest.userId) }}</div>
            <div class="user-id">{{ formatUserId(pendingRequest.userId) }}</div>
          </div>
        </div>

        <!-- Verification Steps -->
        <div class="steps-section">
          <n-steps :current="currentStep" :status="verificationStatus" size="small">
            <n-step title="请求" />
            <n-step title="验证" />
            <n-step title="完成" />
          </n-steps>
        </div>

        <!-- Emoji Verification (SAS) -->
        <div v-if="showEmojiVerification" class="emoji-section">
          <div class="section-title">验证表情符号</div>
          <div class="emoji-grid">
            <div
              v-for="(item, index) in verificationEmoji"
              :key="index"
              class="emoji-item"
            >
              <span class="emoji">{{ item.emoji }}</span>
              <span class="number">{{ item.number }}</span>
            </div>
          </div>
          <n-alert type="info" style="margin-top: 12px">
            请确认对方设备显示的表情符号和数字与上面一致
          </n-alert>
        </div>

        <!-- QR Code Verification -->
        <div v-if="showQRVerification" class="qr-section">
          <div class="section-title">扫描二维码验证</div>
          <div class="qr-container">
            <div class="qr-placeholder">
              <n-icon :size="64"><Qrcode /></n-icon>
              <p>显示二维码供对方扫描</p>
            </div>
          </div>
          <n-button block secondary @click="switchToEmoji">
            改用表情符号验证
          </n-button>
        </div>

        <!-- Trust Level -->
        <div class="trust-section">
          <div class="trust-card" :class="`trust-${currentTrustLevel}`">
            <n-icon :size="24">
              <component :is="getTrustIcon(currentTrustLevel)" />
            </n-icon>
            <div class="trust-info">
              <span class="trust-label">{{ getTrustLabel(currentTrustLevel) }}</span>
              <span class="trust-desc">{{ getTrustDescription(currentTrustLevel) }}</span>
            </div>
          </div>
        </div>

        <!-- Verification Methods -->
        <div v-if="currentStep === 0 && !verifying" class="methods-section">
          <div class="section-title">选择验证方式</div>
          <div class="method-list">
            <div class="method-item" @click="startEmojiVerification">
              <n-icon :size="24" color="#18a058"><MoodHappy /></n-icon>
              <div class="method-info">
                <span class="method-name">表情符号验证</span>
                <span class="method-desc">对比7个表情符号和数字</span>
              </div>
              <n-icon :size="18"><ChevronRight /></n-icon>
            </div>
            <div class="method-item" @click="startQRVerification">
              <n-icon :size="24" color="#18a058"><Qrcode /></n-icon>
              <div class="method-info">
                <span class="method-name">二维码验证</span>
                <span class="method-desc">扫描二维码快速验证</span>
              </div>
              <n-icon :size="18"><ChevronRight /></n-icon>
            </div>
          </div>
        </div>

        <!-- Waiting State -->
        <div v-if="verifying" class="waiting-section">
          <n-spin size="large" />
          <p>正在验证...</p>
        </div>
      </div>

      <!-- Actions -->
      <template #footer>
        <div class="dialog-footer">
          <n-button v-if="currentStep === 1" size="large" block @click="handleReject" :disabled="verifying">
            拒绝
          </n-button>
          <n-button
            v-if="currentStep === 1 && verificationEmoji"
            type="primary"
            size="large"
            block
            @click="handleAccept"
            :loading="verifying"
          >
            确认匹配
          </n-button>
          <n-button
            v-if="currentStep === 0"
            type="primary"
            size="large"
            block
            @click="handleClose"
          >
            稍后验证
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Success Notification -->
    <n-modal
      v-model:show="showSuccess"
      :mask-closable="true"
      :style="{ maxWidth: '320px' }"
      preset="card"
    >
      <template #header>
        <div class="success-header">
          <n-icon :size="48" color="#18a058">
            <CircleCheck />
          </n-icon>
        </div>
      </template>
      <div class="success-content">
        <h3>验证成功!</h3>
        <p>{{ successMessage }}</p>
      </div>
      <template #footer>
        <n-button type="primary" size="large" block @click="showSuccess = false">
          完成
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NButton, NIcon, NAvatar, NSteps, NStep, NAlert, NSpin, useMessage, useDialog } from 'naive-ui'
import { X, Devices, Qrcode, MoodHappy, ChevronRight, Shield, ShieldOff, ShieldX, CircleCheck } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

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

const getTrustIcon = (level: TrustLevel) => {
  switch (level) {
    case 'verified':
      return Shield
    case 'blocked':
      return ShieldX
    default:
      return ShieldOff
  }
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
    positiveText: '拒绝',
    negativeText: '取消',
    onPositiveClick: async () => {
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
      positiveText: '确定',
      negativeText: '继续',
      onPositiveClick: () => {
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

<script lang="ts">
import { watch } from 'vue'
export default {
  name: 'MobileDeviceVerificationDialog'
}
</script>

<style scoped lang="scss">
.mobile-device-verification {
  // Container
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;

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
}

.verification-content {
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 60vh;
  overflow-y: auto;
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
  :deep(.n-steps) {
    .n-step {
      flex: 1;
    }
  }
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
      background: rgba(24, 160, 88, 0.1);
      color: #18a058;
    }

    &.trust-blocked {
      background: rgba(208, 48, 80, 0.1);
      color: #d03050;
    }

    &.trust-unknown {
      background: rgba(240, 160, 32, 0.1);
      color: #f0a020;
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

.dialog-footer {
  display: flex;
  gap: 8px;
}

.success-header {
  text-align: center;
}

.success-content {
  text-align: center;

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

// Safe area support
@supports (padding: env(safe-area-inset-bottom)) {
  .dialog-footer {
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }
}
</style>
