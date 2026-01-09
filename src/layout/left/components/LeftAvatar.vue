<template>
  <UserAvatarMenu @select="onMenuSelect">
    <div class="relative size-34px rounded-50% cursor-pointer">
      <n-avatar
        :size="34"
        :src="avatarSrc"
        :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : '#fff'"
        :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
        round />
      <div
        class="bg-[--left-bg-color] text-10px rounded-50% size-12px absolute bottom--2px right--2px border-(2px solid [--left-bg-color])"
        @click.stop="openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)">
        <img :src="statusIcon" alt="在线状态指示器" class="rounded-50% size-full" />
      </div>
    </div>
  </UserAvatarMenu>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { leftHook } from '@/layout/left/hook'
import UserAvatarMenu from '@/components/settings/UserAvatarMenu.vue'

const userStore = useUserStore()
const { t } = useI18n()
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar as string))
const { openContent } = leftHook()
const { statusIcon } = useOnlineStatus()

const onMenuSelect = (_key: string) => {}
</script>
<style lang="scss" scoped>
@use '../style';
</style>
