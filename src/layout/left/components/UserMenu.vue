<template>
  <div class="user-menu-container">
    <n-popover
      v-model:show="menuVisible"
      :placement="shrinkStatus ? 'bottom-start' : 'right-start'"
      :show-arrow="false"
      trigger="click"
      :width="340">
      <template #trigger>
        <div class="user-avatar-wrapper relative size-34px rounded-50% cursor-pointer">
          <n-avatar
            :size="34"
            :src="avatarSrc"
            :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            round />
          <div
            class="bg-[--left-bg-color] text-10px rounded-50% size-12px absolute bottom--2px right--2px border-(2px solid [--left-bg-color])"
            @click.stop="openStatusPanel">
            <img :src="statusIcon" alt="" class="rounded-50% size-full" />
          </div>
        </div>
      </template>
      <div class="user-menu-content">
        <n-flex :size="20" vertical>
          <n-flex align="center" justify="space-between">
            <n-flex align="center" :size="12">
              <n-avatar
                :size="48"
                :src="avatarSrc"
                round
                :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                class="cursor-pointer"
                @click="activeTab = 'profile'" />
              <n-flex vertical :size="4">
                <span class="text-16px font-bold text-[--text-color]">{{ userStore.userInfo?.name }}</span>
                <n-flex align="center" :size="4">
                  <img :src="statusIcon" alt="" class="rounded-50% size-14px" />
                  <span class="text-12px text-[--info-text-color]">{{ statusTitle }}</span>
                </n-flex>
              </n-flex>
            </n-flex>
            <svg class="size-18px cursor-pointer text-[--text-color]" @click="activeTab = 'settings'">
              <use href="#settings"></use>
            </svg>
          </n-flex>
          <n-divider style="margin: 0" />
          <n-flex :size="4" vertical>
            <div
              v-for="item in menuItems"
              :key="item.key"
              class="menu-item"
              :class="{ 'menu-item-active': activeTab === item.key }"
              @click="handleMenuClick(item)">
              <svg class="size-18px"><use :href="`#${item.icon}`"></use></svg>
              <span class="flex-1 text-14px">{{ t(item.labelKey) }}</span>
              <svg v-if="item.badge" class="size-16px text-[--warn-color]"><use href="#bell"></use></svg>
              <svg v-if="item.children" class="size-14px text-[--text-color]"><use href="#right"></use></svg>
            </div>
          </n-flex>
          <n-divider style="margin: 0" />
          <div class="menu-item danger" @click="handleLogout">
            <svg class="size-18px"><use href="#logout"></use></svg>
            <span class="text-14px">{{ t('user_menu.sign_out') }}</span>
          </div>
          <div class="menu-item danger-logout-all" @click="handleLogoutAll">
            <svg class="size-18px"><use href="#logout-all"></use></svg>
            <span class="text-14px">{{ t('user_menu.sign_out_all') }}</span>
          </div>
        </n-flex>
      </div>
    </n-popover>
    <n-modal
      v-model:show="showNotificationSettings"
      preset="card"
      :title="t('user_menu.notifications.title')"
      style="width: 480px">
      <NotificationSettings />
    </n-modal>
    <n-modal v-model:show="showPrivacySecurity" preset="card" :title="t('user_menu.privacy_security')" style="width: 600px">
      <PrivacySecurity />
    </n-modal>
    <n-modal v-model:show="showSettings" preset="card" :title="t('user_menu.settings.title')" style="width: 700px">
      <SettingsPanel @close="showSettings = false" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useLogin } from '@/hooks/useLogin'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { leftHook } from '../hook'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import MatrixAuthService from '@/services/matrix/MatrixAuthService'
import NotificationSettings from './NotificationSettings.vue'
import PrivacySecurity from './PrivacySecurity.vue'
import SettingsPanel from './SettingsPanel.vue'

const { t } = useI18n()
const userStore = useUserStore()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const { shrinkStatus } = leftHook()
const { logout } = useLogin()
const { statusIcon, statusTitle } = useOnlineStatus()

const menuVisible = ref(false)
const activeTab = ref('profile')
const showNotificationSettings = ref(false)
const showPrivacySecurity = ref(false)
const showSettings = ref(false)

const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar as string))

interface MenuItem {
  key: string
  labelKey: string
  icon: string
  badge?: boolean
  children?: MenuItem[]
}

const menuItems = computed<MenuItem[]>(() => [
  { key: 'profile', labelKey: 'user_menu.profile', icon: 'user' },
  {
    key: 'notifications',
    labelKey: 'user_menu.notifications.title',
    icon: 'bell',
    badge: unreadNotificationCount.value > 0
  },
  { key: 'privacy_security', labelKey: 'user_menu.privacy_security', icon: 'security' },
  { key: 'devices', labelKey: 'user_menu.devices', icon: 'device' },
  { key: 'settings', labelKey: 'user_menu.settings.title', icon: 'settings' }
])

const unreadNotificationCount = ref(0)

const handleMenuClick = (item: MenuItem) => {
  if (item.children) {
    activeTab.value = item.children[0].key
  } else {
    switch (item.key) {
      case 'profile':
        activeTab.value = 'profile'
        break
      case 'notifications':
        showNotificationSettings.value = true
        break
      case 'privacy_security':
        showPrivacySecurity.value = true
        break
      case 'devices':
        showPrivacySecurity.value = true
        activeTab.value = 'devices'
        break
      case 'settings':
        showSettings.value = true
        break
    }
  }
}

const openStatusPanel = () => {
  activeTab.value = 'profile'
}

const handleLogout = async () => {
  window.$dialog.warning({
    title: t('user_menu.sign_out'),
    content: t('user_menu.sign_out_confirm'),
    positiveText: t('user_menu.sign_out'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await logout()
        window.$message.success(t('user_menu.sign_out_success'))
      } catch (error) {
        console.error('Logout failed:', error)
        window.$message.error(t('user_menu.sign_out_failed'))
      }
    }
  })
}

const handleLogoutAll = async () => {
  window.$dialog.error({
    title: t('user_menu.sign_out_all'),
    content: t('user_menu.sign_out_all_confirm'),
    positiveText: t('user_menu.sign_out_all'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const authService = MatrixAuthService.getInstance()
        await authService.logoutAll()
        await logout()
        window.$message.success(t('user_menu.sign_out_all_success'))
      } catch (error) {
        console.error('Logout all failed:', error)
        window.$message.error(t('user_menu.sign_out_all_failed'))
      }
    }
  })
}

provide('activeTab', activeTab)
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;

.user-menu-content {
  padding: 8px;
}

.menu-item {
  @apply flex items-center gap-10px px-12px py-8px rounded-8px cursor-pointer select-none;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-menu-hover);
  }

  &.danger {
    color: #d03050;

    &:hover {
      background: rgba(208, 48, 80, 0.1);
    }
  }

  &.danger-logout-all {
    color: #f56c6c;
    font-size: 12px;
    padding: 6px 12px;

    &:hover {
      background: rgba(245, 108, 108, 0.1);
    }
  }
}

.menu-item-active {
  background: var(--bg-menu-hover);
}
</style>
