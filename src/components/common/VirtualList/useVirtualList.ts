import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import type { VirtualItem } from './types'

// Interface for items with id or message.id
interface ItemWithId {
  id?: string | number
  message?: {
    id?: string | number
  }
}

export interface VirtualListOptions {
  items: unknown[]
  estimatedItemHeight?: number
  buffer?: number
  onVisibleItemsChange?: (visibleItems: VirtualItem[]) => void
}

export function useVirtualList(options: VirtualListOptions) {
  const { items, estimatedItemHeight = 86, buffer = 5, onVisibleItemsChange } = options

  // refs
  const containerRef = ref<HTMLElement>()
  const contentRef = ref<HTMLElement>()
  const phantomRef = ref<HTMLElement>()

  // state
  const scrollTop = ref(0)
  const containerHeightValue = ref(0)
  const isScrolling = ref(false)
  const scrollStopTimer: number | null = null

  // 缓存每个项目的实际高度
  const itemHeights = new Map<string | number, number>()
  const itemPositions = ref<Array<{ index: number; top: number; height: number }>>([])

  // 计算总高度
  const totalHeight = computed(() => {
    if (itemPositions.value.length === 0) {
      return items.length * estimatedItemHeight
    }

    const lastItem = itemPositions.value[itemPositions.value.length - 1]
    if (!lastItem) return 0
    return lastItem.top + lastItem.height
  })

  // 更新项目位置
  const updateItemPositions = () => {
    const positions: Array<{ index: number; top: number; height: number }> = []
    let currentTop = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as ItemWithId
      const itemId = item.id || item.message?.id || i
      const height = itemHeights.get(String(itemId)) || estimatedItemHeight

      positions.push({
        index: i,
        top: currentTop,
        height
      })

      currentTop += height
    }

    itemPositions.value = positions
  }

  // 计算可见项目的索引范围
  const visibleRange = computed(() => {
    if (!containerHeightValue.value || itemPositions.value.length === 0) {
      return { start: 0, end: 0 }
    }

    const scrollTopValue = scrollTop.value
    const start = itemPositions.value.findIndex((pos) => pos.top + pos.height > scrollTopValue)
    const end = itemPositions.value.findIndex((pos) => pos.top > scrollTopValue + containerHeightValue.value)

    // 添加缓冲区
    const bufferedStart = Math.max(0, start - buffer)
    const bufferedEnd = end === -1 ? items.length : Math.min(items.length, end + buffer)

    return { start: bufferedStart, end: bufferedEnd }
  })

  // 获取可见项目
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    const result: VirtualItem[] = []

    for (let i = start; i < end; i++) {
      if (i >= 0 && i < items.length && itemPositions.value[i]) {
        const item = items[i] as ItemWithId
        result.push({
          ...(item || {}),
          _index: i,
          _top: itemPositions.value[i]!.top
        })
      }
    }

    return result
  })

  // 更新项目高度
  const updateItemHeight = (index: number, height: number) => {
    const item = items[index] as ItemWithId
    if (!item) return

    const itemId = item.id || item.message?.id || index
    const oldHeight = itemHeights.get(String(itemId)) || estimatedItemHeight

    if (Math.abs(height - oldHeight) > 1) {
      itemHeights.set(String(itemId), height)

      // 重新计算从该项开始的所有位置
      let currentTop = 0
      if (index > 0 && itemPositions.value[index - 1]) {
        currentTop = itemPositions.value[index - 1]!.top + itemPositions.value[index - 1]!.height
      }

      for (let i = index; i < items.length; i++) {
        const currentItem = items[i] as ItemWithId
        const currentItemId = currentItem.id || currentItem.message?.id || i
        const currentHeight = itemHeights.get(String(currentItemId)) || estimatedItemHeight

        itemPositions.value[i] = {
          index: i,
          top: currentTop,
          height: currentHeight
        }

        currentTop += currentHeight
      }
    }
  }

  // 滚动到指定项目
  const scrollToItem = (index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    if (!containerRef.value || !itemPositions.value[index]) return

    const itemPosition = itemPositions.value[index]
    let scrollTo = 0

    switch (alignment) {
      case 'start':
        scrollTo = itemPosition.top
        break
      case 'center':
        scrollTo = itemPosition.top - (containerHeightValue.value - itemPosition.height) / 2
        break
      case 'end':
        scrollTo = itemPosition.top - containerHeightValue.value + itemPosition.height
        break
    }

    containerRef.value.scrollTo({
      top: scrollTo,
      behavior: 'smooth'
    })
  }

  // 滚动到底部
  const scrollToBottom = () => {
    if (!containerRef.value) return

    containerRef.value.scrollTo({
      top: totalHeight.value,
      behavior: 'smooth'
    })
  }

  // 防抖的可见项目变化处理
  const handleVisibleItemsChange = useDebounceFn(() => {
    onVisibleItemsChange?.(visibleItems.value)
  }, 100)

  // 监听滚动位置变化
  watch(scrollTop, handleVisibleItemsChange)

  // 监听项目变化
  watch(
    items,
    () => {
      nextTick(() => {
        updateItemPositions()
      })
    },
    { deep: true, immediate: true }
  )

  // 监听容器高度变化
  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0]
    if (entry) {
      containerHeightValue.value = entry.contentRect.height
    }
  })

  // 初始化
  onMounted(() => {
    nextTick(() => {
      if (containerRef.value) {
        containerHeightValue.value = containerRef.value.clientHeight
      }
      updateItemPositions()
    })
  })

  // 清理
  onUnmounted(() => {
    if (scrollStopTimer !== null) {
      clearTimeout(scrollStopTimer)
    }
  })

  return {
    // refs
    containerRef,
    contentRef,
    phantomRef,

    // state
    scrollTop,
    totalHeight,
    visibleItems,
    visibleRange,
    isScrolling,
    containerHeight: computed(() => containerHeightValue.value),

    // methods
    updateItemHeight,
    scrollToItem,
    scrollToBottom,
    updateItemPositions
  }
}
