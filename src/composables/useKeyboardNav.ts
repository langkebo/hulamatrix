import { onMounted, onUnmounted, type Ref } from 'vue'

export interface KeyboardNavOptions {
  selectors?: string[]
  loop?: boolean
  onEscape?: () => void
  onEnter?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onHome?: () => void
  onEnd?: () => void
}

export interface KeyboardNavReturn {
  setup: (containerRef: Ref<HTMLElement | null>) => void
  getFocusableElements: (container: Element) => HTMLElement[]
}

/**
 * Keyboard navigation composable for accessible component navigation
 *
 * @example
 * ```ts
 * const { setup } = useKeyboardNav({
 *   loop: true,
 *   onEscape: () => closeModal()
 * })
 *
 * const modalRef = ref<HTMLElement | null>(null)
 * setup(modalRef)
 * ```
 */
export function useKeyboardNav(options: KeyboardNavOptions = {}): KeyboardNavReturn {
  const {
    selectors = ['button', '[tabindex]:not([tabindex="-1"])', 'a[href]', 'input', 'select', 'textarea'],
    loop = true,
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd
  } = options

  let focusableElements: HTMLElement[] = []

  /**
   * Get all focusable elements within a container
   */
  const getFocusableElements = (container: Element): HTMLElement[] => {
    return Array.from(
      container.querySelectorAll<HTMLElement>(selectors.join(', '))
    ).filter((el) => {
      return (
        !el.disabled &&
        !el.hidden &&
        el.offsetParent !== null &&
        el.tabIndex >= 0 &&
        getComputedStyle(el).visibility !== 'hidden' &&
        getComputedStyle(el).display !== 'none'
      )
    })
  }

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement
    const container = event.currentTarget as Element

    switch (event.key) {
      case 'Tab':
        if (!loop) break

        focusableElements = getFocusableElements(container)
        const currentIndex = focusableElements.indexOf(activeElement)

        if (currentIndex === -1) break

        const isFirst = currentIndex === 0 && event.shiftKey
        const isLast = currentIndex === focusableElements.length - 1 && !event.shiftKey

        if (isFirst || isLast) {
          event.preventDefault()
          const nextIndex = isFirst ? focusableElements.length - 1 : 0
          focusableElements[nextIndex]?.focus()
        }
        break

      case 'Escape':
        event.preventDefault()
        onEscape?.()
        break

      case 'Enter':
        // Handle Enter key for non-button elements with role="button"
        if (
          activeElement?.tagName !== 'BUTTON' &&
          activeElement?.tagName !== 'INPUT' &&
          activeElement?.tagName !== 'TEXTAREA' &&
          activeElement?.getAttribute('role') === 'button'
        ) {
          event.preventDefault()
          onEnter?.()
        }
        break

      case 'ArrowDown':
      case 'ArrowUp':
        // Vertical list navigation
        focusableElements = getFocusableElements(container)
        const currentIndexList = focusableElements.indexOf(activeElement)

        if (currentIndexList === -1) break

        event.preventDefault()
        const directionV = event.key === 'ArrowDown' ? 1 : -1
        let nextIndexV = currentIndexList + directionV

        if (loop) {
          nextIndexV = (nextIndexV + focusableElements.length) % focusableElements.length
        } else {
          nextIndexV = Math.max(0, Math.min(nextIndexV, focusableElements.length - 1))
        }

        focusableElements[nextIndexV]?.focus()
        onArrowDown?.()
        break

      case 'ArrowLeft':
      case 'ArrowRight':
        // Horizontal navigation
        focusableElements = getFocusableElements(container)
        const currentIndexH = focusableElements.indexOf(activeElement)

        if (currentIndexH === -1) break

        event.preventDefault()
        const directionH = event.key === 'ArrowRight' ? 1 : -1
        let nextIndexH = currentIndexH + directionH

        if (loop) {
          nextIndexH = (nextIndexH + focusableElements.length) % focusableElements.length
        } else {
          nextIndexH = Math.max(0, Math.min(nextIndexH, focusableElements.length - 1))
        }

        focusableElements[nextIndexH]?.focus()
        if (event.key === 'ArrowRight') {
          onArrowRight?.()
        } else {
          onArrowLeft?.()
        }
        break

      case 'Home':
        // Navigate to first item
        event.preventDefault()
        focusableElements = getFocusableElements(container)
        focusableElements[0]?.focus()
        onHome?.()
        break

      case 'End':
        // Navigate to last item
        event.preventDefault()
        focusableElements = getFocusableElements(container)
        focusableElements[focusableElements.length - 1]?.focus()
        onEnd?.()
        break
    }
  }

  /**
   * Set up keyboard navigation on a container element
   */
  const setup = (containerRef: Ref<HTMLElement | null>) => {
    onMounted(() => {
      const container = containerRef.value
      if (!container) return

      focusableElements = getFocusableElements(container)
      container.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
      const container = containerRef.value
      if (!container) return
      container.removeEventListener('keydown', handleKeyDown)
    })
  }

  return {
    setup,
    getFocusableElements
  }
}

/**
 * Focus trap composable to keep focus within a modal/dialog
 *
 * @example
 * ```ts
 * const { setup: setupFocusTrap } = useFocusTrap({
 *   onEscape: () => closeModal()
 * })
 *
 * const modalRef = ref<HTMLElement | null>(null)
 * setupFocusTrap(modalRef)
 * ```
 */
export function useFocusTrap(options: Pick<KeyboardNavOptions, 'onEscape'> = {}) {
  return useKeyboardNav({
    ...options,
    loop: true,
    selectors: [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ]
  })
}

/**
 * List navigation composable for vertical lists
 *
 * @example
 * ```ts
 * const { setup: setupListNav } = useListNavigation({
 *   onArrowUp: () => selectPrevious(),
 *   onArrowDown: () => selectNext(),
 *   onEnter: () => openSelectedItem()
 * })
 * ```
 */
export function useListNavigation(options: Pick<
  KeyboardNavOptions,
  'onArrowUp' | 'onArrowDown' | 'onEnter' | 'loop'
> = {}) {
  return useKeyboardNav({
    ...options,
    selectors: ['[role="listitem"]', '[role="option"]', 'button', 'a[href]']
  })
}

/**
 * Grid navigation composable for 2D navigation
 *
 * @example
 * ```ts
 * const { setup: setupGridNav } = useGridNavigation({
 *   columns: 3,
 *   onArrowUp: () => moveUp(),
 *   onArrowDown: () => moveDown(),
 *   onArrowLeft: () => moveLeft(),
 *   onArrowRight: () => moveRight()
 * })
 * ```
 */
export function useGridNavigation(options: {
  columns?: number
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onEnter?: () => void
  loop?: boolean
}) {
  const { columns = 3, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, loop = true } = options

  return useKeyboardNav({
    loop,
    onEnter,
    onArrowUp: () => {
      // Custom grid navigation logic can be added here
      onArrowUp?.()
    },
    onArrowDown: () => {
      onArrowDown?.()
    },
    onArrowLeft: () => {
      onArrowLeft?.()
    },
    onArrowRight: () => {
      onArrowRight?.()
    }
  })
}
