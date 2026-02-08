<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="t('user_menu.privacy.title')" />
    </template>

    <template #container>
      <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />
      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <n-spin :show="loading">
            <div class="flex flex-col gap-20px">
              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.privacy.privacy_settings') }}</div>
                <div class="flex flex-col gap-12px">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.read_receipts') }}</span>
                    <n-switch v-model:value="privacySettings.readReceipts" @update:value="handlePrivacyChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.typing_indicator') }}</span>
                    <n-switch v-model:value="privacySettings.typingIndicator" @update:value="handlePrivacyChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.link_previews') }}</span>
                    <n-switch v-model:value="privacySettings.linkPreviews" @update:value="handlePrivacyChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.auto_download') }}</span>
                    <n-switch v-model:value="privacySettings.autoDownload" @update:value="handlePrivacyChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.message_auto_delete') }}</span>
                    <n-switch v-model:value="messageAutoDelete.enabled" @update:value="handlePrivacyChange" />
                  </div>
                  <template v-if="messageAutoDelete.enabled">
                    <div class="flex flex-col gap-8px ml-20px">
                      <span class="text-xs text-gray-500">{{ t('user_menu.privacy.delete_after') }}</span>
                      <n-select
                        v-model:value="messageAutoDelete.deleteAfter"
                        :options="deleteAfterOptions"
                        size="small"
                        style="width: 150px"
                        @update:value="handlePrivacyChange" />
                    </div>
                  </template>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-12px">
                  <div class="text-base font-medium">{{ t('user_menu.privacy.cross_signing') }}</div>
                  <n-tag v-if="crossSigningEnabled" type="success" size="small">
                    {{ t('user_menu.privacy.enabled') }}
                  </n-tag>
                  <n-tag v-else type="warning" size="small">
                    {{ t('user_menu.privacy.disabled') }}
                  </n-tag>
                </div>
                <div class="flex flex-col gap-8px">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.verified_devices') }}</span>
                    <span class="text-sm font-medium">{{ verifiedDeviceCount }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.privacy.unverified_devices') }}</span>
                    <span class="text-sm font-medium text-red-500">{{ unverifiedDeviceCount }}</span>
                  </div>
                  <div v-if="unverifiedDeviceCount > 0" class="flex gap-8px mt-8px">
                    <n-button type="primary" size="small" @click="verifyAllDevices">
                      {{ t('user_menu.privacy.verify_all') }}
                    </n-button>
                    <n-button size="small" @click="showUnverifiedDevices = true">
                      {{ t('user_menu.privacy.view_unverified') }}
                    </n-button>
                  </div>
                  <div v-if="!crossSigningEnabled" class="flex gap-8px mt-8px">
                    <n-button type="primary" size="small" @click="setupCrossSigning">
                      {{ t('user_menu.privacy.setup_cross_signing') }}
                    </n-button>
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-12px">
                  <div class="text-base font-medium">{{ t('user_menu.privacy.key_backup') }}</div>
                  <n-tag v-if="hasBackup" type="success" size="small">
                    {{ t('user_menu.privacy.enabled') }}
                  </n-tag>
                  <n-tag v-else type="warning" size="small">
                    {{ t('user_menu.privacy.disabled') }}
                  </n-tag>
                </div>
                <div class="flex flex-col gap-8px">
                  <div v-if="hasBackup" class="flex gap-8px">
                    <n-button size="small" @click="viewBackupKey">
                      {{ t('user_menu.privacy.view_key') }}
                    </n-button>
                    <n-button type="error" size="small" @click="deleteKeyBackup">
                      {{ t('user_menu.privacy.delete_backup') }}
                    </n-button>
                  </div>
                  <div v-else class="flex gap-8px">
                    <n-button type="primary" size="small" @click="createKeyBackup">
                      {{ t('user_menu.privacy.create_backup') }}
                    </n-button>
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.privacy.quick_actions') }}</div>
                <div class="flex flex-col gap-8px">
                  <n-button block @click="router.push('/mobile/mobileMy/devices')">
                    {{ t('user_menu.privacy.manage_devices') }}
                  </n-button>
                </div>
              </div>
            </div>
          </n-spin>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { h } from 'vue'
import MatrixSettingsService from '@/services/matrix/MatrixSettingsService'
import MatrixKeyBackupService from '@/services/matrix/MatrixKeyBackupService'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'

const { t } = useI18n()
const router = useRouter()

const settingsService = MatrixSettingsService.getInstance()
const keyBackupService = MatrixKeyBackupService.getInstance()
const crossSigningService = MatrixCrossSigningService.getInstance()

const loading = ref(false)
const hasBackup = ref(false)
const crossSigningEnabled = ref(false)
const verifiedDeviceCount = ref(0)
const unverifiedDeviceCount = ref(0)
const showUnverifiedDevices = ref(false)

const privacySettings = ref({
  readReceipts: true,
  typingIndicator: true,
  linkPreviews: true,
  autoDownload: false
})

const messageAutoDelete = ref({
  enabled: false,
  deleteAfter: 'never' as '1h' | '24h' | '7d' | '30d' | 'never'
})

const deleteAfterOptions = [
  { label: t('user_menu.privacy.delete_1h'), value: '1h' },
  { label: t('user_menu.privacy.delete_24h'), value: '24h' },
  { label: t('user_menu.privacy.delete_7d'), value: '7d' },
  { label: t('user_menu.privacy.delete_30d'), value: '30d' },
  { label: t('user_menu.privacy.delete_never'), value: 'never' }
]

const loadPrivacySettings = async () => {
  try {
    loading.value = true
    const settings = await settingsService.getPrivacySettings()
    privacySettings.value = {
      readReceipts: settings.readReceipts,
      typingIndicator: settings.typingIndicator,
      linkPreviews: settings.linkPreviews,
      autoDownload: settings.autoDownload
    }

    if (settings.messageAutoDelete) {
      messageAutoDelete.value = {
        enabled: settings.messageAutoDelete.enabled,
        deleteAfter: settings.messageAutoDelete.deleteAfter
      }
    }
  } catch (error) {
    console.error('Failed to load privacy settings:', error)
  } finally {
    loading.value = false
  }
}

const loadKeyBackupStatus = async () => {
  try {
    const status = await keyBackupService.getBackupStatus()
    hasBackup.value = status.enabled
  } catch (error) {
    console.error('Failed to load key backup status:', error)
  }
}

const loadCrossSigningStatus = async () => {
  try {
    const status = await crossSigningService.getCrossSigningStatus()
    crossSigningEnabled.value = status?.enabled === true

    verifiedDeviceCount.value = await crossSigningService.getVerifiedDeviceCount()
    unverifiedDeviceCount.value = await crossSigningService.getUnverifiedDeviceCount()
  } catch (error) {
    console.error('Failed to load cross signing status:', error)
  }
}

const handlePrivacyChange = async () => {
  try {
    await settingsService.setPrivacySettings({
      readReceipts: privacySettings.value.readReceipts,
      typingIndicator: privacySettings.value.typingIndicator,
      linkPreviews: privacySettings.value.linkPreviews,
      autoDownload: privacySettings.value.autoDownload,
      profileVisibility: 'public',
      presenceVisibility: 'public',
      messageAutoDelete: {
        enabled: messageAutoDelete.value.enabled,
        deleteAfter: messageAutoDelete.value.deleteAfter
      }
    })
    window.$message.success(t('user_menu.privacy.settings_saved'))
  } catch (error) {
    console.error('Failed to save privacy settings:', error)
    window.$message.error(t('user_menu.privacy.settings_save_failed'))
  }
}

const createKeyBackup = async () => {
  try {
    const inputRef = ref<HTMLInputElement | null>(null)
    window.$dialog.create({
      title: t('user_menu.privacy.create_backup'),
      content: () =>
        h('input', {
          ref: inputRef,
          type: 'password',
          placeholder: t('user_menu.privacy.enter_password'),
          class: 'n-input w-full',
          style: 'margin-top: 8px;'
        }),
      positiveText: t('user_menu.privacy.create'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          const password = inputRef.value?.value || ''

          const recoveryKey = await keyBackupService.createBackup(password)

          if (!recoveryKey) {
            window.$message.error(t('user_menu.privacy.create_backup_failed'))
            return
          }

          window.$dialog.info({
            title: t('user_menu.privacy.recovery_key'),
            content: t('user_menu.privacy.recovery_key_content'),
            positiveText: t('user_menu.privacy.copy_key'),
            negativeText: t('common.close'),
            onPositiveClick: () => {
              navigator.clipboard.writeText(recoveryKey.key)
              window.$message.success(t('user_menu.privacy.key_copied'))
            }
          })

          hasBackup.value = true
        } catch (error) {
          console.error('Failed to create backup:', error)
          window.$message.error(t('user_menu.privacy.create_backup_failed'))
        }
      }
    })
  } catch (error) {
    console.error('Failed to create backup dialog:', error)
  }
}

const viewBackupKey = async () => {
  try {
    const backupInfo = await keyBackupService.getBackupInfo()

    if (!backupInfo) {
      window.$message.warning(t('user_menu.privacy.no_backup'))
      return
    }

    window.$dialog.info({
      title: t('user_menu.privacy.recovery_key'),
      content: t('user_menu.privacy.recovery_key_content'),
      positiveText: t('user_menu.privacy.copy_key'),
      negativeText: t('common.close')
    })
  } catch (error) {
    console.error('Failed to view backup key:', error)
  }
}

const deleteKeyBackup = async () => {
  window.$dialog.warning({
    title: t('user_menu.privacy.delete_backup'),
    content: t('user_menu.privacy.delete_backup_confirm'),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await keyBackupService.deleteBackup()
        hasBackup.value = false
        window.$message.success(t('user_menu.privacy.delete_success'))
      } catch (error) {
        console.error('Failed to delete backup:', error)
        window.$message.error(t('user_menu.privacy.delete_backup_failed'))
      }
    }
  })
}

const setupCrossSigning = async () => {
  try {
    const inputRef = ref<HTMLInputElement | null>(null)
    window.$dialog.create({
      title: t('user_menu.privacy.setup_cross_signing'),
      content: () =>
        h('input', {
          ref: inputRef,
          type: 'password',
          placeholder: t('user_menu.privacy.enter_password'),
          class: 'n-input w-full',
          style: 'margin-top: 8px;'
        }),
      positiveText: t('user_menu.privacy.setup'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          await crossSigningService.setupCrossSigning()
          crossSigningEnabled.value = true

          await loadCrossSigningStatus()
        } catch (error) {
          console.error('Failed to setup cross signing:', error)
          window.$message.error(t('user_menu.privacy.setup_failed'))
        }
      }
    })
  } catch (error) {
    console.error('Failed to setup cross signing dialog:', error)
  }
}

const verifyAllDevices = async () => {
  try {
    await crossSigningService.verifyAllDevices()
    await loadCrossSigningStatus()
    window.$message.success(t('user_menu.privacy.verify_success'))
  } catch (error) {
    console.error('Failed to verify all devices:', error)
    window.$message.error(t('user_menu.privacy.verify_failed'))
  }
}

onMounted(() => {
  loadPrivacySettings()
  loadKeyBackupStatus()
  loadCrossSigningStatus()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;
</style>
