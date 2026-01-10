<template>
  <div class="wrap">
    <n-card title="设备管理" size="small">
      <n-alert type="warning" v-if="!e2eeEnabledFlag" :show-icon="true">
        加密功能未启用，设置 `VITE_MATRIX_E2EE_ENABLED=on` 以启用。
      </n-alert>
      <n-alert type="info" v-if="e2eeEnabledFlag" :show-icon="true">
        安全状态：{{ securityLevelText }}，设备验证进度：{{ progress }}%
      </n-alert>
      <n-progress type="line" :percentage="progress" :show-indicator="false" />
      <n-space class="mt-8px">
        <n-button @click="goRecovery">创建或检查密钥存储</n-button>
        <n-button @click="openGuide">设备验证指南</n-button>
      </n-space>
      <n-space class="mt-8px">
        <n-button type="primary" @click="refresh" :loading="loading">刷新设备</n-button>
      </n-space>
      <n-data-table class="mt-12px" :columns="cols" :data="devices" :loading="loading" />
    </n-card>
    <n-card title="未验证设备" size="small" class="mt-12px">
      <div v-if="unverifiedDevices.length === 0" class="text-(12px var(--hula-brand-primary))">暂无未验证设备</div>
      <n-data-table v-else :columns="unverifiedCols" :data="unverifiedDevices" />
      <n-alert v-if="lastVerifyError" type="error" class="mt-8px" :show-icon="true">{{ lastVerifyError }}</n-alert>
    </n-card>
    <n-modal
      v-model:show="showVerifyModal"
      preset="card"
      title="设备验证"
      class="w-640px"
      :on-after-leave="handleModalClose">
      <n-space vertical :size="12" data-test="verify-modal">
        <div>设备：{{ currentVerify?.displayName || currentVerify?.deviceId }}</div>

        <!-- Loading Indicator -->
        <n-spin v-if="verifyLoading" size="small" description="正在处理..." />

        <!-- Method Selection -->
        <n-space v-if="verifyStep === 'method' && !verifyLoading">
          <n-button size="small" type="primary" data-test="sas-start" @click="beginSas">SAS 验证</n-button>
          <n-button size="small" data-test="qr-start" @click="beginQr">二维码验证</n-button>
        </n-space>

        <!-- SAS Verification UI -->
        <div v-if="verifyStep === 'sas' && sasData">
          <div v-if="sasData.emojis?.length">请核对以下表情：</div>
          <div class="flex flex-wrap gap-8px" v-if="sasData.emojis?.length">
            <span v-for="e in sasData.emojis" :key="e.name">{{ e.emoji }} {{ e.name }}</span>
          </div>
          <div v-if="sasData.decimals?.length">或核对数字：{{ sasData.decimals.join(' ') }}</div>
          <n-space class="mt-8px">
            <n-button
              size="small"
              type="primary"
              data-test="sas-confirm"
              :loading="confirming"
              @click="handleConfirmSas">
              确认匹配
            </n-button>
            <n-button
              size="small"
              type="error"
              ghost
              data-test="sas-cancel"
              :disabled="confirming"
              @click="handleCancel">
              取消
            </n-button>
          </n-space>
        </div>

        <!-- QR Verification UI -->
        <div v-if="verifyStep === 'qr' && qrDataUri">
          <div>请使用另一设备扫描二维码以完成验证：</div>
          <img :src="qrDataUri" alt="QR" class="qr-code" />
          <n-space class="mt-8px">
            <n-button size="small" type="primary" data-test="qr-confirm" :loading="confirming" @click="handleConfirmQr">
              已扫描/完成验证
            </n-button>
            <n-button
              size="small"
              type="error"
              ghost
              data-test="qr-cancel"
              :disabled="confirming"
              @click="handleCancel">
              取消
            </n-button>
          </n-space>
        </div>

        <!-- Success Message -->
        <n-alert v-if="verifyStep === 'success'" type="success" :show-icon="true">验证已完成</n-alert>

        <!-- Error Message -->
        <n-alert v-if="verifyError" type="error" :show-icon="true">{{ verifyError }}</n-alert>

        <n-alert type="default" :show-icon="true" v-if="verifyStep !== 'success'">
          若验证失败，请在“恢复密钥”页面确保已完成 4S 初始化，并重试设备验证。
        </n-alert>
      </n-space>
    </n-modal>
    <n-modal v-model:show="showGuide" preset="card" title="设备验证指南" class="w-640px">
      <n-space vertical :size="10">
        <div>1. 确保已登录且启用端到端加密。</div>
        <div>2. 在“恢复密钥”页面创建 4S 并保存备份密钥。</div>
        <div>3. 回到设备管理，逐一验证你的设备，必要时重命名以区分。</div>
        <div>4. 完成后，安全状态应提升为“中/高”。</div>
        <n-space>
          <n-button type="primary" @click="goRecovery">前往恢复密钥</n-button>
          <n-button @click="showGuide = false">关闭</n-button>
        </n-space>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, watch } from 'vue'
import { ref, computed } from 'vue'
import { NCard, NAlert, NSpace, NButton, NDataTable, NModal, NProgress, NSpin } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { useE2EEDevices, type DeviceItem } from '@/composables/useE2EEDevices'
import { useDeviceVerification } from '@/composables/useDeviceVerification'
import { msg } from '@/utils/SafeUI'

const router = useRouter()
const auth = useMatrixAuthStore()

// E2EE Devices Logic
const {
  devices,
  loading,
  progress,
  securityLevel,
  e2eeEnabled: e2eeEnabledFlag,
  unverifiedDevices,
  fetchDevices: refresh,
  handleRenameDevice,
  handleDeleteDevice
} = useE2EEDevices()

// Device Verification Logic
const {
  step: verifyStep,
  loading: verifyLoading,
  confirming,
  error: verifyError,
  sasData,
  qrData,
  reset: resetVerify,
  startSas,
  startQr,
  confirmSas,
  confirmQr,
  cancel: cancelVerify
} = useDeviceVerification()

const showGuide = ref(false)
const showVerifyModal = ref(false)
const currentVerify = ref<DeviceItem | null>(null)
const lastVerifyError = ref('')

const securityLevelText = computed(() => {
  const lvl = securityLevel.value
  return lvl === 'high' ? '高' : lvl === 'medium' ? '中' : '低'
})

const qrDataUri = computed(() => qrData.value?.dataUri || '')

const goRecovery = async () => {
  await router.push('/e2ee/backup')
}
const openGuide = () => {
  showGuide.value = true
}

const cols = [
  { title: '设备ID', key: 'deviceId' },
  { title: '名称', key: 'displayName' },
  {
    title: '最近使用',
    key: 'lastSeenTs',
    render(row: DeviceItem) {
      return row.lastSeenTs ? new Date(row.lastSeenTs).toLocaleString() : '-'
    }
  },
  {
    title: '操作',
    key: 'ops',
    render(row: DeviceItem) {
      return h('div', { class: 'flex gap-8px' }, [
        h('button', { class: 'n-button', onClick: () => handleRenameDevice(row.deviceId, row.displayName) }, '重命名'),
        h('button', { class: 'n-button n-button--error', onClick: () => handleDeleteDevice(row.deviceId) }, '删除')
      ])
    }
  }
]

const onVerify = async (row: DeviceItem) => {
  lastVerifyError.value = ''
  currentVerify.value = row
  resetVerify()
  showVerifyModal.value = true
}

const handleModalClose = () => {
  if (verifyStep.value !== 'success' && verifyStep.value !== 'method') {
    cancelVerify()
  } else {
    resetVerify()
  }
}

const beginSas = async () => {
  if (!currentVerify.value?.deviceId) return
  await startSas(auth.userId, currentVerify.value.deviceId)
}

const beginQr = async () => {
  if (!currentVerify.value?.deviceId) return
  await startQr(auth.userId, currentVerify.value.deviceId)
}

const handleConfirmSas = async () => {
  if (!currentVerify.value?.deviceId) return
  await confirmSas(currentVerify.value.deviceId)
}

const handleConfirmQr = async () => {
  if (!currentVerify.value?.deviceId) return
  await confirmQr(currentVerify.value.deviceId)
}

const handleCancel = async () => {
  await cancelVerify()
}

// Watch for success to show message and close modal after delay
watch(verifyStep, (newStep) => {
  if (newStep === 'success') {
    msg.success('验证成功')
    setTimeout(() => {
      showVerifyModal.value = false
    }, 1500)
  }
})

const unverifiedCols = [
  { title: '设备ID', key: 'deviceId' },
  { title: '名称', key: 'displayName' },
  {
    title: '操作',
    key: 'ops',
    render(row: DeviceItem) {
      return h('div', { class: 'flex gap-8px' }, [
        h('button', { class: 'n-button', onClick: () => onVerify(row) }, '验证')
      ])
    }
  }
]

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.wrap {
  padding: 16px;
}

.qr-code {
  width: 200px;
  height: 200px;
}
</style>
