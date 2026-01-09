import { emitTo } from '@tauri-apps/api/event'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import type { Ref } from 'vue'

export interface ScreenshotCaptureOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
  screenConfig: Ref<{
    startX: number
    startY: number
    endX: number
    endY: number
    scaleX: number
    scaleY: number
  }>
  borderRadius: Ref<number>
}

export interface ScreenshotExportOptions {
  onSuccess?: () => void
  onError?: () => void
}

/**
 * Process and export screenshot
 * Merges image and drawing canvases, crops selection, applies border radius, and exports
 */
export async function processAndExportScreenshot(
  options: ScreenshotCaptureOptions,
  exportOptions?: ScreenshotExportOptions
): Promise<void> {
  const { imgCanvas, drawCanvas, screenConfig, borderRadius } = options
  const { onSuccess, onError } = exportOptions || {}

  if (!imgCanvas.value) {
    throw new Error('Image canvas not available')
  }

  const { startX, startY, endX, endY } = screenConfig.value
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  if (width < 1 || height < 1) {
    throw new Error('Invalid selection size')
  }

  const rectX = Math.min(startX, endX)
  const rectY = Math.min(startY, endY)

  // Create a temporary canvas to merge final image
  const mergedCanvas = document.createElement('canvas')
  const mergedCtx = mergedCanvas.getContext('2d')

  if (!mergedCtx) {
    throw new Error('Failed to get merged canvas context')
  }

  // Set merged canvas size to match imgCanvas
  mergedCanvas.width = imgCanvas.value.width
  mergedCanvas.height = imgCanvas.value.height

  try {
    // Draw original screenshot (from imgCanvas)
    mergedCtx.drawImage(imgCanvas.value, 0, 0)

    // Draw user's drawing content (from drawCanvas), using source-over mode for correct composition
    mergedCtx.globalCompositeOperation = 'source-over'
    if (drawCanvas.value) {
      mergedCtx.drawImage(drawCanvas.value, 0, 0)
    }

    // Create final crop canvas
    const offscreenCanvas = document.createElement('canvas')
    const offscreenCtx = offscreenCanvas.getContext('2d')

    if (!offscreenCtx) {
      throw new Error('Failed to get offscreen canvas context')
    }

    // Set temporary canvas size
    offscreenCanvas.width = width
    offscreenCanvas.height = height

    // Crop selection from merged canvas
    offscreenCtx.drawImage(
      mergedCanvas,
      rectX,
      rectY,
      width,
      height, // Crop region
      0,
      0,
      width,
      height // Draw to temporary canvas region
    )

    // Apply border radius if set, export PNG with transparent rounded corners
    if (borderRadius.value > 0) {
      const scale = screenConfig.value.scaleX || 1
      const r = Math.min(borderRadius.value * scale, width / 2, height / 2)
      if (r > 0) {
        offscreenCtx.save()
        // Keep only rounded rectangle content
        offscreenCtx.globalCompositeOperation = 'destination-in'

        offscreenCtx.beginPath()
        // Build rounded rectangle path on (0, 0, width, height)
        offscreenCtx.moveTo(r, 0)
        offscreenCtx.lineTo(width - r, 0)
        offscreenCtx.quadraticCurveTo(width, 0, width, r)
        offscreenCtx.lineTo(width, height - r)
        offscreenCtx.quadraticCurveTo(width, height, width - r, height)
        offscreenCtx.lineTo(r, height)
        offscreenCtx.quadraticCurveTo(0, height, 0, height - r)
        offscreenCtx.lineTo(0, r)
        offscreenCtx.quadraticCurveTo(0, 0, r, 0)
        offscreenCtx.closePath()
        offscreenCtx.fill()

        offscreenCtx.restore()
      }
    }

    // Test: check if canvas data is valid
    try {
      offscreenCtx.getImageData(0, 0, Math.min(10, width), Math.min(10, height))
    } catch (_error) {
      throw new Error('Failed to get ImageData, possibly security restriction')
    }

    // Convert to blob and export
    offscreenCanvas.toBlob(async (blob) => {
      if (blob && blob.size > 0) {
        try {
          // Convert Blob to ArrayBuffer for Tauri event passing
          const arrayBuffer = await blob.arrayBuffer()
          const buffer = new Uint8Array(arrayBuffer)

          // Send to main window
          try {
            await emitTo('home', 'screenshot', {
              type: 'image',
              buffer: Array.from(buffer),
              mimeType: 'image/png'
            })
          } catch (e) {
            console.warn('Failed to send screenshot to main window:', e)
          }

          // Copy to clipboard
          try {
            await writeImage(buffer)
            if (onSuccess) onSuccess()
          } catch (clipboardError) {
            console.error('Failed to copy to clipboard:', clipboardError)
            if (onError) onError()
          }
        } catch (_error) {
          if (onError) onError()
        }
      } else {
        if (onError) onError()
      }
    }, 'image/png')
  } catch (error) {
    console.error('Canvas operation failed:', error)
    if (onError) onError()
  }
}

/**
 * Validate screenshot selection
 * @returns true if selection is valid, false otherwise
 */
export function isValidSelection(
  screenConfig: Ref<{
    startX: number
    startY: number
    endX: number
    endY: number
  }>
): boolean {
  const { startX, startY, endX, endY } = screenConfig.value
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)
  return width > 0 && height > 0
}
