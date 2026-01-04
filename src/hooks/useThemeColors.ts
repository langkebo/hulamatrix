/**
 * useThemeColors - 主题颜色访问 Composable
 * 提供类型安全的主题颜色访问方法
 */

import { computed, ComputedRef } from 'vue'
import { useSettingStore } from '@/stores/setting'
import { getThemeColors, type ThemeMode } from '@/theme/tokens'
import { ThemeEnum } from '@/enums'

/**
 * 主题颜色接口
 */
export interface ThemeColors {
  // 主色调
  primary: string
  accent: string
  accentHover: string
  accentActive: string

  // 功能色
  success: string
  warning: string
  error: string
  info: string

  // 文字色
  textPrimary: string
  textRegular: string
  textSecondary: string

  // 背景色
  bgPage: string
  bgComponent: string

  // 边框色
  borderLight: string
  borderBase: string
}

/**
 * 主题颜色 Composable
 * @returns {Object} 主题相关的响应式数据和方法
 */
export function useThemeColors() {
  const settingStore = useSettingStore()

  /**
   * 当前主题模式
   */
  const themeMode = computed<ThemeMode>(() => {
    return settingStore.themes.content === ThemeEnum.DARK ? 'dark' : 'light'
  })

  /**
   * 是否为深色模式
   */
  const isDark = computed(() => themeMode.value === 'dark')

  /**
   * 主题颜色（响应式）
   */
  const colors = computed<ThemeColors>(() => getThemeColors())

  /**
   * HuLa 品牌色（强调色）
   */
  const brandColor = computed(() => colors.value.accent)

  /**
   * 主色调
   */
  const primaryColor = computed(() => colors.value.primary)

  /**
   * 成功色
   */
  const successColor = computed(() => colors.value.success)

  /**
   * 警告色
   */
  const warningColor = computed(() => colors.value.warning)

  /**
   * 错误色
   */
  const errorColor = computed(() => colors.value.error)

  /**
   * 获取任意 CSS 变量值
   * @param name CSS 变量名（带或不带 -- 前缀）
   * @returns CSS 变量值
   */
  const getCssVar = (name: string): string => {
    const varName = name.startsWith('--') ? name : `--${name}`
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    return value || ''
  }

  /**
   * 获取多个 CSS 变量值
   * @param names CSS 变量名数组
   * @returns CSS 变量值对象
   */
  const getCssVars = (names: string[]): Record<string, string> => {
    const result: Record<string, string> = {}
    names.forEach((name) => {
      const varName = name.startsWith('--') ? name : `--${name}`
      const key = name.replace('--', '')
      result[key] = getCssVar(varName)
    })
    return result
  }

  return {
    // 主题模式
    themeMode,
    isDark,

    // 颜色对象
    colors,

    // 品牌色快捷访问
    brandColor,
    primaryColor,
    successColor,
    warningColor,
    errorColor,

    // 工具方法
    getCssVar,
    getCssVars
  }
}

/**
 * useBrandColor - 快速访问品牌色的简化 Composable
 * @returns 品牌色的 computed 引用
 */
export function useBrandColor(): ComputedRef<string> {
  const { brandColor } = useThemeColors()
  return brandColor
}

/**
 * useIsDark - 快速检查是否为深色模式
 * @returns 是否为深色模式的 computed 引用
 */
export function useIsDark(): ComputedRef<boolean> {
  const { isDark } = useThemeColors()
  return isDark
}
