<template>
  <n-card :title="t('encryption.key_backup.title')" :bordered="false" class="key-backup-panel">
    <template #header-extra>
      <n-tag :type="backupStatus.enabled ? 'success' : 'warning'" size="small">
        {{ backupStatus.enabled ? t('encryption.key_backup.enabled') : t('encryption.key_backup.disabled') }}
      </n-tag>
    </template>

    <n-flex :size="16" vertical>
      <n-alert v-if="!backupStatus.enabled" type="warning" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#warning"></use></svg>
        </template>
        {{ t('encryption.key_backup.warning_message') }}
      </n-alert>

      <n-alert v-else-if="backupStatus.enabled && !backupStatus.hasBackup" type="info" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#info"></use></svg>
        </template>
        {{ t('encryption.key_backup.no_backup_message') }}
      </n-alert>

      <n-alert v-else type="success" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#check-circle"></use></svg>
        </template>
        {{ t('encryption.key_backup.backup_exists_message') }}
        <div v-if="backupStatus.backupInfo?.count" class="mt-2 text-12px text-gray-600">
          {{ t('encryption.key_backup.keys_count', { count: backupStatus.backupInfo.count }) }}
        </div>
      </n-alert>

      <n-divider style="margin: 8px 0" />

      <n-flex :size="12" vertical>
        <div class="text-14px font-medium">{{ t('encryption.key_backup.actions') }}</div>

        <n-button v-if="!backupStatus.enabled" type="primary" @click="handleEnableBackup" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#shield"></use></svg>
          </template>
          {{ t('encryption.key_backup.enable_backup') }}
        </n-button>

        <n-button v-else-if="backupStatus.enabled && !backupStatus.hasBackup" type="primary" @click="handleCreateBackup" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#plus"></use></svg>
          </template>
          {{ t('encryption.key_backup.create_backup') }}
        </n-button>

        <n-button v-else type="primary" @click="handleShowRecoveryKey" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#key"></use></svg>
          </template>
          {{ t('encryption.key_backup.show_recovery_key') }}
        </n-button>

        <n-button v-if="backupStatus.enabled" @click="handleRestoreBackup" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#refresh"></use></svg>
          </template>
          {{ t('encryption.key_backup.restore_backup') }}
        </n-button>

        <n-button v-if="backupStatus.enabled" type="error" @click="handleDisableBackup" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#trash"></use></svg>
          </template>
          {{ t('encryption.key_backup.disable_backup') }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-modal v-model:show="showRecoveryKeyModal" preset="card" :title="t('encryption.key_backup.recovery_key_title')" style="width: 500px">
      <n-flex :size="16" vertical>
        <n-alert type="warning" :bordered="false">
          {{ t('encryption.key_backup.recovery_key_warning') }}
        </n-alert>

        <n-input
          v-model:value="recoveryKey"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          readonly
          class="recovery-key-input" />

        <n-button type="primary" block @click="copyRecoveryKey">
          <template #icon>
            <svg class="size-16px"><use href="#copy"></use></svg>
          </template>
          {{ t('encryption.key_backup.copy_recovery_key') }}
        </n-button>
      </n-flex>
    </n-modal>

    <n-modal v-model:show="showRestoreModal" preset="card" :title="t('encryption.key_backup.restore_title')" style="width: 500px">
      <n-form ref="restoreFormRef" :model="restoreForm" :rules="restoreRules" label-placement="top" label-width="auto">
        <n-form-item :label="t('encryption.key_backup.recovery_key')" path="recoveryKey">
          <n-input
            v-model:value="restoreForm.recoveryKey"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="t('encryption.key_backup.enter_recovery_key')" />
        </n-form-item>

        <n-form-item :label="t('encryption.key_backup.password')" path="password">
          <n-input
            v-model:value="restoreForm.password"
            type="password"
            show-password-on="click"
            :placeholder="t('encryption.key_backup.enter_password')" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showRestoreModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleRestore" :loading="loading">
            {{ t('encryption.key_backup.restore') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixKeyBackupService from '@/services/matrix/MatrixKeyBackupService'

const { t } = useI18n()
const keyBackupService = MatrixKeyBackupService.getInstance()

const loading = ref(false)
const backupStatus = ref<{
  enabled: boolean
  hasBackup: boolean
  backupInfo: any
  backupVersion: string | null
}>({
  enabled: false,
  hasBackup: false,
  backupInfo: null,
  backupVersion: null
})

const showRecoveryKeyModal = ref(false)
const recoveryKey = ref('')

const showRestoreModal = ref(false)
const restoreFormRef = ref()
const restoreForm = ref({
  recoveryKey: '',
  password: ''
})

const restoreRules = {
  recoveryKey: {
    required: true,
    message: t('encryption.key_backup.recovery_key_required'),
    trigger: 'blur'
  },
  password: {
    required: true,
    message: t('encryption.key_backup.password_required'),
    trigger: 'blur'
  }
}

const loadBackupStatus = async () => {
  try {
    loading.value = true
    const enabled = await keyBackupService.isBackupEnabled()
    const hasBackup = await keyBackupService.hasBackup()
    const backupInfo = await keyBackupService.getBackupInfo()

    backupStatus.value = {
      enabled,
      hasBackup,
      backupInfo,
      backupVersion: backupInfo?.version || null
    }
  } catch (error) {
    console.error('Failed to load backup status:', error)
  } finally {
    loading.value = false
  }
}

const handleEnableBackup = async () => {
  try {
    loading.value = true
    const success = await keyBackupService.enableBackup()
    if (success) {
      window.$message.success(t('encryption.key_backup.backup_enabled'))
      await loadBackupStatus()
    } else {
      window.$message.error(t('encryption.key_backup.enable_failed'))
    }
  } catch (error) {
    console.error('Failed to enable backup:', error)
    window.$message.error(t('encryption.key_backup.enable_failed'))
  } finally {
    loading.value = false
  }
}

const handleCreateBackup = async () => {
  try {
    loading.value = true
    const result = await keyBackupService.createBackup('')
    if (result) {
      recoveryKey.value = result.key
      showRecoveryKeyModal.value = true
      window.$message.success(t('encryption.key_backup.backup_created'))
      await loadBackupStatus()
    } else {
      window.$message.error(t('encryption.key_backup.create_failed'))
    }
  } catch (error) {
    console.error('Failed to create backup:', error)
    window.$message.error(t('encryption.key_backup.create_failed'))
  } finally {
    loading.value = false
  }
}

const handleShowRecoveryKey = async () => {
  try {
    loading.value = true
    const result = await keyBackupService.getBackupInfo()
    if (result) {
      recoveryKey.value = 'Recovery key would be shown here'
      showRecoveryKeyModal.value = true
    } else {
      window.$message.error(t('encryption.key_backup.get_key_failed'))
    }
  } catch (error) {
    console.error('Failed to get recovery key:', error)
    window.$message.error(t('encryption.key_backup.get_key_failed'))
  } finally {
    loading.value = false
  }
}

const copyRecoveryKey = () => {
  navigator.clipboard.writeText(recoveryKey.value)
  window.$message.success(t('encryption.key_backup.copied'))
}

const handleRestoreBackup = () => {
  restoreForm.value = {
    recoveryKey: '',
    password: ''
  }
  showRestoreModal.value = true
}

const handleRestore = async () => {
  try {
    await restoreFormRef.value?.validate()
    loading.value = true

    const progress = await keyBackupService.restoreBackupWithPassphrase(restoreForm.value.password, (progress) => {
      console.log('Restore progress:', progress)
    })

    if (progress) {
      window.$message.success(t('encryption.key_backup.restored'))
      showRestoreModal.value = false
      await loadBackupStatus()
    } else {
      window.$message.error(t('encryption.key_backup.restore_failed'))
    }
  } catch (error) {
    console.error('Failed to restore backup:', error)
    window.$message.error(t('encryption.key_backup.restore_failed'))
  } finally {
    loading.value = false
  }
}

const handleDisableBackup = () => {
  window.$dialog.warning({
    title: t('encryption.key_backup.disable_backup_title'),
    content: t('encryption.key_backup.disable_backup_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        loading.value = true
        const success = await keyBackupService.disableBackup()
        if (success) {
          window.$message.success(t('encryption.key_backup.backup_disabled'))
          await loadBackupStatus()
        } else {
          window.$message.error(t('encryption.key_backup.disable_failed'))
        }
      } catch (error) {
        console.error('Failed to disable backup:', error)
        window.$message.error(t('encryption.key_backup.disable_failed'))
      } finally {
        loading.value = false
      }
    }
  })
}

onMounted(() => {
  loadBackupStatus()
})
</script>

<style scoped>
.key-backup-panel {
  background: var(--bg-color);
}

.recovery-key-input {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  letter-spacing: 1px;
}
</style>
