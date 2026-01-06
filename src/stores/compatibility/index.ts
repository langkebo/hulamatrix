/**
 * Compatibility Stores - Placeholder
 *
 * @deprecated 兼容层 stores 已废弃，请使用核心 stores 代替
 * 这些文件仅用于保持类型兼容性
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { useMenuTopStore } from '@/stores/menuTop'

/**
 * 插件徽章类型
 */
export interface PluginBadge {
  count?: number
  dot?: boolean
}

/**
 * 菜单项类型 - 与 menuTop store 的 MenuItem 兼容
 */
export interface MenuTopItem {
  url: string
  icon?: string
  iconAction?: string
  state?: unknown
  isAdd?: boolean
  dot?: boolean
  progress?: number
  miniShow?: boolean
  title?: string
  shortTitle?: string
  badge?: number | PluginBadge
  window?: { resizable?: boolean }
  size?: unknown
  tip?: string
  id?: string
  label?: string
}

/**
 * @deprecated 使用核心 store 代替
 * 兼容层：桥接到实际的 menuTopStore
 */
export const useMenuTopStoreCompat = defineStore('menuTopCompat', () => {
  // 桥接到实际的 menuTopStore
  const actualStore = useMenuTopStore()

  // 使用 computed 桥接数据，确保响应式
  const menuItems = computed(() => actualStore.menuTop)
  const menuTop = menuItems
  const activeItem = ref<string | null>(null)

  function setActiveItem(id: string) {
    logger.warn('[useMenuTopStoreCompat] setActiveItem() called - use core store instead')
    activeItem.value = id
  }

  function addMenuItem(_item: MenuTopItem) {
    logger.warn('[useMenuTopStoreCompat] addMenuItem() called - use core store instead')
    // 实际 store 不支持动态添加，仅记录警告
  }

  function removeMenuItem(_id: string) {
    logger.warn('[useMenuTopStoreCompat] removeMenuItem() called - use core store instead')
    // 实际 store 不支持动态移除，仅记录警告
  }

  return {
    menuItems,
    activeItem,
    setActiveItem,
    addMenuItem,
    removeMenuItem,
    menuTop
  }
})
