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
    // 主色
    primaryColor: 'var(--hula-accent)',
    primaryColorHover: 'var(--hula-accent-hover)',
    primaryColorPressed: 'var(--hula-accent-active)',
    primaryColorSuppl: 'var(--hula-primary)',

    // 功能色
    successColor: 'var(--hula-success)',
    warningColor: 'var(--hula-warning)',
    errorColor: 'var(--hula-error)',
    infoColor: 'var(--hula-info)',

    // 文字颜色
    textColorBase: 'var(--hula-text-primary)',
    textColor1: 'var(--hula-text-primary)',
    textColor2: 'var(--hula-text-regular)',
    textColor3: 'var(--hula-text-secondary)',
    textColorDisabled: 'var(--hula-text-placeholder)',

    // 背景颜色
    bodyColor: 'var(--hula-bg-page)',
    cardColor: 'var(--hula-bg-component)',
    modalColor: 'var(--hula-bg-component)',
    popoverColor: 'var(--hula-bg-component)',

    // 边框颜色
    borderColor: 'var(--hula-border-light)',
    dividerColor: 'var(--hula-border-base)',

    // 圆角
    borderRadius: 'var(--hula-radius-md)',
    borderRadiusSmall: 'var(--hula-radius-sm)'
  },

  // ==================== 按钮组件 ====================
  Button: {
    borderRadiusMedium: 'var(--hula-radius-md)',
    borderRadiusSmall: 'var(--hula-radius-sm)',
    borderRadiusLarge: 'var(--hula-radius-lg)',
    heightMedium: '36px',
    heightSmall: '28px',
    heightLarge: '44px'
  },

  // ==================== 输入框组件 ====================
  Input: {
    borderRadius: 'var(--hula-radius-md)',
    borderFocus: '1px solid var(--hula-accent)',
    borderHover: '1px solid var(--hula-primary)',
    boxShadowFocus: '0 0 0 2px rgba(19, 152, 127, 0.2)'
  },

  // ==================== 对话框组件 ====================
  Dialog: {
    borderRadius: 'var(--hula-radius-lg)',
    iconColor: 'var(--hula-accent)'
  },

  // ==================== 消息提示 ====================
  Message: {
    iconColor: 'var(--hula-accent)'
  },

  // ==================== 标签 ====================
  Tag: {
    borderRadius: 'var(--hula-radius-sm)',
    colorDefault: 'var(--hula-accent)',
    colorChecked: 'var(--hula-accent)'
  },

  // ==================== 开关 ====================
  Switch: {
    railColorActive: 'var(--hula-accent)',
    buttonColor: 'var(--hula-accent)'
  },

  // ==================== 滚动条 ====================
  Scrollbar: {
    color: 'var(--hula-primary)',
    colorHover: 'var(--hula-primary-dark)'
  }
} as GlobalThemeOverrides

/**
 * 深色模式主题配置
 */
export function createHulaDarkTheme(): GlobalTheme {
  return {
    name: 'hula-dark',
    common: {
      primaryColor: '#1ec29f',
      primaryColorHover: '#4dd6b5',
      primaryColorPressed: '#13987f',
      primaryColorSuppl: '#82b2ac',

      successColor: '#1ec29f',
      successColorHover: '#4dd6b5',
      successColorPressed: '#13987f',
      successColorSuppl: '#82b2ac',

      warningColor: '#ffb88a',
      warningColorHover: '#ffc9a3',
      warningColorPressed: '#ffa770',
      warningColorSuppl: '#ffdcb8',

      errorColor: '#f54a5f',
      errorColorHover: '#f76b7f',
      errorColorPressed: '#e83e55',
      errorColorSuppl: '#f87a8d',

      infoColor: '#6cbfff',
      infoColorHover: '#7fccff',
      infoColorPressed: '#4da8ff',
      infoColorSuppl: '#82b2ac',

      textColorBase: '#ffffff',
      textColor1: '#ffffff',
      textColor2: 'rgba(255, 255, 255, 0.75)',
      textColor3: 'rgba(255, 255, 255, 0.55)',
      textColorDisabled: 'rgba(255, 255, 255, 0.35)',

      bodyColor: '#1a1a1a',
      cardColor: '#242424',
      modalColor: '#242424',
      popoverColor: '#242424',

      borderColor: '#3a3a3a',
      dividerColor: '#4a4a4a'
    } as any // 类型断言: 允许部分覆盖，Naive UI 会自动应用默认值
  }
}

/**
 * 根据当前主题模式获取 Naive UI 主题
 */
export function getNaiveUITheme(isDark: boolean): GlobalTheme | null {
  return isDark ? createHulaDarkTheme() : null
}
