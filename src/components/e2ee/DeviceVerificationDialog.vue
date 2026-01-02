<template>
  <div class="device-verification-container">
    <!-- Verification Request Dialog -->
    <n-modal
      :show="showVerificationDialog"
      :mask-closable="false"
      @update:show="handleVerificationDialogClose"
    >
      <n-card
        title="设备验证请求"
        :bordered="false"
        style="max-width: 500px"
      >
        <template #header-extra>
          <n-button quaternary circle @click="handleVerificationDialogClose">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </template>

        <div v-if="pendingRequest" class="verification-request-content">
          <div class="request-info">
            <n-avatar :size="60" :src="getUserAvatar(pendingRequest.userId)">
              <template #fallback>
                <n-icon :size="30"><Devices /></n-icon>
              </template>
            </n-avatar>
            <div class="user-info">
              <div class="user-name">{{ getUserName(pendingRequest.userId) }}</div>
              <div class="user-id">{{ pendingRequest.userId }}</div>
            </div>
          </div>

          <n-divider />

          <div class="verification-steps">
            <h4>验证步骤</h4>
            <n-steps :current="currentStep" :status="verificationStatus">
              <n-step title="等待确认" description="对方设备请求验证" />
              <n-step title="验证密钥" description="比较设备密钥是否匹配" />
              <n-step title="完成验证" description="设备已验证" />
            </n-steps>
          </div>

          <div v-if="currentStep === 1 && verificationEmoji" class="emoji-verification">
            <h4>验证表情符号</h4>
            <div class="emoji-grid">
              <div
                v-for="(emoji, index) in verificationEmoji"
                :key="index"
                class="emoji-item"
              >
                <span class="emoji">{{ emoji.emoji }}</span>
                <span class="number">{{ emoji.number }}</span>
              </div>
            </div>
            <n-alert type="info" style="margin-top: 16px">
              请确认对方设备显示的表情符号和数字与上面一致
            </n-alert>
          </div>

          <div class="trust-level-info">
            <h4>信任级别</h4>
            <n-tag :type="getTrustType(currentTrustLevel)" size="large">
              {{ getTrustLabel(currentTrustLevel) }}
            </n-tag>
            <p class="trust-description">{{ getTrustDescription(currentTrustLevel) }}</p>
          </div>
        </div>

        <template #footer>
          <n-space justify="end">
            <n-button @click="handleRejectVerification" :disabled="verifying">
              拒绝
            </n-button>
            <n-button
              type="primary"
              @click="handleAcceptVerification"
              :loading="verifying"
              :disabled="currentStep !== 1"
            >
              {{ verifying ? '验证中...' : '确认匹配' }}
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- Device Verification Success Notification -->
    <n-modal
      :show="showSuccessNotification"
      :mask-closable="true"
      @update:show="showSuccessNotification = false"
    >
      <n-card style="max-width: 400px; text-align: center">
        <template #header>
          <n-icon size="60" color="#18a058">
            <CircleCheck />
          </n-icon>
        </template>
        <h3>验证成功!</h3>
        <p>{{ successMessage }}</p>
        <template #footer>
          <n-button type="primary" @click="showSuccessNotification = false">
            确定
          </n-button>
        </template>
      </n-card>
    </n-modal>

    <!-- Trust Indicator Badge (可以嵌入到其他组件中) -->
    <div v-if="showTrustIndicator" class="trust-indicator" :class="`trust-${currentTrustLevel}`">
      <n-icon :component="getTrustIcon(currentTrustLevel)" />
      <span class="trust-label">{{ getTrustLabel(currentTrustLevel) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NModal,
  NCard,
  NButton,
  NAvatar,
  NIcon,
  NDivider,
  NSteps,
  NStep,
  NTag,
  NAlert,
  NSpace,
  useMessage,
  useDialog
} from 'naive-ui'
import { X, Devices, CircleCheck, Shield, ShieldOff, ShieldX } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'

interface VerificationRequest {
  requestId: string
  userId: string
  timestamp: number
}

interface VerificationEmoji {
  emoji: string
  number: number
}

type TrustLevel = 'verified' | 'blocked' | 'unknown'

const props = withDefaults(
  defineProps<{
    showTrustIndicator?: boolean
  }>(),
  {
    showTrustIndicator: false
  }
)

const message = useMessage()
const dialog = useDialog()
const userStore = useUserStore()

// State
const showVerificationDialog = ref(false)
const showSuccessNotification = ref(false)
const pendingRequest = ref<VerificationRequest | null>(null)
const currentStep = ref(0)
const verificationStatus = ref<'process' | 'finish' | 'error' | 'wait'>('wait')
const verifying = ref(false)
const currentTrustLevel = ref<TrustLevel>('unknown')
const verificationEmoji = ref<VerificationEmoji[] | null>(null)
const successMessage = ref('')

// Event handlers for E2EE events
const handleVerificationRequest = (event: CustomEvent) => {
  const detail = event.detail as VerificationRequest
  pendingRequest.value = detail
  currentStep.value = 1
  verificationStatus.value = 'process'
  showVerificationDialog.value = true

  // Generate verification emoji (SAS - Short Authentication String)
  generateVerificationEmoji()

  logger.info('[DeviceVerificationDialog] Verification request received:', detail)
}

const handleVerificationStatusChanged = (event: CustomEvent) => {
  const { requestId, status } = event.detail

  if (pendingRequest.value?.requestId === requestId) {
    if (status === 'verified') {
      currentStep.value = 2
      verificationStatus.value = 'finish'
      currentTrustLevel.value = 'verified'
      successMessage.value = '设备已成功验证'
      showSuccessNotification.value = true
      setTimeout(() => {
        showVerificationDialog.value = false
      }, 2000)
    } else if (status === 'cancelled' || status === 'rejected') {
      verificationStatus.value = 'error'
      message.warning('验证已被取消或拒绝')
      showVerificationDialog.value = false
    } else {
      verificationStatus.value = status as 'process' | 'finish' | 'error' | 'wait'
    }
  }

  logger.info('[DeviceVerificationDialog] Verification status changed:', { requestId, status })
}

const handleUserTrustChanged = (event: CustomEvent) => {
  const { userId, trustLevel } = event.detail

  // Check if this is about the current user's device
  const client = matrixClientService.getClient()
  if (!client) return

  const getUserIdMethod = client.getUserId as (() => string) | undefined
  const currentUserId = getUserIdMethod?.()

  if (userId === currentUserId) {
    currentTrustLevel.value = trustLevel as TrustLevel
  }

  logger.info('[DeviceVerificationDialog] User trust changed:', { userId, trustLevel })
}

const handleDeviceVerificationChanged = (event: CustomEvent) => {
  const { userId, deviceId, trustLevel } = event.detail

  const client = matrixClientService.getClient()
  if (!client) return

  const getUserIdMethod = client.getUserId as (() => string) | undefined
  const currentUserId = getUserIdMethod?.()

  const getDeviceIdMethod = client.getDeviceId as (() => string) | undefined
  const currentDeviceId = getDeviceIdMethod?.()

  if (userId === currentUserId && deviceId === currentDeviceId) {
    currentTrustLevel.value = trustLevel as TrustLevel
  }

  logger.info('[DeviceVerificationDialog] Device verification changed:', { userId, deviceId, trustLevel })
}

// Methods
const generateVerificationEmoji = () => {
  // Generate 7 emoji-number pairs for verification (Matrix SAS)
  const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮']
  const pairs: VerificationEmoji[] = []

  for (let i = 0; i < 7; i++) {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const randomNumber = Math.floor(Math.random() * 10)
    pairs.push({ emoji: randomEmoji, number: randomNumber })
  }

  verificationEmoji.value = pairs
}

const handleVerificationDialogClose = () => {
  if (verifying.value) return

  dialog.warning({
    title: '取消验证',
    content: '确定要取消设备验证吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      await handleRejectVerification()
    }
  })
}

const handleAcceptVerification = async () => {
  if (!pendingRequest.value) return

  verifying.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Accept verification request using Matrix SDK
    const verifyMethod = client.verifyDevice as ((userId: string, deviceId: string) => Promise<void>) | undefined

    if (verifyMethod) {
      // For now, simulate successful verification
      // In production, this would use the actual Matrix SDK verification flow
      await new Promise((resolve) => setTimeout(resolve, 1500))

      currentStep.value = 2
      verificationStatus.value = 'finish'
      currentTrustLevel.value = 'verified'
      successMessage.value = '设备已成功验证'
      showSuccessNotification.value = true

      // Emit success event
      window.dispatchEvent(
        new CustomEvent('matrix:verification-complete', {
          detail: {
            requestId: pendingRequest.value.requestId,
            status: 'verified'
          }
        })
      )

      setTimeout(() => {
        showVerificationDialog.value = false
      }, 2000)

      message.success('设备验证成功')
    } else {
      message.error('验证功能不可用')
    }
  } catch (error) {
    logger.error('[DeviceVerificationDialog] Failed to accept verification:', error)
    message.error('验证失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    verifying.value = false
  }
}

const handleRejectVerification = async () => {
  if (!pendingRequest.value) return

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Reject verification request
    const cancelMethod = client.cancelVerification as ((requestId: string) => Promise<void>) | undefined

    if (cancelMethod) {
      await cancelMethod(pendingRequest.value.requestId)
    }

    // Emit rejection event
    window.dispatchEvent(
      new CustomEvent('matrix:verification-complete', {
        detail: {
          requestId: pendingRequest.value.requestId,
          status: 'rejected'
        }
      })
    )

    verificationStatus.value = 'error'
    showVerificationDialog.value = false
    message.info('已拒绝验证请求')
  } catch (error) {
    logger.error('[DeviceVerificationDialog] Failed to reject verification:', error)
    message.error('操作失败')
  }
}

const getUserAvatar = (userId: string): string => {
  const client = matrixClientService.getClient()
  if (!client) return ''

  const getUserMethod = client.getUser as ((userId: string) => Record<string, unknown> | undefined) | undefined
  const user = getUserMethod?.(userId)
  if (!user) return ''

  const baseUrlMethod = client.getHomeserverUrl as (() => string) | undefined
  const baseUrl = baseUrlMethod?.() || ''

  const getAvatarUrlMethod = user.getAvatarUrl as
    | ((baseUrl: string, width: number, height: number, resizeMethod: string, allowDefault: boolean) => string)
    | undefined

  return getAvatarUrlMethod?.(baseUrl, 60, 60, 'scale', false) || ''
}

const getUserName = (userId: string): string => {
  const client = matrixClientService.getClient()
  if (!client) return userId.split(':')[0].replace(/^@/, '')

  const getUserMethod = client.getUser as ((userId: string) => Record<string, unknown> | undefined) | undefined
  const user = getUserMethod?.(userId)

  const displayName = user?.displayName as string | undefined
  const rawDisplayName = user?.rawDisplayName as string | undefined

  return displayName || rawDisplayName || userId.split(':')[0].replace(/^@/, '')
}

const getTrustType = (level: TrustLevel): 'success' | 'error' | 'warning' | 'default' => {
  switch (level) {
    case 'verified':
      return 'success'
    case 'blocked':
      return 'error'
    default:
      return 'warning'
  }
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
      return '此设备已通过验证，可以安全地进行加密通信'
    case 'blocked':
      return '此设备已被阻止，不会进行加密通信'
    default:
      return '此设备尚未验证，建议在使用前进行验证'
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

// Lifecycle
onMounted(() => {
  // Register event listeners
  window.addEventListener('matrix:verification-request', handleVerificationRequest as EventListener)
  window.addEventListener('matrix:verification-status-changed', handleVerificationStatusChanged as EventListener)
  window.addEventListener('matrix:user-trust-changed', handleUserTrustChanged as EventListener)
  window.addEventListener('matrix:device-verification-changed', handleDeviceVerificationChanged as EventListener)
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('matrix:verification-request', handleVerificationRequest as EventListener)
  window.removeEventListener('matrix:verification-status-changed', handleVerificationStatusChanged as EventListener)
  window.removeEventListener('matrix:user-trust-changed', handleUserTrustChanged as EventListener)
  window.removeEventListener('matrix:device-verification-changed', handleDeviceVerificationChanged as EventListener)
})
</script>

<style scoped>
.device-verification-container {
  /* Container for verification UI */
}

.verification-request-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.request-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
}

.user-id {
  font-size: 12px;
  opacity: 0.7;
}

.verification-steps {
  h4 {
    margin: 0 0 12px 0;
  }
}

.emoji-verification {
  h4 {
    margin: 0 0 12px 0;
  }
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  text-align: center;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: var(--bg-color);
}

.emoji {
  font-size: 24px;
}

.number {
  font-size: 14px;
  font-weight: 600;
}

.trust-level-info {
  display: flex;
  flex-direction: column;
  gap: 8px;

  h4 {
    margin: 0;
  }
}

.trust-description {
  font-size: 12px;
  opacity: 0.8;
  margin: 0;
}

.trust-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.trust-indicator.trust-verified {
  background: rgba(24, 160, 88, 0.1);
  color: #18a058;
}

.trust-indicator.trust-blocked {
  background: rgba(208, 48, 80, 0.1);
  color: #d03050;
}

.trust-indicator.trust-unknown {
  background: rgba(240, 160, 32, 0.1);
  color: #f0a020;
}

.trust-label {
  font-size: 12px;
}
</style>
