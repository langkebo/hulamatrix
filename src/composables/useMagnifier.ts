/**
 * Screenshot Magnifier Composable
 * Handles magnifier functionality for screenshot tool
 */

import { ref, type Ref } from 'vue'

export interface MagnifierConfig {
  width: number
  height: number
  zoomFactor: number
}

export interface MagnifierState {
  magnifier: Ref<HTMLDivElement | null>
  magnifierCanvas: Ref<HTMLCanvasElement | null>
  magnifierCtx: Ref<CanvasRenderingContext2D | null>
  config: MagnifierConfig
  initMagnifier: () => void
  handleMouseMove: (
    event: MouseEvent,
    imgCanvas: HTMLCanvasElement,
    screenConfig: { scaleX: number; scaleY: number },
    isDragging: boolean,
    isResizing: boolean,
    showButtonGroup: boolean,
    isImageLoaded: boolean
  ) => void
  hide: () => void
}

export function useMagnifier(config: MagnifierConfig = { width: 120, height: 120, zoomFactor: 3 }): MagnifierState {
  const magnifier = ref<HTMLDivElement | null>(null)
  const magnifierCanvas = ref<HTMLCanvasElement | null>(null)
  const magnifierCtx = ref<CanvasRenderingContext2D | null>(null)

  /**
   * Initialize magnifier canvas
   */
  const initMagnifier = () => {
    if (magnifierCanvas.value) {
      magnifierCanvas.value.width = config.width
      magnifierCanvas.value.height = config.height
      magnifierCtx.value = magnifierCanvas.value.getContext('2d', { willReadFrequently: true })
    }
  }

  /**
   * Handle magnifier mouse move
   */
  const handleMouseMove = (
    event: MouseEvent,
    imgCanvas: HTMLCanvasElement,
    screenConfig: { scaleX: number; scaleY: number },
    isDragging: boolean,
    isResizing: boolean,
    showButtonGroup: boolean,
    isImageLoaded: boolean
  ) => {
    if (!magnifier.value || !imgCanvas) return

    // Hide during dragging
    if (isDragging) {
      magnifier.value.style.display = 'none'
      return
    }

    // Hide when selection is complete and not interacting
    if (showButtonGroup && !isDragging && !isResizing) {
      magnifier.value.style.display = 'none'
      return
    }

    // Wait for image to load
    if (!isImageLoaded) {
      magnifier.value.style.display = 'none'
      return
    }

    // Initialize canvas on first use
    if (magnifierCanvas.value && magnifierCtx.value === null) {
      initMagnifier()
    }

    if (!magnifierCtx.value) return

    magnifier.value.style.display = 'block'

    // Calculate canvas-relative coordinates
    const clientX = event.clientX
    const clientY = event.clientY
    const rect = imgCanvas.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top

    // Position magnifier near cursor
    let magnifierTop = clientY + 20
    let magnifierLeft = clientX + 20

    // Adjust if near edges
    if (magnifierTop + config.height > window.innerHeight) {
      magnifierTop = clientY - config.height - 20
    }
    if (magnifierLeft + config.width > window.innerWidth) {
      magnifierLeft = clientX - config.width - 20
    }

    magnifier.value.style.top = `${magnifierTop}px`
    magnifier.value.style.left = `${magnifierLeft}px`

    // Calculate source area to sample
    const sourceX = mouseX * screenConfig.scaleX - config.width / config.zoomFactor / 2
    const sourceY = mouseY * screenConfig.scaleY - config.height / config.zoomFactor / 2
    const sourceWidth = config.width / config.zoomFactor
    const sourceHeight = config.height / config.zoomFactor

    // Clear and draw magnified image
    magnifierCtx.value.clearRect(0, 0, config.width, config.height)
    magnifierCtx.value.drawImage(
      imgCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      config.width,
      config.height
    )

    // Draw crosshair
    magnifierCtx.value.strokeStyle = '#13987f'
    magnifierCtx.value.lineWidth = 1
    magnifierCtx.value.beginPath()
    magnifierCtx.value.moveTo(config.width / 2, 0)
    magnifierCtx.value.lineTo(config.width / 2, config.height)
    magnifierCtx.value.moveTo(0, config.height / 2)
    magnifierCtx.value.lineTo(config.width, config.height / 2)
    magnifierCtx.value.stroke()
  }

  /**
   * Hide magnifier
   */
  const hide = () => {
    if (magnifier.value) {
      magnifier.value.style.display = 'none'
    }
  }

  return {
    magnifier,
    magnifierCanvas,
    magnifierCtx,
    config,
    initMagnifier,
    handleMouseMove,
    hide
  }
}
