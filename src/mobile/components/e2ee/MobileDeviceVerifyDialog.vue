<!-- Mobile Device Verification Dialog - E2EE device verification UI for mobile -->
<template>
  <n-modal
    :show="showVerifyDialog"
    :mask-closable="false"
    preset="card"
    :style="{ width: '90%', maxWidth: '400px' }"
    :title="title"
    @update:show="handleClose"
  >
    <!-- Loading state -->
    <div v-if="loading" class="verify-loading">
      <n-spin size="medium" />
      <p class="mt-12px">{{ loadingText }}</p>
    </div>

    <!-- Error state -->
    <n-alert v-else-if="error" type="error" :show-icon="true" class="mb-12px">
      {{ error }}
    </n-alert>

    <!-- Device info -->
    <div v-if="currentDevice && !loading" class="device-info-section">
      <div class="device-info">
        <n-avatar :size="50" :src="getDeviceAvatar(currentDevice)">
          <template #fallback>
            <n-icon :size="24"><DeviceMobile /></n-icon>
          </template>
        </n-avatar>
        <div class="device-details">
          <div class="device-name">{{ currentDevice.display_name || currentDevice.device_id }}</div>
          <div class="device-id">{{ currentDevice.device_id }}</div>
        </div>
      </div>
    </div>

    <!-- Verification method selection -->
    <div v-if="step === 'method' && !loading" class="method-selection">
      <n-space vertical :size="12">
        <n-button
          size="large"
          type="primary"
          block
          @click="startSasVerification"
        >
          <template #icon>
            <n-icon><Key /></n-icon>
          </template>
          SAS 表情符号验证
        </n-button>
        <n-button
          size="large"
          type="info"
          block
          @click="startQrVerification"
        >
          <template #icon>
            <n-icon><Qrcode /></n-icon>
          </template>
          二维码验证
        </n-button>
      </n-space>
    </div>

    <!-- SAS verification -->
    <div v-if="step === 'sas' && sasData" class="sas-verification">
      <n-alert type="info" :show-icon="true" class="mb-12px">
        请确认对方设备显示的表情符号和数字与下面一致
      </n-alert>

      <!-- Emoji display -->
      <div v-if="sasData.emojis && sasData.emojis.length > 0" class="emoji-grid">
        <div
          v-for="(emoji, index) in sasData.emojis"
          :key="index"
          class="emoji-item"
        >
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
      <n-alert type="info" :show-icon="true" class="mb-12px">
        请使用另一设备扫描二维码以完成验证
      </n-alert>
      <div class="qr-code-container">
        <img :src="qrDataUri" alt="QR Code" class="qr-code-image" />
      </div>
    </div>

    <!-- Success state -->
    <div v-if="step === 'success'" class="success-state">
      <n-icon size="60" color="#18a058" class="success-icon">
        <CircleCheck />
      </n-icon>
      <p class="success-text">设备验证成功！</p>
    </div>

    <!-- Actions -->
    <template #footer>
      <n-space v-if="step === 'method'" vertical :size="8">
        <n-button block @click="handleClose">
          取消
        </n-button>
      </n-space>

      <n-space v-if="step === 'sas'" vertical :size="8">
        <n-button
          type="primary"
          block
          :loading="confirming"
          @click="confirmSas"
        >
          确认匹配
        </n-button>
        <n-button
          type="error"
          block
          :disabled="confirming"
          @click="cancelVerification"
        >
          不匹配
        </n-button>
      </n-space>

      <n-space v-if="step === 'qr'" vertical :size="8">
        <n-button
          type="primary"
          block
          :loading="confirming"
          @click="confirmQr"
        >
          已扫描
        </n-button>
        <n-button
          type="error"
          block
          :disabled="confirming"
          @click="cancelVerification"
        >
          取消
        </n-button>
      </n-space>

      <n-button v-if="step === 'success'" type="primary" block @click="handleClose">
        完成
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { NModal, NButton, NSpace, NAlert, NSpin, NIcon, NAvatar } from 'naive-ui'
import { DeviceMobile, Key, Qrcode, CircleCheck } from '@vicons/tabler'
import {
  startSasVerification as apiStartSas,
  startQrVerification as apiStartQr
} from '@/integrations/matrix/encryption'
import { useE2EEStore } from '@/stores/e2ee'
import { msg } from '@/utils/SafeUI'

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
.verify-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
}

.device-info-section {
  margin-bottom: 16px;
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
  padding: 8px 0;
}

.sas-verification {
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
}

.qr-verification {
  text-align: center;

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
