<template>
  <n-dropdown
    trigger="click"
    :options="menuOptions"
    :render-label="renderLabel"
    :render-icon="renderIcon"
    placement="bottom-start"
    @select="onSelect"
  >
    <slot>
      <div class="user-avatar-trigger">
        <n-avatar :size="34" :src="userInfo?.avatar" round />
      </div>
    </slot>
  </n-dropdown>
</template>

<script setup lang="ts">
/**
 * UserAvatarMenu - 头像点击弹出菜单组件 (重构版本)
 *
 * 功能：
 * - 显示用户头像，点击弹出设置菜单
 * - 菜单项包含：链接新设备、通知、隐私安全、所有设置、反馈、注销
 * - 支持国际化 (i18n)
 * - 支持键盘导航
 * - 使用 useUserMenu composable 管理共享逻辑
 *
 * Phase 12 优化: 使用 composable 减少重复代码
 */

import { h, computed, type VNode } from 'vue'
import { useRouter } from 'vue-router'
import { NAvatar, NDropdown, type DropdownOption } from 'naive-ui'
import { useUserMenu } from '@/composables'
import { logger } from '@/utils/logger'

type Emits = (e: 'select', key: string) => void

const emit = defineEmits<Emits>()
const router = useRouter()

// Use the shared composable
const { userInfo, menuItems, handleMenuItem } = useUserMenu({ platform: 'desktop' })

// SVG icon mapping
const iconMap: Record<string, string> = {
  user: '#icon-user',
  qrcode: '#icon-qr',
  bell: '#icon-bell',
  lock: '#icon-lock',
  shield: '#icon-shield',
  palette: '#icon-palette',
  settings: '#icon-settings',
  'message-circle': '#icon-message',
  'log-out': '#icon-power'
}

// Map composable menu items to Naive UI dropdown options
const menuOptions = computed<DropdownOption[]>(() => {
  // Add profile info header
  const options: DropdownOption[] = [
    {
      key: 'profile_info',
      type: 'render',
      render: () =>
        h('div', { class: 'avatar-menu-profile' }, [
          h('div', { class: 'avatar-menu-display-name' }, userInfo.value?.name || ''),
          h('div', { class: 'avatar-menu-mxid' }, `@${userInfo.value?.account || ''}`)
        ])
    }
  ]

  // Add menu items from composable (skip dividers and profile_info)
  menuItems.value.forEach((item) => {
    if (item.id === 'profile_info') return // Skip, we already added it
    if (item.divider) {
      options.push({ type: 'divider', key: item.id })
    } else {
      options.push({
        key: item.id,
        label: item.label
      })
    }
  })

  return options
})

// Render label
const renderLabel = (option: DropdownOption) => {
  if (option.type === 'divider' || typeof option.label !== 'string') {
    return null
  }
  return h('span', { class: 'avatar-menu-label' }, option.label)
}

// Render icon
const renderIcon = (option: DropdownOption) => {
  // Look up icon from menu items by key
  const menuItem = menuItems.value.find((item) => item.id === option.key)
  const iconName = menuItem?.icon
  if (iconName) {
    const href = iconMap[iconName] || iconMap.settings
    return h('svg', { class: 'avatar-menu-icon', viewBox: '0 0 1024 1024' }, [h('use', { href })])
  }
  return null
}

// Handle menu selection
const onSelect = async (key: string) => {
  emit('select', key)

  // Skip profile info header
  if (key === 'profile_info') return

  try {
    // Use composable's handleMenuItem
    await handleMenuItem(key)
  } catch (error) {
    logger.error('[UserAvatarMenu] Menu action failed:', error)
  }
}
</script>

<style scoped lang="scss">
.user-avatar-trigger {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
}

// Dropdown menu styles
:deep(.n-dropdown-menu) {
  min-width: 180px;
  padding: 8px 0;
}

.avatar-menu-profile {
  padding: 12px 16px;
  cursor: default;
  border-bottom: 1px solid var(--n-divider-color);

  &:hover {
    background: transparent;
  }
}

.avatar-menu-display-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color-1);
  margin-bottom: 4px;
}

.avatar-menu-mxid {
  font-size: 12px;
  color: var(--n-text-color-3);
  opacity: 0.8;
}

.avatar-menu-label {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

.avatar-menu-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
