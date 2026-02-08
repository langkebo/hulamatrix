<template>
  <n-flex :size="16" vertical>
    <n-flex align="center" justify="center" vertical :size="16">
      <div class="avatar-container">
        <n-avatar
          :size="80"
          :src="avatarSrc"
          round
          :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          class="cursor-pointer"
          @click="handleAvatarClick" />
        <n-button
          v-if="!isEditingAvatar"
          circle
          size="small"
          type="primary"
          class="avatar-edit-btn"
          @click="handleAvatarClick">
          <svg class="size-16px"><use href="#camera"></use></svg>
        </n-button>
        <input
          v-if="isEditingAvatar"
          ref="avatarInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleAvatarChange" />
      </div>
      <n-flex align="center" vertical :size="8">
        <n-flex v-if="!isEditingName" align="center" :size="8">
          <span class="text-20px font-bold text-[--text-color]">{{ displayName }}</span>
          <n-button text size="small" @click="isEditingName = true">
            <svg class="size-14px"><use href="#edit"></use></svg>
          </n-button>
        </n-flex>
        <n-input
          v-else
          v-model:value="editingName"
          size="small"
          style="width: 200px"
          @blur="saveName"
          @keyup.enter="saveName" />
        <n-flex align="center" :size="8">
          <img :src="statusIcon" alt="" class="rounded-50% size-14px" />
          <span class="text-14px text-[--info-text-color]">{{ statusTitle }}</span>
          <n-button text size="small" @click="showStatusMenu = true">
            <svg class="size-14px"><use href="#down"></use></svg>
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>
    <n-divider style="margin: 0" />
    <n-flex :size="12" vertical>
      <n-flex align="center" justify="space-between">
        <span class="text-14px text-[--info-text-color]">{{ t('user_menu.profile.user_id') }}</span>
        <n-flex align="center" :size="8">
          <span class="text-14px text-[--text-color]">{{ userId }}</span>
          <n-button text size="small" @click="copyUserId">
            <svg class="size-14px"><use href="#copy"></use></svg>
          </n-button>
        </n-flex>
      </n-flex>
      <n-flex align="center" justify="space-between">
        <span class="text-14px text-[--info-text-color]">{{ t('user_menu.profile.status_message') }}</span>
        <n-flex v-if="!isEditingStatus" align="center" :size="8">
          <span class="text-14px text-[--text-color]">{{ statusMessage || t('user_menu.profile.no_status') }}</span>
          <n-button text size="small" @click="isEditingStatus = true">
            <svg class="size-14px"><use href="#edit"></use></svg>
          </n-button>
        </n-flex>
        <n-input
          v-else
          v-model:value="editingStatus"
          size="small"
          :placeholder="t('user_menu.profile.status_placeholder')"
          style="width: 200px"
          @blur="saveStatus"
          @keyup.enter="saveStatus" />
      </n-flex>
      <n-flex align="center" justify="space-between">
        <span class="text-14px text-[--info-text-color]">{{ t('user_menu.profile.device_id') }}</span>
        <span class="text-14px text-[--text-color]">{{ deviceId }}</span>
      </n-flex>
    </n-flex>
    <n-divider style="margin: 0" />
    <n-flex :size="12" vertical>
      <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.profile.online_status') }}</span>
      <n-flex :size="8" vertical>
        <n-flex
          v-for="status in statusOptions"
          :key="status.value"
          align="center"
          :size="8"
          class="status-option"
          :class="{ 'status-option-active': isStatusActive(status.value) }"
          @click="handleStatusChange(status.value)">
          <img :src="status.icon" alt="" class="rounded-50% size-14px" />
          <span class="text-14px text-[--text-color]">{{ t(status.labelKey) }}</span>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OnlineEnum, ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const { t } = useI18n()
const settingStore = useSettingStore()
const userStore = useUserStore()
const { themes } = storeToRefs(settingStore)
const { statusIcon, statusTitle, activeStatus } = useOnlineStatus()

const avatarInput = ref<HTMLInputElement | null>(null)
const isEditingAvatar = ref(false)
const isEditingName = ref(false)
const isEditingStatus = ref(false)
const editingName = ref('')
const editingStatus = ref('')
const showStatusMenu = ref(false)

const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar as string))
const displayName = computed(() => userStore.userInfo?.name || '')
const userId = computed(() => userStore.userInfo?.userId || '')
const statusMessage = computed(() => userStore.userInfo?.statusMessage || '')
const deviceId = computed(() => {
  const client = MatrixClientService.getInstance().getClient()
  return client?.getDeviceId() || ''
})

const statusOptions = [
  {
    value: 'online',
    labelKey: 'user_menu.profile.status_online',
    icon: '/icons/status-online.svg'
  },
  {
    value: 'unavailable',
    labelKey: 'user_menu.profile.status_unavailable',
    icon: '/icons/status-unavailable.svg'
  },
  {
    value: 'offline',
    labelKey: 'user_menu.profile.status_offline',
    icon: '/icons/status-offline.svg'
  }
]

const isStatusActive = computed(() => (statusValue: string) => {
  if (activeStatus.value === OnlineEnum.ONLINE && statusValue === 'online') return true
  if (activeStatus.value === OnlineEnum.OFFLINE && statusValue === 'offline') return true
  if (activeStatus.value === OnlineEnum.UNAVAILABLE && statusValue === 'unavailable') return true
  return false
})

const handleAvatarClick = () => {
  isEditingAvatar.value = true
  nextTick(() => {
    avatarInput.value?.click()
  })
}

const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    try {
      const client = MatrixClientService.getInstance().getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        const avatarUrl = e.target?.result as string
        await client.setAvatarUrl(avatarUrl)
        window.$message.success(t('user_menu.profile.avatar_updated'))
        isEditingAvatar.value = false
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to update avatar:', error)
      window.$message.error(t('user_menu.profile.avatar_update_failed'))
    }
  }

  isEditingAvatar.value = false
}

const saveName = async () => {
  if (editingName.value && editingName.value !== displayName.value) {
    try {
      const client = MatrixClientService.getInstance().getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setDisplayName(editingName.value)
      window.$message.success(t('user_menu.profile.name_updated'))
    } catch (error) {
      console.error('Failed to update name:', error)
      window.$message.error(t('user_menu.profile.name_update_failed'))
    }
  }
  isEditingName.value = false
}

const saveStatus = async () => {
  if (editingStatus.value !== statusMessage.value) {
    try {
      const client = MatrixClientService.getInstance().getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await (client.setAccountData as any)('m.status', {
        status: editingStatus.value
      })
      window.$message.success(t('user_menu.profile.status_updated'))
    } catch (error) {
      console.error('Failed to update status:', error)
      window.$message.error(t('user_menu.profile.status_update_failed'))
    }
  }
  isEditingStatus.value = false
}

const copyUserId = () => {
  navigator.clipboard.writeText(userId.value)
  window.$message.success(t('user_menu.profile.copied'))
}

const handleStatusChange = async (status: string) => {
  try {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await client.setPresence({
      presence: status as 'online' | 'offline' | 'unavailable',
      status_msg: statusMessage.value
    })
    window.$message.success(t('user_menu.profile.status_updated'))
  } catch (error) {
    console.error('Failed to update status:', error)
    window.$message.error(t('user_menu.profile.status_update_failed'))
  }
}

watch(isEditingName, (val) => {
  if (val) {
    editingName.value = displayName.value
  }
})

watch(isEditingStatus, (val) => {
  if (val) {
    editingStatus.value = statusMessage.value
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;

.avatar-container {
  position: relative;
  display: inline-block;
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  background: var(--primary-color);
  border: 2px solid var(--left-bg-color);
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-menu-hover);
  }

  &.status-option-active {
    background: var(--bg-menu-hover);
    color: var(--primary-color);
  }
}
</style>
