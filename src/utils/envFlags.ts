/**
 * Vite 环境变量类型
 */
type EnvValue = string | boolean | undefined

/**
 * Vite 环境变量记录类型
 */
type ViteEnvRecord = Record<string, EnvValue>

/**
 * 配置验证错误类型
 */
export interface ConfigError {
  type: 'critical' | 'warning' | 'info'
  key: string
  value: string
  message: string
  suggestion: string
}

/**
 * 配置验证结果类型
 */
export interface ConfigValidationResult {
  isValid: boolean
  errors: ConfigError[]
  warnings: ConfigError[]
  info: ConfigError[]
}

const raw: ViteEnvRecord = import.meta.env as ViteEnvRecord

function normalize(v: EnvValue): string {
  const s = String(v ?? '')
  return s.trim().toLowerCase()
}

function parseBool(v: EnvValue, def: boolean): boolean {
  const n = normalize(v)
  if (n === 'true' || n === 'on' || n === '1' || n === 'yes') return true
  if (n === 'false' || n === 'off' || n === '0' || n === 'no') return false
  return def
}

export function readFlag(name: string, def: boolean): boolean {
  const v = raw[name]
  return parseBool(v, def)
}

/**
 * 关键配置项定义
 * 这些配置项错误应该阻止应用启动
 */
const CRITICAL_CONFIGS = {
  VITE_APP_NAME: {
    required: false,
    validate: (v: string) => v.length > 0,
    message: '应用名称不能为空',
    suggestion: '在 .env 中设置 VITE_APP_NAME="HuLa"'
  },
  VITE_MATRIX_SERVER_NAME: {
    required: false,
    validate: (v: string) => !v || v.includes('.'),
    message: 'Matrix 服务器名称必须是有效的域名',
    suggestion: '设置 VITE_MATRIX_SERVER_NAME=your-domain.com (例如 cjystx.top)'
  }
}

/**
 * 功能依赖关系定义
 * 用于检测功能开关配置是否合理
 */
const FEATURE_DEPENDENCIES = {
  VITE_MATRIX_MEDIA_ENABLED: {
    dependsOn: ['VITE_MATRIX_ENABLED', 'VITE_MATRIX_ROOMS_ENABLED'],
    message: '媒体上传需要 Matrix 和房间功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED 和 VITE_MATRIX_ROOMS_ENABLED'
  },
  VITE_MATRIX_E2EE_ENABLED: {
    dependsOn: ['VITE_MATRIX_ENABLED'],
    message: '端到端加密需要 Matrix 功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED'
  },
  VITE_MATRIX_RTC_ENABLED: {
    dependsOn: ['VITE_MATRIX_ENABLED'],
    message: 'RTC 通话需要 Matrix 功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED'
  },
  VITE_MATRIX_ADMIN_ENABLED: {
    dependsOn: ['VITE_MATRIX_ENABLED'],
    message: '管理功能需要 Matrix 功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED'
  },
  // 移动端Matrix功能依赖
  VITE_MOBILE_MATRIX_SPACES: {
    dependsOn: ['VITE_MATRIX_ENABLED', 'VITE_MOBILE_FEATURES_ENABLED'],
    message: '移动端 Spaces 需要 Matrix 和移动端功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED 和 VITE_MOBILE_FEATURES_ENABLED'
  },
  VITE_MOBILE_MATRIX_ROOM_SEARCH: {
    dependsOn: ['VITE_MATRIX_ENABLED', 'VITE_MOBILE_FEATURES_ENABLED'],
    message: '移动端房间搜索需要 Matrix 和移动端功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED 和 VITE_MOBILE_FEATURES_ENABLED'
  },
  VITE_MOBILE_MATRIX_E2EE_SETTINGS: {
    dependsOn: ['VITE_MATRIX_ENABLED', 'VITE_MATRIX_E2EE_ENABLED', 'VITE_MOBILE_FEATURES_ENABLED'],
    message: '移动端 E2EE 设置需要 Matrix E2EE 和移动端功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED, VITE_MATRIX_E2EE_ENABLED 和 VITE_MOBILE_FEATURES_ENABLED'
  },
  VITE_MOBILE_MATRIX_ADVANCED_ROOM_SETTINGS: {
    dependsOn: ['VITE_MATRIX_ENABLED', 'VITE_MOBILE_FEATURES_ENABLED'],
    message: '移动端高级房间设置需要 Matrix 和移动端功能已启用',
    suggestion: '启用 VITE_MATRIX_ENABLED 和 VITE_MOBILE_FEATURES_ENABLED'
  }
}

export const flags = {
  matrixEnabled: readFlag('VITE_MATRIX_ENABLED', true),
  matrixRoomsEnabled: readFlag('VITE_MATRIX_ROOMS_ENABLED', true),
  matrixMediaEnabled: readFlag('VITE_MATRIX_MEDIA_ENABLED', false),
  matrixPushEnabled: readFlag('VITE_MATRIX_PUSH_ENABLED', false),
  matrixE2eeEnabled: readFlag('VITE_MATRIX_E2EE_ENABLED', false),
  matrixRtcEnabled: readFlag('VITE_MATRIX_RTC_ENABLED', false),
  matrixAdminEnabled: readFlag('VITE_MATRIX_ADMIN_ENABLED', false),
  matrixSearchEnabled: readFlag('VITE_MATRIX_SEARCH_ENABLED', true),
  matrixReactionsEnabled: readFlag('VITE_MATRIX_REACTIONS_ENABLED', true),
  matrixPushRulesEnabled: readFlag('VITE_MATRIX_PUSH_RULES_ENABLED', true),
  synapseFriendsEnabled: readFlag('VITE_SYNAPSE_FRIENDS_ENABLED', true),
  mobileFeaturesEnabled: readFlag('VITE_MOBILE_FEATURES_ENABLED', false),

  // 移动端细粒度功能开关
  mobile: {
    // 下拉刷新
    pullToRefresh: readFlag('VITE_MOBILE_PULL_TO_REFRESH', true),
    // 长按菜单
    longPressMenus: readFlag('VITE_MOBILE_LONG_PRESS_MENUS', true),
    // 图片缓存
    imageCache: readFlag('VITE_MOBILE_IMAGE_CACHE', true),
    // 滑动手势
    swipeGestures: readFlag('VITE_MOBILE_SWIPE_GESTURES', true),
    // 触觉反馈
    hapticFeedback: readFlag('VITE_MOBILE_HAPTIC_FEEDBACK', true),
    // 安全区域适配
    safeAreaInset: readFlag('VITE_MOBILE_SAFE_AREA_INSET', true),
    // 虚拟滚动
    virtualScroll: readFlag('VITE_MOBILE_VIRTUAL_SCROLL', true),
    // 图片懒加载
    imageLazyLoad: readFlag('VITE_MOBILE_IMAGE_LAZY_LOAD', true),
    // 移动端Matrix Spaces
    matrixSpaces: readFlag('VITE_MOBILE_MATRIX_SPACES', false),
    // 移动端房间搜索
    matrixRoomSearch: readFlag('VITE_MOBILE_MATRIX_ROOM_SEARCH', false),
    // 移动端E2EE设置
    matrixE2EESettings: readFlag('VITE_MOBILE_MATRIX_E2EE_SETTINGS', false),
    // 移动端高级房间设置
    matrixAdvancedRoomSettings: readFlag('VITE_MOBILE_MATRIX_ADVANCED_ROOM_SETTINGS', false)
  }
}

export function flagSummary(): string {
  return JSON.stringify(flags)
}

/**
 * 验证环境变量配置
 *
 * @returns 配置验证结果，包含错误、警告和信息
 */
export function validateEnvFlags(): ConfigValidationResult {
  const errors: ConfigError[] = []
  const warnings: ConfigError[] = []
  const info: ConfigError[] = []

  // 1. 验证布尔型环境变量格式
  const boolKeys = [
    'VITE_MATRIX_ENABLED',
    'VITE_MATRIX_ROOMS_ENABLED',
    'VITE_MATRIX_MEDIA_ENABLED',
    'VITE_MATRIX_PUSH_ENABLED',
    'VITE_MATRIX_E2EE_ENABLED',
    'VITE_MATRIX_RTC_ENABLED',
    'VITE_MATRIX_ADMIN_ENABLED',
    'VITE_MATRIX_SEARCH_ENABLED',
    'VITE_MATRIX_REACTIONS_ENABLED',
    'VITE_MATRIX_PUSH_RULES_ENABLED',
    'VITE_SYNAPSE_FRIENDS_ENABLED',
    'VITE_MOBILE_FEATURES_ENABLED',
    'VITE_MOBILE_PULL_TO_REFRESH',
    'VITE_MOBILE_LONG_PRESS_MENUS',
    'VITE_MOBILE_IMAGE_CACHE',
    'VITE_MOBILE_SWIPE_GESTURES',
    'VITE_MOBILE_HAPTIC_FEEDBACK',
    'VITE_MOBILE_SAFE_AREA_INSET',
    'VITE_MOBILE_VIRTUAL_SCROLL',
    'VITE_MOBILE_IMAGE_LAZY_LOAD',
    'VITE_MOBILE_MATRIX_SPACES',
    'VITE_MOBILE_MATRIX_ROOM_SEARCH',
    'VITE_MOBILE_MATRIX_E2EE_SETTINGS',
    'VITE_MOBILE_MATRIX_ADVANCED_ROOM_SETTINGS',
    'VITE_MATRIX_DEV_SYNC',
    'VITE_DEV_PERF'
  ]

  for (const key of boolKeys) {
    const v = raw[key]
    const n = normalize(v)
    if (v !== undefined && !['true', 'false', 'on', 'off', '1', '0', 'yes', 'no'].includes(n)) {
      warnings.push({
        type: 'warning',
        key,
        value: String(v),
        message: `布尔值格式不正确，应为 on/off/true/false/1/0/yes/no`,
        suggestion: `设置 ${key}=on 或 ${key}=off`
      })
    }
  }

  // 2. 验证关键配置项
  for (const [key, config] of Object.entries(CRITICAL_CONFIGS)) {
    const value = String(raw[key] || '')
    if (config.required && !value) {
      errors.push({
        type: 'critical',
        key,
        value: '(未设置)',
        message: config.message,
        suggestion: config.suggestion
      })
    } else if (value && !config.validate(value)) {
      errors.push({
        type: 'critical',
        key,
        value,
        message: config.message,
        suggestion: config.suggestion
      })
    }
  }

  // 3. 检查功能依赖关系
  for (const [featureKey, depConfig] of Object.entries(FEATURE_DEPENDENCIES)) {
    const featureEnabled = parseBool(raw[featureKey], false)
    if (featureEnabled) {
      for (const depKey of depConfig.dependsOn) {
        const depEnabled = parseBool(raw[depKey], false)
        if (!depEnabled) {
          warnings.push({
            type: 'warning',
            key: featureKey,
            value: String(raw[featureKey]),
            message: depConfig.message,
            suggestion: depConfig.suggestion
          })
        }
      }
    }
  }

  // 4. 提供灰度功能状态信息
  if (!flags.matrixMediaEnabled) {
    info.push({
      type: 'info',
      key: 'VITE_MATRIX_MEDIA_ENABLED',
      value: 'off',
      message: '媒体上传功能未启用',
      suggestion: '如需发送图片/视频等媒体文件，请设置 VITE_MATRIX_MEDIA_ENABLED=on'
    })
  }
  if (!flags.matrixE2eeEnabled) {
    info.push({
      type: 'info',
      key: 'VITE_MATRIX_E2EE_ENABLED',
      value: 'off',
      message: '端到端加密功能未启用',
      suggestion: '如需加密聊天功能，请设置 VITE_MATRIX_E2EE_ENABLED=on'
    })
  }
  if (!flags.matrixRtcEnabled) {
    info.push({
      type: 'info',
      key: 'VITE_MATRIX_RTC_ENABLED',
      value: 'off',
      message: 'RTC 音视频通话功能未启用',
      suggestion: '如需音视频通话功能，请设置 VITE_MATRIX_RTC_ENABLED=on'
    })
  }

  // 5. 移动端功能状态信息
  if (!flags.mobileFeaturesEnabled) {
    info.push({
      type: 'info',
      key: 'VITE_MOBILE_FEATURES_ENABLED',
      value: 'off',
      message: '移动端功能未启用',
      suggestion: '如需使用移动端，请设置 VITE_MOBILE_FEATURES_ENABLED=on'
    })
  }
  if (flags.mobileFeaturesEnabled && !flags.mobile.matrixSpaces) {
    info.push({
      type: 'info',
      key: 'VITE_MOBILE_MATRIX_SPACES',
      value: 'off',
      message: '移动端 Spaces 功能未启用',
      suggestion: '如需在移动端使用 Spaces，请设置 VITE_MOBILE_MATRIX_SPACES=on'
    })
  }
  if (flags.mobileFeaturesEnabled && !flags.mobile.matrixRoomSearch) {
    info.push({
      type: 'info',
      key: 'VITE_MOBILE_MATRIX_ROOM_SEARCH',
      value: 'off',
      message: '移动端房间搜索功能未启用',
      suggestion: '如需在移动端搜索房间，请设置 VITE_MOBILE_MATRIX_ROOM_SEARCH=on'
    })
  }
  if (flags.mobileFeaturesEnabled && !flags.mobile.matrixE2EESettings) {
    info.push({
      type: 'info',
      key: 'VITE_MOBILE_MATRIX_E2EE_SETTINGS',
      value: 'off',
      message: '移动端 E2EE 设置功能未启用',
      suggestion: '如需在移动端管理 E2EE，请设置 VITE_MOBILE_MATRIX_E2EE_SETTINGS=on'
    })
  }

  // 判断整体配置是否有效（仅关键错误会导致无效）
  const isValid = errors.length === 0

  return {
    isValid,
    errors,
    warnings,
    info
  }
}

/**
 * 向后兼容的验证函数（已废弃，请使用 validateEnvFlags）
 * @deprecated 使用 validateEnvFlags() 替代，以获取更详细的验证信息
 */
export function validateEnvFlagsLegacy(): { warnings: string[] } {
  const result = validateEnvFlags()
  const warnings = [...result.errors, ...result.warnings].map((e) => `${e.key}=${e.value}`)
  return { warnings }
}
