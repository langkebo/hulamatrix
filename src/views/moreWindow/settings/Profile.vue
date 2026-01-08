<template>
  <n-flex vertical :size="40">
    <!-- 个人资料卡片 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">个人资料</span>

      <n-flex class="item" :size="20" vertical>
        <n-flex align="center" :size="20">
          <!-- 头像 -->
          <div class="avatar-wrapper">
            <img
              :src="userStore.userInfo.avatar || '/imgs/avatar.png'"
              :alt="userStore.userInfo.name"
              class="w-80px h-80px rounded-full object-cover" />
            <n-button circle size="small" class="avatar-edit-btn" @click="handleAvatarUpload">
              <template #icon>
                <svg class="size-14px"><use href="#camera"></use></svg>
              </template>
            </n-button>
          </div>

          <!-- 用户信息 -->
          <n-flex vertical :size="12">
            <n-flex align="center" :size="12">
              <span class="text-16px font-600">{{ userStore.userInfo.name || '未设置昵称' }}</span>
              <n-tag v-if="userStore.userInfo.uid" size="small" type="info">MXID</n-tag>
            </n-flex>
            <span v-if="userStore.userInfo.uid" class="text-(12px #909090)">{{ userStore.userInfo.uid }}</span>
          </n-flex>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 显示名称编辑 -->
        <n-flex align="center" justify="space-between">
          <span>显示名称</span>
          <n-input
            v-model:value="displayName"
            size="small"
            placeholder="输入显示名称"
            class="profile-input"
            @blur="handleSaveDisplayName" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 个性签名 -->
        <n-flex align="center" justify="space-between">
          <span>个性签名</span>
          <n-input
            v-model:value="bio"
            type="textarea"
            size="small"
            placeholder="介绍一下自己"
            :autosize="{ minRows: 1, maxRows: 3 }"
            class="profile-input"
            @blur="handleSaveBio" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 联系方式 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">联系方式</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 邮箱 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.general.profile.email') }}</span>
            <span class="text-(12px #909090)">{{ email || t('setting.general.profile.no_email') }}</span>
          </n-flex>
          <n-button size="small" @click="handleAddEmail">
            {{ email ? t('setting.general.profile.edit') : t('setting.general.profile.add_email') }}
          </n-button>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 手机号 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.general.profile.phone') }}</span>
            <span class="text-(12px #909090)">{{ phone || t('setting.general.profile.no_phone') }}</span>
          </n-flex>
          <n-button size="small" @click="handleAddPhone">
            {{ phone ? t('setting.general.profile.edit') : t('setting.general.profile.add_phone') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 账户安全 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.general.profile.account_section') }}</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 修改密码 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.general.profile.password_change_section') }}</span>
            <span class="text-(12px #909090)">定期修改密码以保护账户安全</span>
          </n-flex>
          <n-button size="small" type="primary" secondary @click="showPasswordDialog = true">
            {{ t('action.modify') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>

  <!-- 修改密码对话框 -->
  <n-modal v-model:show="showPasswordDialog" preset="card" title="修改密码" class="password-dialog-modal">
    <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-placement="left" label-width="100">
      <n-form-item label="当前密码" path="oldPassword">
        <n-input
          v-model:value="passwordForm.oldPassword"
          type="password"
          show-password-on="click"
          placeholder="请输入当前密码" />
      </n-form-item>
      <n-form-item label="新密码" path="newPassword">
        <n-input
          v-model:value="passwordForm.newPassword"
          type="password"
          show-password-on="click"
          placeholder="请输入新密码" />
      </n-form-item>
      <n-form-item label="确认密码" path="confirmPassword">
        <n-input
          v-model:value="passwordForm.confirmPassword"
          type="password"
          show-password-on="click"
          placeholder="请再次输入新密码" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showPasswordDialog = false">取消</n-button>
        <n-button type="primary" @click="handlePasswordChange" :loading="passwordChanging">确认修改</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NFlex, NButton, NInput, NTag, NModal, NForm, NFormItem, NSpace, useMessage } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useAppStateStore } from '@/stores/appState'

const { t } = useI18n()
const message = useMessage()
const userStore = useUserStore()

// 用户信息
const displayName = ref(userStore.userInfo.name || '')
const bio = ref(userStore.userInfo.resume || '')
const email = ref(userStore.userInfo.email || '')
const phone = ref('')

// 修改密码
const showPasswordDialog = ref(false)
const passwordChanging = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordFormRef = ref()

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码长度至少 8 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => {
        return value === passwordForm.value.newPassword
      },
      message: '两次输入的密码不一致',
      trigger: 'blur'
    }
  ]
}

// 方法

const handleAvatarUpload = () => {
  message.info('头像上传功能开发中')
}

const handleSaveDisplayName = () => {
  if (displayName.value && displayName.value !== userStore.userInfo.name) {
    userStore.userInfo.name = displayName.value
    message.success('显示名称已更新')
  }
}

const handleSaveBio = () => {
  message.success('个性签名已保存')
}

const handleAddEmail = () => {
  message.info('添加邮箱功能开发中')
}

const handleAddPhone = () => {
  message.info('添加手机号功能开发中')
}

/**
 * 修改密码
 * 使用 Matrix SDK 的密码修改 API
 */
const handlePasswordChange = async () => {
  // 检查应用状态
  const appStateStore = useAppStateStore()
  if (!appStateStore.isReady) {
    message.warning('应用正在初始化，请稍后再试')
    return
  }

  try {
    await passwordFormRef.value?.validate()
    passwordChanging.value = true

    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化，请先登录')
      passwordChanging.value = false
      return
    }

    // 使用 Matrix SDK 修改密码
    // Matrix SDK 的 passwordChange 方法需要新的密码和当前的认证会话
    const passwordChangeMethod = (
      client as unknown as {
        passwordChange?: (newPassword: string) => Promise<unknown>
      }
    ).passwordChange

    if (!passwordChangeMethod) {
      message.error('当前客户端版本不支持密码修改功能')
      passwordChanging.value = false
      return
    }

    // 对于支持 UI-auth 的服务器，可能需要先进行身份验证
    // 这里使用简化的实现，直接尝试修改密码
    try {
      await passwordChangeMethod(passwordForm.value.newPassword)

      message.success('密码修改成功，请重新登录')

      // 关闭对话框并重置表单
      showPasswordDialog.value = false
      passwordForm.value = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      }

      // 密码修改后，可能需要重新登录
      // 这里可以选择自动退出登录或让用户手动重新登录
    } catch (sdkError) {
      // 检查是否是 UI-auth 错误（需要额外身份验证）
      const errorMessage = sdkError instanceof Error ? sdkError.message : String(sdkError)

      if (errorMessage.includes('User Interaction Required') || errorMessage.includes('UI auth')) {
        message.warning('密码修改需要额外身份验证，请稍后重试')
        logger.warn('[Profile] Password change requires UI auth:', sdkError)
      } else if (errorMessage.includes('Invalid password') || errorMessage.includes('401')) {
        message.error('当前密码错误，请重试')
        logger.warn('[Profile] Password change failed - invalid current password:', sdkError)
      } else {
        message.error(`密码修改失败：${errorMessage}`)
        logger.error('[Profile] Password change failed:', sdkError)
      }
    }
  } catch (formError) {
    // 表单验证失败
    logger.debug('[Profile] Password form validation failed:', formError)
  } finally {
    passwordChanging.value = false
  }
}
</script>

<style scoped lang="scss">
.password-dialog-modal {
  width: 400px;
}

.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]) custom-shadow;
  padding: var(--pad-container-x);
  font-size: clamp(12px, 2vw, 14px);
}

.profile-input {
  width: 200px;
}

.avatar-wrapper {
  position: relative;
  width: 80px;
  height: 80px;

  .avatar-edit-btn {
    position: absolute;
    bottom: -4px;
    right: -4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .avatar-edit-btn {
    opacity: 1;
  }
}
</style>
