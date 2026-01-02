// 类型工具和辅助函数

/**
 * 处理 exactOptionalPropertyTypes 问题的工具类型
 * 将可能为 undefined 的属性转换为更合适的类型
 */
export type OptionalProperty<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>> extends infer O
  ? { [P in keyof O]: O[P] }
  : never

/**
 * 安全地处理可能为 undefined 的属性值
 */
export function safeProperty<T>(value: T | undefined, defaultValue: T): T {
  return value ?? defaultValue
}

/**
 * 过滤掉 undefined 的属性值
 */
export function filterUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * 将带有 undefined 的对象转换为严格模式兼容的对象
 */
export function toStrictProps<T extends Record<string, unknown>>(
  obj: {
    [K in keyof T]: T[K] | undefined
  }
): T {
  return filterUndefined(obj as unknown as T) as T
}

/**
 * 创建严格属性的辅助函数，支持可选属性
 */
export function createStrictProps<T extends Record<string, unknown>>(props: { [K in keyof T]?: T[K] | undefined }): T {
  return filterUndefined(props as unknown as T) as T
}

/**
 * 处理 Naive UI 组件 Props 的辅助函数
 * 特别处理 exactOptionalPropertyTypes 问题
 */
export function createNaiveProps<T extends Record<string, unknown>>(props: { [K in keyof T]?: T[K] | undefined }): T {
  const result = {} as T
  for (const key in props) {
    const value = props[key]
    if (value !== undefined) {
      ;(result as Record<string, unknown>)[key] = value
    }
  }
  return result
}

/**
 * 创建组件 Props 的类型安全版本
 */
export function createComponentProps<T extends Record<string, unknown>>(
  defaultValues: T,
  overrides: { [K in keyof T]?: T[K] | undefined } = {}
): T {
  return { ...defaultValues, ...filterUndefined(overrides as unknown as T) }
}

/**
 * CSS 样式对象类型
 */
export type CSSStyle = Record<string, string | number | undefined>

/**
 * 处理样式相关的 Props
 */
export interface StyleProps {
  class?: string
  style?: string | CSSStyle
}

/**
 * 处理事件相关的 Props
 */
export interface EventProps {
  onClick?: (event: MouseEvent) => void
  onDoubleClick?: (event: MouseEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
}

/**
 * 合并 Props 的工具函数
 */
export function mergeProps<T extends Record<string, unknown>>(baseProps: T, additionalProps: Partial<T>): T {
  return { ...baseProps, ...filterUndefined(additionalProps as unknown as T) }
}

/**
 * 图片尺寸工具类型
 */
export type ImageDimensions =
  | {
      width?: string | number
      height?: string | number
    }
  | undefined

/**
 * 处理图片尺寸的工具函数
 */
export function normalizeImageSize(dimensions?: ImageDimensions): {
  width?: string | number
  height?: string | number
} {
  if (!dimensions) return {}
  return toStrictProps<{ width?: string | number; height?: string | number }>({
    width: dimensions.width,
    height: dimensions.height
  })
}

/**
 * 处理 Naive UI 组件Props的工具类型
 */
export type NaiveProps<T> = T extends infer U ? (U extends object ? { [K in keyof U]: U[K] } : never) : never

/**
 * 处理事件处理器的类型
 */
export type EventHandler<T = Event> = (event: T) => void

/**
 * 处理异步事件处理器的类型
 */
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>

/**
 * 确保类型安全的对象合并
 */
export function mergeStrict<T extends object>(target: T, source: Partial<T>): T {
  return { ...target, ...source }
}

/**
 * 创建类型守卫函数
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/**
 * 处理数组可能包含 undefined 的情况
 */
export function filterDefined<T>(array: (T | undefined)[]): T[] {
  return array.filter(isDefined)
}

/**
 * 严格的组件属性类型
 */
export interface StrictComponentProps {
  // 基础属性
  class?: string
  style?: string | CSSStyle

  // 事件处理器
  onClick?: EventHandler
  onDoubleClick?: EventHandler
  onMouseEnter?: EventHandler
  onMouseLeave?: EventHandler

  // 条件渲染
  show?: boolean

  // 尺寸相关
  width?: string | number
  height?: string | number
  size?: 'small' | 'medium' | 'large'

  // 状态相关
  disabled?: boolean
  loading?: boolean
  readonly?: boolean
}

/**
 * 创建严格属性的辅助函数
 */
export function createStrictComponentProps<T extends StrictComponentProps>(props: T): T {
  return props
}
