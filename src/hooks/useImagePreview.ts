import { ref, computed } from 'vue'

export interface ImageItem {
  id: string
  name: string
  url: string
  width?: number
  height?: number
  size?: number
  downloadUrl?: string
  previewUrl?: string
}

/**
 * 图片预览 Hook
 */
export function useImagePreview() {
  const visible = ref(false)
  const images = ref<ImageItem[]>([])
  const currentIndex = ref(0)

  /**
   * 打开图片预览
   */
  const open = (imageList: ImageItem[], index = 0) => {
    images.value = imageList
    currentIndex.value = index
    visible.value = true
  }

  /**
   * 打开单个图片预览
   */
  const openSingle = (image: ImageItem) => {
    open([image], 0)
  }

  /**
   * 关闭预览
   */
  const close = () => {
    visible.value = false
    // 清理数据
    setTimeout(() => {
      images.value = []
      currentIndex.value = 0
    }, 300)
  }

  /**
   * 预览下一张
   */
  const next = () => {
    if (currentIndex.value < images.value.length - 1) {
      currentIndex.value++
    }
  }

  /**
   * 预览上一张
   */
  const prev = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  /**
   * 跳转到指定索引
   */
  const goTo = (index: number) => {
    if (index >= 0 && index < images.value.length) {
      currentIndex.value = index
    }
  }

  /**
   * 当前图片
   */
  const currentImage = computed(() => images.value[currentIndex.value])

  return {
    visible,
    images,
    currentIndex,
    currentImage,
    open,
    openSingle,
    close,
    next,
    prev,
    goTo
  }
}
