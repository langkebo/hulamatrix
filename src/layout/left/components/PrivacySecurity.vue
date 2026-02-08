<template>
  <n-tabs v-model:value="activeTab" type="line" animated>
    <n-tab-pane :name="'devices'" :tab="t('user_menu.privacy.devices')">
      <n-flex :size="16" vertical>
        <n-spin :show="loading">
          <n-flex :size="12" vertical>
            <div class="device-item">
              <n-flex align="center" justify="space-between" class="w-full">
                <n-flex align="center" :size="12">
                  <svg class="size-24px text-[--text-color]"><use href="#device-desktop"></use></svg>
                  <n-flex vertical :size="4">
                    <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.privacy.current_device') }}</span>
                    <span class="text-12px text-[--info-text-color]">{{ currentDeviceInfo }}</span>
                  </n-flex>
                </n-flex>
                <n-tag type="success" size="small">{{ t('user_menu.privacy.online') }}</n-tag>
              </n-flex>
            </div>
          </n-flex>
          <n-divider style="margin: 0" />
          <n-flex :size="12" vertical>
            <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.privacy.other_devices') }}</span>
            <div v-for="device in devices" :key="device.id" class="device-item">
              <n-flex align="center" justify="space-between" class="w-full">
                <n-flex align="center" :size="12">
                  <svg class="size-24px text-[--text-color]">
                    <use :href="device.type === 'mobile' ? '#device-mobile' : '#device-desktop'"></use>
                  </svg>
                  <n-flex vertical :size="4">
                    <span class="text-14px text-[--text-color]">{{ device.name }}</span>
                    <span class="text-12px text-[--info-text-color]">
                      {{ t('user_menu.privacy.last_active') }}: {{ device.lastActive }}
                    </span>
                  </n-flex>
                </n-flex>
                <n-flex :size="8">
                  <n-button size="small" text @click="handleRenameDevice(device)">
                    {{ t('user_menu.privacy.rename') }}
                  </n-button>
                  <n-button size="small" type="error" quaternary @click="handleLogoutDevice(device)">
                    {{ t('user_menu.privacy.logout') }}
                  </n-button>
                </n-flex>
              </n-flex>
            </div>
            <n-empty v-if="devices.length === 0" :description="t('user_menu.privacy.no_other_devices')" size="small" />
          </n-flex>
          <n-divider style="margin: 0" />
          <n-flex justify="center">
            <n-button type="primary" :disabled="devices.length === 0" @click="handleLogoutAllDevices">
              {{ t('user_menu.privacy.logout_all') }}
            </n-button>
          </n-flex>
        </n-spin>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'key_backup'" :tab="t('user_menu.privacy.key_backup')">
      <n-flex :size="20" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex align="center" :size="12">
            <svg class="size-24px text-[--primary-color]"><use href="#key"></use></svg>
            <n-flex vertical :size="4">
              <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.privacy.key_backup') }}</span>
              <span class="text-12px text-[--info-text-color]">{{ t('user_menu.privacy.key_backup_desc') }}</span>
            </n-flex>
          </n-flex>
          <n-switch v-model:value="keyBackupEnabled" />
        </n-flex>
        <template v-if="keyBackupEnabled">
          <n-divider style="margin: 0" />
          <n-alert type="info" :show-icon="false">
            {{ t('user_menu.privacy.key_backup_warning') }}
          </n-alert>
          <n-flex :size="12" vertical>
            <n-button type="primary" @click="createKeyBackup">
              {{ t('user_menu.privacy.create_backup') }}
            </n-button>
            <n-button v-if="hasBackup" @click="viewBackupKey">
              {{ t('user_menu.privacy.view_recovery_key') }}
            </n-button>
            <n-button type="warning" quaternary @click="deleteKeyBackup">
              {{ t('user_menu.privacy.delete_backup') }}
            </n-button>
          </n-flex>
        </template>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'cross_signing'" :tab="t('user_menu.privacy.cross_signing')">
      <n-flex :size="20" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex align="center" :size="12">
            <svg class="size-24px text-[--primary-color]"><use href="#shield"></use></svg>
            <n-flex vertical :size="4">
              <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.privacy.cross_signing') }}</span>
              <span class="text-12px text-[--info-text-color]">{{ t('user_menu.privacy.cross_signing_desc') }}</span>
            </n-flex>
          </n-flex>
          <n-tag :type="crossSigningEnabled ? 'success' : 'default'" size="small">
            {{ crossSigningEnabled ? t('user_menu.privacy.enabled') : t('user_menu.privacy.disabled') }}
          </n-tag>
        </n-flex>
        <template v-if="!crossSigningEnabled">
          <n-divider style="margin: 0" />
          <n-button type="primary" @click="setupCrossSigning">
            {{ t('user_menu.privacy.setup_cross_signing') }}
          </n-button>
        </template>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'encryption'" :tab="t('user_menu.privacy.encryption')">
      <n-flex :size="20" vertical>
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.encryption_enabled') }}</span>
          <n-tag type="success" size="small">{{ t('user_menu.privacy.active') }}</n-tag>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.verified_devices') }}</span>
          <span class="text-14px text-[--primary-color]">{{ verifiedDeviceCount }}</span>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.unverified_devices') }}</span>
          <n-button text type="warning" @click="showUnverifiedDevices = true">
            {{ unverifiedDeviceCount }}
          </n-button>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-button @click="verifyAllDevices">
          {{ t('user_menu.privacy.verify_all') }}
        </n-button>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'privacy'" :tab="t('user_menu.privacy.privacy_prefs')">
      <n-flex :size="16" vertical>
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.read_receipts') }}</span>
          <n-switch v-model:value="privacySettings.readReceipts" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.typing_indicator') }}</span>
          <n-switch v-model:value="privacySettings.typingIndicator" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.link_previews') }}</span>
          <n-switch v-model:value="privacySettings.linkPreviews" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.auto_download') }}</span>
          <n-switch v-model:value="privacySettings.autoDownload" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.privacy.message_auto_delete') }}</span>
          <n-switch v-model:value="messageAutoDelete.enabled" />
        </n-flex>
        <template v-if="messageAutoDelete.enabled">
          <n-flex :size="10" vertical class="ml-20px">
            <span class="text-12px text-[--info-text-color]">{{ t('user_menu.privacy.delete_after') }}</span>
            <n-select
              v-model:value="messageAutoDelete.deleteAfter"
              :options="deleteAfterOptions"
              size="small"
              style="width: 150px" />
          </n-flex>
        </template>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'login_history'" :tab="t('user_menu.privacy.login_history')">
      <n-flex :size="16" vertical>
        <n-flex justify="space-between">
          <n-button @click="loadLoginHistory">
            {{ t('user_menu.privacy.refresh') }}
          </n-button>
          <n-button @click="clearLoginHistory" type="error" ghost>
            {{ t('user_menu.privacy.clear_history') }}
          </n-button>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-spin :show="loadingLoginHistory">
          <n-empty v-if="loginHistory.length === 0" :description="t('user_menu.privacy.no_login_history')" />
          <n-list v-else bordered>
            <n-list-item v-for="entry in loginHistory" :key="entry.id">
              <n-thing>
                <template #header>
                  <n-flex align="center" justify="space-between">
                    <span class="font-medium">{{ entry.deviceName }}</span>
                    <n-tag size="small" :type="entry.deviceId === currentDeviceId ? 'success' : 'default'">
                      {{ entry.deviceId === currentDeviceId ? t('user_menu.privacy.current_device') : '' }}
                    </n-tag>
                  </n-flex>
                </template>
                <template #description>
                  <n-flex :size="8" vertical>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.platform') }}: {{ entry.platform }}
                    </span>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.ip_address') }}: {{ entry.ipAddress || t('user_menu.privacy.unknown') }}
                    </span>
                    <span class="text-12px text-gray-500">
                      {{ formatLoginTime(entry.timestamp) }}
                    </span>
                  </n-flex>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-spin>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'access_tokens'" :tab="t('user_menu.privacy.access_tokens')">
      <n-flex :size="16" vertical>
        <n-flex justify="space-between">
          <n-button @click="loadAccessTokens">
            {{ t('user_menu.privacy.refresh') }}
          </n-button>
          <n-button @click="clearExpiredTokens" type="warning" ghost>
            {{ t('user_menu.privacy.clear_expired') }}
          </n-button>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-spin :show="loadingTokens">
          <n-empty v-if="accessTokens.length === 0" :description="t('user_menu.privacy.no_tokens')" />
          <n-list v-else bordered>
            <n-list-item v-for="token in accessTokens" :key="token.id">
              <n-thing>
                <template #header>
                  <n-flex align="center" justify="space-between">
                    <span class="font-medium">{{ token.name }}</span>
                    <n-flex :size="8">
                      <n-tag v-if="isTokenExpired(token)" type="error" size="small">
                        {{ t('user_menu.privacy.expired') }}
                      </n-tag>
                      <n-button text size="small" type="error" @click="revokeToken(token.id)">
                        {{ t('user_menu.privacy.revoke') }}
                      </n-button>
                    </n-flex>
                  </n-flex>
                </template>
                <template #description>
                  <n-flex :size="8" vertical>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.created_at') }}: {{ formatTokenTime(token.createdAt) }}
                    </span>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.last_used') }}: {{ formatTokenTime(token.lastUsedAt) }}
                    </span>
                    <span v-if="token.expiresAt" class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.expires_at') }}: {{ formatTokenTime(token.expiresAt) }}
                    </span>
                  </n-flex>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-spin>
      </n-flex>
    </n-tab-pane>
    <n-tab-pane :name="'third_party_apps'" :tab="t('user_menu.privacy.third_party_apps')">
      <n-flex :size="16" vertical>
        <n-flex justify="space-between">
          <n-button @click="loadThirdPartyApps">
            {{ t('user_menu.privacy.refresh') }}
          </n-button>
          <n-button @click="showAddAppDialog = true" type="primary">
            {{ t('user_menu.privacy.add_app') }}
          </n-button>
        </n-flex>
        <n-divider style="margin: 0" />
        <n-spin :show="loadingApps">
          <n-empty v-if="thirdPartyApps.length === 0" :description="t('user_menu.privacy.no_apps')" />
          <n-list v-else bordered>
            <n-list-item v-for="app in thirdPartyApps" :key="app.id">
              <n-thing>
                <template #header>
                  <n-flex align="center" justify="space-between">
                    <n-flex align="center" :size="12">
                      <n-avatar :size="40" :src="app.icon" />
                      <n-flex :size="4" vertical>
                        <span class="font-medium">{{ app.name }}</span>
                        <span class="text-12px text-gray-500">{{ app.description }}</span>
                      </n-flex>
                    </n-flex>
                    <n-flex :size="8">
                      <n-switch v-model:value="app.enabled" @update:value="(val: boolean) => toggleApp(app.id, val)" />
                      <n-button text size="small" type="error" @click="revokeApp(app.id)">
                        {{ t('user_menu.privacy.revoke') }}
                      </n-button>
                    </n-flex>
                  </n-flex>
                </template>
                <template #description>
                  <n-flex :size="8" vertical>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.website') }}: <a :href="app.website" target="_blank">{{ app.website }}</a>
                    </span>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.permissions') }}: {{ app.permissions.join(', ') }}
                    </span>
                    <span class="text-12px text-gray-500">
                      {{ t('user_menu.privacy.last_used') }}: {{ formatAppTime(app.lastUsedAt) }}
                    </span>
                  </n-flex>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-spin>
      </n-flex>
    </n-tab-pane>
  </n-tabs>
  <n-modal v-model:show="showAddAppDialog" preset="card" :title="t('user_menu.privacy.add_third_party_app')" style="width: 500px">
    <n-form ref="addAppFormRef" :model="newApp" :rules="appFormRules" label-placement="left" label-width="100">
      <n-form-item :label="t('user_menu.privacy.app_name')" path="name">
        <n-input v-model:value="newApp.name" :placeholder="t('user_menu.privacy.enter_app_name')" />
      </n-form-item>
      <n-form-item :label="t('user_menu.privacy.app_description')" path="description">
        <n-input v-model:value="newApp.description" type="textarea" :placeholder="t('user_menu.privacy.enter_app_description')" />
      </n-form-item>
      <n-form-item :label="t('user_menu.privacy.app_icon')" path="icon">
        <n-input v-model:value="newApp.icon" :placeholder="t('user_menu.privacy.enter_app_icon_url')" />
      </n-form-item>
      <n-form-item :label="t('user_menu.privacy.app_website')" path="website">
        <n-input v-model:value="newApp.website" :placeholder="t('user_menu.privacy.enter_app_website')" />
      </n-form-item>
      <n-form-item :label="t('user_menu.privacy.app_permissions')" path="permissions">
        <n-checkbox-group v-model:value="newApp.permissions">
          <n-space vertical>
            <n-checkbox value="read_messages">{{ t('user_menu.privacy.read_messages') }}</n-checkbox>
            <n-checkbox value="send_messages">{{ t('user_menu.privacy.send_messages') }}</n-checkbox>
            <n-checkbox value="read_rooms">{{ t('user_menu.privacy.read_rooms') }}</n-checkbox>
            <n-checkbox value="manage_rooms">{{ t('user_menu.privacy.manage_rooms') }}</n-checkbox>
          </n-space>
        </n-checkbox-group>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showAddAppDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" @click="addApp">{{ t('common.add') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
  <n-tab-pane :name="'encryption'" :tab="t('user_menu.privacy.encryption')">
    <n-flex :size="16" vertical>
      <EncryptionStatusIndicator :show-text="true" @click="() => {}" />
      
      <KeyBackupPanel />
      
      <CrossSigningPanel />
      
      <DeviceVerificationPanel />
    </n-flex>
  </n-tab-pane>
  <n-tab-pane :name="'gdpr'" :tab="t('user_menu.privacy.gdpr')">
    <GDPRPanel />
  </n-tab-pane>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { h } from 'vue'
import MatrixClientService from '@/services/matrix/MatrixClientService'
import MatrixDeviceService from '@/services/matrix/MatrixDeviceService'
import MatrixSettingsService from '@/services/matrix/MatrixSettingsService'
import MatrixKeyBackupService from '@/services/matrix/MatrixKeyBackupService'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'
import KeyBackupPanel from '@/components/encryption/KeyBackupPanel.vue'
import CrossSigningPanel from '@/components/encryption/CrossSigningPanel.vue'
import DeviceVerificationPanel from '@/components/encryption/DeviceVerificationPanel.vue'
import EncryptionStatusIndicator from '@/components/encryption/EncryptionStatusIndicator.vue'
import GDPRPanel from '@/components/gdpr/GDPRPanel.vue'

const { t } = useI18n()

const activeTab = inject('activeTab') as any

const activeTabValue = ref('devices')
watch(
  () => activeTab.value,
  (val) => {
    if (val) activeTabValue.value = val
  }
)

const deviceService = MatrixDeviceService.getInstance()
const settingsService = MatrixSettingsService.getInstance()
const keyBackupService = MatrixKeyBackupService.getInstance()
const crossSigningService = MatrixCrossSigningService.getInstance()

const loading = ref(false)
const currentDeviceInfo = ref('')
const devices = ref<any[]>([])
const keyBackupEnabled = ref(false)
const hasBackup = ref(false)
const crossSigningEnabled = ref(true)
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

const loadingLoginHistory = ref(false)
const loginHistory = ref<any[]>([])
const currentDeviceId = ref('')

const loadingTokens = ref(false)
const accessTokens = ref<any[]>([])

const loadingApps = ref(false)
const thirdPartyApps = ref<any[]>([])
const showAddAppDialog = ref(false)
const addAppFormRef = ref()
const newApp = ref({
  name: '',
  description: '',
  icon: '',
  website: '',
  permissions: []
})

const appFormRules = {
  name: { required: true, message: t('user_menu.privacy.app_name_required'), trigger: 'blur' },
  description: { required: true, message: t('user_menu.privacy.app_description_required'), trigger: 'blur' },
  website: { required: true, message: t('user_menu.privacy.app_website_required'), trigger: 'blur' }
}

const loadDevices = async () => {
  try {
    loading.value = true
    const deviceList = await deviceService.getDeviceDisplayInfo()
    const currentDevice = await deviceService.getCurrentDevice()

    if (currentDevice) {
      const platform = navigator.platform
      const userAgent = navigator.userAgent
      currentDeviceInfo.value = `${platform} | ${userAgent.slice(0, 50)}...`
    }

    devices.value = deviceList.filter((d) => !d.isCurrentDevice)

    const allDevices = await deviceService.getDeviceList()
    verifiedDeviceCount.value = allDevices.devices.filter((d) => d.isVerified).length
    unverifiedDeviceCount.value = allDevices.devices.filter((d) => !d.isVerified).length
  } catch (error) {
    console.error('Failed to load devices:', error)
    window.$message.error(t('user_menu.privacy.load_devices_failed'))
  } finally {
    loading.value = false
  }
}

const loadPrivacySettings = async () => {
  try {
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
  }
}

const loadKeyBackupStatus = async () => {
  try {
    const status = await keyBackupService.getBackupStatus()
    keyBackupEnabled.value = status.enabled
    hasBackup.value = status.enabled
  } catch (error) {
    console.error('Failed to load key backup status:', error)
  }
}

const loadCrossSigningStatus = async () => {
  try {
    const status = await crossSigningService.getCrossSigningStatus()
    crossSigningEnabled.value = status?.enabled === true
  } catch (error) {
    console.error('Failed to load cross signing status:', error)
  }
}

const handleLogoutDevice = async (device: any) => {
  window.$dialog.warning({
    title: t('user_menu.privacy.logout_device'),
    content: t('user_menu.privacy.logout_device_confirm', { name: device.name }),
    positiveText: t('user_menu.privacy.logout'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deviceService.deleteDevice(device.id)
        devices.value = devices.value.filter((d) => d.id !== device.id)
        window.$message.success(t('user_menu.privacy.logout_success'))
      } catch (error) {
        console.error('Failed to logout device:', error)
        window.$message.error(t('user_menu.privacy.logout_failed'))
      }
    }
  })
}

const handleRenameDevice = async (device: any) => {
  const inputRef = ref<HTMLInputElement | null>(null)
  window.$dialog.create({
    title: t('user_menu.privacy.rename_device'),
    content: () =>
      h('input', {
        ref: inputRef,
        type: 'text',
        placeholder: t('user_menu.privacy.enter_device_name'),
        value: device.name,
        class: 'n-input w-full',
        style: 'margin-top: 8px;'
      }),
    positiveText: t('common.save'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const newName = inputRef.value?.value || ''
        if (!newName.trim()) {
          window.$message.warning(t('user_menu.privacy.device_name_required'))
          return false
        }

        const success = await deviceService.renameDevice(device.id, newName)
        if (success) {
          device.name = newName
          window.$message.success(t('user_menu.privacy.rename_success'))
        } else {
          window.$message.error(t('user_menu.privacy.rename_failed'))
        }
      } catch (error) {
        console.error('Failed to rename device:', error)
        window.$message.error(t('user_menu.privacy.rename_failed'))
      }
    }
  })
}

const handleLogoutAllDevices = async () => {
  window.$dialog.warning({
    title: t('user_menu.privacy.logout_all'),
    content: t('user_menu.privacy.logout_all_confirm'),
    positiveText: t('user_menu.privacy.logout'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deviceService.deleteAllOtherDevices()
        devices.value = []
        window.$message.success(t('user_menu.privacy.logout_success'))
      } catch (error) {
        console.error('Failed to logout all devices:', error)
        window.$message.error(t('user_menu.privacy.logout_failed'))
      }
    }
  })
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

          await loadDevices()
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
    await loadDevices()
    window.$message.success(t('user_menu.privacy.verify_success'))
  } catch (error) {
    console.error('Failed to verify all devices:', error)
    window.$message.error(t('user_menu.privacy.verify_failed'))
  }
}

watch(
  privacySettings,
  async (settings) => {
    try {
      await settingsService.setPrivacySettings({
        readReceipts: settings.readReceipts,
        typingIndicator: settings.typingIndicator,
        linkPreviews: settings.linkPreviews,
        autoDownload: settings.autoDownload,
        profileVisibility: 'public',
        presenceVisibility: 'public',
        messageAutoDelete: {
          enabled: messageAutoDelete.value.enabled,
          deleteAfter: messageAutoDelete.value.deleteAfter
        }
      })
    } catch (error) {
      console.error('Failed to save privacy settings:', error)
    }
  },
  { deep: true }
)

watch(
  messageAutoDelete,
  async (settings) => {
    try {
      await settingsService.setPrivacySettings({
        readReceipts: privacySettings.value.readReceipts,
        typingIndicator: privacySettings.value.typingIndicator,
        linkPreviews: privacySettings.value.linkPreviews,
        autoDownload: privacySettings.value.autoDownload,
        profileVisibility: 'public',
        presenceVisibility: 'public',
        messageAutoDelete: {
          enabled: settings.enabled,
          deleteAfter: settings.deleteAfter
        }
      })
    } catch (error) {
      console.error('Failed to save message auto delete settings:', error)
    }
  },
  { deep: true }
)

const loadLoginHistory = async () => {
  try {
    loadingLoginHistory.value = true
    loginHistory.value = settingsService.getLoginHistory()

    const client = MatrixClientService.getInstance().getClient()
    if (client) {
      currentDeviceId.value = client.getDeviceId() || ''
    }
  } catch (error) {
    console.error('Failed to load login history:', error)
  } finally {
    loadingLoginHistory.value = false
  }
}

const clearLoginHistory = () => {
  window.$dialog.warning({
    title: t('user_menu.privacy.clear_login_history'),
    content: t('user_menu.privacy.clear_login_history_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      settingsService.clearLoginHistory()
      loginHistory.value = []
      window.$message.success(t('user_menu.privacy.login_history_cleared'))
    }
  })
}

const formatLoginTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return t('user_menu.privacy.just_now')
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('user_menu.privacy.minutes_ago', { minutes })
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('user_menu.privacy.hours_ago', { hours })
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('user_menu.privacy.days_ago', { days })
  } else {
    return date.toLocaleDateString()
  }
}

const loadAccessTokens = async () => {
  try {
    loadingTokens.value = true
    accessTokens.value = settingsService.getAccessTokens()
  } catch (error) {
    console.error('Failed to load access tokens:', error)
  } finally {
    loadingTokens.value = false
  }
}

const revokeToken = (tokenId: string) => {
  window.$dialog.warning({
    title: t('user_menu.privacy.revoke_token'),
    content: t('user_menu.privacy.revoke_token_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      const success = settingsService.revokeAccessToken(tokenId)
      if (success) {
        accessTokens.value = accessTokens.value.filter((t) => t.id !== tokenId)
        window.$message.success(t('user_menu.privacy.token_revoked'))
      } else {
        window.$message.error(t('user_menu.privacy.revoke_failed'))
      }
    }
  })
}

const clearExpiredTokens = () => {
  window.$dialog.warning({
    title: t('user_menu.privacy.clear_expired_tokens'),
    content: t('user_menu.privacy.clear_expired_tokens_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      settingsService.clearExpiredTokens()
      loadAccessTokens()
      window.$message.success(t('user_menu.privacy.expired_tokens_cleared'))
    }
  })
}

const isTokenExpired = (token: any) => {
  if (!token.expiresAt) return false
  return Date.now() > token.expiresAt
}

const formatTokenTime = (timestamp: number) => {
  if (!timestamp) return t('user_menu.privacy.never')

  const date = new Date(timestamp)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) {
    return t('user_menu.privacy.expired')
  } else if (diff < 60000) {
    return t('user_menu.privacy.in_1h')
  } else if (diff < 3600000) {
    const hours = Math.floor(diff / 3600000)
    return t('user_menu.privacy.in_xh', { hours })
  } else if (diff < 86400000) {
    const days = Math.floor(diff / 86400000)
    return t('user_menu.privacy.in_xd', { days })
  } else {
    return date.toLocaleDateString()
  }
}

const loadThirdPartyApps = async () => {
  try {
    loadingApps.value = true
    thirdPartyApps.value = settingsService.getThirdPartyApps()
  } catch (error) {
    console.error('Failed to load third party apps:', error)
  } finally {
    loadingApps.value = false
  }
}

const addApp = () => {
  addAppFormRef.value?.validate((errors: any) => {
    if (!errors) {
      settingsService.addThirdPartyApp({
        name: newApp.value.name,
        description: newApp.value.description,
        icon: newApp.value.icon,
        website: newApp.value.website,
        permissions: newApp.value.permissions,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        enabled: true
      })
      loadThirdPartyApps()
      showAddAppDialog.value = false
      newApp.value = {
        name: '',
        description: '',
        icon: '',
        website: '',
        permissions: []
      }
      window.$message.success(t('user_menu.privacy.app_added'))
    }
  })
}

const revokeApp = (appId: string) => {
  window.$dialog.warning({
    title: t('user_menu.privacy.revoke_app'),
    content: t('user_menu.privacy.revoke_app_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      const success = settingsService.revokeThirdPartyApp(appId)
      if (success) {
        thirdPartyApps.value = thirdPartyApps.value.filter((a) => a.id !== appId)
        window.$message.success(t('user_menu.privacy.app_revoked'))
      } else {
        window.$message.error(t('user_menu.privacy.revoke_failed'))
      }
    }
  })
}

const toggleApp = (appId: string, enabled: boolean) => {
  const success = settingsService.updateThirdPartyApp(appId, { enabled })
  if (!success) {
    window.$message.error(t('user_menu.privacy.update_failed'))
  }
}

const formatAppTime = (timestamp: number) => {
  if (!timestamp) return t('user_menu.privacy.never')

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return t('user_menu.privacy.just_now')
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('user_menu.privacy.minutes_ago', { minutes })
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('user_menu.privacy.hours_ago', { hours })
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('user_menu.privacy.days_ago', { days })
  } else {
    return date.toLocaleDateString()
  }
}

onMounted(() => {
  loadDevices()
  loadPrivacySettings()
  loadKeyBackupStatus()
  loadCrossSigningStatus()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;

.device-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-menu-hover);
}
</style>
