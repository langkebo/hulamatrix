/**
 * Vue 动画组合式API
 * 提供常用的动画效果管理
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue'
import {
  animateElement,
  staggerAnimation,
  AnimationTimeline,
  type AnimationConfig,
  animations
} from '@/utils/animations'

// Type for valid animation names
type AnimationName = keyof typeof animations

// 动画状态管理
export function useAnimation(
  target: Ref<Element | undefined> | Element,
  animationName?: string,
  _config?: AnimationConfig
) {
  const isAnimating = ref(false)
  const hasAnimated = ref(false)
  const element = ref(target instanceof Element ? target : target.value)

  // 执行动画
  const animate = async (name?: AnimationName, options?: AnimationConfig) => {
    if (!element.value) return

    isAnimating.value = true
    try {
      await animateElement(element.value, (name || animationName) as AnimationName, options)
      hasAnimated.value = true
    } catch (_error) {
    } finally {
      isAnimating.value = false
    }
  }

  // 重置动画状态
  const reset = () => {
    isAnimating.value = false
    hasAnimated.value = false
  }

  return {
    isAnimating: readonlyRef(isAnimating),
    hasAnimated: readonlyRef(hasAnimated),
    animate,
    reset
  }
}

// 交错动画
export function useStaggerAnimation(
  targets: Ref<Element[]> | Element[],
  animationName: AnimationName,
  staggerDelay: number = 50,
  config?: AnimationConfig
) {
  const isAnimating = ref(false)
  const elements = ref(Array.isArray(targets) ? targets : targets.value)

  const animate = async () => {
    if (elements.value.length === 0) return

    isAnimating.value = true
    try {
      await staggerAnimation(elements.value, animationName, staggerDelay, config)
    } catch (_error) {
    } finally {
      isAnimating.value = false
    }
  }

  return {
    isAnimating: readonlyRef(isAnimating),
    animate,
    elements
  }
}

// 时间线动画
export function useAnimationTimeline() {
  const timeline = new AnimationTimeline()
  const isAnimating = ref(false)

  const add = (element: Element, animationName: AnimationName, config?: AnimationConfig) => {
    timeline.add(element, animationName, config)
    return timeline
  }

  const play = async () => {
    isAnimating.value = true
    try {
      await timeline.play()
    } catch (_error) {
    } finally {
      isAnimating.value = false
    }
  }

  const reset = () => {
    timeline.reset()
    isAnimating.value = false
  }

  return {
    isAnimating: readonlyRef(isAnimating),
    add,
    play,
    reset
  }
}

// 触发器动画
export function useTriggerAnimation(
  trigger: Ref<boolean>,
  target: Ref<Element | undefined> | Element,
  enterAnimation: AnimationName,
  leaveAnimation: AnimationName,
  config?: AnimationConfig
) {
  const isVisible = ref(trigger.value)
  const element = ref(target instanceof Element ? target : target.value)

  watch(trigger, async (newVal) => {
    if (!element.value) return

    if (newVal) {
      await animateElement(element.value, enterAnimation, config)
      isVisible.value = true
    } else {
      await animateElement(element.value, leaveAnimation, config)
      isVisible.value = false
    }
  })

  return {
    isVisible: readonlyRef(isVisible)
  }
}

// 滚动触发动画
export function useScrollAnimation(
  target: Ref<Element | undefined> | Element,
  animationName: AnimationName,
  config?: AnimationConfig & { threshold?: number; rootMargin?: string }
) {
  const element = ref(target instanceof Element ? target : target.value)
  const isVisible = ref(false)
  const hasAnimated = ref(false)
  const observer = ref<IntersectionObserver | null>(null)

  const animate = async () => {
    if (!element.value || hasAnimated.value) return

    await animateElement(element.value, animationName, config)
    hasAnimated.value = true
  }

  onMounted(() => {
    if (!element.value) return

    observer.value = new IntersectionObserver(
      async ([entry]) => {
        if (!entry) return
        isVisible.value = entry.isIntersecting
        if (entry.isIntersecting && !hasAnimated.value) {
          await animate()
        }
      },
      {
        threshold: config?.threshold || 0.1,
        rootMargin: config?.rootMargin || '0px'
      }
    )

    observer.value.observe(element.value)
  })

  onUnmounted(() => {
    if (observer.value) {
      observer.value.disconnect()
    }
  })

  return {
    isVisible: readonlyRef(isVisible),
    hasAnimated: readonlyRef(hasAnimated),
    animate
  }
}

// 数字动画
export function useNumberAnimation(
  from: number,
  to: number,
  duration: number = 1000,
  config?: { easing?: (t: number) => number; decimals?: number }
) {
  const current = ref(from)
  const isAnimating = ref(false)
  let animationId: number | null = null

  const defaultEasing = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }

  const animate = () => {
    isAnimating.value = true
    const startTime = performance.now()
    const decimals = config?.decimals || 0

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = config?.easing ? config.easing(progress) : defaultEasing(progress)

      current.value = Number((from + (to - from) * easedProgress).toFixed(decimals))

      if (progress < 1) {
        animationId = requestAnimationFrame(step)
      } else {
        isAnimating.value = false
      }
    }

    animationId = requestAnimationFrame(step)
  }

  const stop = () => {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
      isAnimating.value = false
    }
  }

  const reset = () => {
    stop()
    current.value = from
  }

  return {
    current: readonlyRef(current),
    isAnimating: readonlyRef(isAnimating),
    animate,
    stop,
    reset
  }
}

// 打字机效果
export function useTypewriter(
  text: Ref<string> | string,
  speed: number = 50,
  config?: { delay?: number; showCursor?: boolean }
) {
  const displayText = ref('')
  const isTyping = ref(false)
  const currentIndex = ref(0)
  let timeoutId: NodeJS.Timeout | null = null

  const sourceText = computed(() => (typeof text === 'string' ? text : text.value))
  const showCursor = config?.showCursor ?? true

  const start = () => {
    stop()
    isTyping.value = true
    currentIndex.value = 0
    displayText.value = ''

    const delay = config?.delay || 0

    timeoutId = setTimeout(() => {
      type()
    }, delay)
  }

  const type = () => {
    if (currentIndex.value < sourceText.value.length) {
      displayText.value = sourceText.value.slice(0, currentIndex.value + 1)
      currentIndex.value++
      timeoutId = setTimeout(type, speed)
    } else {
      isTyping.value = false
    }
  }

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isTyping.value = false
  }

  const reset = () => {
    stop()
    displayText.value = ''
    currentIndex.value = 0
  }

  // 监听文本变化
  watch(sourceText, () => {
    reset()
    start()
  })

  // 自动开始
  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    displayText: computed(() => displayText.value + (showCursor && isTyping.value ? '|' : '')),
    isTyping: readonlyRef(isTyping),
    currentIndex: readonlyRef(currentIndex),
    start,
    stop,
    reset
  }
}

// 鼠标跟随动画
export function useMouseFollow(
  target: Ref<Element | undefined> | Element,
  config?: { easing?: number; scale?: number }
) {
  const element = ref(target instanceof Element ? (target as HTMLElement) : (target.value as HTMLElement | undefined))
  const mousePosition = ref({ x: 0, y: 0 })
  const elementPosition = ref({ x: 0, y: 0 })
  const isHovering = ref(false)

  const easing = config?.easing || 0.1
  const scale = config?.scale || 1.2

  const updatePosition = (clientX: number, clientY: number) => {
    if (!element.value) return

    const rect = element.value.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    mousePosition.value = { x: clientX, y: clientY }

    // 缓动动画
    const dx = (clientX - centerX) * easing
    const dy = (clientY - centerY) * easing

    elementPosition.value.x += dx
    elementPosition.value.y += dy
  }

  const handleMouseMove = (e: MouseEvent) => {
    updatePosition(e.clientX, e.clientY)
  }

  const handleMouseEnter = () => {
    isHovering.value = true
    const el = element.value as HTMLElement | undefined
    if (el) {
      el.style.transform = `scale(${scale})`
    }
  }

  const handleMouseLeave = () => {
    isHovering.value = false
    const el = element.value as HTMLElement | undefined
    if (el) {
      el.style.transform = 'scale(1)'
      elementPosition.value = { x: 0, y: 0 }
    }
  }

  onMounted(() => {
    const el = element.value as HTMLElement | undefined
    if (el) {
      el.addEventListener('mousemove', handleMouseMove as EventListener)
      el.addEventListener('mouseenter', handleMouseEnter as EventListener)
      el.addEventListener('mouseleave', handleMouseLeave as EventListener)
    }
  })

  onUnmounted(() => {
    const el = element.value as HTMLElement | undefined
    if (el) {
      el.removeEventListener('mousemove', handleMouseMove as EventListener)
      el.removeEventListener('mouseenter', handleMouseEnter as EventListener)
      el.removeEventListener('mouseleave', handleMouseLeave as EventListener)
    }
  })

  return {
    isHovering: readonlyRef(isHovering),
    mousePosition: readonlyRef(mousePosition),
    elementPosition: readonlyRef(elementPosition)
  }
}

// 导出只读版本的ref
function readonlyRef<T>(ref: Ref<T>) {
  return computed(() => ref.value)
}
