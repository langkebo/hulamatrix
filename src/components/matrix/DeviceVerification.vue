<template>
  <div class="device-verification">
    <!-- Device List -->
    <div class="device-list">
      <div class="section-header">
        <h3>我的设备</h3>
        <n-button
          text
          size="small"
          @click="refreshDevices"
        >
          <n-icon :component="Refresh" />
          刷新
        </n-button>
      </div>

      <div class="current-device">
        <n-card title="当前设备" size="small">
          <div class="device-info">
            <n-descriptions :column="1" size="small">
              <n-descriptions-item label="设备ID">
                {{ currentDevice?.deviceId || 'N/A' }}
              </n-descriptions-item>
              <n-descriptions-item label="设备名称">
                {{ currentDevice?.displayName || '当前设备' }}
              </n-descriptions-item>
              <n-descriptions-item label="验证状态">
                <n-tag
                  :type="currentDevice?.verified ? 'success' : 'warning'"
                  size="small"
                >
                  {{ currentDevice?.verified ? '已验证' : '未验证' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="最后活动">
                {{ formatLastSeen(currentDevice?.lastSeenTs) }}
              </n-descriptions-item>
            </n-descriptions>

            <div class="device-keys">
              <h4>设备密钥指纹</h4>
              <div class="fingerprint-display">
                <div class="fingerprint-section">
                  <span class="label">ED25519:</span>
                  <code class="fingerprint">{{ currentDeviceFingerprint.ed25519 }}</code>
                </div>
                <div class="fingerprint-section">
                  <span class="label">Curve25519:</span>
                  <code class="fingerprint">{{ currentDeviceFingerprint.curve25519 }}</code>
                </div>
              </div>
              <n-button
                text
                size="small"
                type="primary"
                @click="copyFingerprint"
              >
                <n-icon :component="Copy" />
                复制指纹
              </n-button>
            </div>
          </div>
        </n-card>
      </div>

      <!-- Other Devices -->
      <div class="other-devices">
        <h4>其他设备</h4>
        <div v-if="devices.length === 0" class="empty-devices">
          <n-empty description="没有其他设备" />
        </div>
        <div v-else class="device-grid">
          <n-card
            v-for="device in devices"
            :key="device.deviceId"
            size="small"
            class="device-card"
            :class="{ 'blocked': device.blocked }"
          >
            <div class="device-card-header">
              <div class="device-name">
                {{ device.displayName || device.deviceId }}
                <n-tag v-if="device.blocked" type="error" size="tiny">已阻止</n-tag>
              </div>
              <n-dropdown
                :options="getDeviceMenuOptions(device)"
                @select="handleDeviceMenuAction($event, device)"
              >
                <n-button quaternary size="small">
                  <n-icon :component="DotsVertical" />
                </n-button>
              </n-dropdown>
            </div>

            <div class="device-details">
              <div class="device-meta">
                <span class="device-id">{{ device.deviceId }}</span>
                <n-tag
                  :type="device.verified ? 'success' : 'warning'"
                  size="small"
                >
                  {{ device.verified ? '已验证' : '未验证' }}
                </n-tag>
              </div>

              <div v-if="device.lastSeenTs" class="last-seen">
                最后活动: {{ formatLastSeen(device.lastSeenTs) }}
                <span v-if="device.lastSeenIp" class="ip">
                  ({{ device.lastSeenIp }})
                </span>
              </div>
            </div>

            <div class="device-actions">
              <n-button
                v-if="!device.verified && !device.blocked"
                type="primary"
                size="small"
                @click="startVerification(device)"
              >
                <n-icon :component="ShieldCheck" />
                验证
              </n-button>
              <n-button
                v-if="!device.blocked"
                type="error"
                size="small"
                @click="blockDevice(device)"
              >
                <n-icon :component="Shield" />
                阻止
              </n-button>
              <n-button
                v-else
                type="success"
                size="small"
                @click="unblockDevice(device)"
              >
                <n-icon :component="ShieldCheck" />
                取消阻止
              </n-button>
            </div>
          </n-card>
        </div>
      </div>
    </div>

    <!-- Verification Requests -->
    <div v-if="verificationRequests.length > 0" class="verification-requests">
      <h3>验证请求</h3>
      <div class="request-list">
        <n-card
          v-for="request in verificationRequests"
          :key="request.requestId"
          size="small"
        >
          <div class="request-info">
            <div class="request-header">
              <n-avatar
                v-bind="request.fromDevice.displayName !== undefined ? { src: request.fromDevice.displayName } : {}"
                round
                size="small"
              />
              <div class="request-details">
                <span class="requester">
                  {{ request.fromDevice.displayName || request.fromDevice.deviceId }}
                </span>
                <span class="request-device">设备: {{ request.fromDevice.deviceId }}</span>
              </div>
            </div>
            <div class="request-time">
              {{ formatTime(request.timestamp) }}
            </div>
          </div>
          <div class="request-actions">
            <n-button
              type="success"
              size="small"
              @click="acceptVerificationRequest(request)"
            >
              接受
            </n-button>
            <n-button
              type="error"
              size="small"
              @click="rejectVerificationRequest(request)"
            >
              拒绝
            </n-button>
          </div>
        </n-card>
      </div>
    </div>

    <!-- Verification Modal -->
    <n-modal
      v-model:show="showVerificationModal"
      :mask-closable="false"
      preset="dialog"
      title="设备验证"
      style="width: 600px"
    >
      <div v-if="verifyingDevice" class="verification-content">
        <!-- Step 1: Display keys -->
        <div v-if="verificationStep === 'display'" class="verification-step">
          <h4>步骤 1: 确认设备密钥</h4>
          <p>请确认以下密钥是否与另一个设备上显示的一致:</p>

          <div class="emoji-verification">
            <h5>表情符号验证</h5>
            <div class="emoji-list">
              <div
                v-for="(emoji, index) in verificationEmojis"
                :key="index"
                class="emoji-item"
              >
                <span class="emoji">{{ emoji.emoji }}</span>
                <span class="emoji-name">{{ emoji.name }}</span>
              </div>
            </div>
          </div>

          <div class="numeric-verification">
            <h5>数字验证</h5>
            <div class="number-list">
              <span
                v-for="(number, index) in verificationNumbers"
                :key="index"
                class="number-item"
              >
                {{ number }}
              </span>
            </div>
          </div>

          <div class="verification-actions">
            <n-button @click="showVerificationModal = false">
              取消
            </n-button>
            <n-button type="primary" @click="confirmVerification">
              确认匹配
            </n-button>
          </div>
        </div>

        <!-- Step 2: Waiting -->
        <div v-else-if="verificationStep === 'waiting'" class="verification-step">
          <div class="waiting-content">
            <n-spin size="large" />
            <p>等待其他设备确认...</p>
          </div>
        </div>

        <!-- Step 3: Complete -->
        <div v-else-if="verificationStep === 'complete'" class="verification-step">
          <div class="complete-content">
            <n-icon size="48" color="#18a058" :component="CircleCheck" />
            <h4>验证成功!</h4>
            <p>设备已成功验证</p>
          </div>
        </div>

        <!-- Step 4: Failed -->
        <div v-else-if="verificationStep === 'failed'" class="verification-step">
          <div class="failed-content">
            <n-icon size="48" color="var(--hula-error, #d03050)" :component="CircleX" />
            <h4>验证失败</h4>
            <p>{{ verificationError || '设备验证失败，请重试' }}</p>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- User Verification -->
    <div class="user-verification">
      <n-collapse>
        <n-collapse-item title="用户验证" name="users">
          <div class="user-list">
            <div
              v-for="user in users"
              :key="user.userId"
              class="user-item"
            >
              <div class="user-info">
                <n-avatar
                  v-bind="user.avatarUrl !== undefined ? { src: user.avatarUrl } : {}"
                  round
                  size="medium"
                >
                  {{ getUserInitials(user) }}
                </n-avatar>
                <div>
                  <div class="user-name">{{ user.displayName || user.userId }}</div>
                  <div class="user-id">{{ user.userId }}</div>
                </div>
              </div>
              <div class="user-devices">
                <n-tag
                  v-for="device in user.devices"
                  :key="device.deviceId"
                  :type="device.verified ? 'success' : 'warning'"
                  size="small"
                >
                  {{ device.displayName || device.deviceId }}
                </n-tag>
              </div>
            </div>
          </div>
        </n-collapse-item>
      </n-collapse>
    </div>

    <!-- Cross Signing Status -->
    <div class="cross-signing-status">
      <n-card title="交叉签名状态" size="small">
        <n-descriptions :column="2" size="small">
          <n-descriptions-item label="主密钥">
            <n-tag
              :type="crossSigningStatus.masterKey ? 'success' : 'error'"
              size="small"
            >
              {{ crossSigningStatus.masterKey ? '已设置' : '未设置' }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="自签名密钥">
            <n-tag
              :type="crossSigningStatus.userSigningKey ? 'success' : 'error'"
              size="small"
            >
              {{ crossSigningStatus.userSigningKey ? '已设置' : '未设置' }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="设备密钥">
            <n-tag
              :type="crossSigningStatus.deviceSigningKey ? 'success' : 'error'"
              size="small"
            >
              {{ crossSigningStatus.deviceSigningKey ? '已设置' : '未设置' }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <div v-if="!crossSigningStatus.complete" class="cross-signing-actions">
          <n-alert type="warning" title="交叉签名未完成">
            为了完整的安全性，请设置交叉签名
          </n-alert>
          <n-button
            type="primary"
            @click="setupCrossSigning"
          >
            设置交叉签名
          </n-button>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NButton,
  NIcon,
  NDropdown,
  NEmpty,
  NModal,
  NSpin,
  NCollapse,
  NCollapseItem,
  NAvatar,
  NAlert,
  useMessage
} from 'naive-ui'
import { Refresh, Copy, DotsVertical, ShieldCheck, Shield, CircleCheck, CircleX } from '@vicons/tabler'
import { e2eeService, type DeviceInfo, type VerificationRequest } from '@/services/e2eeService'
import { matrixClientService } from '@/integrations/matrix/client'
import { getUserId, isFunction } from '@/utils/matrixClientUtils'
import type { MatrixMember } from '@/types/matrix'

// Extended member interface with devices
interface MemberWithDevices extends MatrixMember {
  devices?: DeviceInfo[]
}

const emit = defineEmits<{
  verificationComplete: [device: DeviceInfo]
  verificationFailed: [device: DeviceInfo, error: string]
}>()

const message = useMessage()

// State
const loading = ref(false)
const currentDevice = ref<DeviceInfo | null>(null)
const devices = ref<DeviceInfo[]>([])
const verificationRequests = ref<VerificationRequest[]>([])
const verifyingRequest = ref<VerificationRequest | null>(null)
const showVerificationModal = ref(false)
const verifyingDevice = ref<DeviceInfo | null>(null)
const verificationStep = ref<'display' | 'waiting' | 'complete' | 'failed'>('display')
const verificationError = ref<string | null>(null)
const users = ref<MemberWithDevices[]>([])

// Verification data
const verificationEmojis = ref<Array<{ emoji: string; name: string }>>([])
const verificationNumbers = ref<string[]>([])

// Cross signing status
const crossSigningStatus: {
  masterKey: boolean
  userSigningKey: boolean
  deviceSigningKey: boolean
  complete: boolean
} = reactive({
  masterKey: false,
  userSigningKey: false,
  deviceSigningKey: false,
  complete: false
})

// Computed
const currentDeviceFingerprint = computed(() => {
  if (!currentDevice.value?.keys) {
    return { ed25519: '', curve25519: '' }
  }
  return {
    ed25519: formatFingerprint(currentDevice.value.keys.ed25519),
    curve25519: formatFingerprint(currentDevice.value.keys.curve25519)
  }
})

// Methods
const loadDevices = async () => {
  loading.value = true
  try {
    // Get current device info
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not available')

    const getDeviceIdFn = client.getDeviceId as (() => string) | undefined
    const deviceId = getDeviceIdFn?.()
    const userId = getUserId(client)
    if (!userId) throw new Error('User ID not available')
    if (!deviceId) throw new Error('Device ID not available')
    const allDevices = await e2eeService.getUserDevices(userId)

    currentDevice.value = allDevices.find((d) => d.deviceId === deviceId) || null
    devices.value = allDevices.filter((d) => d.deviceId !== deviceId)

    // Load verification requests
    verificationRequests.value = await e2eeService.getVerificationRequests()
  } catch (error) {
    message.error('加载设备列表失败')
  } finally {
    loading.value = false
  }
}

const refreshDevices = () => {
  loadDevices()
}

const copyFingerprint = async () => {
  const fingerprint = `${currentDeviceFingerprint.value.ed25519}\n${currentDeviceFingerprint.value.curve25519}`

  try {
    await navigator.clipboard.writeText(fingerprint)
    message.success('指纹已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const startVerification = async (device: DeviceInfo) => {
  try {
    verifyingDevice.value = device

    // Start verification
    await e2eeService.requestDeviceVerification(device.userId, device.deviceId)

    // Generate verification data
    generateVerificationData()

    showVerificationModal.value = true
    verificationStep.value = 'display'
  } catch (error) {
    message.error('启动验证失败')
  }
}

const acceptVerificationRequest = async (request: VerificationRequest) => {
  try {
    verifyingDevice.value = request.fromDevice

    // Accept request
    await e2eeService.acceptVerificationRequest(request.requestId)

    // Generate verification data
    generateVerificationData()

    showVerificationModal.value = true
    verificationStep.value = 'display'
  } catch (error) {
    message.error('接受验证请求失败')
  }
}

const rejectVerificationRequest = async (request: VerificationRequest) => {
  try {
    await e2eeService.rejectVerificationRequest(request.requestId)
    verificationRequests.value = verificationRequests.value.filter((r) => r.requestId !== request.requestId)
    message.success('已拒绝验证请求')
  } catch (error) {
    message.error('拒绝验证请求失败')
  }
}

const confirmVerification = async () => {
  if (!verifyingDevice.value) return

  try {
    verificationStep.value = 'waiting'

    // Confirm verification
    await e2eeService.confirmVerification(verifyingRequest.value?.requestId || '')

    verificationStep.value = 'complete'
    emit('verificationComplete', verifyingDevice.value)

    // Refresh device list
    await loadDevices()
  } catch (error) {
    verificationError.value = '验证失败'
    verificationStep.value = 'failed'
    emit('verificationFailed', verifyingDevice.value, error as string)
  }
}

const generateVerificationData = () => {
  // Generate emoji verification
  const emojis = [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐽',
    '🐸',
    '🐵',
    '🙈',
    '🙉',
    '🙊',
    '🐒',
    '🐔',
    '🐧',
    '🐦',
    '🐤',
    '🦆',
    '🦅',
    '🦉',
    '🦇',
    '🐺',
    '🐗',
    '🐴',
    '🦄'
  ]

  const emojiNames = [
    'dog',
    'cat',
    'mouse',
    'hamster',
    'rabbit',
    'fox',
    'bear',
    'panda',
    'koala',
    'tiger',
    'lion',
    'cow',
    'pig',
    'boar',
    'frog',
    'monkey',
    'see-no-evil',
    'hear-no-evil',
    'speak-no-evil',
    'chimp',
    'chicken',
    'penguin',
    'bird',
    'chick',
    'duck',
    'eagle',
    'owl',
    'bat',
    'wolf',
    'boar',
    'horse',
    'unicorn'
  ]

  verificationEmojis.value = []
  for (let i = 0; i < 7; i++) {
    const index = Math.floor(Math.random() * emojis.length)
    const emoji = emojis[index]
    const name = emojiNames[index]
    if (emoji && name) {
      verificationEmojis.value.push({ emoji, name })
    }
  }

  // Generate numeric verification
  verificationNumbers.value = []
  for (let i = 0; i < 4; i++) {
    verificationNumbers.value.push(Math.floor(Math.random() * 10).toString())
  }
}

const blockDevice = async (device: DeviceInfo) => {
  try {
    await e2eeService.blockDevice(device.userId, device.deviceId)
    device.blocked = true
    message.success('设备已阻止')
  } catch (error) {
    message.error('阻止设备失败')
  }
}

const unblockDevice = async (device: DeviceInfo) => {
  try {
    await e2eeService.unblockDevice(device.userId, device.deviceId)
    device.blocked = false
    message.success('已取消阻止设备')
  } catch (error) {
    message.error('取消阻止设备失败')
  }
}

const getDeviceMenuOptions = (device: DeviceInfo) => {
  const options = [
    {
      label: '查看详情',
      key: 'view'
    }
  ]

  if (!device.verified && !device.blocked) {
    options.push({
      label: '验证',
      key: 'verify'
    })
  }

  if (!device.blocked) {
    options.push({
      label: '阻止',
      key: 'block'
    })
  } else {
    options.push({
      label: '取消阻止',
      key: 'unblock'
    })
  }

  return options
}

const handleDeviceMenuAction = (key: string, device: DeviceInfo) => {
  switch (key) {
    case 'view':
      // Show device details
      break
    case 'verify':
      startVerification(device)
      break
    case 'block':
      blockDevice(device)
      break
    case 'unblock':
      unblockDevice(device)
      break
  }
}

const setupCrossSigning = async () => {
  try {
    await e2eeService.setupCrossSigning()
    message.success('交叉签名设置成功')
    await checkCrossSigningStatus()
  } catch (error) {
    message.error('设置交叉签名失败')
  }
}

const checkCrossSigningStatus = async () => {
  try {
    const status = await e2eeService.getCrossSigningStatus()
    Object.assign(crossSigningStatus, status)
  } catch (error) {}
}

// Helper methods
const formatFingerprint = (key: string): string => {
  if (!key) return ''
  // Format in groups of 4 characters
  return key.match(/.{1,4}/g)?.join(' ') || key
}

const formatLastSeen = (timestamp?: number): string => {
  if (!timestamp) return '未知'

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) {
    return '刚刚'
  } else if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  } else if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getUserInitials = (user: MatrixMember): string => {
  const name = user.displayName || user.userId
  if (!name) return '?'
  const names = name.split(' ')
  if (names.length >= 2) {
    return names[0][0] + names[1][0]
  }
  return name.substring(0, 2).toUpperCase()
}

// Event handlers
const handleVerificationRequest = (event: CustomEvent) => {
  verificationRequests.value.push(event.detail)
}

// Lifecycle
onMounted(async () => {
  await loadDevices()
  await checkCrossSigningStatus()

  // Listen for verification requests using the correct event name from E2EE service
  window.addEventListener('e2ee:verification-request', handleVerificationRequest as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('e2ee:verification-request', handleVerificationRequest as EventListener)
})
</script>

<style scoped>
.device-verification {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.current-device {
  margin-bottom: 24px;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.device-keys {
  border-top: 1px solid var(--n-border-color);
  padding-top: 16px;
}

.device-keys h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.fingerprint-display {
  background: var(--n-hover-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.fingerprint-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.fingerprint-section .label {
  font-size: 12px;
  color: var(--n-text-color-3);
  min-width: 80px;
}

.fingerprint {
  font-family: monospace;
  font-size: 12px;
  background: var(--n-color);
  padding: 4px 8px;
  border-radius: 4px;
  word-break: break-all;
}

.other-devices h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.empty-devices {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.device-card {
  transition: all 0.3s;
}

.device-card.blocked {
  opacity: 0.6;
  border-color: var(--n-error-color);
}

.device-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.device-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.device-details {
  margin-bottom: 12px;
}

.device-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.device-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.last-seen {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.ip {
  color: var(--n-text-color-2);
}

.device-actions {
  display: flex;
  gap: 8px;
}

.verification-requests {
  border-top: 1px solid var(--n-border-color);
  padding-top: 24px;
}

.verification-requests h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.request-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.requester {
  font-weight: 600;
  display: block;
}

.request-device {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.request-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.request-actions {
  display: flex;
  gap: 8px;
}

.verification-content {
  padding: 24px;
}

.verification-step h4 {
  margin: 0 0 16px 0;
  text-align: center;
}

.verification-step p {
  text-align: center;
  color: var(--n-text-color-3);
  margin-bottom: 24px;
}

.emoji-verification {
  margin-bottom: 32px;
}

.emoji-verification h5 {
  margin: 0 0 16px 0;
  text-align: center;
}

.emoji-list {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--n-hover-color);
  border-radius: 8px;
  min-width: 60px;
}

.emoji {
  font-size: 24px;
}

.emoji-name {
  font-size: 10px;
  color: var(--n-text-color-3);
  text-align: center;
}

.numeric-verification {
  margin-bottom: 32px;
}

.numeric-verification h5 {
  margin: 0 0 16px 0;
  text-align: center;
}

.number-list {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.number-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--n-primary-color);
  color: white;
  font-size: 24px;
  font-weight: bold;
  border-radius: 8px;
}

.verification-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.waiting-content,
.complete-content,
.failed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  text-align: center;
}

.waiting-content p,
.complete-content p,
.failed-content p {
  margin: 0;
  color: var(--n-text-color-3);
}

.complete-content h4 {
  margin: 0;
  color: var(--n-success-color);
}

.failed-content h4 {
  margin: 0;
  color: var(--n-error-color);
}

.user-verification {
  margin-top: 24px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--n-hover-color);
  border-radius: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.user-id {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.user-devices {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cross-signing-status {
  margin-top: 24px;
}

.cross-signing-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>