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
          <p class="mt-12px">正在处理...</p>
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
            <van-button size="large" type="primary" block @click="handleStartSas" icon="key">
              SAS 表情符号验证
            </van-button>
            <van-button size="large" type="default" block @click="handleStartQr" icon="qr" class="mt-12px">
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
          <van-icon name="success" :size="60" color="var(--hula-success)" class="success-icon" />
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
            <van-button type="primary" block :loading="confirming" @click="handleConfirmSas">确认匹配</van-button>
            <van-button type="danger" block :disabled="confirming" @click="cancel" class="mt-8px">
              不匹配
            </van-button>
          </div>
        </template>

        <template v-if="step === 'qr'">
          <div class="button-group">
            <van-button type="primary" block :loading="confirming" @click="handleConfirmQr">已扫描</van-button>
            <van-button type="danger" block :disabled="confirming" @click="cancel" class="mt-8px">
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
import { computed, watch } from 'vue'
import { msg } from '@/utils/SafeUI'
import { useDeviceVerification } from '@/composables/useDeviceVerification'

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

// Composable
const {
  step,
  loading,
  confirming,
  error,
  sasData,
  qrData,
  reset,
  startSas,
  startQr,
  confirmSas,
  confirmQr,
  cancel
} = useDeviceVerification()

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

// Watch for step changes to emit events or handle side effects if needed
watch(step, (newStep) => {
  if (newStep === 'success' && props.device) {
    msg.success('设备验证成功')
    emit('verified', props.device.device_id)
  }
})

// Watch for dialog close to reset state
watch(() => props.show, (newVal) => {
  if (!newVal) {
    // When dialog closes, ensure we reset if we are not in success state?
    // Or just reset on open?
    // Ideally we reset when closing.
    if (step.value !== 'success') {
       // If we are in the middle of verification, we should probably cancel?
       // But handleClose calls cancel/reset.
    }
  } else {
    reset()
  }
})

// Methods
const handleClose = () => {
  if (confirming.value) return
  if (step.value !== 'success' && step.value !== 'method') {
    cancel()
  } else {
    reset()
  }
  emit('update:show', false)
}

const handleStartSas = async () => {
  if (!props.device?.device_id || !props.userId) {
    error.value = '缺少必要信息'
    return
  }
  await startSas(props.userId, props.device.device_id)
}

const handleStartQr = async () => {
  if (!props.device?.device_id || !props.userId) {
    error.value = '缺少必要信息'
    return
  }
  await startQr(props.userId, props.device.device_id)
}

const handleConfirmSas = async () => {
  if (!props.device?.device_id) return
  await confirmSas(props.device.device_id)
}

const handleConfirmQr = async () => {
  if (!props.device?.device_id) return
  await confirmQr(props.device.device_id)
}

const getDeviceAvatar = (_device: { device_id: string; display_name?: string }): string => {
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
  border-bottom: 1px solid var(--hula-gray-100);
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
  border-top: 1px solid var(--hula-gray-100);
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
  color: var(--hula-error);
  font-size: 13px;
  margin: 0 16px;
}

.alert-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #e6f7ff;
  border: 1px solid var(--hula-info);
  border-radius: 8px;
  color: var(--hula-info);
  font-size: 13px;
  margin: 0 16px 16px;
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
