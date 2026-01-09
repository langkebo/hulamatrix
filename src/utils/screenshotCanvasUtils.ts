import type { Ref } from 'vue'

export interface ScreenConfig {
  scaleX: number
  startY: number
}

/**
 * Draw a rectangle (with optional rounded corners) on canvas
 */
export function drawRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 2,
  borderRadius: number = 0,
  screenScaleX: number = 1
): void {
  context.strokeStyle = '#13987f'
  context.lineWidth = lineWidth

  // If border radius is set, draw rounded rectangle
  if (borderRadius > 0) {
    const radius = borderRadius * screenScaleX // Adjust radius based on scale
    const adjustedRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)

    context.beginPath()

    // Ensure coordinates are correct (handle negative width/height)
    const rectX = width >= 0 ? x : x + width
    const rectY = height >= 0 ? y : y + height
    const rectWidth = Math.abs(width)
    const rectHeight = Math.abs(height)

    // Draw rounded rectangle path
    context.moveTo(rectX + adjustedRadius, rectY)
    context.lineTo(rectX + rectWidth - adjustedRadius, rectY)
    context.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + adjustedRadius)
    context.lineTo(rectX + rectWidth, rectY + rectHeight - adjustedRadius)
    context.quadraticCurveTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX + rectWidth - adjustedRadius,
      rectY + rectHeight
    )
    context.lineTo(rectX + adjustedRadius, rectY + rectHeight)
    context.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - adjustedRadius)
    context.lineTo(rectX, rectY + adjustedRadius)
    context.quadraticCurveTo(rectX, rectY, rectX + adjustedRadius, rectY)
    context.closePath()

    context.stroke()
  } else {
    // Regular rectangle
    context.strokeRect(x, y, width, height)
  }
}

/**
 * Draw rectangle size text on canvas
 */
export function drawSizeText(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  if (context) {
    // Round width and height
    const roundedWidth = Math.round(Math.abs(width))
    const roundedHeight = Math.round(Math.abs(height))
    const sizeText = `${roundedWidth} x ${roundedHeight}`

    // Ensure text always displays at the top-left of the rectangle
    const textX = width >= 0 ? x : x + width
    const textY = height >= 0 ? y : y + height

    // Set font and style
    context.font = '14px Arial'
    context.fillStyle = 'white'
    // Set image interpolation quality
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillText(sizeText, textX + 5, textY - 10) // Draw text at top-left of rectangle with slight offset
  }
}

/**
 * Draw mask overlay on canvas
 */
export function drawMask(
  maskCtx: Ref<CanvasRenderingContext2D | null>,
  maskCanvas: Ref<HTMLCanvasElement | null>
): void {
  if (maskCtx.value && maskCanvas.value) {
    maskCtx.value.fillStyle = 'rgba(0, 0, 0, 0.4)'
    maskCtx.value.fillRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  }
}

/**
 * Redraw selection mask as transparent with no border
 * (Avoids duplication with DOM selection border)
 */
export function redrawSelection(
  maskCtx: Ref<CanvasRenderingContext2D | null>,
  maskCanvas: Ref<HTMLCanvasElement | null>,
  screenConfig: Ref<{ startX: number; startY: number; endX: number; endY: number }>
): void {
  if (!maskCtx.value || !maskCanvas.value) return

  const { startX, startY, endX, endY } = screenConfig.value
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  // Clear and redraw mask
  maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  drawMask(maskCtx, maskCanvas)

  maskCtx.value.clearRect(x, y, width, height)
}
