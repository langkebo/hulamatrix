/**
 * useUserMenu - Shared user menu logic composable
 *
 * This composable extracts common user menu logic that can be shared
 * between desktop (dropdown menu) and mobile (bottom sheet) components.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate components
 */

import { ref, computed, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'

export interface MenuItem {
  id: string
  label: string
  icon: string
  action: () => void | Promise<void>
  disabled?: boolean
  divider?: boolean
  danger?: boolean
  badge?: string | number
  route?: string
}

export interface UserMenuOptions {
  platform?: 'desktop' | 'mobile'
}

export interface UserMenuResult {
  // State
  isOpen: Ref<boolean>
  userInfo: Ref<{ uid: string; name: string; avatar: string; account: string } | null>

  // Menu items
  menuItems: Ref<MenuItem[]>
  quickActions: Ref<MenuItem[]>

  // Operations
  openMenu: () => void
  closeMenu: () => void
  toggleMenu: () => void
  handleMenuItem: (itemId: string) => Promise<void>
}

/**
 * Composable for shared user menu logic
 */
export function useUserMenu(options: UserMenuOptions = {}): UserMenuResult {
  const { t } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const _globalStore = useGlobalStore()

  const isOpen = ref(false)
  const platform = options.platform || 'desktop'

  // Get user info from store
  const userInfo = computed(() => {
    const user = userStore.userInfo
    if (!user) return null

    return {
      uid: user.uid,
      name: user.name || user.account || 'User',
      avatar: user.avatar || '',
      account: user.account || ''
    }
  })

  /**
   * Navigate to a specific route based on platform
   */
  const navigate = (route: string, mobileRoute: string) => {
    const targetRoute = platform === 'mobile' ? mobileRoute : route
    router.push(targetRoute)
    closeMenu()
  }

  /**
   * Handle logout using the useLogin hook
   */
  const handleLogout = async () => {
    try {
      logger.info('[useUserMenu] Logging out user')

      // Dynamically import useLogin to avoid circular dependencies
      const { useLogin } = await import('@/hooks/useLogin')
      const { logout } = useLogin()

      // Perform logout
      await logout()

      msg.success(t('auth.logoutSuccess'))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useUserMenu] Logout failed', err)
      msg.error(t('auth.logoutFailed'))
    }
  }

  /**
   * Build menu items based on platform
   */
  const menuItems = ref<MenuItem[]>([
    {
      id: 'profile_info',
      label: t('common.avatar_menu.profile_info'),
      icon: 'user',
      action: () => navigate('/settings/profile', '/mobile/settings/profile')
    },
    {
      id: 'link_device',
      label: t('common.avatar_menu.link_device'),
      icon: 'qrcode',
      action: () => navigate('/settings/sessions', '/mobile/settings/sessions')
    },
    {
      id: 'notification',
      label: t('common.avatar_menu.notification'),
      icon: 'bell',
      action: () => navigate('/settings/notification', '/mobile/settings/notification')
    },
    {
      id: 'privacy_security',
      label: t('common.avatar_menu.privacy_security'),
      icon: 'lock',
      action: () => navigate('/settings/privacy', '/mobile/settings/privacy')
    },
    {
      id: 'privacy_manage',
      label: t('common.avatar_menu.privacy_manage'),
      icon: 'shield',
      action: () => navigate('/settings/privacy/manage', '/mobile/settings/privacy/manage')
    },
    {
      id: 'appearance',
      label: t('common.avatar_menu.appearance'),
      icon: 'palette',
      action: () => navigate('/settings/appearance', '/mobile/settings/appearance')
    },
    {
      id: 'all_settings',
      label: t('common.avatar_menu.all_settings'),
      icon: 'settings',
      action: () => navigate('/settings', '/mobile/settings')
    },
    {
      id: 'feedback',
      label: t('common.avatar_menu.feedback'),
      icon: 'message-circle',
      action: () => navigate('/settings/feedback', '/mobile/settings/feedback')
    },
    {
      id: 'divider-1',
      label: '',
      icon: '',
      action: () => {},
      divider: true
    },
    {
      id: 'logout',
      label: t('common.avatar_menu.logout'),
      icon: 'log-out',
      action: handleLogout,
      danger: true
    }
  ])

  // Quick actions for desktop (shown in header)
  const quickActions = ref<MenuItem[]>([
    {
      id: 'settings',
      label: t('menu.settings'),
      icon: 'settings',
      action: () => navigate('/settings', '/mobile/settings')
    },
    {
      id: 'logout',
      label: t('menu.logout'),
      icon: 'log-out',
      action: handleLogout,
      danger: true
    }
  ])

  /**
   * Open the menu
   */
  const openMenu = (): void => {
    isOpen.value = true
    logger.debug('[useUserMenu] Menu opened')
  }

  /**
   * Close the menu
   */
  const closeMenu = (): void => {
    isOpen.value = false
    logger.debug('[useUserMenu] Menu closed')
  }

  /**
   * Toggle menu open/close state
   */
  const toggleMenu = (): void => {
    isOpen.value = !isOpen.value
    logger.debug('[useUserMenu] Menu toggled', { open: isOpen.value })
  }

  /**
   * Handle menu item click
   */
  const handleMenuItem = async (itemId: string): Promise<void> => {
    const menuItem = menuItems.value.find((item) => item.id === itemId)

    if (!menuItem) {
      logger.warn('[useUserMenu] Menu item not found', { itemId })
      return
    }

    if (menuItem.divider || menuItem.disabled) {
      return
    }

    try {
      logger.info('[useUserMenu] Executing menu action', { itemId })
      await menuItem.action()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useUserMenu] Menu action failed', { itemId, error: err })
      msg.error(t('errors.menuActionFailed'))
    }
  }

  // refreshUserInfo 已移除 - Matrix 用户信息会自动同步
  // 用户刷新功能已不再需要，因为 Matrix 客户端会自动更新用户信息

  return {
    // State
    isOpen,
    userInfo,

    // Menu items
    menuItems,
    quickActions,

    // Operations
    openMenu,
    closeMenu,
    toggleMenu,
    handleMenuItem

    // refreshUserInfo 已移除
  }
}

/**
 * Check if a menu item should be shown
 */
export function shouldShowMenuItem(
  item: MenuItem,
  context: {
    isAdmin?: boolean
    isMobile?: boolean
  }
): boolean {
  // Check if item is only for specific platforms
  if (item.id === 'admin' && !context.isAdmin) {
    return false
  }

  // Check other visibility conditions
  if (item.disabled) {
    return false
  }

  return true
}

/**
 * Get menu item label with fallback
 */
export function getMenuItemLabel(item: MenuItem, fallback: string = ''): string {
  return item.label || fallback
}
