/**
 * Compatibility Stores - Placeholder
 *
 * @deprecated 兼容层 stores 已废弃，请使用核心 stores 代替
 * 这些文件仅用于保持类型兼容性
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/utils/logger'

/**
 * 插件徽章类型
 */
export interface PluginBadge {
  count?: number
  dot?: boolean
}

/**
 * 菜单项类型
 */
export interface MenuTopItem {
  id: string
  label: string
  url: string
  title: string
  icon?: string
  iconAction?: string
  badge?: number | PluginBadge
  dot?: boolean
  shortTitle?: string
  state?: unknown
  window?: { resizable?: boolean }
  size?: unknown
  tip?: string
}

/**
 * @deprecated 使用核心 store 代替
 */
export const useMenuTopStoreCompat = defineStore('menuTopCompat', () => {
  const menuItems = ref<MenuTopItem[]>([])
  const activeItem = ref<string | null>(null)

  function setActiveItem(id: string) {
    logger.warn('[useMenuTopStoreCompat] setActiveItem() called - use core store instead')
    activeItem.value = id
  }

  function addMenuItem(item: MenuTopItem) {
    logger.warn('[useMenuTopStoreCompat] addMenuItem() called - use core store instead')
    menuItems.value.push(item)
  }

  function removeMenuItem(id: string) {
    logger.warn('[useMenuTopStoreCompat] removeMenuItem() called - use core store instead')
    const index = menuItems.value.findIndex((item) => item.id === id)
    if (index !== -1) {
      menuItems.value.splice(index, 1)
    }
  }

  return {
    menuItems,
    activeItem,
    setActiveItem,
    addMenuItem,
    removeMenuItem,
    // 添加 menuTop 别名以保持兼容性
    menuTop: menuItems
  }
})
