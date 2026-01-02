/**
 * UI交互简化工具
 * 提供简化的常用交互模式
 */

import { ref, Ref, nextTick } from 'vue'
import { debounce, throttle } from 'es-toolkit'

/** 状态更新函数类型 */
type StateUpdater<T> = T | ((prev: T) => T)

/** 简单的状态管理 */
export function useSimpleState<T>(initial: T) {
  const state = ref(initial) as Ref<T>

  const setState = (newState: StateUpdater<T>) => {
    if (typeof newState === 'function') {
      state.value = (newState as (prev: T) => T)(state.value)
    } else {
      state.value = newState
    }
  }

  const reset = () => {
    state.value = initial
  }

  return {
    state,
    setState,
    reset
  }
}

/** 简化的加载状态 */
export function useLoading(initial = false) {
  const { state: isLoading, setState: setLoading } = useSimpleState(initial)

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true)
    try {
      return await fn()
    } finally {
      setLoading(false)
    }
  }

  return {
    isLoading,
    setLoading,
    withLoading
  }
}

/** 简化的确认对话框 */
export function useConfirm() {
  const { state: isVisible, setState: setVisible } = useSimpleState(false)
  const { state: isLoading, setState: setLoading } = useSimpleState(false)
  const title = ref('')
  const content = ref('')
  let resolveFn: ((value: boolean) => void) | null = null

  const confirm = (options: { title: string; content: string }): Promise<boolean> => {
    return new Promise((resolve) => {
      title.value = options.title
      content.value = options.content
      setVisible(true)
      resolveFn = resolve
    })
  }

  const onConfirm = async () => {
    if (!resolveFn) return

    setLoading(true)
    try {
      await nextTick()
      resolveFn(true)
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  const onCancel = () => {
    if (!resolveFn) return
    resolveFn(false)
    setVisible(false)
  }

  return {
    isVisible,
    isLoading,
    title,
    content,
    confirm,
    onConfirm,
    onCancel
  }
}

/** 简化的提示消息 */
export function useMessage() {
  const { state: messages, setState: setMessages } = useSimpleState<
    Array<{
      id: string
      type: 'success' | 'error' | 'warning' | 'info'
      content: string
      duration?: number
    }>
  >([])

  const show = (content: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) => {
    const id = Date.now().toString()
    const message = { id, type, content, duration }

    setMessages((prev) => [...prev, message])

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  const remove = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }

  const clear = () => {
    setMessages([])
  }

  return {
    messages,
    show,
    success: (content: string, duration?: number) => show(content, 'success', duration),
    error: (content: string, duration?: number) => show(content, 'error', duration),
    warning: (content: string, duration?: number) => show(content, 'warning', duration),
    info: (content: string, duration?: number) => show(content, 'info', duration),
    remove,
    clear
  }
}

/** 模态框选项 */
export interface ModalOptions {
  title?: string
}

/** 简化的弹窗控制 */
export function useModal<T = unknown>() {
  const { state: isVisible, setState: setVisible } = useSimpleState(false)
  const { state: title, setState: setTitle } = useSimpleState('')
  const { state: isLoading, setState: setLoading } = useSimpleState(false)
  let resolveFn: ((value: T | undefined) => void) | null = null

  const open = (options?: ModalOptions): Promise<T | undefined> => {
    return new Promise<T | undefined>((resolve) => {
      if (options?.title) {
        setTitle(options.title)
      }
      setVisible(true)
      resolveFn = resolve
    })
  }

  const close = (result?: T) => {
    if (resolveFn) {
      resolveFn(result)
      resolveFn = null
    }
    setVisible(false)
    setTitle('')
  }

  return {
    isVisible,
    title,
    isLoading,
    open,
    close,
    setLoading
  }
}

/** 简化的列表选择 */
export function useSelection<T>(items: T[] = [], keyExtractor?: (item: T) => string) {
  const { state: selectedItems, setState: setSelectedItems } = useSimpleState<T[]>([])
  const { state: lastSelectedIndex, setState: setLastSelectedIndex } = useSimpleState(-1)

  const select = (item: T, index?: number) => {
    setSelectedItems([item])
    if (index !== undefined) {
      setLastSelectedIndex(index)
    }
  }

  const selectMultiple = (item: T, index?: number, shiftKey = false) => {
    if (!shiftKey) {
      setSelectedItems((prev) => {
        const isSelected = prev.some((selected) =>
          keyExtractor ? keyExtractor(selected) === keyExtractor(item) : selected === item
        )
        if (isSelected) {
          return prev.filter((selected) =>
            keyExtractor ? keyExtractor(selected) !== keyExtractor(item) : selected !== item
          )
        } else {
          return [...prev, item]
        }
      })
    } else if (lastSelectedIndex.value !== -1 && index !== undefined) {
      // Shift多选
      const start = Math.min(lastSelectedIndex.value, index)
      const end = Math.max(lastSelectedIndex.value, index)
      const range = items.slice(start, end + 1)
      setSelectedItems(range)
    }

    if (index !== undefined) {
      setLastSelectedIndex(index)
    }
  }

  const selectAll = () => {
    setSelectedItems(items)
  }

  const clear = () => {
    setSelectedItems([])
    setLastSelectedIndex(-1)
  }

  const isSelected = (item: T) => {
    return selectedItems.value.some((selected) =>
      keyExtractor ? keyExtractor(selected) === keyExtractor(item) : selected === item
    )
  }

  const isAllSelected = () => {
    return selectedItems.value.length === items.length && items.length > 0
  }

  const toggle = (item: T, index?: number) => {
    if (isSelected(item)) {
      setSelectedItems((prev) =>
        prev.filter((selected) => (keyExtractor ? keyExtractor(selected) !== keyExtractor(item) : selected !== item))
      )
    } else {
      setSelectedItems((prev) => [...prev, item])
    }
    if (index !== undefined) {
      setLastSelectedIndex(index)
    }
  }

  return {
    selectedItems,
    select,
    selectMultiple,
    selectAll,
    clear,
    isSelected,
    isAllSelected,
    toggle
  }
}

/** 简化的无限滚动 */
export function useInfiniteScroll(loadMore: () => Promise<boolean>) {
  const { state: isLoading, setState: setLoading } = useSimpleState(false)
  const { state: hasMore, setState: setHasMore } = useSimpleState(true)
  const { state: error, setState: setError } = useSimpleState<string | null>(null)

  const load = async () => {
    if (isLoading.value || !hasMore.value) return

    setLoading(true)
    setError(null)

    try {
      const result = await loadMore()
      setHasMore(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setHasMore(true)
    setError(null)
  }

  const debouncedLoad = debounce(load, 200)

  return {
    isLoading,
    hasMore,
    error,
    load,
    reset,
    debouncedLoad
  }
}

/** 简化的拖拽 */
export function useDraggable() {
  const { state: isDragging, setState: setIsDragging } = useSimpleState(false)
  const { state: position, setState: setPosition } = useSimpleState({ x: 0, y: 0 })
  const { state: startPosition, setState: setStartPosition } = useSimpleState({ x: 0, y: 0 })

  const start = (clientX: number, clientY: number) => {
    setIsDragging(true)
    setStartPosition({ x: clientX, y: clientY })
  }

  const move = (clientX: number, clientY: number) => {
    if (!isDragging.value) return

    setPosition({
      x: clientX - startPosition.value.x,
      y: clientY - startPosition.value.y
    })
  }

  const end = () => {
    setIsDragging(false)
  }

  return {
    isDragging,
    position,
    start,
    move,
    end
  }
}

/** 简化的搜索 */
export function useSearch<T>(items: T[], searchFn: (item: T, query: string) => boolean, debounceMs = 300) {
  const { state: query, setState: setQuery } = useSimpleState('')
  const { state: results, setState: setResults } = useSimpleState<T[]>(items)
  const { state: isLoading, setState: setLoading } = useSimpleState(false)

  const search = debounce((newQuery: string) => {
    setQuery(newQuery)
    setLoading(true)

    const filtered = items.filter((item) => searchFn(item, newQuery))
    setResults(filtered)
    setLoading(false)
  }, debounceMs)

  const clear = () => {
    setQuery('')
    setResults(items)
  }

  return {
    query,
    results,
    isLoading,
    search,
    clear
  }
}

/** 简化的键盘快捷键 */
export function useKeyboard() {
  const { state: pressedKeys, setState: setPressedKeys } = useSimpleState<Set<string>>(new Set())

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (!pressedKeys.value.has(key)) {
      setPressedKeys(new Set([...pressedKeys.value, key]))
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    setPressedKeys(new Set([...pressedKeys.value].filter((k) => k !== key)))
  }

  const isPressed = (key: string) => {
    return pressedKeys.value.has(key.toLowerCase())
  }

  const isHotkey = (keys: string[], event: KeyboardEvent) => {
    return keys.every((key) => {
      const k = key.toLowerCase()
      if (k === 'ctrl') return event.ctrlKey
      if (k === 'shift') return event.shiftKey
      if (k === 'alt') return event.altKey
      if (k === 'meta') return event.metaKey
      return event.key.toLowerCase() === k
    })
  }

  return {
    pressedKeys,
    onKeyDown,
    onKeyUp,
    isPressed,
    isHotkey
  }
}

/** 简化的防抖/节流输入 */
export function useThrottledInput(initialValue: string = '', delay: number = 300) {
  const { state: value, setState: setValue } = useSimpleState(initialValue)
  const { state: throttledValue, setState: setThrottledValue } = useSimpleState(initialValue)

  const updateValue = throttle((newValue: string) => {
    setThrottledValue(newValue)
  }, delay)

  const onChange = (newValue: string) => {
    setValue(newValue)
    updateValue(newValue)
  }

  return {
    value,
    throttledValue,
    onChange,
    setValue
  }
}
