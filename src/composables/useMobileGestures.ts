/**
 * Mobile Gesture Composable - Touch gestures for mobile devices
 *
 * Features:
 * - Swipe to reply
 * - Long press menu
 * - Double tap to like/react
 * - Swipe to delete
 * - Pinch to zoom (for images)
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { logger } from '@/utils/logger'

// ==================== Types ====================

export interface SwipeOptions {
  threshold?: number // Distance in pixels to trigger swipe
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export interface LongPressOptions {
  threshold?: number // Time in ms to trigger long press
  delay?: number // Delay before allowing tap again
  onLongPress?: (event: TouchEvent) => void
  onPress?: (event: TouchEvent) => void
}

export interface DoubleTapOptions {
  interval?: number // Max time between taps in ms
  onDoubleTap?: (event: TouchEvent) => void
  onSingleTap?: (event: TouchEvent) => void
}

export interface PinchZoomOptions {
  minScale?: number
  maxScale?: number
  onZoomStart?: (scale: number) => void
  onZoomMove?: (scale: number) => void
  onZoomEnd?: (scale: number) => void
}

// ==================== Swipe Detection ====================

export function useSwipe(targetRef: Ref<HTMLElement | undefined>, options: SwipeOptions = {}) {
  const { threshold = 80, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = options

  const startX = ref(0)
  const startY = ref(0)
  const isDragging = ref(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    startX.value = e.touches[0].clientX
    startY.value = e.touches[0].clientY
    isDragging.value = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.value || e.touches.length !== 1) return
    e.preventDefault()
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isDragging.value || e.changedTouches.length !== 1) return

    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const diffX = endX - startX.value
    const diffY = endY - startY.value

    // Check if movement is primarily horizontal or vertical
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (Math.abs(diffX) >= threshold) {
        if (diffX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (diffX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(diffY) >= threshold) {
        if (diffY > 0 && onSwipeDown) {
          onSwipeDown()
        } else if (diffY < 0 && onSwipeUp) {
          onSwipeUp()
        }
      }
    }

    isDragging.value = false
  }

  onMounted(() => {
    const el = targetRef.value
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: false })
      el.addEventListener('touchmove', handleTouchMove, { passive: false })
      el.addEventListener('touchend', handleTouchEnd)
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (el) {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  })

  return {
    isDragging
  }
}

// ==================== Long Press Detection ====================

export function useLongPress(targetRef: Ref<HTMLElement | undefined>, options: LongPressOptions = {}) {
  const { threshold = 500, delay = 300, onLongPress, onPress } = options

  const isPressed = ref(false)
  const pressTimer = ref<number | null>(null)
  const lastPressTime = ref(0)

  const start = (e: TouchEvent) => {
    // Prevent rapid repeated presses
    const now = Date.now()
    if (now - lastPressTime.value < delay) {
      return
    }

    isPressed.value = false
    pressTimer.value = window.setTimeout(() => {
      isPressed.value = true
      if (onLongPress) {
        onLongPress(e)
        logger.debug('[useLongPress] Long press triggered')
      }
    }, threshold)
  }

  const cancel = () => {
    if (pressTimer.value) {
      clearTimeout(pressTimer.value)
      pressTimer.value = null
    }
  }

  const end = (e: TouchEvent) => {
    cancel()
    lastPressTime.value = Date.now()

    if (!isPressed.value && onPress) {
      onPress(e)
    }
  }

  onMounted(() => {
    const el = targetRef.value
    if (el) {
      el.addEventListener('touchstart', start, { passive: true })
      el.addEventListener('touchend', end, { passive: true })
      el.addEventListener('touchmove', cancel, { passive: true })
      el.addEventListener('touchcancel', cancel)
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (el) {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchmove', cancel)
      el.removeEventListener('touchcancel', cancel)
    }
  })

  return {
    isPressed
  }
}

// ==================== Double Tap Detection ====================

export function useDoubleTap(targetRef: Ref<HTMLElement | undefined>, options: DoubleTapOptions = {}) {
  const { interval = 300, onDoubleTap, onSingleTap } = options

  const lastTapTime = ref(0)
  const tapTimer = ref<number | null>(null)

  const handleTap = (e: TouchEvent) => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTime.value

    if (timeSinceLastTap < interval && timeSinceLastTap > 0) {
      // Double tap detected
      if (tapTimer.value) {
        clearTimeout(tapTimer.value)
        tapTimer.value = null
      }
      if (onDoubleTap) {
        onDoubleTap(e)
        logger.debug('[useDoubleTap] Double tap triggered')
      }
      lastTapTime.value = 0
    } else {
      // Wait to see if this is a single tap or first tap of double
      lastTapTime.value = now
      tapTimer.value = window.setTimeout(() => {
        if (onSingleTap) {
          onSingleTap(e)
        }
        lastTapTime.value = 0
        tapTimer.value = null
      }, interval)
    }
  }

  onMounted(() => {
    const el = targetRef.value
    if (el) {
      el.addEventListener('touchend', handleTap, { passive: true })
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (el) {
      el.removeEventListener('touchend', handleTap)
    }
    if (tapTimer.value) {
      clearTimeout(tapTimer.value)
    }
  })

  return {}
}

// ==================== Pinch to Zoom ====================

export function usePinchZoom(targetRef: Ref<HTMLElement | undefined>, options: PinchZoomOptions = {}) {
  const { minScale = 0.5, maxScale = 3, onZoomStart, onZoomMove, onZoomEnd } = options

  const scale = ref(1)
  const isZooming = ref(false)
  const initialDistance = ref(0)
  const initialScale = ref(1)

  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      isZooming.value = true
      initialDistance.value = getDistance(e.touches[0], e.touches[1])
      initialScale.value = scale.value

      if (onZoomStart) {
        onZoomStart(scale.value)
      }

      logger.debug('[usePinchZoom] Zoom started')
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isZooming.value || e.touches.length !== 2) return

    e.preventDefault()

    const currentDistance = getDistance(e.touches[0], e.touches[1])
    const scaleFactor = currentDistance / initialDistance.value
    const newScale = Math.max(minScale, Math.min(maxScale, initialScale.value * scaleFactor))

    scale.value = newScale

    if (onZoomMove) {
      onZoomMove(newScale)
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (isZooming.value && e.touches.length < 2) {
      isZooming.value = false

      if (onZoomEnd) {
        onZoomEnd(scale.value)
      }

      logger.debug('[usePinchZoom] Zoom ended')
    }
  }

  const reset = () => {
    scale.value = 1
  }

  onMounted(() => {
    const el = targetRef.value
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: false })
      el.addEventListener('touchmove', handleTouchMove, { passive: false })
      el.addEventListener('touchend', handleTouchEnd)
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (el) {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  })

  return {
    scale,
    isZooming,
    reset
  }
}

// ==================== Swipe to Delete ====================

export function useSwipeToDelete(
  targetRef: Ref<HTMLElement | undefined>,
  onDelete: () => void,
  options: { threshold?: number; confirm?: boolean } = {}
) {
  const { threshold = 100, confirm = false } = options

  const isSwiped = ref(false)
  const swipeX = ref(0)
  const isConfirmed = ref(false)

  const handleSwipeRight = () => {
    if (!isConfirmed.value && confirm) {
      isConfirmed.value = true
      // Auto-hide confirmation after 2 seconds
      setTimeout(() => {
        isConfirmed.value = false
        reset()
      }, 2000)
    } else {
      onDelete()
      reset()
    }
  }

  const handleSwipeLeft = () => {
    reset()
  }

  const { isDragging } = useSwipe(targetRef, {
    threshold,
    onSwipeRight: handleSwipeRight,
    onSwipeLeft: handleSwipeLeft
  })

  const reset = () => {
    isSwiped.value = false
    swipeX.value = 0
    isConfirmed.value = false
  }

  return {
    isSwiped,
    swipeX,
    isConfirmed,
    isDragging,
    reset
  }
}

// ==================== Haptic Feedback ====================

/**
 * Trigger haptic feedback on mobile devices
 */
export function useHaptic() {
  /**
   * Light impact feedback
   */
  const impactLight = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  /**
   * Medium impact feedback
   */
  const impactMedium = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }
  }

  /**
   * Heavy impact feedback
   */
  const impactHeavy = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30)
    }
  }

  /**
   * Success feedback pattern
   */
  const success = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10])
    }
  }

  /**
   * Warning feedback pattern
   */
  const warning = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 50, 20])
    }
  }

  /**
   * Error feedback pattern
   */
  const error = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30, 50, 30])
    }
  }

  /**
   * Selection feedback
   */
  const selection = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }
  }

  return {
    impactLight,
    impactMedium,
    impactHeavy,
    success,
    warning,
    error,
    selection
  }
}

// ==================== Pull to Refresh ====================

export function usePullToRefresh(
  targetRef: Ref<HTMLElement | undefined>,
  onRefresh: () => Promise<void>,
  options: { threshold?: number; debounce?: number } = {}
) {
  const { threshold = 80, debounce: _debounce } = options

  const isPulling = ref(false)
  const pullDistance = ref(0)
  const isRefreshing = ref(false)
  const startY = ref(0)
  const currentY = ref(0)

  const handleTouchStart = (e: TouchEvent) => {
    if (isRefreshing.value) return
    const el = targetRef.value
    if (!el) return

    // Only trigger pull when at the top
    if (el.scrollTop === 0) {
      startY.value = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (isRefreshing.value || startY.value === 0) return

    currentY.value = e.touches[0].clientY
    const diff = currentY.value - startY.value

    if (diff > 0) {
      isPulling.value = true
      // Add resistance
      pullDistance.value = Math.min(diff * 0.5, threshold * 1.5)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance.value >= threshold && !isRefreshing.value) {
      isRefreshing.value = true

      try {
        await onRefresh()
      } catch (err) {
        logger.error('[usePullToRefresh] Refresh failed:', err)
      } finally {
        isRefreshing.value = false
      }
    }

    // Reset
    isPulling.value = false
    pullDistance.value = 0
    startY.value = 0
    currentY.value = 0
  }

  onMounted(() => {
    const el = targetRef.value
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: true })
      el.addEventListener('touchmove', handleTouchMove, { passive: true })
      el.addEventListener('touchend', handleTouchEnd)
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (el) {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  })

  return {
    isPulling,
    pullDistance,
    isRefreshing
  }
}
