/**
 * 通用类型定义
 */

export * from '@/services/types'
export * from '@/typings/components'

// Re-export MessageType as MessageItem for compatibility
import type { MessageType } from '@/services/types'
import type { PluginEnum } from '@/enums'
export type MessageItem = MessageType
export type { MessageType }

// Additional properties for MessageItem that might be used in components
export interface MessageItemExtended extends MessageItem {
  readCount?: number
  messageMarks?: Record<string, { count: number; userMarked: boolean }>
}

/** 插件窗口配置 */
export interface PluginWindowConfig {
  resizable?: boolean
  minWidth?: number
  width?: number
  height?: number
}

/** 徽章对象类型 */
export interface PluginBadge {
  count?: number
  dot?: boolean
}

/** 插件尺寸配置 */
export interface PluginSize {
  width: number
  height: number
  minWidth?: number
}

/** 插件项类型定义 */
export interface PluginItem {
  /** 插件 URL 标识 */
  url: string
  /** 图标名称 */
  icon?: string | undefined
  /** 激活状态图标 */
  iconAction?: string | undefined
  /** 插件标题 */
  title?: string | undefined
  /** 短标题 */
  shortTitle?: string | undefined
  /** 提示文本 */
  tip?: string | undefined
  /** 版本号 */
  version?: string | undefined
  /** 插件状态 */
  state?: PluginEnum | number | undefined
  /** 是否已添加 */
  isAdd?: boolean | undefined
  /** 是否显示红点 */
  dot?: boolean | undefined
  /** 徽章数量 */
  badge?: number | string | PluginBadge | undefined
  /** 下载/更新进度 (0-100) */
  progress?: number | undefined
  /** 窗口尺寸 */
  size?: PluginSize | undefined
  /** 窗口配置 */
  window?: PluginWindowConfig | undefined
  /** 是否在迷你模式显示 */
  miniShow?: boolean | undefined
  /** Additional properties for extensibility */
  [key: string]: unknown
}

/** 菜单项类型定义 */
export interface MenuItem {
  /** 菜单项标签 */
  label: string
  /** 图标名称 */
  icon: string
  /** 点击事件处理函数 */
  click: () => unknown | Promise<unknown>
}
