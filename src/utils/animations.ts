/**
 * 动画工具函数库
 * 提供常用的动画效果和过渡函数
 */

// 缓动函数
export const easings = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeInQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  easeInQuart: 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
  easeInQuint: 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
  easeInSine: 'cubic-bezier(0.47, 0, 0.745, 0.715)',
  easeInExpo: 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
  easeInCirc: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
  easeInBack: 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
  easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  easeOutQuart: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
  easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeOutSine: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
  easeOutExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
  easeOutCirc: 'cubic-bezier(0.075, 0.82, 0.165, 1)',
  easeOutBack: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  easeInOutQuad: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  easeInOutQuart: 'cubic-bezier(0.77, 0, 0.175, 1)',
  easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
  easeInOutSine: 'cubic-bezier(0.445, 0.05, 0.55, 0.95)',
  easeInOutExpo: 'cubic-bezier(1, 0, 0, 1)',
  easeInOutCirc: 'cubic-bezier(0.785, 0.135, 0.15, 0.86)',
  easeInOutBack: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
}

// 动画持续时间
export const durations = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '1000ms'
}

// 动画配置
export interface AnimationConfig {
  duration?: keyof typeof durations | string
  easing?: keyof typeof easings | string
  delay?: number | string
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both'
}

/** 动画持续时间键类型 */
export type DurationKey = keyof typeof durations

/** 缓动函数键类型 */
export type EasingKey = keyof typeof easings

/** 关键帧类型 */
export type KeyframeValue = string | number | null | undefined

/** 关键帧对象类型 */
export interface KeyframeObject {
  [property: string]: KeyframeValue
}

/** 关键帧类型可以是对象或选择器字符串 */
export type KeyframeType = KeyframeObject | string

/** 动画预设选项 */
export interface AnimationOptions {
  duration: DurationKey | string
  easing: EasingKey | string
}

/** 持续时间值类型（用于解析） */
type DurationValue = DurationKey | string | number | undefined

/** 填充模式类型 */
type FillModeType = 'none' | 'forwards' | 'backwards' | 'both'

// 创建动画字符串
export function createAnimation(config: AnimationConfig): string {
  const duration = typeof config.duration === 'string' ? config.duration : durations[config.duration || 'normal']

  const easing = typeof config.easing === 'string' ? config.easing : easings[config.easing || 'easeInOut']

  const delay = config.delay ? `${typeof config.delay === 'number' ? config.delay : config.delay}ms` : ''

  return [duration, easing, delay || '0ms'].join(' ')
}

// 预定义动画
export const animations = {
  // 淡入淡出
  fadeIn: {
    keyframes: [{ opacity: 0 }, { opacity: 1 }] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  fadeOut: {
    keyframes: [{ opacity: 1 }, { opacity: 0 }] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },

  // 缩放
  scaleIn: {
    keyframes: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOutBack' } as AnimationOptions
  },
  scaleOut: {
    keyframes: [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.9)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },

  // 滑动
  slideInUp: {
    keyframes: [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  slideInDown: {
    keyframes: [
      { opacity: 0, transform: 'translateY(-20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  slideInLeft: {
    keyframes: [
      { opacity: 0, transform: 'translateX(-20px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  slideInRight: {
    keyframes: [
      { opacity: 0, transform: 'translateX(20px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  slideOutUp: {
    keyframes: [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-20px)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },
  slideOutDown: {
    keyframes: [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(20px)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },
  slideOutLeft: {
    keyframes: [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(-20px)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },
  slideOutRight: {
    keyframes: [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(20px)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },

  // 弹跳
  bounce: {
    keyframes: ['0%, 20%, 53%, 80%, 100%', '40%, 43%', '70%', '90%'],
    values: [
      { transform: 'translate3d(0,0,0)' },
      { transform: 'translate3d(0,-8px,0)' },
      { transform: 'translate3d(0,0,0)' }
    ] as KeyframeObject[],
    options: { duration: 'slow', easing: 'ease' } as AnimationOptions
  },

  // 旋转
  rotateIn: {
    keyframes: [
      { opacity: 0, transform: 'rotate(-180deg)' },
      { opacity: 1, transform: 'rotate(0)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeOut' } as AnimationOptions
  },
  rotateOut: {
    keyframes: [
      { opacity: 1, transform: 'rotate(0)' },
      { opacity: 0, transform: 'rotate(180deg)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeIn' } as AnimationOptions
  },

  // 脉冲
  pulse: {
    keyframes: ['0%', '50%', '100%'],
    values: [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeInOut' } as AnimationOptions
  },

  // 闪烁
  flash: {
    keyframes: ['0%, 50%, 100%', '25%, 75%'],
    values: [{ opacity: 1 }, { opacity: 0 }] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeInOut' } as AnimationOptions
  },

  // 摇摆
  shake: {
    keyframes: ['0%, 100%', '10%, 30%, 50%, 70%, 90%', '20%, 40%, 60%, 80%'],
    values: [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: 'translate3d(-2px, 0, 0)' },
      { transform: 'translate3d(2px, 0, 0)' }
    ] as KeyframeObject[],
    options: { duration: 'fast', easing: 'easeInOut' } as AnimationOptions
  },

  // 心跳
  heartbeat: {
    keyframes: ['0%', '14%', '28%', '42%', '70%', '100%'],
    values: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)' },
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)' },
      { transform: 'scale(1)' }
    ] as KeyframeObject[],
    options: { duration: 'slow', easing: 'easeInOut' } as AnimationOptions
  },

  // 橡皮筋
  rubberBand: {
    keyframes: ['0%', '30%', '40%', '50%', '65%', '75%', '100%'],
    values: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.25, 0.75)' },
      { transform: 'scale(0.75, 1.25)' },
      { transform: 'scale(1.15, 0.85)' },
      { transform: 'scale(0.95, 1.05)' },
      { transform: 'scale(1.05, 0.95)' },
      { transform: 'scale(1)' }
    ] as KeyframeObject[],
    options: { duration: 'normal', easing: 'easeInOut' } as AnimationOptions
  }
}

// 应用动画到元素
export function animateElement(
  element: Element,
  animationName: keyof typeof animations,
  config?: Partial<AnimationConfig>
): Promise<void> {
  const animation = animations[animationName]
  if (!animation) {
    return Promise.reject(new Error(`Animation "${animationName}" not found`))
  }

  const keyframes = 'values' in animation ? animation.values : animation.keyframes

  const toMs = (val: DurationValue, fallback: DurationKey | string): number => {
    if (typeof val === 'number') return val
    const src = val ?? fallback
    if (typeof src === 'string') {
      if (src.endsWith('ms')) return parseInt(src, 10)
      if (src.endsWith('s')) return Math.round(parseFloat(src) * 1000)
      const preset = durations[src as DurationKey]
      if (typeof preset === 'string') {
        if (preset.endsWith('ms')) return parseInt(preset, 10)
        if (preset.endsWith('s')) return Math.round(parseFloat(preset) * 1000)
      }
      const n = Number(src)
      return Number.isFinite(n) ? n : 300
    }
    const preset = durations[String(src) as DurationKey]
    if (typeof preset === 'string' && preset.endsWith('ms')) return parseInt(preset, 10)
    if (typeof preset === 'string' && preset.endsWith('s')) return Math.round(parseFloat(preset) * 1000)
    return 300
  }

  const toNumber = (val: number | string | undefined): number => {
    if (val === undefined) return 0
    if (typeof val === 'number') return val
    if (val.endsWith('ms')) return parseInt(val, 10)
    if (val.endsWith('s')) return Math.round(parseFloat(val) * 1000)
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }

  const animationConfig: KeyframeAnimationOptions = {
    duration: toMs(config?.duration, animation.options.duration),
    easing: config?.easing || animation.options.easing || 'ease',
    delay: toNumber(config?.delay),
    fill: (config?.fillMode || 'both') as FillModeType
  }

  return element.animate(keyframes, animationConfig).finished.then(() => {})
}

// 创建交错动画
export function staggerAnimation(
  elements: Element[],
  animationName: keyof typeof animations,
  staggerDelay: number = 50,
  config?: Partial<AnimationConfig>
): Promise<void[]> {
  return Promise.all(
    elements.map((element, index) =>
      animateElement(element, animationName, {
        ...config,
        delay: (typeof config?.delay === 'number' ? config?.delay : 0) + index * staggerDelay
      })
    )
  )
}

// 创建时间线动画
export class AnimationTimeline {
  private animations: Promise<void>[] = []

  add(element: Element, animationName: keyof typeof animations, config?: Partial<AnimationConfig>): AnimationTimeline {
    this.animations.push(animateElement(element, animationName, config))
    return this
  }

  async play(): Promise<void> {
    await Promise.all(this.animations)
  }

  reset(): AnimationTimeline {
    this.animations = []
    return this
  }
}
