<template>
  <div class="p-16px max-w-720px mx-auto">
    <h2>密钥备份与恢复</h2>
    <n-space vertical :size="12">
      <n-alert type="info" :show-icon="true">用于管理端到端加密的备份与恢复。请妥善保管恢复密钥。</n-alert>

      <n-card title="恢复密钥">
        <n-input v-model:value="passphrase" placeholder="输入口令（可选）" />
        <n-space>
          <n-button @click="generateRecoveryKey">生成恢复密钥</n-button>
          <n-button @click="saveBackupKey">保存备份私钥到会话</n-button>
          <n-button @click="loadBackupKeyFrom4S">从4S加载备份私钥</n-button>
          <n-button type="primary" @click="setupSecretStorage">创建4S并保存备份密钥</n-button>
        </n-space>
        <n-input type="textarea" :rows="3" v-model:value="recoveryKey" placeholder="恢复密钥（可粘贴）" />
        <div v-if="backupVersion">当前备份版本：{{ backupVersion }}</div>
        <div class="status-log" v-if="statusLog.length">
          <div>状态日志：</div>
          <ul>
            <li v-for="s in statusLog" :key="s">{{ s }}</li>
          </ul>
        </div>
        <n-space :size="12" align="center">
          <n-tag type="info">允许密钥存储：{{ allowSecretStorage ? '是' : '否' }}</n-tag>
          <n-button @click="goDevices">设备验证</n-button>
        </n-space>
        <n-divider />
        <n-space :size="12" align="center">
          <n-tag type="success">备份成功次数：{{ stats.backupSuccess }}</n-tag>
          <n-tag type="warning">备份失败次数：{{ stats.backupFail }}</n-tag>
          <n-tag type="info">恢复成功次数：{{ stats.restoreSuccess }}</n-tag>
          <n-tag type="error">恢复失败次数：{{ stats.restoreFail }}</n-tag>
          <n-tag type="default">平均耗时(ms)：{{ avgDuration }}</n-tag>
        </n-space>
        <n-divider />
        <div v-if="stats.backupSuccess + stats.backupFail > 0 || stats.restoreSuccess + stats.restoreFail > 0">
          <div class="chart-row">
            <span>备份成功率</span>
            <n-progress
              type="line"
              :percentage="backupRate"
              :color="
                backupRate > 80
                  ? 'var(--hula-success, var(--hula-brand-primary))'
                  : 'var(--hula-warning, var(--hula-brand-primary))'
              "
              :rail-color="'var(--hula-brand-primary)'"
              indicator-placement="inside" />
          </div>
          <div class="chart-row mt-4px">
            <span>恢复成功率</span>
            <n-progress
              type="line"
              :percentage="recoveryRate"
              :color="
                recoveryRate > 80
                  ? 'var(--hula-success, var(--hula-brand-primary))'
                  : 'var(--hula-warning, var(--hula-brand-primary))'
              "
              :rail-color="'var(--hula-brand-primary)'"
              indicator-placement="inside" />
          </div>
        </div>
      </n-card>

      <n-card title="导出/导入房间密钥">
        <n-space>
          <n-button @click="exportKeys">导出房间密钥(JSON)</n-button>
          <n-button @click="importKeys">导入房间密钥(JSON)</n-button>
        </n-space>
        <n-input type="textarea" :rows="8" v-model:value="keysJson" placeholder="房间密钥JSON" />
      </n-card>
      <n-card title="4S 默认密钥设置">
        <n-space>
          <n-input v-model:value="defaultKeyId" placeholder="输入现有 keyId 设为默认" />
          <n-button @click="setDefaultKey">设为默认密钥</n-button>
          <n-button @click="refreshDefaultKey">查看当前默认密钥</n-button>
          <n-button @click="refreshKeyIds">刷新可用 keyId 列表</n-button>
        </n-space>
        <div class="mt-8px" v-if="keyIds.length > 0">
          <n-select v-model:value="defaultKeyId" :options="keyIds.map((k) => ({ label: k, value: k }))" />
        </div>
        <div v-if="currentDefaultKeyId">当前默认：{{ currentDefaultKeyId }}</div>
      </n-card>
    </n-space>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import { msg } from '@/utils/SafeUI'
import { useRouter } from 'vue-router'
import { useSettingStore } from '@/stores/setting'

// Types for Matrix E2EE crypto API
interface SecretStorageLike {
  getDefaultKeyId?(): Promise<string>
  setDefaultKeyId?(keyId: string): Promise<void>
}

interface CryptoLike {
  createRecoveryKeyFromPassphrase?(passphrase?: string): Promise<{ recovery_key: string }>
  bootstrapSecretStorage?(opts: {
    createSecretStorageKey: () => Promise<{ recovery_key: string }>
    setupNewSecretStorage?: boolean
    setupNewKeyBackup?: boolean
  }): Promise<void>
  storeSessionBackupPrivateKey?(key: string, version?: string): Promise<void>
  loadSessionBackupPrivateKeyFromSecretStorage?(): Promise<{ version?: string }>
  exportRoomKeysAsJson?(): Promise<Record<string, unknown>>
  importRoomKeysAsJson?(data: Record<string, unknown>): Promise<void>
  getKeyBackupInfo?(): Promise<{ version?: string } | null>
  isKeyBackupTrusted?(info: { version?: string } | null): Promise<boolean>
  isSecretStorageReady?(): boolean
  secretStorage?: SecretStorageLike
  on?(event: string, handler: (...args: unknown[]) => void): void
}

interface MatrixClientLike {
  getCrypto?(): CryptoLike | undefined
  setAccountSetting?(key: string, value: unknown, level?: string): Promise<void>
}

const passphrase = ref('')
const recoveryKey = ref('')
const keysJson = ref('')
const backupVersion = ref('')
const backupTrusted = ref<boolean | null>(null)
const statusLog = ref<string[]>([])
const defaultKeyId = ref('')
const currentDefaultKeyId = ref('')
const keyIds = ref<string[]>([])
const allowSecretStorage = ref(false)
const router = useRouter()
const settingStore = useSettingStore()
const stats = ref({ backupSuccess: 0, backupFail: 0, restoreSuccess: 0, restoreFail: 0 })
const durations = ref<number[]>([])
const avgDuration = ref(0)
const backupRate = computed(() => {
  const total = stats.value.backupSuccess + stats.value.backupFail
  return total > 0 ? Math.round((stats.value.backupSuccess / total) * 100) : 0
})
const recoveryRate = computed(() => {
  const total = stats.value.restoreSuccess + stats.value.restoreFail
  return total > 0 ? Math.round((stats.value.restoreSuccess / total) * 100) : 0
})
const measure = async <T,>(fn: () => Promise<T>, kind: 'backup' | 'restore'): Promise<T> => {
  const t0 = performance.now()
  try {
    const res = await fn()
    const dt = Math.round(performance.now() - t0)
    durations.value.push(dt)
    avgDuration.value = Math.round(durations.value.reduce((a, b) => a + b, 0) / durations.value.length)
    if (kind === 'backup') stats.value.backupSuccess++
    else stats.value.restoreSuccess++
    return res
  } catch {
    if (kind === 'backup') stats.value.backupFail++
    else stats.value.restoreFail++
    throw new Error('op_failed')
  }
}

const getCrypto = (): CryptoLike | undefined => {
  const client = matrixClientService.getClient() as MatrixClientLike | undefined
  return client?.getCrypto?.()
}

const generateRecoveryKey = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.createRecoveryKeyFromPassphrase) {
      const { recovery_key } = await crypto.createRecoveryKeyFromPassphrase(passphrase.value || undefined)
      recoveryKey.value = recovery_key
      msg.success('已生成恢复密钥')
    } else {
      msg.error('当前环境不支持生成恢复密钥')
    }
  } catch {
    msg.error('生成恢复密钥失败')
  }
}

const setupSecretStorage = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.bootstrapSecretStorage && crypto?.createRecoveryKeyFromPassphrase) {
      await measure(
        async () =>
          await crypto.bootstrapSecretStorage!({
            createSecretStorageKey: async () =>
              await crypto.createRecoveryKeyFromPassphrase!(passphrase.value || undefined),
            setupNewSecretStorage: true,
            setupNewKeyBackup: false
          }),
        'backup'
      )
      msg.success('4S已创建并保存备份密钥')
      await checkBackupStatus()
      statusLog.value.push('已完成4S初始化并保存备份密钥')
      allowSecretStorage.value = !!crypto?.isSecretStorageReady?.()
      try {
        settingStore.setLevelSetting('account', 'e2ee.allowSecretStorage', allowSecretStorage.value)
        await settingStore.saveToCache()
        const client = matrixClientService.getClient() as MatrixClientLike | undefined
        await client?.setAccountSetting?.('e2ee.allowSecretStorage', allowSecretStorage.value, 'account')
      } catch {}
    } else {
      msg.error('当前环境不支持4S创建')
    }
  } catch (e) {
    msg.error('创建4S失败')
    statusLog.value.push('创建4S失败，请检查设备与密钥配置')
  }
}

const goDevices = async () => {
  await router.push('/e2ee/devices')
}

const saveBackupKey = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.storeSessionBackupPrivateKey) {
      await crypto.storeSessionBackupPrivateKey(recoveryKey.value, backupVersion.value || undefined)
      msg.success('备份私钥已保存')
    } else {
      msg.error('当前环境不支持保存备份私钥')
    }
  } catch {
    msg.error('保存备份私钥失败')
  }
}

const loadBackupKeyFrom4S = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.loadSessionBackupPrivateKeyFromSecretStorage) {
      const v = await measure(async () => await crypto.loadSessionBackupPrivateKeyFromSecretStorage!(), 'restore')
      backupVersion.value = v?.version || ''
      msg.success('已从4S加载备份私钥')
    } else {
      msg.error('当前环境不支持4S加载')
    }
  } catch {
    msg.error('从4S加载失败')
  }
}

const exportKeys = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.exportRoomKeysAsJson) {
      const js = await crypto.exportRoomKeysAsJson()
      keysJson.value = JSON.stringify(js, null, 2)
      msg.success('已导出房间密钥')
    } else {
      msg.error('当前环境不支持导出房间密钥')
    }
  } catch {
    msg.error('导出失败')
  }
}

const importKeys = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.importRoomKeysAsJson) {
      const data = JSON.parse(keysJson.value || '{}')
      await crypto.importRoomKeysAsJson(data)
      msg.success('已导入房间密钥')
    } else {
      msg.error('当前环境不支持导入房间密钥')
    }
  } catch {
    msg.error('导入失败')
  }
}

const checkBackupStatus = async () => {
  const crypto = getCrypto()
  try {
    if (crypto?.getKeyBackupInfo && crypto?.isKeyBackupTrusted) {
      const info = await crypto.getKeyBackupInfo()
      backupVersion.value = info?.version || ''
      backupTrusted.value = await crypto.isKeyBackupTrusted(info)
      statusLog.value.push(`版本=${backupVersion.value} 可信=${backupTrusted.value}`)
      msg.success('已检查备份状态')
    }
  } catch {
    msg.error('检查备份状态失败')
  }
}

const refreshDefaultKey = async () => {
  const crypto = getCrypto()
  try {
    const ss = crypto?.secretStorage
    if (ss?.getDefaultKeyId) {
      const id = await ss.getDefaultKeyId()
      currentDefaultKeyId.value = id || ''
      msg.success('已读取默认密钥')
    } else {
      msg.error('不支持读取默认密钥')
    }
  } catch {
    msg.error('读取默认密钥失败')
  }
}

const setDefaultKey = async () => {
  const crypto = getCrypto()
  try {
    const ss = crypto?.secretStorage
    if (ss?.setDefaultKeyId && defaultKeyId.value) {
      await ss.setDefaultKeyId(defaultKeyId.value)
      currentDefaultKeyId.value = defaultKeyId.value
      msg.success('默认密钥已更新')
    } else {
      msg.error('不支持设置默认密钥或 keyId 为空')
    }
  } catch {
    msg.error('设置默认密钥失败')
  }
}

const refreshKeyIds = async () => {
  const crypto = getCrypto()
  try {
    const ss = crypto?.secretStorage
    const ids: string[] = []
    if (ss?.getDefaultKeyId) {
      const id = await ss.getDefaultKeyId()
      if (id) ids.push(id)
    }
    keyIds.value = Array.from(new Set(ids))
    if (keyIds.value.length === 0) msg.warning('当前环境未提供 keyId 列表接口')
  } catch {
    msg.error('刷新 keyId 列表失败')
  }
}

onMounted(() => {
  try {
    const crypto = getCrypto()
    if (crypto?.on) {
      crypto.on('KeyBackupStatus', (s: unknown) => {
        statusLog.value.push(`KeyBackupStatus=${JSON.stringify(s)}`)
      })
      crypto.on('KeyBackupSessionsRemaining', (...args: unknown[]) => {
        const n = args[0] as number | undefined
        statusLog.value.push(`SessionsRemaining=${n ?? 0}`)
      })
    }
    try {
      const v = settingStore.getLevelSetting('e2ee.allowSecretStorage')
      if (typeof v === 'boolean') allowSecretStorage.value = v
    } catch {}
  } catch {}
})
</script>
<style scoped>
.status-log {
  font-size: 12px;
  color: var(--hula-gray-700);
}
.chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.chart-row span {
  width: 80px;
  font-size: 12px;
}
</style>
