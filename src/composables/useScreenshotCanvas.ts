import { ref, type Ref, watch } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { logger } from '@/utils/logger'
import { isMac } from '@/utils/PlatformConstants'
import type { ScreenConfig } from '@/composables/useScreenshotMagnifier'

/** Canvas tool return type */
interface CanvasTool {
  draw: (type: string) => void
  drawMosaicBrushSize: (size: number) => void
  drawRectangle: (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => void
  drawCircle: (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => void
  drawArrow: (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => void
  undo: () => void
  redo: () => void
  clearAll: () => void
  resetState: () => void
  stopDrawing: () => void
  clearEvents: () => void
  canUndo: { value: boolean }
  startDrawing?: () => void
  [key: string]: unknown
}

export interface UseScreenshotCanvasOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  imgCtx: Ref<CanvasRenderingContext2D | null>
  maskCanvas: Ref<HTMLCanvasElement | null>
  maskCtx: Ref<CanvasRenderingContext2D | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
  drawCtx: Ref<CanvasRenderingContext2D | null>
  screenConfig: Ref<ScreenConfig>
  showButtonGroup: Ref<boolean>
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  borderRadius: Ref<number>
  isImageLoaded?: Ref<boolean>
  drawRectangle?: (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    lineWidth?: number
  ) => void
  resetDrawTools?: () => void
}

export interface UseScreenshotCanvasReturn {
  // State
  isImageLoaded: Ref<boolean>
  drawTools: Ref<CanvasTool | null>
  canUndo: Ref<boolean>

  // Actions
  initCanvas: () => Promise<void>
  resetScreenshot: () => Promise<void>
  restoreWindowState: () => Promise<void>

  // Cleanup callback for event listeners
  setupEventListeners: (handlers: {
    onMaskMouseDown: (event: MouseEvent) => void
    onMaskMouseMove: (event: MouseEvent) => void
    onMaskMouseUp: (event: MouseEvent) => void
    onKeyDown: (event: KeyboardEvent) => void
    onRightClick: (event: MouseEvent) => void
    onGlobalMouseDown: (event: MouseEvent) => void
  }) => void

  removeEventListeners: (handlers: {
    onKeyDown: (event: KeyboardEvent) => void
    onRightClick: (event: MouseEvent) => void
    onGlobalMouseDown: (event: MouseEvent) => void
  }) => void
}

/**
 * Composable for screenshot canvas initialization and lifecycle management
 * Handles canvas setup, screenshot capture, image loading, and cleanup
 */
export function useScreenshotCanvas(options: UseScreenshotCanvasOptions): UseScreenshotCanvasReturn {
  const {
    imgCanvas,
    imgCtx,
    maskCanvas,
    maskCtx,
    drawCanvas,
    drawCtx,
    screenConfig,
    showButtonGroup,
    isDragging,
    isResizing,
    borderRadius,
    drawRectangle,
    resetDrawTools
  } = options

  // State
  const isImageLoaded = ref(false)
  const drawTools = ref<CanvasTool | null>(null)
  const canUndo = ref(false)

  // Screenshot image
  let screenshotImage: HTMLImageElement | null = null

  // Performance optimization: mouse move throttle (macOS only)
  let mouseMoveThrottleId: number | null = null

  // Get current window instance
  const appWindow = WebviewWindow.getCurrent()

  /**
   * Restore window state (hide window)
   */
  const restoreWindowState = async () => {
    await appWindow.hide()
  }

  /**
   * Initialize canvas for screenshot
   */
  const initCanvas = async () => {
    // Reset state before screenshot
    if (resetDrawTools) {
      resetDrawTools()
    }
    isImageLoaded.value = false
    borderRadius.value = 0
    isDragging.value = false
    isResizing.value = false

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

    if (!imgCanvas.value || !maskCanvas.value) {
      logger.error('Canvas elements not available')
      return
    }

    // Setup canvas dimensions
    imgCanvas.value.width = canvasWidth
    imgCanvas.value.height = canvasHeight
    maskCanvas.value.width = canvasWidth
    maskCanvas.value.height = canvasHeight
    if (drawCanvas.value) {
      drawCanvas.value.width = canvasWidth
      drawCanvas.value.height = canvasHeight
    }

    // Get canvas contexts
    imgCtx.value = imgCanvas.value.getContext('2d')
    maskCtx.value = maskCanvas.value.getContext('2d')
    drawCtx.value = drawCanvas.value?.getContext('2d', { willReadFrequently: true }) || null

    // Clear draw canvas
    if (drawCtx.value) {
      drawCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
    }

    // Calculate screen scale
    const { clientWidth: containerWidth, clientHeight: containerHeight } = imgCanvas.value
    screenConfig.value.scaleX = canvasWidth / containerWidth
    screenConfig.value.scaleY = canvasHeight / containerHeight

    // Setup image loading
    screenshotImage = new Image()

    screenshotImage.onload = async () => {
      if (!imgCtx.value) {
        logger.error('imgCtx.value is null')
        return
      }

      try {
        imgCtx.value.drawImage(screenshotImage!, 0, 0, canvasWidth, canvasHeight)

        // Draw green border
        if (maskCtx.value && drawRectangle) {
          drawRectangle(
            maskCtx.value,
            screenConfig.value.startX,
            screenConfig.value.startY,
            canvasWidth,
            canvasHeight,
            4
          )
        }

        // Initialize drawing tools
        await initializeDrawingTools()
        isImageLoaded.value = true
      } catch (_error) {
        logger.error('Failed to draw image to canvas')
      }
    }

    // Try to draw image data directly, fallback to Image object
    if (screenshotData && imgCtx.value) {
      try {
        // Decode base64 data
        const binaryString = atob(screenshotData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Create ImageData and draw to canvas
        const imageData = new ImageData(new Uint8ClampedArray(bytes), canvasWidth, canvasHeight)
        imgCtx.value.putImageData(imageData, 0, 0)

        // Draw green border
        if (maskCtx.value && drawRectangle) {
          drawRectangle(
            maskCtx.value,
            screenConfig.value.startX,
            screenConfig.value.startY,
            canvasWidth,
            canvasHeight,
            4
          )
        }

        // Initialize drawing tools
        await initializeDrawingTools()
        isImageLoaded.value = true
      } catch (_error) {
        // Fallback to Image object if direct drawing fails
        screenshotImage!.src = `data:image/png;base64,${screenshotData}`
      }
    } else if (screenshotImage) {
      screenshotImage.src = `data:image/png;base64,${screenshotData}`
    }
  }

  /**
   * Initialize drawing tools
   */
  const initializeDrawingTools = async () => {
    if (!drawCanvas.value || !drawCtx.value || !imgCtx.value) {
      logger.warn('Canvas elements not available for drawing tools')
      return
    }

    // Import useCanvasTool dynamically to avoid circular dependency
    const { useCanvasTool } = await import('@/hooks/useCanvasTool')
    drawTools.value = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)

    // Disable drawing canvas events initially
    drawCanvas.value.style.pointerEvents = 'none'
    drawCanvas.value.style.zIndex = '5'

    // Sync canUndo state
    if (drawTools.value?.canUndo) {
      watch(
        () => drawTools.value?.canUndo?.value,
        (val) => (canUndo.value = val ?? false),
        { immediate: true }
      )
    }

    logger.debug('Drawing tools initialized', undefined, 'Screenshot')
  }

  /**
   * Reset screenshot state and canvases
   */
  const resetScreenshot = async () => {
    try {
      // Clear throttle timer (macOS only)
      if (isMac() && mouseMoveThrottleId) {
        clearTimeout(mouseMoveThrottleId)
        mouseMoveThrottleId = null
      }

      // Reset drawing tools
      if (resetDrawTools) {
        resetDrawTools()
      }

      // Reset all states
      showButtonGroup.value = false
      isImageLoaded.value = false
      borderRadius.value = 0
      isDragging.value = false
      isResizing.value = false

      screenConfig.value = {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        scaleX: 0,
        scaleY: 0,
        isDrawing: false,
        width: 0,
        height: 0
      }

      // Clear all canvases
      if (imgCtx.value && imgCanvas.value) {
        imgCtx.value.clearRect(0, 0, imgCanvas.value.width, imgCanvas.value.height)
      }
      if (maskCtx.value && maskCanvas.value) {
        maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
      }
      if (drawCtx.value && drawCanvas.value) {
        drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
        drawCanvas.value.style.pointerEvents = 'none'
      }

      // Restore window state
      await restoreWindowState()
    } catch (_error) {
      // Try to restore window state even on error
      await restoreWindowState()
    }
  }

  /**
   * Setup event listeners for canvas interactions
   */
  const setupEventListeners = (handlers: {
    onMaskMouseDown: (event: MouseEvent) => void
    onMaskMouseMove: (event: MouseEvent) => void
    onMaskMouseUp: (event: MouseEvent) => void
    onKeyDown: (event: KeyboardEvent) => void
    onRightClick: (event: MouseEvent) => void
    onGlobalMouseDown: (event: MouseEvent) => void
  }) => {
    maskCanvas.value?.addEventListener('mousedown', handlers.onMaskMouseDown)
    maskCanvas.value?.addEventListener('mousemove', handlers.onMaskMouseMove)
    maskCanvas.value?.addEventListener('mouseup', handlers.onMaskMouseUp)
    maskCanvas.value?.addEventListener('contextmenu', handlers.onRightClick)
    document.addEventListener('keydown', handlers.onKeyDown)
    document.addEventListener('contextmenu', handlers.onRightClick)
    document.addEventListener('mousedown', handlers.onGlobalMouseDown)
  }

  /**
   * Remove event listeners
   */
  const removeEventListeners = (handlers: {
    onKeyDown: (event: KeyboardEvent) => void
    onRightClick: (event: MouseEvent) => void
    onGlobalMouseDown: (event: MouseEvent) => void
  }) => {
    document.removeEventListener('keydown', handlers.onKeyDown)
    document.removeEventListener('contextmenu', handlers.onRightClick)
    document.removeEventListener('mousedown', handlers.onGlobalMouseDown)

    if (maskCanvas.value) {
      maskCanvas.value.removeEventListener('contextmenu', handlers.onRightClick)
    }

    // Clear throttle timer (macOS only)
    if (isMac() && mouseMoveThrottleId) {
      clearTimeout(mouseMoveThrottleId)
      mouseMoveThrottleId = null
    }
  }

  return {
    isImageLoaded,
    drawTools,
    canUndo,
    initCanvas,
    resetScreenshot,
    restoreWindowState,
    setupEventListeners,
    removeEventListeners
  }
}
