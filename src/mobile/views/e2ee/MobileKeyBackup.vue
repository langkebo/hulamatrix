<!-- Mobile Key Backup View - E2EE key backup for mobile -->
<template>
  <div class="mobile-key-backup-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <n-button text @click="goBack">
          <template #icon>
            <n-icon :size="20"><ArrowLeft /></n-icon>
          </template>
        </n-button>
      </div>
      <div class="header-title">密钥备份</div>
      <div class="header-right" />
    </div>

    <!-- Status Banner -->
    <div class="status-banner" :class="`status-${backupStatus}`">
      <n-icon class="banner-icon" :size="24">
        <Cloud v-if="backupStatus === 'ok'" />
        <CloudOff v-else-if="backupStatus === 'warning'" />
        <CloudXIcon v-else />
      </n-icon>
      <div class="banner-content">
        <div class="banner-title">{{ statusTitle }}</div>
        <div class="banner-desc">{{ statusDescription }}</div>
      </div>
    </div>

    <!-- Content -->
    <div class="view-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <n-spin size="medium" />
        <p class="mt-12px">正在检查密钥备份状态...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <n-result status="error" title="检查失败" :description="error">
          <template #footer>
            <n-button @click="checkStatus">重试</n-button>
          </template>
        </n-result>
      </div>

      <!-- Content -->
      <div v-else class="backup-content">
        <!-- Info Section -->
        <n-card title="关于密钥备份" size="small" class="mb-12px">
          <p class="info-text">
            密钥备份可以将您的加密密钥安全地存储在服务器上。这样即使您更换设备或丢失设备，也能恢复您的加密消息历史。
          </p>
          <n-alert type="info" :show-icon="true" class="mt-8px">
            <strong>建议：</strong>创建密钥备份后，请保存好恢复密钥，以防万一
          </n-alert>
        </n-card>

        <!-- Actions Section -->
        <n-card title="密钥备份操作" size="small">
          <n-space vertical :size="12">
            <n-button
              v-if="backupStatus === 'none'"
              type="primary"
              size="large"
              block
              @click="createBackup"
            >
              <template #icon>
                <n-icon><Plus /></n-icon>
              </template>
              创建密钥备份
            </n-button>

            <n-button
              v-if="backupStatus === 'warning'"
              type="warning"
              size="large"
              block
              @click="repairBackup"
            >
              <template #icon>
                <n-icon><Tool /></n-icon>
              </template>
              修复密钥备份
            </n-button>

            <n-button
              v-if="backupStatus === 'ok'"
              type="info"
              size="large"
              block
              @click="showRecoveryKey = true"
            >
              <template #icon>
                <n-icon><Key /></n-icon>
              </template>
              查看恢复密钥
            </n-button>

            <n-button
              size="large"
              block
              @click="showHelp = true"
            >
              <template #icon>
                <n-icon><HelpIcon /></n-icon>
              </template>
              帮助
            </n-button>
          </n-space>
        </n-card>

        <!-- Details Section -->
        <n-card title="备份详情" size="small" class="mt-12px">
          <n-descriptions :column="1" bordered size="small">
            <n-descriptions-item label="状态">
              <n-tag
                :type="backupStatus === 'ok' ? 'success' : backupStatus === 'warning' ? 'warning' : 'default'"
                size="small"
              >
                {{ statusLabel }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="版本">
              {{ backupInfo.version || '未知' }}
            </n-descriptions-item>
            <n-descriptions-item label="信任状态">
              <n-tag :type="backupInfo.trusted ? 'success' : 'warning'" size="small">
                {{ backupInfo.trusted ? '已信任' : '未信任' }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="密钥存储">
              <n-tag :type="backupInfo.secretReady ? 'success' : 'error'" size="small">
                {{ backupInfo.secretReady ? '就绪' : '未就绪' }}
              </n-tag>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
      </div>
    </div>

    <!-- Recovery Key Dialog -->
    <n-modal
      v-model:show="showRecoveryKey"
      preset="card"
      title="恢复密钥"
      :style="{ width: '90%', maxWidth: '400px' }"
    >
      <n-alert type="warning" :show-icon="true" class="mb-12px">
        请将此恢复密钥保存在安全的地方。任何获得此密钥的人都可以访问您的加密消息。
      </n-alert>

      <div v-if="recoveryKey" class="recovery-key-display">
        <n-input
          :value="recoveryKey"
          type="textarea"
          readonly
          :autosize="{ minRows: 3, maxRows: 5 }"
        />
      </div>

      <n-space class="mt-12px" vertical>
        <n-button type="primary" block @click="copyRecoveryKey">
          <template #icon>
            <n-icon><Copy /></n-icon>
          </template>
          复制恢复密钥
        </n-button>
        <n-button block @click="showRecoveryKey = false">
          关闭
        </n-button>
      </n-space>
    </n-modal>

    <!-- Help Dialog -->
    <n-modal
      v-model:show="showHelp"
      preset="card"
      title="密钥备份帮助"
      :style="{ width: '90%', maxWidth: '400px' }"
    >
      <div class="help-content">
        <h4>什么是密钥备份？</h4>
        <p>密钥备份将您的加密密钥安全地存储在 Matrix 服务器上，使用您的账户密码进行加密保护。</p>

        <h4>为什么需要密钥备份？</h4>
        <ul>
          <li>更换设备时恢复历史消息</li>
          <li>防止设备丢失导致数据无法解密</li>
          <li>在新设备上快速开始使用</li>
        </ul>

        <h4>恢复密钥</h4>
        <p>恢复密钥是用于访问密钥备份的特殊密钥。请务必妥善保管，不要分享给他人。</p>

        <n-alert type="info" :show-icon="true" class="mt-12px">
          建议将恢复密钥写在纸上或存储在密码管理器中
        </n-alert>
      </div>

      <template #footer>
        <n-button type="primary" block @click="showHelp = false">
          我知道了
        </n-button>
      </template>
    </n-modal>

    <!-- Create Backup Dialog -->
    <n-modal
      v-model:show="showCreateBackup"
      preset="card"
      title="创建密钥备份"
      :style="{ width: '90%', maxWidth: '400px' }"
    >
      <n-alert type="info" :show-icon="true" class="mb-12px">
        创建密钥备份需要设置密码或生成恢复密钥
      </n-alert>

      <n-space vertical :size="12">
        <n-form-item label="备份方式">
          <n-radio-group v-model:value="backupMethod" name="backupMethod">
            <n-space vertical>
              <n-radio value="passphrase">
                使用密码保护
              </n-radio>
              <n-radio value="recoveryKey">
                生成恢复密钥
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <n-input
          v-if="backupMethod === 'passphrase'"
          v-model:value="passphrase"
          type="password"
          show-password-on="click"
          placeholder="输入备份密码"
          size="large"
        />

        <n-alert v-if="backupMethod === 'recoveryKey'" type="warning" :show-icon="true">
          系统将生成一个恢复密钥，请务必保存好
        </n-alert>
      </n-space>

      <template #footer>
        <n-space vertical>
          <n-button
            type="primary"
            block
            size="large"
            :loading="creatingBackup"
            @click="doCreateBackup"
          >
            创建备份
          </n-button>
          <n-button block @click="showCreateBackup = false">
            取消
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NIcon,
  NCard,
  NSpace,
  NAlert,
  NSpin,
  NResult,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NInput,
  NFormItem,
  NRadioGroup,
  NRadio,
  useDialog
} from 'naive-ui'
import { ArrowLeft, Cloud, CloudOff, Plus, Tool, Key, Help as HelpIcon, Copy, X as CloudXIcon } from '@vicons/tabler'
import { getKeyBackupStatusDetailed, repairSecretStorage } from '@/integrations/matrix/encryption'
import { msg } from '@/utils/SafeUI'
import { flags } from '@/utils/envFlags'

const router = useRouter()
const dialog = useDialog()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const backupStatus = ref<'none' | 'warning' | 'ok'>('none')
const backupInfo = ref<{
  version?: string
  trusted?: boolean
  secretReady?: boolean
}>({})

const showRecoveryKey = ref(false)
const showHelp = ref(false)
const showCreateBackup = ref(false)
const recoveryKey = ref('')
const creatingBackup = ref(false)
const backupMethod = ref<'passphrase' | 'recoveryKey'>('recoveryKey')
const passphrase = ref('')

// Computed
const e2eeEnabled = computed(() => flags.matrixE2eeEnabled && flags.matrixEnabled)

const statusTitle = computed(() => {
  switch (backupStatus.value) {
    case 'ok':
      return '密钥备份正常'
    case 'warning':
      return '密钥备份需要修复'
    default:
      return '未设置密钥备份'
  }
})

const statusDescription = computed(() => {
  switch (backupStatus.value) {
    case 'ok':
      return '您的加密密钥已安全备份'
    case 'warning':
      return '密钥备份存在问题，建议修复'
    default:
      return '建议创建密钥备份以防止数据丢失'
  }
})

const statusLabel = computed(() => {
  switch (backupStatus.value) {
    case 'ok':
      return '正常'
    case 'warning':
      return '需要修复'
    default:
      return '未设置'
  }
})

// Methods
const goBack = () => {
  router.back()
}

const checkStatus = async () => {
  if (!e2eeEnabled.value) return

  loading.value = true
  error.value = null

  try {
    const result = await getKeyBackupStatusDetailed()

    if (result.ok) {
      backupInfo.value = {
        version: result.version,
        trusted: result.trusted,
        secretReady: result.secretReady
      }

      if (result.version && result.trusted && result.secretReady) {
        backupStatus.value = 'ok'
      } else if (result.version || result.secretReady) {
        backupStatus.value = 'warning'
      } else {
        backupStatus.value = 'none'
      }
    } else {
      backupStatus.value = 'none'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '检查失败'
  } finally {
    loading.value = false
  }
}

const createBackup = () => {
  showCreateBackup.value = true
}

const doCreateBackup = async () => {
  if (backupMethod.value === 'passphrase' && !passphrase.value) {
    msg.warning('请输入备份密码')
    return
  }

  creatingBackup.value = true

  try {
    const success = await repairSecretStorage(backupMethod.value === 'passphrase' ? passphrase.value : undefined)

    if (success) {
      msg.success('密钥备份创建成功')

      if (backupMethod.value === 'recoveryKey') {
        // Generate and show recovery key
        recoveryKey.value = 'RECOVERY_KEY_PLACEHOLDER' // Would be generated by actual implementation
        showRecoveryKey.value = true
      }

      showCreateBackup.value = false
      await checkStatus()
    } else {
      msg.error('密钥备份创建失败')
    }
  } catch (err) {
    msg.error('创建失败: ' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    creatingBackup.value = false
  }
}

const repairBackup = async () => {
  dialog.info({
    title: '修复密钥备份',
    content: '修复将尝试重新同步您的密钥备份。此过程可能需要几分钟。',
    positiveText: '开始修复',
    negativeText: '取消',
    onPositiveClick: async () => {
      loading.value = true
      try {
        const success = await repairSecretStorage()
        if (success) {
          msg.success('密钥备份修复成功')
          await checkStatus()
        } else {
          msg.error('密钥备份修复失败')
        }
      } finally {
        loading.value = false
      }
    }
  })
}

const copyRecoveryKey = () => {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => {
      msg.success('恢复密钥已复制到剪贴板')
    })
    .catch(() => {
      msg.error('复制失败')
    })
}

// Lifecycle
onMounted(() => {
  checkStatus()
})
</script>

<style scoped lang="scss">
.mobile-key-backup-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
  position: sticky;
  top: 0;
  z-index: 10;

  .header-left,
  .header-right {
    width: 32px;
    display: flex;
    align-items: center;
  }

  .header-right {
    justify-content: flex-end;
  }

  .header-title {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  margin: 12px 16px;
  border-radius: 12px;

  &.status-ok {
    background: rgba(24, 160, 88, 0.1);
    border: 1px solid rgba(24, 160, 88, 0.2);

    .banner-icon {
      color: #18a058;
    }
  }

  &.status-warning {
    background: rgba(240, 160, 32, 0.1);
    border: 1px solid rgba(240, 160, 32, 0.2);

    .banner-icon {
      color: #f0a020;
    }
  }

  &.status-none {
    background: rgba(208, 48, 80, 0.1);
    border: 1px solid rgba(208, 48, 80, 0.2);

    .banner-icon {
      color: #d03050;
    }
  }

  .banner-content {
    flex: 1;
  }

  .banner-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 2px;
  }

  .banner-desc {
    font-size: 12px;
    opacity: 0.8;
  }
}

.view-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 80px 16px;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 32px;
}

.backup-content {
  .info-text {
    font-size: 13px;
    color: var(--text-color-2);
    line-height: 1.6;
    margin: 0;
  }

  .recovery-key-display {
    :deep(.n-input__textarea-el) {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
    }
  }
}

.help-content {
  h4 {
    margin: 16px 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color-1);

    &:first-child {
      margin-top: 0;
    }
  }

  p {
    font-size: 13px;
    color: var(--text-color-2);
    margin: 8px 0;
    line-height: 1.5;
  }

  ul {
    margin: 8px 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--text-color-2);
    line-height: 1.6;
  }

  li {
    margin: 4px 0;
  }
}
</style>
