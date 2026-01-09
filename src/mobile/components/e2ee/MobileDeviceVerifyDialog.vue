<!-- Mobile Device Verification Dialog - E2EE device verification UI for mobile -->
<template>
  <van-popup
    :show="showVerifyDialog"
    :close-on-click-overlay="false"
    position="center"
    :style="{ width: '90%', maxWidth: '400px', borderRadius: '12px' }">
    <div class="verify-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <span class="header-title">{{ title }}</span>
        <van-icon name="cross" :size="18" @click="handleClose" />
      </div>

      <!-- Scrollable Content -->
      <div class="dialog-content">
        <!-- Loading state -->
        <div v-if="loading" class="verify-loading">
          <van-loading size="24px" />
          <p class="mt-12px">{{ loadingText }}</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert-error mb-12px">
          <van-icon name="warning-o" :size="18" />
          <span>{{ error }}</span>
        </div>

        <!-- Device info -->
        <div v-if="currentDevice && !loading" class="device-info-section">
          <div class="device-info">
            <van-image :width="50" :height="50" :src="getDeviceAvatar(currentDevice)" round>
              <template #error>
                <div class="avatar-fallback">
                  <van-icon name="phone-o" :size="24" />
                </div>
              </template>
            </van-image>
            <div class="device-details">
              <div class="device-name">{{ currentDevice.display_name || currentDevice.device_id }}</div>
              <div class="device-id">{{ currentDevice.device_id }}</div>
            </div>
          </div>
        </div>

        <!-- Verification method selection -->
        <div v-if="step === 'method' && !loading" class="method-selection">
          <div class="button-group">
            <van-button size="large" type="primary" block @click="startSasVerification" icon="key">
              SAS 表情符号验证
            </van-button>
            <van-button size="large" type="default" block @click="startQrVerification" icon="qr" class="mt-12px">
              二维码验证
            </van-button>
          </div>
        </div>

        <!-- SAS verification -->
        <div v-if="step === 'sas' && sasData" class="sas-verification">
          <div class="alert-info mb-12px">
            <van-icon name="info-o" :size="18" />
            <span>请确认对方设备显示的表情符号和数字与下面一致</span>
          </div>

          <!-- Emoji display -->
          <div v-if="sasData.emojis && sasData.emojis.length > 0" class="emoji-grid">
            <div v-for="(emoji, index) in sasData.emojis" :key="index" class="emoji-item">
              <span class="emoji-char">{{ emoji.emoji }}</span>
              <span class="emoji-name">{{ emoji.name }}</span>
            </div>
          </div>

          <!-- Decimal display -->
          <div v-else-if="sasData.decimals && sasData.decimals.length > 0" class="decimal-display">
            <div class="decimal-label">或者核对数字：</div>
            <div class="decimal-numbers">
              <span v-for="(num, index) in sasData.decimals" :key="index" class="decimal-digit">
                {{ num.toString().padStart(4, '0') }}
              </span>
            </div>
          </div>
        </div>

        <!-- QR verification -->
        <div v-if="step === 'qr' && qrDataUri" class="qr-verification">
          <div class="alert-info mb-12px">
            <van-icon name="info-o" :size="18" />
            <span>请使用另一设备扫描二维码以完成验证</span>
          </div>
          <div class="qr-code-container">
            <img :src="qrDataUri" alt="QR Code" class="qr-code-image" />
          </div>
        </div>

        <!-- Success state -->
        <div v-if="step === 'success'" class="success-state">
          <van-icon name="success" :size="60" color="#18a058" class="success-icon" />
          <p class="success-text">设备验证成功！</p>
        </div>
      </div>

      <!-- Actions Footer -->
      <div class="dialog-footer">
        <template v-if="step === 'method'">
          <van-button block @click="handleClose">取消</van-button>
        </template>

        <template v-if="step === 'sas'">
          <div class="button-group">
            <van-button type="primary" block :loading="confirming" @click="confirmSas">确认匹配</van-button>
            <van-button type="danger" block :disabled="confirming" @click="cancelVerification" class="mt-8px">
              不匹配
            </van-button>
          </div>
        </template>

        <template v-if="step === 'qr'">
          <div class="button-group">
            <van-button type="primary" block :loading="confirming" @click="confirmQr">已扫描</van-button>
            <van-button type="danger" block :disabled="confirming" @click="cancelVerification" class="mt-8px">
              取消
            </van-button>
          </div>
        </template>

        <van-button v-if="step === 'success'" type="primary" block @click="handleClose">完成</van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { msg } from '@/utils/SafeUI'
import {
  startSasVerification as apiStartSas,
  startQrVerification as apiStartQr
} from '@/integrations/matrix/encryption'
import { useE2EEStore } from '@/stores/e2ee'

// Icon name mapping for Vant
const getVantIconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    DeviceMobile: 'phone-o',
    Key: 'key',
    Qrcode: 'qr',
    CircleCheck: 'success'
  }
  return iconMap[iconName] || 'circle'
}

// Props
interface Props {
  show: boolean
  device?: {
    device_id: string
    display_name?: string
  } | null
  userId?: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  device: null,
  userId: ''
})

// Emits
interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'verified', deviceId: string): void
}

const emit = defineEmits<Emits>()

// Store
const e2eeStore = useE2EEStore()

// State
const step = ref<'method' | 'sas' | 'qr' | 'success'>('method')
const loading = ref(false)
const loadingText = ref('')
const error = ref('')
const confirming = ref(false)

// SAS data
interface SasData {
  decimals?: number[]
  emojis?: Array<{ emoji: string; name: string }>
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}

const sasData = ref<SasData | null>(null)

// QR data
interface QrData {
  dataUri?: string
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}

const qrData = ref<QrData | null>(null)

// Computed
const showVerifyDialog = computed(() => props.show)
const currentDevice = computed(() => props.device)
const qrDataUri = computed(() => qrData.value?.dataUri || '')

const title = computed(() => {
  switch (step.value) {
    case 'method':
      return '选择验证方式'
    case 'sas':
      return 'SAS 验证'
    case 'qr':
      return '二维码验证'
    case 'success':
      return '验证成功'
    default:
      return '设备验证'
  }
})

// Methods
const handleClose = () => {
  if (confirming.value) return
  reset()
  emit('update:show', false)
}

const reset = () => {
  step.value = 'method'
  loading.value = false
  loadingText.value = ''
  error.value = ''
  confirming.value = false
  sasData.value = null
  qrData.value = null
}

const startSasVerification = async () => {
  if (!props.device?.device_id || !props.userId) {
    error.value = '缺少必要信息'
    return
  }

  loading.value = true
  loadingText.value = '正在启动 SAS 验证...'
  error.value = ''

  try {
    const result = await apiStartSas(props.userId, props.device.device_id)

    if (!result.ok) {
      error.value = result.reason || 'SAS 验证启动失败'
      loading.value = false
      return
    }

    sasData.value = {
      decimals: result.decimals,
      emojis: result.emojis,
      confirm: result.confirm,
      cancel: result.cancel
    }

    step.value = 'sas'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'SAS 验证启动失败'
  } finally {
    loading.value = false
  }
}

const startQrVerification = async () => {
  if (!props.device?.device_id || !props.userId) {
    error.value = '缺少必要信息'
    return
  }

  loading.value = true
  loadingText.value = '正在生成二维码...'
  error.value = ''

  try {
    const result = await apiStartQr(props.userId, props.device.device_id)

    if (!result.ok) {
      error.value = result.reason || '二维码生成失败'
      loading.value = false
      return
    }

    qrData.value = {
      dataUri: result.dataUri,
      confirm: result.confirm,
      cancel: result.cancel
    }

    step.value = 'qr'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '二维码生成失败'
  } finally {
    loading.value = false
  }
}

const confirmSas = async () => {
  if (!sasData.value?.confirm) return

  confirming.value = true
  try {
    await sasData.value.confirm()
    msg.success('设备验证成功')
    e2eeStore.updateDevice(props.device!.device_id, { verified: true })
    step.value = 'success'
    emit('verified', props.device!.device_id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '验证失败'
  } finally {
    confirming.value = false
  }
}

const confirmQr = async () => {
  if (!qrData.value?.confirm) return

  confirming.value = true
  try {
    await qrData.value.confirm()
    msg.success('设备验证成功')
    e2eeStore.updateDevice(props.device!.device_id, { verified: true })
    step.value = 'success'
    emit('verified', props.device!.device_id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '验证失败'
  } finally {
    confirming.value = false
  }
}

const cancelVerification = async () => {
  confirming.value = true
  try {
    await sasData.value?.cancel?.()
    await qrData.value?.cancel?.()
  } catch {
    // Ignore cancel errors
  }
  reset()
  emit('update:show', false)
  confirming.value = false
}

const getDeviceAvatar = (_device: { device_id: string; display_name?: string }): string => {
  // Could return device avatar URL if available
  return ''
}
</script>

<style scoped lang="scss">
.verify-dialog {
  display: flex;
  flex-direction: column;
  background: white;
  max-height: 80vh;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--hula-gray-900);
  }
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
}

.dialog-footer {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.alert-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--hula-white)2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #ff4d4f;
  font-size: 13px;
  margin: 0 16px;
}

.alert-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  color: #0958d9;
  font-size: 13px;
  margin: 0 16px 16px;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--primary-color, #18a058);
  color: white;
  border-radius: 50%;
}

.button-group {
  display: flex;
  flex-direction: column;
}

.mt-8px {
  margin-top: 8px;
}

.mt-12px {
  margin-top: 12px;
}

.mb-12px {
  margin-bottom: 12px;
}

.verify-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
}

.device-info-section {
  margin-bottom: 16px;
  padding: 0 16px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
}

.device-details {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-color-1);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-id {
  font-size: 12px;
  color: var(--text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-selection {
  padding: 16px;
}

.sas-verification {
  padding: 0 16px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--card-color);
  border-radius: 8px;
}

.emoji-char {
  font-size: 28px;
  line-height: 1;
}

.emoji-name {
  font-size: 11px;
  color: var(--text-color-3);
  text-align: center;
}

.decimal-display {
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
  text-align: center;
}

.decimal-label {
  font-size: 13px;
  color: var(--text-color-2);
  margin-bottom: 12px;
}

.decimal-numbers {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.decimal-digit {
  font-size: 18px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  padding: 8px 12px;
  background: var(--card-color);
  border-radius: 6px;
  color: var(--text-color-1);
}

.qr-verification {
  text-align: center;
  padding: 0 16px;

  .qr-code-container {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 8px;
  }

  .qr-code-image {
    width: 200px;
    height: 200px;
    border-radius: 8px;
  }
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;

  .success-icon {
    margin-bottom: 12px;
  }

  .success-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1);
    margin: 0;
  }
}
</style>
