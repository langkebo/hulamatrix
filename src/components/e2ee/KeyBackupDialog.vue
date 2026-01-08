<template>
  <n-modal :show="show" :mask-closable="false" @update:show="handleClose">
    <n-card
      class="modal-card"
      :title="t('setting.e2ee.key_backup.title')"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true">
      <n-tabs v-model:value="activeTab" type="line">
        <!-- 查看备份状态 -->
        <n-tab-pane name="view" :tab="t('setting.e2ee.key_backup.view_status')">
          <div class="backup-status">
            <n-spin :show="loading">
              <n-result
                v-if="hasBackup"
                status="success"
                :title="t('setting.e2ee.key_backup.backup_exists')"
                :description="t('setting.e2ee.key_backup.backup_exists_desc')">
                <template #footer>
                  <n-space vertical>
                    <n-descriptions :column="1" bordered>
                      <n-descriptions-item :label="t('setting.e2ee.key_backup.version')">
                        {{ backupVersion }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('setting.e2ee.key_backup.key_count')">
                        {{ keyCount }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('setting.e2ee.key_backup.trust_status')">
                        <n-tag :type="trustInfo?.usable ? 'success' : 'warning'">
                          {{
                            trustInfo?.usable
                              ? t('setting.e2ee.key_backup.trusted')
                              : t('setting.e2ee.key_backup.not_trusted')
                          }}
                        </n-tag>
                      </n-descriptions-item>
                    </n-descriptions>
                    <n-space>
                      <n-button @click="activeTab = 'restore'">
                        {{ t('setting.e2ee.key_backup.restore_button') }}
                      </n-button>
                      <n-button type="error" @click="handleDeleteBackup">
                        {{ t('setting.e2ee.key_backup.delete_button') }}
                      </n-button>
                    </n-space>
                  </n-space>
                </template>
              </n-result>

              <n-result
                v-else
                status="warning"
                :title="t('setting.e2ee.key_backup.no_backup')"
                :description="t('setting.e2ee.key_backup.no_backup_desc')">
                <template #footer>
                  <n-button type="primary" @click="activeTab = 'create'">
                    {{ t('setting.e2ee.key_backup.create_button') }}
                  </n-button>
                </template>
              </n-result>
            </n-spin>
          </div>
        </n-tab-pane>

        <!-- 创建新备份 -->
        <n-tab-pane name="create" :tab="t('setting.e2ee.key_backup.create_new')">
          <div class="backup-create">
            <n-alert type="info" class="alert-spacing">
              {{ t('setting.e2ee.key_backup.create_warning') }}
            </n-alert>

            <n-spin :show="creating">
              <n-space vertical>
                <n-text>
                  {{ t('setting.e2ee.key_backup.create_desc') }}
                </n-text>

                <n-result v-if="recoveryKey" status="success" :title="t('setting.e2ee.key_backup.created')">
                  <template #icon>
                    <n-icon size="80" color="#18a058">
                      <Key />
                    </n-icon>
                  </template>
                  <template #footer>
                    <n-space vertical class="width-full">
                      <n-input
                        :value="recoveryKey"
                        type="textarea"
                        readonly
                        :autosize="{ minRows: 3, maxRows: 5 }"
                        class="monospace-input" />

                      <n-alert type="warning">
                        {{ t('setting.e2ee.key_backup.save_warning') }}
                      </n-alert>

                      <n-space>
                        <n-button type="primary" @click="handleCopyKey">
                          {{ t('setting.e2ee.key_backup.copy_button') }}
                        </n-button>
                        <n-button @click="handleDownloadKey">
                          {{ t('setting.e2ee.key_backup.download_button') }}
                        </n-button>
                      </n-space>

                      <n-checkbox v-model:checked="confirmed">
                        {{ t('setting.e2ee.key_backup.confirm_save') }}
                      </n-checkbox>

                      <n-button type="primary" :disabled="!confirmed" @click="handleFinishCreate">
                        {{ t('setting.e2ee.key_backup.finish_button') }}
                      </n-button>
                    </n-space>
                  </template>
                </n-result>

                <n-button v-else type="primary" block size="large" @click="handleCreateBackup">
                  <template #icon>
                    <n-icon><Plus /></n-icon>
                  </template>
                  {{ t('setting.e2ee.key_backup.start_create') }}
                </n-button>
              </n-space>
            </n-spin>
          </div>
        </n-tab-pane>

        <!-- 恢复备份 -->
        <n-tab-pane name="restore" :tab="t('setting.e2ee.key_backup.restore_backup')">
          <div class="backup-restore">
            <n-alert type="info" class="alert-spacing">
              {{ t('setting.e2ee.key_backup.restore_desc') }}
            </n-alert>

            <n-spin :show="restoring">
              <n-space vertical>
                <n-input
                  v-model:value="inputRecoveryKey"
                  type="textarea"
                  :placeholder="t('setting.e2ee.key_backup.enter_recovery_key')"
                  :autosize="{ minRows: 3, maxRows: 5 }"
                  class="monospace-textarea" />

                <n-result v-if="restoreResult" status="success" :title="t('setting.e2ee.key_backup.restored')">
                  <template #footer>
                    <n-descriptions :column="1" bordered>
                      <n-descriptions-item :label="t('setting.e2ee.key_backup.imported')">
                        {{ restoreResult.imported }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('setting.e2ee.key_backup.total')">
                        {{ restoreResult.total }}
                      </n-descriptions-item>
                    </n-descriptions>
                  </template>
                </n-result>

                <n-space v-if="!restoreResult">
                  <n-button type="primary" @click="handleRestoreBackup">
                    {{ t('setting.e2ee.key_backup.restore_button') }}
                  </n-button>
                </n-space>

                <n-button v-if="restoreResult" type="primary" @click="handleClose">
                  {{ t('common.close') }}
                </n-button>
              </n-space>
            </n-spin>
          </div>
        </n-tab-pane>
      </n-tabs>

      <template #footer>
        <n-space justify="end">
          <n-button @click="handleClose">{{ t('common.close') }}</n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NCard,
  NTabs,
  NTabPane,
  NSpace,
  NSpin,
  NResult,
  NButton,
  NInput,
  NCheckbox,
  NAlert,
  NTag,
  NDescriptions,
  NDescriptionsItem,
  NIcon,
  useMessage,
  useDialog
} from 'naive-ui'
import { Key, Plus } from '@vicons/tabler'
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
const message = useMessage()
const dialog = useDialog()
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
      message.success(t('setting.e2ee.key_backup.create_success'))
    } else {
      message.error(t('setting.e2ee.key_backup.create_failed'))
    }
  } catch (error) {
    logger.error('[KeyBackupDialog] Failed to create backup:', error)
    message.error(t('setting.e2ee.key_backup.create_failed'))
  } finally {
    creating.value = false
  }
}

function handleCopyKey() {
  navigator.clipboard.writeText(recoveryKey.value)
  message.success(t('setting.e2ee.key_backup.copied'))
}

function handleDownloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matrix-recovery-key-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success(t('setting.e2ee.key_backup.downloaded'))
}

function handleFinishCreate() {
  emit('backup-completed', { recoveryKey: recoveryKey.value })
  activeTab.value = 'view'
}

async function handleRestoreBackup() {
  if (!inputRecoveryKey.value.trim()) {
    message.warning(t('setting.e2ee.key_backup.enter_key_first'))
    return
  }

  restoring.value = true
  try {
    const result = await e2eeStore.restoreKeyBackup(inputRecoveryKey.value.trim())
    if (result) {
      restoreResult.value = result
      message.success(t('setting.e2ee.key_backup.restore_success'))
    } else {
      message.error(t('setting.e2ee.key_backup.restore_failed'))
    }
  } catch (error) {
    logger.error('[KeyBackupDialog] Failed to restore backup:', error)
    message.error(t('setting.e2ee.key_backup.restore_failed'))
  } finally {
    restoring.value = false
  }
}

function handleDeleteBackup() {
  dialog.warning({
    title: t('setting.e2ee.key_backup.delete_confirm_title'),
    content: t('setting.e2ee.key_backup.delete_confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      message.info(t('setting.e2ee.key_backup.delete_not_implemented'))
    }
  })
}

function handleClose() {
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.backup-status,
.backup-create,
.backup-restore {
  min-height: 300px;
}

/* Inline style replacements */
.modal-card {
  width: 600px;
  max-width: 90vw;
}

.alert-spacing {
  margin-bottom: 16px;
}

.width-full {
  width: 100%;
}

.monospace-input {
  font-family: monospace;
  font-size: 14px;
}

.monospace-textarea {
  font-family: monospace;
}
</style>
