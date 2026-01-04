export interface VirtualItem {
  _index: number
  _top: number
  [key: string]: unknown
}

export interface ItemPosition {
  index: number
  top: number
  height: number
}

export interface VirtualListProps {
  items: unknown[]
  estimatedItemHeight?: number
  buffer?: number
  isLoadingMore?: boolean
  isLast?: boolean
  listKey?: string | number
  hideScrollbar?: boolean
  itemKey?: string
  dynamicHeight?: boolean
}

export interface VirtualListEmits {
  scroll: [event: Event]
  scrollDirectionChange: [direction: 'up' | 'down']
  loadMore: []
  mouseenter: []
  mouseleave: []
  visibleItemsChange: [items: VirtualItem[]]
  itemResize: [index: number, height: number]
}

export interface ScrollDirection {
  value: 'up' | 'down' | null
}
