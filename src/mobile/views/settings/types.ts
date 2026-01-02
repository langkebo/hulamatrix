/**
 * Mobile Settings Types
 * 移动端设置功能类型定义
 */

/**
 * 设置项类型
 */
export enum SettingsItemType {
  SWITCH = 'switch', // 开关
  INPUT = 'input', // 输入框
  SELECT = 'select', // 下拉选择
  NAVIGATION = 'navigation', // 导航到子页面
  ACTION = 'action', // 点击执行操作
  DIVIDER = 'divider', // 分隔线
  SECTION = 'section' // 分组标题
}

/**
 * 设置项数据接口
 */
export interface SettingsItem {
  key: string // 唯一标识
  type: SettingsItemType // 设置项类型
  label: string // 显示文本
  icon?: string // 图标名称（可选）
  value?: string | boolean | number // 当前值
  defaultValue?: string | boolean | number // 默认值
  options?: SelectOption[] // 选择项（仅 SELECT 类型）
  route?: string // 目标路由（仅 NAVIGATION 类型）
  action?: () => void // 点击操作（仅 ACTION 类型）
  disabled?: boolean // 是否禁用
  visible?: boolean // 是否显示
  description?: string // 描述文本
}

/**
 * 选择项接口
 * Compatible with Naive UI SelectMixedOption
 */
export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
  type?: 'group' | 'divider' | 'ignored'
  children?: SelectOption[]
}

/**
 * 设置分组接口
 */
export interface SettingsSection {
  title: string // 分组标题
  items: SettingsItem[] // 设置项列表
}

/**
 * 设置页面配置
 */
export interface SettingsPageConfig {
  title: string // 页面标题
  sections: SettingsSection[] // 分组列表
}
