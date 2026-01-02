/* ==========================================================================
   图片懒加载优化工具
   ========================================================================== */

import { ref, onMounted } from 'vue'

/**
 * 图片懒加载配置
 */
interface LazyImageOptions {
  /** 根边距，用于提前加载 */
  rootMargin?: string
  /** 可见比例阈值 */
  threshold?: number
  /** 加载失败时的占位图 */
  errorPlaceholder?: string
  /** 加载中的占位图 */
  loadingPlaceholder?: string
  /** 图片加载成功的回调 */
  onLoad?: (img: HTMLImageElement) => void
  /** 图片加载失败的回调 */
  onError?: (img: HTMLImageElement) => void
  /** 是否启用淡入效果 */
  fadeIn?: boolean
  /** 淡入动画时长 */
  fadeInDuration?: number
}

/**
 * 默认配置
 */
const defaultOptions: LazyImageOptions = {
  rootMargin: '50px',
  threshold: 0.1,
  errorPlaceholder: '/images/error-placeholder.png',
  loadingPlaceholder: '/images/loading-placeholder.svg',
  fadeIn: true,
  fadeInDuration: 300
}

/**
 * 图片懒加载管理器
 */
class ImageLazyLoader {
  private observer: IntersectionObserver | null = null
  private imageCache = new Map<string, HTMLImageElement>()
  private loadingImages = new Set<HTMLImageElement>()
  private options: LazyImageOptions

  constructor(options: LazyImageOptions = {}) {
    this.options = { ...defaultOptions, ...options }
    this.initObserver()
  }

  /**
   * 初始化交叉观察器
   */
  private initObserver() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
        rootMargin: this.options.rootMargin || '50px',
        threshold: this.options.threshold || 0.1
      })
    } else {
      // 降级方案：立即加载所有图片
    }
  }

  /**
   * 处理图片进入视口
   */
  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        this.loadImage(img)
        this.observer?.unobserve(img)
      }
    })
  }

  /**
   * 加载图片
   */
  private loadImage(img: HTMLImageElement) {
    const src = img.dataset.src
    const srcset = img.dataset.srcset

    if (!src && !srcset) {
      return
    }

    // 设置加载中状态
    img.classList.add('loading')
    this.loadingImages.add(img)

    // 创建新的图片对象进行预加载
    const newImg = new Image()

    newImg.onload = () => {
      // 加载成功
      if (src) img.src = src
      if (srcset) img.srcset = srcset

      img.classList.remove('loading')
      img.classList.add('loaded')
      this.loadingImages.delete(img)

      // 淡入效果
      if (this.options.fadeIn) {
        img.style.opacity = '0'
        img.style.transition = `opacity ${this.options.fadeInDuration}ms ease-in`

        requestAnimationFrame(() => {
          img.style.opacity = '1'
        })
      }

      // 移除临时样式
      delete img.dataset.src
      delete img.dataset.srcset

      this.options.onLoad?.(img)
    }

    newImg.onerror = () => {
      // 加载失败
      img.classList.remove('loading')
      img.classList.add('error')
      this.loadingImages.delete(img)

      if (this.options.errorPlaceholder) {
        img.src = this.options.errorPlaceholder
      }

      this.options.onError?.(img)
    }

    // 开始加载
    if (src) newImg.src = src
    if (srcset) newImg.srcset = srcset
  }

  /**
   * 观察图片元素
   */
  observe(img: HTMLImageElement) {
    if (this.observer) {
      this.observer.observe(img)
    } else {
      // 降级方案：立即加载
      this.loadImage(img)
    }
  }

  /**
   * 停止观察图片元素
   */
  unobserve(img: HTMLImageElement) {
    this.observer?.unobserve(img)
  }

  /**
   * 销毁观察器
   */
  destroy() {
    this.observer?.disconnect()
    this.observer = null
    this.imageCache.clear()
    this.loadingImages.clear()
  }

  /**
   * 预加载图片
   */
  preload(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (this.imageCache.has(src)) {
        resolve(this.imageCache.get(src)!)
        return
      }

      const img = new Image()
      img.onload = () => {
        this.imageCache.set(src, img)
        resolve(img)
      }
      img.onerror = reject
      img.src = src
    })
  }

  /**
   * 批量预加载图片
   */
  async preloadBatch(srcs: string[]): Promise<HTMLImageElement[]> {
    const promises = srcs.map((src) => this.preload(src))
    return Promise.allSettled(promises).then((results) => {
      return results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<HTMLImageElement>).value)
    })
  }
}

// 创建全局实例
const globalImageLoader = new ImageLazyLoader()

/** Vue 指令绑定值类型 */
interface LazyImageBinding {
  src?: string
  srcset?: string
  [key: string]: unknown
}

/** Vue 指令绑定类型 */
interface DirectiveBinding<V = unknown> {
  instance?: unknown
  value?: V
  oldValue?: V
  arg?: string
  modifiers?: Record<string, boolean>
  dir?: Record<string, unknown>
}

/**
 * Vue 自定义指令：v-lazy
 */
export const lazyImageDirective = {
  mounted(el: HTMLImageElement, binding: DirectiveBinding<LazyImageBinding>) {
    const value = binding.value || {}
    const options = { ...defaultOptions, ...value }

    // 设置数据属性
    const src = (value as LazyImageBinding).src || el.src
    const srcset = (value as LazyImageBinding).srcset || el.srcset
    el.dataset.src = src
    el.dataset.srcset = srcset

    // 设置初始占位图
    if (options.loadingPlaceholder && !el.src) {
      el.src = options.loadingPlaceholder
    }

    // 添加样式类
    el.classList.add('lazy-image')

    // 开始观察
    globalImageLoader.observe(el)
  },

  unmounted(el: HTMLImageElement) {
    globalImageLoader.unobserve(el)
  },

  updated(el: HTMLImageElement, binding: DirectiveBinding<LazyImageBinding>) {
    const value = binding.value || {}
    // 如果数据源改变，重新观察
    if ((value as LazyImageBinding).src !== el.dataset.src) {
      globalImageLoader.unobserve(el)

      const src = (value as LazyImageBinding).src || el.src
      const srcset = (value as LazyImageBinding).srcset || el.srcset
      el.dataset.src = src
      el.dataset.srcset = srcset

      globalImageLoader.observe(el)
    }
  }
}

/** Vue 组件 props 类型 */
interface LazyImageProps {
  src?: string
  srcset?: string
  alt?: string
  width?: string | number
  height?: string | number
  loading?: 'eager' | 'lazy'
  options?: LazyImageOptions
}

/**
 * 响应式图片懒加载组件工厂
 */
export function createLazyImageComponent() {
  return {
    name: 'LazyImage',
    props: {
      src: String,
      srcset: String,
      alt: String,
      width: [String, Number],
      height: [String, Number],
      loading: {
        type: String,
        default: 'lazy'
      },
      options: Object
    },
    setup(props: LazyImageProps) {
      const imgRef = ref<HTMLElement | null>(null)

      onMounted(() => {
        if (imgRef.value) {
          const img = imgRef.value as HTMLImageElement
          if (props.src) img.dataset.src = props.src
          if (props.srcset) img.dataset.srcset = props.srcset

          const opts = props.options || {}
          const loader = new ImageLazyLoader(opts)
          loader.observe(img)
        }
      })

      const finalLoading = props.loading ?? 'lazy'
      const finalSrc = finalLoading === 'eager' ? props.src : props.options?.loadingPlaceholder

      return {
        imgRef,
        finalSrc
      }
    },
    template: `
      <img
        ref="imgRef"
        :alt="alt"
        :width="width"
        :height="height"
        :src="finalSrc"
        class="lazy-image"
      />
    `
  }
}

/**
 * 背景图片懒加载
 */
export function lazyBackground(selector: string, options: LazyImageOptions = {}) {
  const elements = document.querySelectorAll(selector)

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            const bgSrc = element.dataset.bg

            if (bgSrc) {
              element.style.backgroundImage = `url(${bgSrc})`
              element.classList.add('bg-loaded')
              delete element.dataset.bg
            }

            observer.unobserve(element)
          }
        })
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.1
      }
    )

    elements.forEach((el) => observer.observe(el))
  }
}

/**
 * 图片优化工具
 */
export const imageOptimization = {
  /**
   * 生成响应式图片 URL
   */
  generateResponsiveUrl(baseUrl: string, width?: number, height?: number, quality?: number): string {
    const url = new URL(baseUrl)
    const params = new URLSearchParams(url.search)

    if (width) params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    if (quality) params.set('q', quality.toString())

    url.search = params.toString()
    return url.toString()
  },

  /**
   * 生成 WebP 格式 URL
   */
  generateWebpUrl(baseUrl: string): string {
    if (baseUrl.includes('?')) {
      return `${baseUrl}&format=webp`
    }
    return `${baseUrl}?format=webp`
  },

  /**
   * 检查 WebP 支持
   */
  checkWebpSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image()
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2)
      }
      webP.src =
        'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
    })
  }
}

/**
 * 使用示例：
 *
 * // 在 Vue 组件中使用指令
 * <img v-lazy="{ src: '/path/to/image.jpg', fadeIn: true }" alt="Lazy Image">
 *
 * // 懒加载背景图片
 * lazyBackground('.lazy-bg', { rootMargin: '100px' })
 *
 * // 预加载图片
 * globalImageLoader.preload('/path/to/image.jpg')
 */

// 导出全局实例
export { globalImageLoader }
export default globalImageLoader
