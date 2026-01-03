<template>
  <van-action-sheet v-model:show="show" :title="t('setting.e2ee.key_backup.title')" :closeable="true">
    <div class="key-backup-sheet">
      <!-- View Status Tab -->
      <div v-if="activeTab === 'view'" class="backup-content">
        <van-loading v-if="loading" size="24px" vertical>
          {{ t('setting.e2ee.key_backup.loading') }}
        </van-loading>

        <template v-else>
          <van-empty v-if="!hasBackup" :description="t('setting.e2ee.key_backup.no_backup_desc')" image="warning">
            <van-button type="primary" round @click="activeTab = 'create'">
              {{ t('setting.e2ee.key_backup.create_button') }}
            </van-button>
          </van-empty>

          <div v-else class="backup-exists">
            <van-icon name="passed" size="60" color="#07c160" />
            <div class="success-title">{{ t('setting.e2ee.key_backup.backup_exists') }}</div>

            <van-cell-group inset>
              <van-cell :title="t('setting.e2ee.key_backup.version')" :value="backupVersion" />
              <van-cell :title="t('setting.e2ee.key_backup.key_count')" :value="keyCount" />
              <van-cell :title="t('setting.e2ee.key_backup.trust_status')">
                <template #value>
                  <van-tag :type="trustInfo?.usable ? 'success' : 'warning'">
                    {{
                      trustInfo?.usable
                        ? t('setting.e2ee.key_backup.trusted')
                        : t('setting.e2ee.key_backup.not_trusted')
                    }}
                  </van-tag>
                </template>
              </van-cell>
            </van-cell-group>

            <van-button type="primary" block round @click="activeTab = 'restore'">
              {{ t('setting.e2ee.key_backup.restore_button') }}
            </van-button>
          </div>
        </template>
      </div>

      <!-- Create Backup Tab -->
      <div v-if="activeTab === 'create'" class="backup-content">
        <van-notice-bar type="info" :text="t('setting.e2ee.key_backup.create_warning')" wrapable />

        <van-loading v-if="creating" size="24px" vertical>
          {{ t('setting.e2ee.key_backup.creating') }}
        </van-loading>

        <template v-else>
          <div v-if="recoveryKey" class="recovery-key-section">
            <van-icon name="shield-o" size="60" color="#07c160" />
            <div class="success-title">{{ t('setting.e2ee.key_backup.created') }}</div>

            <div class="key-display">
              <van-field
                :model-value="recoveryKey"
                type="textarea"
                readonly
                :autosize="{ minHeight: 80, maxHeight: 120 }"
                class="recovery-key-field" />
            </div>

            <van-notice-bar type="warning" :text="t('setting.e2ee.key_backup.save_warning')" wrapable />

            <div class="action-buttons">
              <van-button icon="share" round @click="handleCopyKey">
                {{ t('setting.e2ee.key_backup.copy_button') }}
              </van-button>
              <van-button icon="down" round @click="handleDownloadKey">
                {{ t('setting.e2ee.key_backup.download_button') }}
              </van-button>
            </div>

            <van-checkbox v-model="confirmed" shape="square">
              {{ t('setting.e2ee.key_backup.confirm_save') }}
            </van-checkbox>

            <van-button type="primary" block round :disabled="!confirmed" @click="handleFinishCreate">
              {{ t('setting.e2ee.key_backup.finish_button') }}
            </van-button>
          </div>

          <van-button v-else type="primary" block round size="large" icon="plus" @click="handleCreateBackup">
            {{ t('setting.e2ee.key_backup.start_create') }}
          </van-button>
        </template>
      </div>

      <!-- Restore Backup Tab -->
      <div v-if="activeTab === 'restore'" class="backup-content">
        <van-notice-bar type="info" :text="t('setting.e2ee.key_backup.restore_desc')" wrapable />

        <van-loading v-if="restoring" size="24px" vertical>
          {{ t('setting.e2ee.key_backup.restoring') }}
        </van-loading>

        <template v-else>
          <div v-if="restoreResult" class="restore-result">
            <van-icon name="passed" size="60" color="#07c160" />
            <div class="success-title">{{ t('setting.e2ee.key_backup.restored') }}</div>

            <van-cell-group inset>
              <van-cell :title="t('setting.e2ee.key_backup.imported')" :value="restoreResult.imported.toString()" />
              <van-cell :title="t('setting.e2ee.key_backup.total')" :value="restoreResult.total.toString()" />
            </van-cell-group>

            <van-button type="primary" block round @click="handleClose">
              {{ t('common.close') }}
            </van-button>
          </div>

          <div v-else class="restore-form">
            <van-field
              v-model="inputRecoveryKey"
              type="textarea"
              :placeholder="t('setting.e2ee.key_backup.enter_recovery_key')"
              :autosize="{ minHeight: 100, maxHeight: 150 }"
              class="recovery-input" />

            <van-button type="primary" block round @click="handleRestoreBackup">
              {{ t('setting.e2ee.key_backup.restore_button') }}
            </van-button>
          </div>
        </template>
      </div>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import {
  ActionSheet as VanActionSheet,
  Icon as VanIcon,
  Loading as VanLoading,
  Empty as VanEmpty,
  Button as VanButton,
  CellGroup as VanCellGroup,
  Cell as VanCell,
  Tag as VanTag,
  Field as VanField,
  NoticeBar as VanNoticeBar,
  Checkbox as VanCheckbox
} from 'vant'
import { useE2EEStore } from '@/stores/e2ee'
import { logger } from '@/utils/logger'

interface Props {
  show: boolean
}

interface BackupResult {
  success?: boolean
  recoveryKey?: string
  imported?: number
  total?: number
  error?: string
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'backup-completed', result: BackupResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const e2eeStore = useE2EEStore()

const activeTab = ref('view')
const loading = ref(false)
const creating = ref(false)
const restoring = ref(false)
const recoveryKey = ref('')
const inputRecoveryKey = ref('')
const confirmed = ref(false)
const restoreResult = ref<{ imported: number; total: number } | null>(null)

const hasBackup = computed(() => e2eeStore.stats.keyBackupEnabled)
const backupVersion = computed(() => e2eeStore.stats.keyBackupVersion || '-')
const keyCount = computed(() => e2eeStore.stats.keyCount?.toString() || '0')
const trustInfo = computed(() => e2eeStore.stats.trustInfo)

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      activeTab.value = 'view'
      recoveryKey.value = ''
      inputRecoveryKey.value = ''
      confirmed.value = false
      restoreResult.value = null
      e2eeStore.loadKeyBackupStatus()
    }
  }
)

async function handleCreateBackup() {
  creating.value = true
  try {
    const result = await e2eeStore.createKeyBackup()
    if (result) {
      recoveryKey.value = result.recoveryKey
      showToast.success(t('setting.e2ee.key_backup.create_success'))
    } else {
      showToast.fail(t('setting.e2ee.key_backup.create_failed'))
    }
  } catch (error) {
    logger.error('[MobileKeyBackup] Failed to create backup:', error)
    showToast.fail(t('setting.e2ee.key_backup.create_failed'))
  } finally {
    creating.value = false
  }
}

function handleCopyKey() {
  navigator.clipboard.writeText(recoveryKey.value)
  showToast.success(t('setting.e2ee.key_backup.copied'))
}

function handleDownloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matrix-recovery-key-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  showToast.success(t('setting.e2ee.key_backup.downloaded'))
}

function handleFinishCreate() {
  emit('backup-completed', { recoveryKey: recoveryKey.value })
  activeTab.value = 'view'
}

async function handleRestoreBackup() {
  if (!inputRecoveryKey.value.trim()) {
    showToast.warning(t('setting.e2ee.key_backup.enter_key_first'))
    return
  }

  restoring.value = true
  try {
    const result = await e2eeStore.restoreKeyBackup(inputRecoveryKey.value.trim())
    if (result) {
      restoreResult.value = result
      showToast.success(t('setting.e2ee.key_backup.restore_success'))
    } else {
      showToast.fail(t('setting.e2ee.key_backup.restore_failed'))
    }
  } catch (error) {
    logger.error('[MobileKeyBackup] Failed to restore backup:', error)
    showToast.fail(t('setting.e2ee.key_backup.restore_failed'))
  } finally {
    restoring.value = false
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.key-backup-sheet {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;

  .backup-content {
    min-height: 300px;

    .backup-exists,
    .recovery-key-section,
    .restore-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .success-title {
      font-size: 18px;
      font-weight: 600;
    }

    .key-display {
      width: 100%;

      .recovery-key-field {
        font-family: monospace;
        font-size: 13px;
        line-height: 1.6;
      }
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      width: 100%;

      .van-button {
        flex: 1;
      }
    }

    .restore-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  }
}
</style>
