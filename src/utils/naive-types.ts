/**
 * Naive UI 组件的严格类型定义
 * 用于处理 exactOptionalPropertyTypes 模式下的类型问题
 */

import type {
  ImageProps as NaiveImageProps,
  AvatarProps as NaiveAvatarProps,
  VirtualListProps as NaiveVirtualListProps
} from 'naive-ui'
import { createNaiveProps } from './types'

// ============================================================================
// CSS 样式类型
// ============================================================================

/**
 * CSS 属性值类型
 */
type CSSValue = string | number | undefined | null

/**
 * CSS 样式对象类型
 */
export interface CSSStyle extends Record<string, CSSValue> {}

// ============================================================================
// 严格模式的 Image 组件 Props
// ============================================================================

export interface StrictImageProps extends Omit<NaiveImageProps, 'width' | 'height' | 'alt' | 'src'> {
  width?: string | number | null
  height?: string | number | null
  alt?: string | null
  src?: string | null
  class?: string
  style?: string | CSSStyle
  onClick?: (event: MouseEvent) => void
}

// ============================================================================
// 严格模式的 Avatar 组件 Props
// ============================================================================

export interface StrictAvatarProps extends Omit<NaiveAvatarProps, 'size' | 'src' | 'fallbackSrc' | 'color' | 'round'> {
  size?: number | string | null
  src?: string | null
  fallbackSrc?: string | null
  color?: string | null
  round?: boolean | null
  class?: string
  style?: string | CSSStyle
  onError?: (event: Event) => void
  onLoad?: (event: Event) => void
}

// ============================================================================
// 严格模式的 VirtualList 组件 Props
// ============================================================================

export interface StrictVirtualListProps<T = unknown>
  extends Omit<NaiveVirtualListProps, 'itemSize' | 'items' | 'showScrollbar'> {
  itemSize?: number | null
  items?: T[] | null
  showScrollbar?: boolean | null
  class?: string
  style?: string | CSSStyle
  onVisibleItemsChange?: (items: T[]) => void
}

/**
 * 创建严格的 Image 组件 Props
 */
export function createStrictImageProps(props: {
  width?: string | number | null
  height?: string | number | null
  alt?: string | null
  src?: string | null
  class?: string
  style?: string | CSSStyle
  onClick?: (event: MouseEvent) => void
  [key: string]: unknown
}): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (props.width !== undefined && props.width !== null) {
    result.width = props.width
  }
  if (props.height !== undefined && props.height !== null) {
    result.height = props.height
  }
  if (props.alt !== undefined && props.alt !== null) {
    result.alt = props.alt
  }
  if (props.src !== undefined && props.src !== null) {
    result.src = props.src
  }
  if (props.class) {
    result.class = props.class
  }
  if (props.style) {
    result.style = props.style
  }
  if (props.onClick) {
    result.onClick = props.onClick
  }

  // 添加其他属性
  for (const key in props) {
    if (!['width', 'height', 'alt', 'src', 'class', 'style', 'onClick'].includes(key)) {
      result[key] = props[key]
    }
  }

  return result
}

/**
 * 创建严格的 Avatar 组件 Props
 */
export function createStrictAvatarProps(props: {
  size?: number | string | null
  src?: string | null
  fallbackSrc?: string | null
  color?: string | null
  round?: boolean | null
  class?: string
  style?: string | CSSStyle
  onError?: (event: Event) => void
  onLoad?: (event: Event) => void
  [key: string]: unknown
}): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (props.size !== undefined && props.size !== null) {
    result.size = props.size
  }
  if (props.src !== undefined && props.src !== null) {
    result.src = props.src
  }
  if (props.fallbackSrc !== undefined && props.fallbackSrc !== null) {
    result.fallbackSrc = props.fallbackSrc
  }
  if (props.color !== undefined && props.color !== null) {
    result.color = props.color
  }
  if (props.round !== undefined && props.round !== null) {
    result.round = props.round
  }
  if (props.class) {
    result.class = props.class
  }
  if (props.style) {
    result.style = props.style
  }
  if (props.onError) {
    result.onError = props.onError
  }
  if (props.onLoad) {
    result.onLoad = props.onLoad
  }

  // 添加其他属性
  for (const key in props) {
    if (!['size', 'src', 'fallbackSrc', 'color', 'round', 'class', 'style', 'onError', 'onLoad'].includes(key)) {
      result[key] = props[key]
    }
  }

  return result
}

/**
 * 创建严格的 VirtualList 组件 Props
 */
export function createStrictVirtualListProps<T = unknown>(props: {
  itemSize?: number | null
  items?: T[] | null
  showScrollbar?: boolean | null
  class?: string
  style?: string | CSSStyle
  onVisibleItemsChange?: (items: T[]) => void
  [key: string]: unknown
}): StrictVirtualListProps<T> {
  return createNaiveProps(props)
}
