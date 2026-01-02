<template>
  <n-modal v-model:show="visible" preset="card" :style="{ width: '880px' }" :segmented="true">
    <template #header>
      <div class="settings-panel-header">
        <span class="settings-panel-title">{{ t('setting.panel.title') }}</span>
        <span class="settings-panel-subtitle">{{ t('setting.panel.subtitle') }}</span>
      </div>
    </template>
    <div class="settings-panel-body">
      <aside class="settings-panel-sidebar">
        <n-menu :options="menu" :value="active" @update:value="onSelect" />
      </aside>
      <section class="settings-panel-content">
        <Suspense>
          <template #default>
            <router-view />
          </template>
          <template #fallback>
            <SettingsSkeleton :loading="true" :rows="6" showTitle titleWidth="240" variant="setting" />
          </template>
        </Suspense>
      </section>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
/**
 * SettingsPanel - 设置面板模态框组件
 *
 * 功能：
 * - 在模态框中显示设置界面
 * - 左侧菜单导航，右侧内容展示
 * - 支持国际化 (i18n)
 * - 使用 Suspense 进行异步组件加载
 *
 * @author HuLamatrix Team
 */

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NMenu, type MenuOption } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SettingsSkeleton from '@/components/settings/SettingsSkeleton.vue'

const router = useRouter()
const { t } = useI18n()

const visible = ref(true)
const active = ref<string | null>('appearance')

// 菜单配置 - 使用 i18n 翻译
const menu = computed<MenuOption[]>(() => [
  {
    key: 'profile',
    label: t('setting.panel.menu.profile')
  },
  {
    key: 'sessions',
    label: t('setting.panel.menu.sessions')
  },
  {
    key: 'notification',
    label: t('setting.panel.menu.notification')
  },
  {
    key: 'encryption',
    label: t('setting.panel.menu.encryption')
  },
  {
    key: 'appearance',
    label: t('setting.panel.menu.appearance')
  },
  {
    key: 'privacy',
    label: t('setting.panel.menu.privacy')
  },
  {
    key: 'keyboard',
    label: t('setting.panel.menu.keyboard')
  },
  {
    key: 'audio',
    label: t('setting.panel.menu.audio')
  },
  {
    key: 'labs',
    label: t('setting.panel.menu.labs')
  }
])

// 路由映射
const routeMap: Record<string, string> = {
  profile: '/settings/profile',
  sessions: '/settings/sessions',
  notification: '/settings/notification',
  encryption: '/e2ee/backup',
  appearance: '/settings/appearance',
  privacy: '/settings/manageStore',
  keyboard: '/settings/keyboard',
  audio: '/settings/pusher',
  labs: '/settings/labs'
}

const onSelect = async (key: string) => {
  active.value = key
  const route = routeMap[key]
  if (route) {
    await router.push(route)
  }
}
</script>

<style scoped lang="scss">
.settings-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-panel-title {
  font-size: 18px;
  font-weight: 500;
}

.settings-panel-subtitle {
  opacity: 0.6;
  font-size: 12px;
}

.settings-panel-body {
  display: flex;
}

.settings-panel-sidebar {
  width: 200px;
  padding-right: 12px;
  border-right: 1px solid #e5e7eb;
}

.settings-panel-content {
  flex: 1;
  padding-left: 12px;
  min-height: 420px;
}
</style>
