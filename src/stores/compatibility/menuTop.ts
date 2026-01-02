/**
 * useMenuTopStore 兼容层
 * 从旧 Store 迁移到 Core Store 的过渡实现
 *
 * 迁移目标: app.menuTop
 *
 * @migration 从 src/stores/menuTop.ts 迁移到 Core Store
 */

import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/core'
import { StoresEnum } from '@/enums'
import type { MenuItem } from '@/stores/core'
import type { PluginBadge } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 带有 i18n 标题的菜单项类型
 * 兼容 MenuItem 和 PluginItem 的属性
 */
export interface MenuTopItem extends MenuItem {
  title: string
  shortTitle: string
  /** 徽章数量 */
  badge?: number | string | PluginBadge
}

/**
 * useMenuTopStore 兼容层
 *
 * 这个兼容层代理到新的 Core Store (app.menuTop)
 * 同时保持原有的 API 接口不变
 */
export const useMenuTopStoreCompat = defineStore(
  StoresEnum.MENUTOP,
  () => {
    const { t } = useI18n()
    const appStore = useAppStore()

    // 从 Core Store 获取基础菜单配置
    const baseMenuTop = computed(() => appStore.menuTop ?? [])

    // 使用 computed 实现响应式 i18n（保持原有逻辑）
    const menuTop = computed<MenuTopItem[]>(() => {
      const items = Array.isArray(baseMenuTop.value) ? baseMenuTop.value : []
      return items.map((item: MenuItem, index: number): MenuTopItem => {
        const i18nKey = index === 0 ? 'message' : 'contact'
        return {
          ...item,
          title: t(`home.action.${i18nKey}`),
          shortTitle: t(`home.action.${i18nKey}_short_title`)
        }
      })
    })

    // 开发模式警告 - 帮助追踪迁移进度
    if (import.meta.env.DEV) {
      logger.warn('[Compatibility] Using legacy store: useMenuTopStore')
    }

    return {
      menuTop
    }
  },
  // 保持原有的 share 配置
  {
    share: {
      enable: true,
      initialize: true
    }
  } as Record<string, unknown>
)

// 为了方便迁移，同时导出一个直接使用 Core Store 的函数
/**
 * 直接使用 Core Store 的版本（用于完全迁移后）
 *
 * 使用示例:
 * ```ts
 * import { useMenuTopFromCore } from '@/stores/compatibility/menuTop'
 *
 * const { t } = useI18n()
 * const baseMenuTop = useMenuTopFromCore()
 *
 * const menuTop = computed(() => {
 *   return baseMenuTop.value.map((item, index) => {
 *     const i18nKey = index === 0 ? 'message' : 'contact'
 *     return {
 *       ...item,
 *       title: t(`home.action.${i18nKey}`),
 *       shortTitle: t(`home.action.${i18nKey}_short_title`)
 *     }
 *   })
 * })
 * ```
 */
export function useMenuTopFromCore() {
  const appStore = useAppStore()
  return computed<MenuItem[]>(() => {
    const menu = appStore.menuTop
    return Array.isArray(menu) ? menu : []
  })
}
