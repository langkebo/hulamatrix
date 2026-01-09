import { ref, type Ref } from 'vue'

export interface ScreenConfig {
  startX: number
  startY: number
  endX: number
  endY: number
  scaleX: number
  scaleY: number
  isDrawing: boolean
  width: number
  height: number
}

export interface UseScreenshotMagnifierOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  imgCtx: Ref<CanvasRenderingContext2D | null>
  screenConfig: Ref<ScreenConfig>
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  showButtonGroup: Ref<boolean>
  isImageLoaded: Ref<boolean>
  magnifier?: Ref<HTMLDivElement | null>
  magnifierCanvas?: Ref<HTMLCanvasElement | null>
  magnifierCtx?: Ref<CanvasRenderingContext2D | null>
  magnifierWidth?: number
  magnifierHeight?: number
  zoomFactor?: number
}

export interface UseScreenshotMagnifierReturn {
  // State
  magnifier: Ref<HTMLDivElement | null>
  magnifierCanvas: Ref<HTMLCanvasElement | null>
  magnifierCtx: Ref<CanvasRenderingContext2D | null>
  magnifierWidth: number
  magnifierHeight: number
  zoomFactor: number

  // Actions
  initMagnifier: () => void
  handleMagnifierMouseMove: (event: MouseEvent) => void
  hideMagnifier: () => void
}

/**
 * Composable for screenshot magnifier functionality
 * Handles magnifier initialization, positioning, and rendering
 */
export function useScreenshotMagnifier(options: UseScreenshotMagnifierOptions): UseScreenshotMagnifierReturn {
  const {
    imgCanvas,
    imgCtx,
    screenConfig,
    isDragging,
    isResizing,
    showButtonGroup,
    isImageLoaded,
    magnifier: externalMagnifier,
    magnifierCanvas: externalMagnifierCanvas,
    magnifierCtx: externalMagnifierCtx,
    magnifierWidth: customMagnifierWidth = 120,
    magnifierHeight: customMagnifierHeight = 120,
    zoomFactor: customZoomFactor = 3
  } = options

  // State - use external refs if provided, otherwise create internal refs
  const magnifier = externalMagnifier || ref<HTMLDivElement | null>(null)
  const magnifierCanvas = externalMagnifierCanvas || ref<HTMLCanvasElement | null>(null)
  const magnifierCtx = externalMagnifierCtx || ref<CanvasRenderingContext2D | null>(null)
  const magnifierWidth = customMagnifierWidth
  const magnifierHeight = customMagnifierHeight
  const zoomFactor = customZoomFactor

  /**
   * 初始化放大镜
   */
  const initMagnifier = () => {
    if (magnifierCanvas.value) {
      magnifierCanvas.value.width = magnifierWidth
      magnifierCanvas.value.height = magnifierHeight
      magnifierCtx.value = magnifierCanvas.value.getContext('2d', { willReadFrequently: true })
    }
  }

  /**
   * 处理放大镜鼠标移动
   */
  const handleMagnifierMouseMove = (event: MouseEvent) => {
    if (!magnifier.value || !imgCanvas.value || !imgCtx.value) return

    // 在拖动选区时隐藏放大镜，仅在调整大小和绘制时显示
    if (isDragging.value) {
      magnifier.value.style.display = 'none'
      return
    }

    // 如果已经选择了区域，但当前不在拖动或调整大小，则隐藏放大镜
    if (showButtonGroup.value && !isDragging.value && !isResizing.value) {
      magnifier.value.style.display = 'none'
      return
    }

    // 确保图像已加载
    if (!isImageLoaded.value) {
      magnifier.value.style.display = 'none'
      return
    }

    // 初始化放大镜画布
    if (magnifierCanvas.value && magnifierCtx.value === null) {
      magnifierCanvas.value.width = magnifierWidth
      magnifierCanvas.value.height = magnifierHeight
      magnifierCtx.value = magnifierCanvas.value.getContext('2d')
    }

    if (!magnifierCtx.value) return

    magnifier.value.style.display = 'block'

    // 统一使用 clientX/clientY + canvas 的 boundingClientRect 计算相对画布的坐标
    const clientX = (event as MouseEvent).clientX
    const clientY = (event as MouseEvent).clientY
    const rect = imgCanvas.value.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top

    // 定位放大镜（使用视口坐标放置，避免偏移）
    let magnifierTop = clientY + 20
    let magnifierLeft = clientX + 20

    if (magnifierTop + magnifierHeight > window.innerHeight) {
      magnifierTop = clientY - magnifierHeight - 20
    }
    if (magnifierLeft + magnifierWidth > window.innerWidth) {
      magnifierLeft = clientX - magnifierWidth - 20
    }

    magnifier.value.style.top = `${magnifierTop}px`
    magnifier.value.style.left = `${magnifierLeft}px`

    // 计算源图像中的采样区域（相对画布坐标再乘缩放因子）
    const sourceX = mouseX * screenConfig.value.scaleX - magnifierWidth / zoomFactor / 2
    const sourceY = mouseY * screenConfig.value.scaleY - magnifierHeight / zoomFactor / 2
    const sourceWidth = magnifierWidth / zoomFactor
    const sourceHeight = magnifierHeight / zoomFactor

    // 清除放大镜画布
    magnifierCtx.value.clearRect(0, 0, magnifierWidth, magnifierHeight)

    // 绘制放大的图像
    magnifierCtx.value.drawImage(
      imgCanvas.value,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      magnifierWidth,
      magnifierHeight
    )

    // 在放大镜中心绘制十字线
    magnifierCtx.value.strokeStyle = '#13987f'
    magnifierCtx.value.lineWidth = 1
    magnifierCtx.value.beginPath()
    magnifierCtx.value.moveTo(magnifierWidth / 2, 0)
    magnifierCtx.value.lineTo(magnifierWidth / 2, magnifierHeight)
    magnifierCtx.value.moveTo(0, magnifierHeight / 2)
    magnifierCtx.value.lineTo(magnifierWidth, magnifierHeight / 2)
    magnifierCtx.value.stroke()
  }

  /**
   * 隐藏放大镜
   */
  const hideMagnifier = () => {
    if (magnifier.value) {
      magnifier.value.style.display = 'none'
    }
  }

  return {
    magnifier,
    magnifierCanvas,
    magnifierCtx,
    magnifierWidth,
    magnifierHeight,
    zoomFactor,
    initMagnifier,
    handleMagnifierMouseMove,
    hideMagnifier
  }
}
