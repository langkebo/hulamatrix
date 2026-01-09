/**
 * Screenshot Canvas Management Composable
 *
 * Handles canvas initialization, configuration, and image loading
 */

import { ref, type Ref } from 'vue'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { ErrorType } from '@/common/exception'
import { logger } from '@/utils/logger'

export interface ScreenConfig {
  startX: number
  startY: number
  endX: number
  endY: number
  scaleX: number
  scaleY: number
  image?: string | null
}

export interface CanvasContext {
  canvas: Ref<HTMLCanvasElement | null>
  ctx: Ref<CanvasRenderingContext2D | null>
}

export interface UseScreenshotCanvasState {
  isImageLoaded: boolean
}

export interface UseScreenshotCanvasActions {
  initCanvas: () => Promise<void>
  getCanvasContexts: () => {
    imgCtx: Ref<CanvasRenderingContext2D | null>
    maskCtx: Ref<CanvasRenderingContext2D | null>
    drawCtx: Ref<CanvasRenderingContext2D | null>
  }
}

export interface UseScreenshotCanvasOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  maskCanvas: Ref<HTMLCanvasElement | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
  magnifier: Ref<HTMLDivElement | null>
  onImageLoaded?: () => void
}

/**
 * Screenshot canvas management composable
 */
export function useScreenshotCanvas(options: UseScreenshotCanvasOptions) {
  const { imgCanvas, maskCanvas, drawCanvas, magnifier, onImageLoaded } = options

  // State
  const isImageLoaded = ref(false)
  const screenConfig = ref<ScreenConfig>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    scaleX: 1,
    scaleY: 1
  })

  // Context refs
  const imgCtx: Ref<CanvasRenderingContext2D | null> = ref(null)
  const maskCtx: Ref<CanvasRenderingContext2D | null> = ref(null)
  const drawCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

  /**
   * Draw rectangle on canvas (helper function)
   */
  const drawRectangle = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    borderSize: number = 2,
    borderColor: string = 'var(--hula-brand-primary)'
  ) => {
    context.strokeStyle = borderColor
    context.lineWidth = borderSize
    context.strokeRect(x, y, width, height)
  }

  /**
   * Initialize canvas and load screenshot
   */
  const initCanvas = async (): Promise<void> => {
    // Hide magnifier before screenshot
    if (magnifier.value) {
      magnifier.value.style.display = 'none'
    }

    // Reset state
    isImageLoaded.value = false

    const canvasWidth = screen.width * window.devicePixelRatio
    const canvasHeight = screen.height * window.devicePixelRatio

    const config = {
      x: '0',
      y: '0',
      width: `${canvasWidth}`,
      height: `${canvasHeight}`
    }

    const screenshotData = await invokeWithErrorHandler<string>('screenshot', config, {
      customErrorMessage: '截图失败',
      errorType: ErrorType.Client
    })

    if (imgCanvas.value && maskCanvas.value) {
      // Setup canvas dimensions
      imgCanvas.value.width = canvasWidth
      imgCanvas.value.height = canvasHeight
      maskCanvas.value.width = canvasWidth
      maskCanvas.value.height = canvasHeight
      drawCanvas.value!.width = canvasWidth
      drawCanvas.value!.height = canvasHeight

      // Get contexts
      imgCtx.value = imgCanvas.value.getContext('2d')
      maskCtx.value = maskCanvas.value.getContext('2d')
      drawCtx.value = drawCanvas.value!.getContext('2d', { willReadFrequently: true })

      // Clear drawing canvas
      if (drawCtx.value) {
        drawCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
      }

      // Calculate scale factors
      const { clientWidth: containerWidth, clientHeight: containerHeight } = imgCanvas.value!
      screenConfig.value.scaleX = canvasWidth / containerWidth
      screenConfig.value.scaleY = canvasHeight / containerHeight

      // Load screenshot image
      await loadScreenshotImage(screenshotData, canvasWidth, canvasHeight)
    }
  }

  /**
   * Load screenshot image onto canvas
   */
  const loadScreenshotImage = async (data: string, canvasWidth: number, canvasHeight: number): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image()

      img.onload = () => {
        if (imgCtx.value) {
          try {
            imgCtx.value.drawImage(img, 0, 0, canvasWidth, canvasHeight)

            // Draw green border
            if (maskCtx.value) {
              drawRectangle(
                maskCtx.value,
                screenConfig.value.startX,
                screenConfig.value.startY,
                canvasWidth,
                canvasHeight,
                4
              )
            }

            isImageLoaded.value = true
            onImageLoaded?.()
          } catch (error) {
            logger.error('绘制图像到canvas失败:', error)
          }
        }
        resolve()
      }

      img.onerror = () => {
        logger.error('Failed to load screenshot image')
        resolve()
      }

      // Try to draw directly from base64 data first
      if (data && imgCtx.value) {
        try {
          const binaryString = atob(data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          const imageData = new ImageData(new Uint8ClampedArray(bytes), canvasWidth, canvasHeight)
          imgCtx.value.putImageData(imageData, 0, 0)

          // Draw green border
          if (maskCtx.value) {
            drawRectangle(
              maskCtx.value,
              screenConfig.value.startX,
              screenConfig.value.startY,
              canvasWidth,
              canvasHeight,
              4
            )
          }

          isImageLoaded.value = true
          onImageLoaded?.()
          resolve()
        } catch (_error) {
          // Fallback to Image object
          img.src = `data:image/png;base64,${data}`
        }
      } else {
        img.src = `data:image/png;base64,${data}`
      }
    })
  }

  return {
    // State
    isImageLoaded,
    screenConfig,

    // Actions
    initCanvas,
    getCanvasContexts: () => ({ imgCtx, maskCtx, drawCtx })
  }
}
