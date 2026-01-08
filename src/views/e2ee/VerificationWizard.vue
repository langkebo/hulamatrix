<template>
  <n-space vertical :size="16" class="p-16px">
    <n-card>
      <n-space align="center" :size="12">
        <span>设备验证向导</span>
        <n-tag v-if="initialized" type="success">加密已初始化</n-tag>
        <n-tag v-else type="warning">加密未初始化</n-tag>
      </n-space>
      <n-space :size="8" class="mt-8px">
        <n-button type="primary" :loading="loading" @click="init">初始化加密</n-button>
        <n-button tertiary :loading="loading" @click="loadDevices">刷新设备</n-button>
      </n-space>
    </n-card>
    <n-card>
      <n-data-table :columns="columns" :data="devices" :bordered="false" />
    </n-card>
    <n-card v-if="backupStatus">
      <n-space :size="8" align="center">
        <n-tag type="info">备份版本：{{ backupStatus?.version || '-' }}</n-tag>
        <n-tag :type="backupStatus?.trusted ? 'success' : 'warning'">{{ backupStatus?.trusted ? '备份可信' : '备份未可信' }}</n-tag>
        <n-tag :type="backupStatus?.secretReady ? 'success' : 'warning'">{{ backupStatus?.secretReady ? '4S已就绪' : '4S未就绪' }}</n-tag>
        <n-button type="primary" @click="autoRepair">自动修复</n-button>
      </n-space>
    </n-card>
    <n-card v-if="sas.decimals.length || sas.emojis.length">
      <n-space vertical :size="8">
        <div>请与另一设备核对以下代码或表情</div>
        <n-space>
          <n-tag v-for="d in sas.decimals" :key="d" type="info">{{ d }}</n-tag>
        </n-space>
        <n-space>
          <n-tag v-for="e in sas.emojis" :key="e.name" type="success">{{ e.emoji }} {{ e.name }}</n-tag>
        </n-space>
        <n-space>
          <n-button type="primary" @click="confirmSas">确认一致</n-button>
          <n-button tertiary @click="cancelSas">取消</n-button>
        </n-space>
      </n-space>
    </n-card>
    <n-card v-if="qrData">
      <n-space vertical :size="8">
        <div>请用另一设备扫描二维码完成验证</div>
        <img :src="qrData" alt="QR" class="qr-image" />
        <n-space>
          <n-button type="primary" @click="confirmQr">确认完成</n-button>
          <n-button tertiary @click="cancelQr">取消</n-button>
        </n-space>
      </n-space>
    </n-card>
    <n-alert v-if="status" type="info" :show-icon="true">{{ status }}</n-alert>
  </n-space>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import {
  initializeEncryption,
  listDevices,
  startSasVerification,
  startQrVerification,
  renameDevice
} from '@/integrations/matrix/encryption'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
const msg = useMessage()
const loading = ref(false)
const initialized = ref(false)
const devices = ref<Array<{ device_id: string; display_name?: string; last_seen_ts?: number }>>([])
const status = ref('')
const sas = ref<{
  decimals: number[]
  emojis: Array<{ emoji: string; name: string }>
  confirm?: (() => Promise<void>) | undefined
  cancel?: (() => Promise<void>) | undefined
}>({ decimals: [], emojis: [] })
const qrData = ref<string>('')
const qrConfirm = ref<(() => Promise<void>) | undefined>()
const qrCancel = ref<(() => Promise<void>) | undefined>()
interface DeviceRow {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  [key: string]: unknown
}

const columns = [
  { title: '设备ID', key: 'device_id' },
  { title: '名称', key: 'display_name' },
  { title: '最近使用', key: 'last_seen_ts' },
  { title: '信任', key: 'trust', render: (row: DeviceRow) => h('span', {}, trustMap.get(row.device_id) || '-') },
  {
    title: '操作',
    key: 'action',
    render: (row: DeviceRow) => {
      return h('div', {}, [
        h('a', { style: 'margin-right:8px', onClick: () => doSas(row.device_id) }, 'SAS验证'),
        h('a', { style: 'margin-right:8px', onClick: () => doQr(row.device_id) }, '二维码验证'),
        h('a', { style: 'margin-right:8px', onClick: () => checkTrust(row.device_id) }, '查看交叉签名'),
        h('a', { style: 'margin-right:8px', onClick: () => doMarkTrusted(row.device_id) }, '仅信任此设备'),
        h('a', { onClick: () => doRename(row.device_id) }, '重命名')
      ])
    }
  }
]
import { h } from 'vue'
const trustMap = new Map<string, string>()
const backupStatus = ref<{ version?: string; trusted?: boolean; secretReady?: boolean } | null>(null)
const init = async () => {
  loading.value = true
  try {
    initialized.value = await initializeEncryption()
    status.value = initialized.value ? '加密初始化成功' : '加密初始化失败'
  } finally {
    loading.value = false
  }
}
const loadDevices = async () => {
  loading.value = true
  try {
    devices.value = await listDevices()
  } finally {
    loading.value = false
  }
}
const doSas = async (deviceId: string) => {
  try {
    const userId = useMatrixAuthStore().userId
    const r = await startSasVerification(userId, deviceId)
    if (!r.ok && r.reason) {
      msg.error(r.reason)
      return
    }
    sas.value = { decimals: r.decimals || [], emojis: r.emojis || [], confirm: r.confirm, cancel: r.cancel }
  } catch {
    msg.error('SAS 验证启动失败')
  }
}
const confirmSas = async () => {
  try {
    await sas.value.confirm?.()
    sas.value = { decimals: [], emojis: [] }
    msg.success('SAS 验证完成')
  } catch {
    msg.error('确认失败')
  }
}
const cancelSas = async () => {
  try {
    await sas.value.cancel?.()
  } finally {
    sas.value = { decimals: [], emojis: [] }
  }
}
const doQr = async (deviceId: string) => {
  try {
    const userId = useMatrixAuthStore().userId
    const r = await startQrVerification(userId, deviceId)
    if (!r.ok && r.reason) {
      msg.error(r.reason)
      return
    }
    qrData.value = r.dataUri || ''
    qrConfirm.value = r.confirm
    qrCancel.value = r.cancel
  } catch {
    msg.error('二维码验证启动失败')
  }
}
const confirmQr = async () => {
  try {
    await qrConfirm.value?.()
    qrData.value = ''
    msg.success('二维码验证完成')
  } catch {
    msg.error('确认失败')
  }
}
const cancelQr = async () => {
  try {
    await qrCancel.value?.()
  } finally {
    qrData.value = ''
  }
}
const doRename = async (deviceId: string) => {
  const name = window.prompt('输入新的设备名称') || ''
  if (!name) return
  const ok = await renameDevice(deviceId, name)
  msg[ok ? 'success' : 'error'](ok ? '重命名成功' : '重命名失败')
  if (ok) await loadDevices()
}
const doMarkTrusted = async (deviceId: string) => {
  if (!window.confirm('确认要将此设备标记为信任吗？如果设备不属于你，这可能会有安全风险。')) return
  try {
    const { markDeviceTrusted } = await import('@/integrations/matrix/encryption')
    const userId = useMatrixAuthStore().userId
    const ok = await markDeviceTrusted(userId, deviceId)
    msg[ok ? 'success' : 'error'](ok ? '标记信任成功' : '标记失败')
    if (ok) await checkTrust(deviceId)
  } catch {
    msg.error('操作失败')
  }
}
const checkTrust = async (deviceId: string) => {
  try {
    const { getCrossSigningStatus, getKeyBackupStatusDetailed } = await import('@/integrations/matrix/encryption')
    const userId = useMatrixAuthStore().userId
    const r = await getCrossSigningStatus(userId, deviceId)
    if (!r.ok) {
      msg.error(r.reason || '查询失败')
      return
    }
    const parts = [
      r.userTrusted ? '用户已信任' : '用户未信任',
      r.deviceVerified ? '设备已验证' : '设备未验证',
      r.crossSigned ? '交叉签名通过' : '交叉签名未通过'
    ]
    if (r.reason) parts.push(`(${r.reason})`)
    const text = parts.join(' / ')
    trustMap.set(deviceId, text)
    const bs = await getKeyBackupStatusDetailed()
    const status: { version?: string; trusted?: boolean; secretReady?: boolean } = {}
    if (bs.trusted !== undefined) status.trusted = bs.trusted
    if (bs.secretReady !== undefined) status.secretReady = bs.secretReady
    if (bs.version !== undefined) status.version = bs.version
    backupStatus.value = status
    msg.success('已更新交叉签名状态')
  } catch {
    msg.error('查询失败')
  }
}

const autoRepair = async () => {
  try {
    const passphrase = window.prompt('输入用于创建4S的口令（可留空）') || ''
    const { repairSecretStorage } = await import('@/integrations/matrix/encryption')
    const ok = await repairSecretStorage(passphrase)
    msg[ok ? 'success' : 'error'](ok ? '自动修复完成' : '自动修复失败')
  } catch {
    msg.error('自动修复失败')
  }
}
</script>

<style scoped>
.qr-image {
  max-width: 220px;
  border-radius: 8px;
}
</style>
