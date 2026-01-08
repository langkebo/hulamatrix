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
    primaryColor: '#13987f',
    primaryColorHover: '#0f7d69',
    primaryColorPressed: '#0c6354',
    primaryColorSuppl: '#64a29c',

    // 功能色
    successColor: '#13987f',
    warningColor: '#ff976a',
    errorColor: '#ee0a24',
    infoColor: '#1989fa',

    // 文字颜色
    textColorBase: '#18212c',
    textColor1: '#18212c',
    textColor2: '#576b95',
    textColor3: '#9fa1a9',
    textColorDisabled: '#c8c9cc',

    // 背景颜色 - 使用实际颜色值以支持透明度计算
    bodyColor: '#f7f8fa',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',

    // 边框颜色
    borderColor: '#ebedf0',
    dividerColor: '#dcdee0',

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
    borderFocus: '1px solid #13987f',
    borderHover: '1px solid #64a29c',
    boxShadowFocus: '0 0 0 2px rgba(19, 152, 127, 0.2)'
  },

  // ==================== 对话框组件 ====================
  Dialog: {
    borderRadius: '12px',
    iconColor: '#13987f'
  },

  // ==================== 消息提示 ====================
  Message: {
    iconColor: '#13987f'
  },

  // ==================== 标签 ====================
  Tag: {
    borderRadius: '6px',
    colorDefault: '#13987f',
    colorChecked: '#13987f'
  },

  // ==================== 开关 ====================
  Switch: {
    railColorActive: '#13987f',
    buttonColor: '#13987f'
  },

  // ==================== 滚动条 ====================
  Scrollbar: {
    color: '#64a29c',
    colorHover: '#4d8b85'
  }
} as GlobalThemeOverrides

/**
 * 深色模式主题配置
 */
export function createHulaDarkTheme(): GlobalTheme {
  const themeOverrides: GlobalThemeOverrides = {
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
