/**
 * Naive UI 主题配置 - HuLa 主题
 * 将 Naive UI 组件的主题色映射到 HuLa 品牌色
 * 适用于 PC 端和移动端
 */

import type { GlobalTheme, GlobalThemeOverrides } from 'naive-ui'

/**
 * HuLa 主题覆盖配置
 * 使用 CSS 变量映射，支持深色/浅色模式切换
 *
 * 注意: 使用类型断言以允许部分覆盖，Naive UI 会自动应用默认值
 */
export const hulaThemeOverrides = {
  // ==================== 通用配置 ====================
  common: {
    // 主色 - 使用实际颜色值以支持 Naive UI 的颜色计算
    primaryColor: 'var(--hula-brand-primary)',
    primaryColorHover: 'var(--hula-brand-primary)',
    primaryColorPressed: 'var(--hula-brand-primary)',
    primaryColorSuppl: 'var(--hula-brand-primary)',

    // 功能色
    successColor: 'var(--hula-brand-primary)',
    warningColor: 'var(--hula-brand-primary)',
    errorColor: 'var(--hula-brand-primary)',
    infoColor: 'var(--hula-brand-primary)',

    // 文字颜色
    textColorBase: 'var(--hula-brand-primary)',
    textColor1: 'var(--hula-brand-primary)',
    textColor2: 'var(--hula-brand-primary)',
    textColor3: 'var(--hula-brand-primary)',
    textColorDisabled: 'var(--hula-brand-primary)',

    // 背景颜色 - 使用实际颜色值以支持透明度计算
    bodyColor: 'var(--hula-brand-primary)',
    cardColor: 'var(--hula-brand-primary)',
    modalColor: 'var(--hula-brand-primary)',
    popoverColor: 'var(--hula-brand-primary)',

    // 边框颜色
    borderColor: 'var(--hula-brand-primary)',
    dividerColor: 'var(--hula-brand-primary)',

    // 圆角
    borderRadius: '8px',
    borderRadiusSmall: '6px'
  },

  // ==================== 按钮组件 ====================
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    borderRadiusLarge: '12px',
    heightMedium: '36px',
    heightSmall: '28px',
    heightLarge: '44px'
  },

  // ==================== 输入框组件 ====================
  Input: {
    borderRadius: '8px',
    borderFocus: '1px solid var(--hula-brand-primary)',
    borderHover: '1px solid var(--hula-brand-primary)',
    boxShadowFocus: '0 0 0 2px rgba(19, 152, 127, 0.2)'
  },

  // ==================== 对话框组件 ====================
  Dialog: {
    borderRadius: '12px',
    iconColor: 'var(--hula-brand-primary)'
  },

  // ==================== 消息提示 ====================
  Message: {
    iconColor: 'var(--hula-brand-primary)'
  },

  // ==================== 标签 ====================
  Tag: {
    borderRadius: '6px',
    colorDefault: 'var(--hula-brand-primary)',
    colorChecked: 'var(--hula-brand-primary)'
  },

  // ==================== 开关 ====================
  Switch: {
    railColorActive: 'var(--hula-brand-primary)',
    buttonColor: 'var(--hula-brand-primary)'
  },

  // ==================== 滚动条 ====================
  Scrollbar: {
    color: 'var(--hula-brand-primary)',
    colorHover: 'var(--hula-brand-primary)'
  }
} as GlobalThemeOverrides

/**
 * 深色模式主题配置
 */
export function createHulaDarkTheme(): GlobalTheme {
  const themeOverrides: GlobalThemeOverrides = {
    common: {
      primaryColor: 'var(--hula-brand-primary)',
      primaryColorHover: 'var(--hula-brand-primary)',
      primaryColorPressed: 'var(--hula-brand-primary)',
      primaryColorSuppl: 'var(--hula-brand-primary)',

      successColor: 'var(--hula-brand-primary)',
      successColorHover: 'var(--hula-brand-primary)',
      successColorPressed: 'var(--hula-brand-primary)',
      successColorSuppl: 'var(--hula-brand-primary)',

      warningColor: 'var(--hula-brand-primary)',
      warningColorHover: 'var(--hula-brand-primary)',
      warningColorPressed: 'var(--hula-brand-primary)',
      warningColorSuppl: 'var(--hula-brand-primary)',

      errorColor: 'var(--hula-brand-primary)',
      errorColorHover: 'var(--hula-brand-primary)',
      errorColorPressed: 'var(--hula-brand-primary)',
      errorColorSuppl: 'var(--hula-brand-primary)',

      infoColor: 'var(--hula-brand-primary)',
      infoColorHover: 'var(--hula-brand-primary)',
      infoColorPressed: 'var(--hula-brand-primary)',
      infoColorSuppl: 'var(--hula-brand-primary)',

      textColorBase: 'var(--hula-brand-primary)',
      textColor1: 'var(--hula-brand-primary)',
      textColor2: 'rgba(255, 255, 255, 0.75)',
      textColor3: 'rgba(255, 255, 255, 0.55)',
      textColorDisabled: 'rgba(255, 255, 255, 0.35)',

      bodyColor: 'var(--hula-brand-primary)',
      cardColor: 'var(--hula-brand-primary)',
      modalColor: 'var(--hula-brand-primary)',
      popoverColor: 'var(--hula-brand-primary)',

      borderColor: 'var(--hula-brand-primary)',
      dividerColor: 'var(--hula-brand-primary)'
    }
  }

  return {
    name: 'hula-dark',
    ...themeOverrides
  } as GlobalTheme
}

/**
 * 根据当前主题模式获取 Naive UI 主题
 */
export function getNaiveUITheme(isDark: boolean): GlobalTheme | null {
  return isDark ? createHulaDarkTheme() : null
}
