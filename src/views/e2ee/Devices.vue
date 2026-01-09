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
      <div v-if="unverified.length === 0" class="text-(12px var(--hula-brand-primary))">暂无未验证设备</div>
      <n-data-table v-else :columns="unverifiedCols" :data="unverified" />
      <n-alert v-if="lastVerifyError" type="error" class="mt-8px" :show-icon="true">{{ lastVerifyError }}</n-alert>
    </n-card>
    <n-modal v-model:show="showVerifyModal" preset="card" title="设备验证" class="w-640px">
      <n-space vertical :size="12" data-test="verify-modal">
        <div>设备：{{ currentVerify?.display_name || currentVerify?.device_id }}</div>
        <n-progress type="line" :percentage="verifyProgress" :show-indicator="false" />
        <n-alert v-if="verifyFlowInfo" type="info" :show-icon="true">{{ verifyFlowInfo }}</n-alert>
        <n-space>
          <n-button size="small" type="primary" data-test="sas-start" @click="beginSas">SAS 验证</n-button>
          <n-button size="small" data-test="qr-start" @click="beginQr">二维码验证</n-button>
          <n-button size="small" data-test="sas-retry" @click="retrySas" tertiary>重试 SAS</n-button>
          <n-button size="small" data-test="qr-retry" @click="retryQr" tertiary>重试二维码</n-button>
        </n-space>
        <div v-if="sasData">
          <div v-if="sasData.emojis?.length">请核对以下表情：</div>
          <div class="flex flex-wrap gap-8px" v-if="sasData.emojis?.length">
            <span v-for="e in sasData.emojis" :key="e.name">{{ e.emoji }} {{ e.name }}</span>
          </div>
          <div v-if="sasData.decimals?.length">或核对数字：{{ sasData.decimals.join(' ') }}</div>
          <n-space>
            <n-button size="small" type="primary" data-test="sas-confirm" @click="confirmSas">确认匹配</n-button>
            <n-button size="small" type="error" ghost data-test="sas-cancel" @click="cancelSas">取消</n-button>
          </n-space>
        </div>
        <div v-if="qrDataUri">
          <div>请使用另一设备扫描二维码以完成验证：</div>
          <img :src="qrDataUri" alt="QR" class="qr-code" />
          <n-space>
            <n-button size="small" type="primary" data-test="qr-confirm" @click="confirmQr">完成验证</n-button>
            <n-button size="small" type="error" ghost data-test="qr-cancel" @click="cancelQr">取消</n-button>
          </n-space>
        </div>
        <n-alert v-if="verifyFlowError" type="error" :show-icon="true">{{ verifyFlowError }}</n-alert>
        <n-alert type="default" :show-icon="true">
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
import { h, onMounted } from 'vue'
import { ref, computed } from 'vue'
import { NCard, NAlert, NSpace, NButton, NDataTable, NModal, NProgress } from 'naive-ui'
import { startSasVerification, startQrVerification } from '@/integrations/matrix/encryption'
import { useE2EEStore } from '@/stores/e2ee'
import { useRouter } from 'vue-router'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { useE2EEDevices, type DeviceItem } from '@/composables/useE2EEDevices'

import { msg } from '@/utils/SafeUI'

// Type definitions
// Replaced by DeviceItem from composable

interface UnverifiedDevice {
  deviceId: string
  displayName?: string
}

interface SasEmoji {
  emoji: string
  name: string
}

interface SasData {
  emojis?: SasEmoji[]
  decimals?: number[]
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
  ok?: boolean
  reason?: string
}

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

const showGuide = ref(false)
const router = useRouter()
const e2ee = useE2EEStore()
const auth = useMatrixAuthStore()

const securityLevelText = computed(() => {
  const lvl = securityLevel.value
  return lvl === 'high' ? '高' : lvl === 'medium' ? '中' : '低'
})

// Use unverifiedDevices from composable, but we might need to map it if the table expects specific columns
// The original unverified computed mapped to { device_id, display_name }
// Let's check unverifiedCols. It is not shown in the read output, I should assume it uses similar keys.
// Actually, looking at the template: <n-data-table ... :columns="unverifiedCols" :data="unverified" />
// I need to find unverifiedCols definition. It wasn't in the first 200 lines.
// I should read the rest of the file first to be safe.

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
  showVerifyModal.value = true
}

const lastVerifyError = ref('')
const showVerifyModal = ref(false)
const currentVerify = ref<DeviceItem | null>(null)
const sasData = ref<SasData | null>(null)
const qrDataUri = ref<string | null>(null)
const verifyFlowError = ref('')
const verifyFlowInfo = ref('')
const verifyProgress = ref(0)
let progressTimer: NodeJS.Timeout | null = null

const beginSas = async () => {
  verifyFlowError.value = ''
  verifyFlowInfo.value = '正在发起 SAS 验证，请在另一设备确认…'
  sasData.value = null
  qrDataUri.value = null
  verifyProgress.value = 10
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    verifyProgress.value = Math.min(95, verifyProgress.value + 5)
  }, 600)
  const r = await startSasVerification(auth.userId, currentVerify.value?.deviceId || '')
  if (!r.ok && !r.decimals && !r.emojis) {
    verifyFlowError.value = r.reason || '无法开始 SAS 验证'
    verifyFlowInfo.value = ''
    if (progressTimer) clearInterval(progressTimer)
    verifyProgress.value = 0
    return
  }
  verifyFlowInfo.value = '请核对表情或数字是否一致'
  sasData.value = r
}
const confirmSas = async () => {
  try {
    await sasData.value?.confirm?.()
    msg.success('SAS 验证完成')
    e2ee.updateDevice(currentVerify.value!.deviceId, { verified: true })
    verifyFlowInfo.value = '验证已完成'
    verifyProgress.value = 100
    if (progressTimer) clearInterval(progressTimer)
    showVerifyModal.value = false
  } catch (e: unknown) {
    verifyFlowError.value = e instanceof Error ? e.message : 'SAS 验证失败'
    verifyFlowInfo.value = ''
    if (progressTimer) clearInterval(progressTimer)
    verifyProgress.value = 0
  }
}
const cancelSas = async () => {
  await sasData.value?.cancel?.()
  sasData.value = null
  verifyFlowInfo.value = ''
  if (progressTimer) clearInterval(progressTimer)
  verifyProgress.value = 0
}
const beginQr = async () => {
  verifyFlowError.value = ''
  verifyFlowInfo.value = '正在生成二维码，请使用另一设备扫描…'
  sasData.value = null
  qrDataUri.value = null
  verifyProgress.value = 10
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    verifyProgress.value = Math.min(95, verifyProgress.value + 5)
  }, 600)
  const r = await startQrVerification(auth.userId, currentVerify.value?.deviceId || '')
  if (!r.ok && !r.dataUri) {
    verifyFlowError.value = r.reason || '无法开始二维码验证'
    verifyFlowInfo.value = ''
    if (progressTimer) clearInterval(progressTimer)
    verifyProgress.value = 0
    return
  }
  qrDataUri.value = r.dataUri || null
}
const confirmQr = async () => {
  try {
    await (await startQrVerification(auth.userId, currentVerify.value?.deviceId || '')).confirm?.()
    msg.success('二维码验证完成')
    e2ee.updateDevice(currentVerify.value!.deviceId, { verified: true })
    verifyFlowInfo.value = '验证已完成'
    verifyProgress.value = 100
    if (progressTimer) clearInterval(progressTimer)
    showVerifyModal.value = false
  } catch (e: unknown) {
    verifyFlowError.value = e instanceof Error ? e.message : '二维码验证失败'
    verifyFlowInfo.value = ''
    if (progressTimer) clearInterval(progressTimer)
    verifyProgress.value = 0
  }
}
const cancelQr = async () => {
  qrDataUri.value = null
  verifyFlowInfo.value = ''
  if (progressTimer) clearInterval(progressTimer)
  verifyProgress.value = 0
}
const retrySas = () => beginSas()
const retryQr = () => beginQr()

const unverifiedCols = [
  { title: '设备ID', key: 'deviceId' },
  { title: '名称', key: 'displayName' },
  {
    title: '操作',
    key: 'ops',
    render(row: UnverifiedDevice) {
      return h('div', { class: 'flex gap-8px' }, [
        h('button', { class: 'n-button', onClick: () => onVerify(row as unknown as DeviceItem) }, '验证')
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
