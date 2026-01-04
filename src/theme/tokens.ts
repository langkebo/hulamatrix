/**
 * HuLa 主题令牌系统
 * 使用统一的 CSS 变量系统，支持浅色/深色模式自动切换
 */

export type ThemeMode = 'light' | 'dark'

/**
 * 获取 CSS 变量值的辅助函数
 */
function getCssVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * 浅色主题令牌
 * 使用统一的 HuLa 主题 CSS 变量
 */
const lightVars: Record<string, string> = {
  // 背景色 - 使用 HuLa 主题变量
  '--bg-setting-item': 'var(--hula-bg-component, #ffffff)',
  '--line-color': 'var(--hula-border-light, #e5e7eb)',
  '--hover-color': 'var(--hula-bg-page, #f7f7f7)',

  // 品牌色 - 使用 HuLa 强调色
  '--border-active-color': '#13987f',

  // 滚动条 - 使用 HuLa 主色
  '--scrollbar-thumb-color': 'var(--hula-primary-light, #c7c7c7)',

  // 文字色 - 使用 HuLa 文字颜色
  '--text-color': 'var(--hula-text-primary, #1f2937)',

  // 字体大小
  '--font-size-12': '12px',
  '--font-size-14': '14px',

  // 间距
  '--space-8': '8px',
  '--space-12': '12px',

  // 阴影 - 使用 HuLa 阴影
  '--shadow-main': 'var(--hula-shadow-md, 0 4px 12px rgba(0,0,0,0.08))'
}

/**
 * 深色主题令牌
 * 使用统一的 HuLa 主题 CSS 变量（深色模式）
 */
const darkVars: Record<string, string> = {
  // 背景色 - 使用 HuLa 主题变量（深色）
  '--bg-setting-item': 'var(--hula-bg-component, #151515)',
  '--line-color': 'var(--hula-border-light, #2a2a2a)',
  '--hover-color': 'var(--hula-bg-page, #1f1f1f)',

  // 品牌色 - 使用 HuLa 强调色（深色模式提亮）
  '--border-active-color': 'var(--hula-accent, #1ec29f)',

  // 滚动条 - 使用 HuLa 主色（深色）
  '--scrollbar-thumb-color': 'var(--hula-primary-light, #3a3a3a)',

  // 文字色 - 使用 HuLa 文字颜色（深色）
  '--text-color': 'var(--hula-text-primary, #e5e7eb)',

  // 字体大小
  '--font-size-12': '12px',
  '--font-size-14': '14px',

  // 间距
  '--space-8': '8px',
  '--space-12': '12px',

  // 阴影 - 使用 HuLa 阴影（深色）
  '--shadow-main': 'var(--hula-shadow-md, 0 4px 12px rgba(0,0,0,0.25))'
}

/**
 * 应用主题令牌到 DOM
 * @param mode 主题模式 'light' | 'dark'
 */
export function applyThemeTokens(mode: ThemeMode) {
  const vars = mode === 'dark' ? darkVars : lightVars
  const el = document.documentElement
  Object.entries(vars).forEach(([k, v]) => {
    el.style.setProperty(k, v)
  })
}

/**
 * 获取当前主题颜色
 * 提供类型安全的主题颜色访问
 */
export function getThemeColors() {
  return {
    // 主色调
    primary: getCssVar('--hula-primary'),
    accent: getCssVar('--hula-accent'),
    accentHover: getCssVar('--hula-accent-hover'),
    accentActive: getCssVar('--hula-accent-active'),

    // 功能色
    success: getCssVar('--hula-success'),
    warning: getCssVar('--hula-warning'),
    error: getCssVar('--hula-error'),
    info: getCssVar('--hula-info'),

    // 文字色
    textPrimary: getCssVar('--hula-text-primary'),
    textRegular: getCssVar('--hula-text-regular'),
    textSecondary: getCssVar('--hula-text-secondary'),

    // 背景色
    bgPage: getCssVar('--hula-bg-page'),
    bgComponent: getCssVar('--hula-bg-component'),

    // 边框色
    borderLight: getCssVar('--hula-border-light'),
    borderBase: getCssVar('--hula-border-base')
  }
}
