<template>
  <teleport to="body">
    <transition name="slide-up">
      <div v-if="visible" class="avatar-menu-overlay" @click.self="handleClose">
        <div class="avatar-menu-sheet" :style="{ height: sheetHeight }">
          <!-- Handle bar -->
          <div class="handle-bar" @click="handleClose"></div>

          <!-- Profile Info Section -->
          <div class="profile-section">
            <div class="profile-avatar">
              <van-image :width="64" :height="64" :src="userInfo?.avatar || '/logo.png'" round />
            </div>
            <div class="profile-info">
              <div class="profile-name">{{ userInfo?.name || '' }}</div>
              <div class="profile-mxid">@{{ userInfo?.account || '' }}</div>
            </div>
          </div>

          <!-- Menu Items -->
          <div class="menu-items">
            <div
              v-for="item in displayMenuItems"
              :key="item.id"
              :class="['menu-item', { 'menu-item--danger': item.danger }]"
              @click="handleItemClick(item)">
              <div class="menu-item__icon">
                <Icon :name="item.icon" :size="20" />
              </div>
              <div class="menu-item__label">{{ item.label }}</div>
              <div class="menu-item__chevron">
                <Icon name="chevron-right" :size="16" />
              </div>
            </div>
          </div>

          <!-- Cancel Button -->
          <div class="cancel-section">
            <div class="cancel-button" @click="handleClose">
              {{ t('common.cancel') }}
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/**
 * Mobile User Avatar Menu - 移动端用户头像菜单 (重构版本)
 *
 * 功能：
 * - 底部抽屉式菜单
 * - 显示用户信息、菜单项和取消按钮
 * - 支持手势关闭
 * - 使用 useUserMenu composable 管理共享逻辑
 *
 * Phase 12 优化: 使用 composable 减少重复代码
 */

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog, useMessage } from '@/utils/vant-adapter'
import Icon from '#/components/icons/Icon.vue'
import { useUserMenu } from '@/composables'
import { logger } from '@/utils/logger'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [key: string]
}>()

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

// Use the shared composable
const { userInfo, menuItems, handleMenuItem } = useUserMenu({ platform: 'mobile' })

// Sheet height (70% of screen)
const sheetHeight = computed(() => '70vh')

// Filter out divider items for display
const displayMenuItems = computed(() => {
  return menuItems.value.filter((item) => !item.divider && item.id !== 'profile_info')
})

// Handle close
const handleClose = () => {
  emit('update:visible', false)
}

// Handle menu item click
const handleItemClick = async (item: { id: string; label: string; icon: string; danger?: boolean }) => {
  emit('select', item.id)

  // Handle logout with confirmation dialog
  if (item.id === 'logout') {
    dialog.warning({
      title: t('common.avatar_menu.logout_confirm_title') || '确认退出',
      content: t('common.avatar_menu.logout_confirm_content') || '确定要退出登录吗？',
      confirmText: t('common.confirm') || '确定',
      cancelText: t('common.cancel') || '取消',
      onConfirm: async () => {
        try {
          await handleMenuItem(item.id)
          message.success(t('common.avatar_menu.logout_success') || '退出成功')
        } catch (error) {
          logger.error('[MobileUserAvatarMenu] Logout failed:', error)
          message.error(t('common.avatar_menu.logout_failed') || '退出失败')
        }
        handleClose()
      }
    })
    return
  }

  // Close menu and handle action
  handleClose()
  await handleMenuItem(item.id)
}

// Sync visible state with parent (prevent body scroll)
watch(
  () => props.visible,
  (newValue) => {
    if (newValue) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.avatar-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--hula-black-rgb), 0.5);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.avatar-menu-sheet {
  width: 100%;
  max-width: 600px;
  background: white;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  max-height: 85vh;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--hula-gray-200);
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--hula-gray-300);
  }
}

.profile-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--hula-gray-100);
  flex-shrink: 0;

  .profile-avatar {
    flex-shrink: 0;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--hula-gray-900);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-mxid {
    font-size: 14px;
    color: var(--hula-gray-400);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.menu-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: var(--hula-gray-50);
  }

  &--danger {
    .menu-item__label {
      color: var(--hula-error);
    }

    .menu-item__icon {
      color: var(--hula-error);
    }
  }

  &__icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hula-gray-700);
  }

  &__label {
    flex: 1;
    font-size: 16px;
    color: var(--hula-gray-900);
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--hula-gray-400);
  }
}

.cancel-section {
  padding: 12px 20px;
  border-top: 1px solid var(--hula-gray-100);
  flex-shrink: 0;
}

.cancel-button {
  width: 100%;
  padding: 14px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--hula-gray-900);
  background: var(--hula-gray-50);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: var(--hula-gray-200);
  }
}

// Slide up animation
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}

// Fade overlay
.slide-up-enter-active {
  .avatar-menu-overlay {
    transition: opacity 0.3s ease;
  }
}

.slide-up-enter-from {
  .avatar-menu-overlay {
    opacity: 0;
  }
}

.slide-up-enter-to {
  .avatar-menu-overlay {
    opacity: 1;
  }
}
</style>
