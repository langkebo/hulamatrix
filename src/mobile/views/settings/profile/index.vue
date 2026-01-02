<template>
  <SettingsLayout :title="t('setting.profile.title')">
    <div class="profile-settings">
      <!-- Profile Info Card -->
      <div class="profile-card">
        <div class="profile-avatar">
          <img
            :src="userStore.userInfo.avatar || '/imgs/avatar.png'"
            :alt="userStore.userInfo.name"
            class="avatar-image" />
          <button class="avatar-edit-btn" @click="handleAvatarUpload">
            <Icon name="camera" :size="16" />
          </button>
        </div>
        <div class="profile-info">
          <div class="profile-name">{{ userStore.userInfo.name || t('setting.profile.no_name') }}</div>
          <div v-if="userStore.userInfo.uid" class="profile-mxid">{{ userStore.userInfo.uid }}</div>
        </div>
      </div>

      <!-- Display Name -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.profile.display_name') }}</div>
        <div class="settings-item">
          <n-input
            v-model:value="displayName"
            :placeholder="t('setting.profile.display_name_placeholder')"
            size="large"
            @blur="handleSaveDisplayName" />
        </div>
      </div>

      <!-- Bio -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.profile.bio') }}</div>
        <div class="settings-item">
          <n-input
            v-model:value="bio"
            type="textarea"
            :placeholder="t('setting.profile.bio_placeholder')"
            :autosize="{ minRows: 2, maxRows: 4 }"
            size="large"
            @blur="handleSaveBio" />
        </div>
      </div>

      <!-- Contact Info -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.profile.contact_info') }}</div>
        <div class="settings-list">
          <div class="settings-item" @click="handleAddEmail">
            <div class="item-content">
              <div class="item-label">{{ t('setting.general.profile.email') }}</div>
              <div class="item-value">{{ email || t('setting.general.profile.no_email') }}</div>
            </div>
            <Icon name="chevron-right" :size="16" />
          </div>
          <div class="settings-item" @click="handleAddPhone">
            <div class="item-content">
              <div class="item-label">{{ t('setting.general.profile.phone') }}</div>
              <div class="item-value">{{ phone || t('setting.general.profile.no_phone') }}</div>
            </div>
            <Icon name="chevron-right" :size="16" />
          </div>
        </div>
      </div>

      <!-- Account Security -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.general.profile.account_section') }}</div>
        <div class="settings-list">
          <div class="settings-item" @click="showPasswordDialog = true">
            <div class="item-content">
              <div class="item-label">{{ t('setting.general.profile.password_change_section') }}</div>
              <div class="item-description">{{ t('setting.profile.password_tip') }}</div>
            </div>
            <Icon name="chevron-right" :size="16" />
          </div>
        </div>
      </div>
    </div>

    <!-- Password Change Dialog -->
    <n-modal v-model:show="showPasswordDialog" preset="card" :title="t('setting.profile.change_password')" class="password-dialog">
      <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-placement="top">
        <n-form-item :label="t('setting.profile.current_password')" path="oldPassword">
          <n-input
            v-model:value="passwordForm.oldPassword"
            type="password"
            show-password-on="click"
            :placeholder="t('setting.profile.enter_current_password')" />
        </n-form-item>
        <n-form-item :label="t('setting.profile.new_password')" path="newPassword">
          <n-input
            v-model:value="passwordForm.newPassword"
            type="password"
            show-password-on="click"
            :placeholder="t('setting.profile.enter_new_password')" />
        </n-form-item>
        <n-form-item :label="t('setting.profile.confirm_password')" path="confirmPassword">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            show-password-on="click"
            :placeholder="t('setting.profile.confirm_new_password')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showPasswordDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handlePasswordChange" :loading="passwordChanging">
            {{ t('action.confirm') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput, NModal, NForm, NFormItem, NSpace, NButton, useMessage } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const message = useMessage()
const userStore = useUserStore()

// User info
const displayName = ref(userStore.userInfo.name || '')
const bio = ref(userStore.userInfo.resume || '')
const email = ref(userStore.userInfo.email || '')
const phone = ref('')

// Password change
const showPasswordDialog = ref(false)
const passwordChanging = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordFormRef = ref()

const passwordRules = {
  oldPassword: [{ required: true, message: t('setting.profile.enter_current_password'), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('setting.profile.enter_new_password'), trigger: 'blur' },
    { min: 8, message: t('setting.profile.password_too_short'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('setting.profile.confirm_new_password'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => {
        return value === passwordForm.value.newPassword
      },
      message: t('setting.profile.password_mismatch'),
      trigger: 'blur'
    }
  ]
}

// Methods
const handleAvatarUpload = () => {
  message.info(t('setting.profile.avatar_upload_coming_soon'))
}

const handleSaveDisplayName = async () => {
  if (displayName.value && displayName.value !== userStore.userInfo.name) {
    userStore.userInfo.name = displayName.value
    message.success(t('setting.profile.display_name_updated'))
  }
}

const handleSaveBio = () => {
  message.success(t('setting.profile.bio_saved'))
}

const handleAddEmail = () => {
  message.info(t('setting.profile.email_coming_soon'))
}

const handleAddPhone = () => {
  message.info(t('setting.profile.phone_coming_soon'))
}

const handlePasswordChange = async () => {
  try {
    await passwordFormRef.value?.validate()
    passwordChanging.value = true

    const client = matrixClientService.getClient()
    if (!client) {
      message.error(t('setting.profile.client_not_initialized'))
      return
    }

    const passwordChangeMethod = (
      client as unknown as {
        passwordChange?: (newPassword: string) => Promise<unknown>
      }
    ).passwordChange

    if (!passwordChangeMethod) {
      message.error(t('setting.profile.password_change_not_supported'))
      return
    }

    try {
      await passwordChangeMethod(passwordForm.value.newPassword)
      message.success(t('setting.profile.password_changed'))

      showPasswordDialog.value = false
      passwordForm.value = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
    } catch (sdkError) {
      const errorMessage = sdkError instanceof Error ? sdkError.message : String(sdkError)
      if (errorMessage.includes('User Interaction Required') || errorMessage.includes('UI auth')) {
        message.warning(t('setting.profile.password_auth_required'))
      } else if (errorMessage.includes('Invalid password') || errorMessage.includes('401')) {
        message.error(t('setting.profile.wrong_password'))
      } else {
        message.error(`${t('setting.profile.password_change_failed')}: ${errorMessage}`)
      }
    }
  } catch (error) {
    logger.debug('[Profile] Password form validation failed:', error)
  } finally {
    passwordChanging.value = false
  }
}
</script>

<style lang="scss" scoped>
.profile-settings {
  padding: 0;
}

.profile-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  position: relative;
  flex-shrink: 0;

  .avatar-image {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-edit-btn {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary-color);
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
  }
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  word-break: break-all;
}

.profile-mxid {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.settings-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 4px 8px;
}

.settings-item {
  background: white;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: #f5f5f5;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-label {
    font-size: 16px;
    color: #333;
    margin-bottom: 2px;
  }

  .item-description {
    font-size: 12px;
    color: #999;
  }

  .item-value {
    font-size: 14px;
    color: #666;
  }
}

.password-dialog {
  :deep(.n-card) {
    width: 90vw !important;
    max-width: 400px !important;
  }
}
</style>
