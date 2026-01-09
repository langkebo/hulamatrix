<template>
  <div ref="canvasbox" class="canvasbox">
    <canvas ref="drawCanvas" class="draw-canvas"></canvas>
    <canvas ref="maskCanvas" class="mask-canvas"></canvas>
    <canvas ref="imgCanvas" class="img-canvas"></canvas>
    <div ref="magnifier" class="magnifier">
      <canvas ref="magnifierCanvas"></canvas>
    </div>
    <!-- 选区拖动区域 -->
    <div ref="selectionArea" class="selection-area" v-show="showButtonGroup" :style="selectionAreaStyle">
      <!-- 内部拖动区域 -->
      <div
        :class="['drag-area', currentDrawTool ? 'cannot-drag' : 'can-drag']"
        :title="t('message.screenshot.tooltip_drag')"
        @mousedown="handleSelectionDragStart"
        @mousemove="handleSelectionDragMove"
        @mouseup="handleSelectionDragEnd"
        @dblclick="confirmSelection"></div>

      <!-- resize控制点 - 四个角 -->
      <div
        :class="['resize-handle', 'resize-nw', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'nw')"></div>
      <div
        :class="['resize-handle', 'resize-ne', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'ne')"></div>
      <div
        :class="['resize-handle', 'resize-sw', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'sw')"></div>
      <div
        :class="['resize-handle', 'resize-se', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'se')"></div>

      <!-- resize控制点 - 四条边的中间 -->
      <div
        :class="['resize-handle', 'resize-n', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'n')"></div>
      <div
        :class="['resize-handle', 'resize-e', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'e')"></div>
      <div
        :class="['resize-handle', 'resize-s', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 's')"></div>
      <div
        :class="['resize-handle', 'resize-w', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'w')"></div>

      <!-- 圆角控制器 -->
      <div class="border-radius-controller" :style="borderRadiusControllerStyle" @click.stop>
        <label>{{ t('message.screenshot.border_radius') }}:</label>
        <input type="range" :value="borderRadius" @input="handleBorderRadiusChange" min="0" max="100" step="1" />
        <span>{{ borderRadius }}px</span>
      </div>
    </div>

    <div ref="buttonGroup" class="button-group" v-show="showButtonGroup && !isDragging && !isResizing">
      <span
        :class="{ active: currentDrawTool === 'rect' }"
        :title="t('message.screenshot.tool_rect')"
        @click="drawImgCanvas('rect')">
        <svg><use href="#square"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'circle' }"
        :title="t('message.screenshot.tool_circle')"
        @click="drawImgCanvas('circle')">
        <svg><use href="#round"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'arrow' }"
        :title="t('message.screenshot.tool_arrow')"
        @click="drawImgCanvas('arrow')">
        <svg><use href="#arrow-right-up"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'mosaic' }"
        :title="t('message.screenshot.tool_mosaic')"
        @click="drawImgCanvas('mosaic')">
        <svg><use href="#mosaic"></use></svg>
      </span>
      <!-- 重做 -->
      <span :title="t('message.screenshot.redo')" @click="drawImgCanvas('redo')">
        <svg><use href="#refresh"></use></svg>
      </span>
      <!-- 撤回：当没有涂鸦时禁用 -->
      <span
        :class="{ disabled: !canUndo }"
        :aria-disabled="!canUndo"
        :title="t('message.screenshot.undo')"
        @click.stop="drawImgCanvas('undo')">
        <svg><use href="#return"></use></svg>
      </span>
      <span :title="t('message.screenshot.confirm')" @click="confirmSelection">
        <svg><use href="#check-small"></use></svg>
      </span>
      <span :title="t('message.screenshot.cancel')" @click="cancelSelection">
        <svg><use href="#close"></use></svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import type { Ref } from 'vue'
import { useCanvasTool } from '@/hooks/useCanvasTool'
import { useScreenshotSelection } from '@/composables/useScreenshotSelection'
import { useScreenshotMagnifier } from '@/composables/useScreenshotMagnifier'
import { useScreenshotCanvas } from '@/composables/useScreenshotCanvas'
import { isMac } from '@/utils/PlatformConstants'
import {
  drawRectangle as drawRectUtil,
  drawSizeText,
  drawMask as drawMaskUtil,
  redrawSelection as redrawSelUtil
} from '@/utils/screenshotCanvasUtils'
import { processAndExportScreenshot, isValidSelection } from '@/utils/screenshotProcessingUtils'

import { msg } from '@/utils/SafeUI'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

type ScreenConfig = {
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

// Get current window instance
const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const canvasbox: Ref<HTMLDivElement | null> = ref(null)

// Image layer
const imgCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const imgCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// Mask layer
const maskCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const maskCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// Drawing layer
const drawCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const drawCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

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

// Magnifier
const magnifier: Ref<HTMLDivElement | null> = ref(null)
const magnifierCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const magnifierCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// Button group
const buttonGroup: Ref<HTMLDivElement | null> = ref(null)
const showButtonGroup: Ref<boolean> = ref(false)

// Selection drag area
const selectionArea: Ref<HTMLDivElement | null> = ref(null)

// Screen config
const screenConfig: Ref<ScreenConfig> = ref({
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  scaleX: 0,
  scaleY: 0,
  isDrawing: false,
  width: 0,
  height: 0
})

// Current drawing tool
const currentDrawTool: Ref<string | null> = ref(null)

// Performance optimization: mouse move throttle (macOS only)
let mouseMoveThrottleId: number | null = null
const mouseMoveThrottleDelay = 16 // ~60FPS

/**
 * Initialize canvas composable after wrapper functions are defined
 */
// Wrapper functions for utilities
const drawRectangle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 2
) => {
  drawRectUtil(context, x, y, width, height, lineWidth, 0, screenConfig.value.scaleX)
  drawSizeText(context, x, y, width, height)
}

const drawMask = () => {
  drawMaskUtil(maskCtx, maskCanvas)
}

const redrawSelection = () => {
  redrawSelUtil(maskCtx, maskCanvas, screenConfig)
}

// Reset drawing tools - will be passed to canvas composable
const resetDrawTools = () => {
  currentDrawTool.value = null
  // Drawing tools cleanup will be handled by canvas composable

  // Clear draw canvas
  if (drawCtx.value && drawCanvas.value) {
    drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    logger.debug('Drawing content cleared', undefined, 'Screenshot')
  }

  // Disable drawing canvas events
  if (drawCanvas.value) {
    drawCanvas.value.style.pointerEvents = 'none'
    drawCanvas.value.style.zIndex = '5'
  }

  logger.debug('Drawing tools reset', undefined, 'Screenshot')
}

// Create temporary refs for isDragging and isResizing (will be overridden)
const tempIsDragging = ref(false)
const tempIsResizing = ref(false)
const tempIsImageLoaded = ref(false)

// Initialize canvas composable
const canvasComposable = useScreenshotCanvas({
  imgCanvas,
  imgCtx,
  maskCanvas,
  maskCtx,
  drawCanvas,
  drawCtx,
  screenConfig,
  showButtonGroup,
  isDragging: tempIsDragging,
  isResizing: tempIsResizing,
  borderRadius: ref(0), // Will be provided by selection composable
  isImageLoaded: tempIsImageLoaded,
  drawRectangle,
  resetDrawTools
})

// Destructure canvas composable
const { isImageLoaded, drawTools, canUndo, initCanvas, resetScreenshot, setupEventListeners, removeEventListeners } =
  canvasComposable

/**
 * Draw shapes
 * @param {string} type - Shape type
 */
const drawImgCanvas = (type: string) => {
  if (!drawTools.value) {
    logger.warn('绘图工具未初始化')
    return
  }

  const drawableTypes = ['rect', 'circle', 'arrow', 'mosaic']

  if (drawableTypes.includes(type)) {
    // If clicking the active tool, keep it selected (not cancelable)
    if (currentDrawTool.value === type) {
      return
    }

    // Stop previous tool
    if (currentDrawTool.value) {
      drawTools.value.stopDrawing && drawTools.value.stopDrawing()
    }

    // Activate new drawing tool
    currentDrawTool.value = type

    // Enable drawing canvas events
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'auto'
    }

    // Set brush size for mosaic
    if (type === 'mosaic') {
      drawTools.value.drawMosaicBrushSize && drawTools.value.drawMosaicBrushSize(20)
    }

    // Call drawing method to activate tool
    try {
      drawTools.value.draw(type)
    } catch (error) {
      logger.error(`Drawing tool activation failed: ${type}`, error)
      currentDrawTool.value = null
      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'none'
      }
    }
  } else if (type === 'redo') {
    // Clear all drawings
    if (drawTools.value.clearAll) {
      drawTools.value.clearAll()
    }
    currentDrawTool.value = null
    drawTools.value.resetState && drawTools.value.resetState()
    drawTools.value.clearEvents && drawTools.value.clearEvents()
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
    logger.debug('Cleared all drawings (via redo button)', undefined, 'Screenshot')
  } else if (type === 'undo') {
    // Ignore if nothing to undo
    if (!canUndo.value) return
    drawTools.value.stopDrawing && drawTools.value.stopDrawing()
    drawTools.value.undo && drawTools.value.undo()
    logger.debug('Undo executed', undefined, 'Screenshot')
  }
}

// Mask mouse event handlers
const handleMaskMouseDown = (event: MouseEvent) => {
  // 如果已经显示按钮组，则不执行任何操作
  if (showButtonGroup.value) return
  // MouseEvent扩展接口，包含offsetX和offsetY
  interface MouseEventWithOffset extends MouseEvent {
    offsetX: number
    offsetY: number
  }
  const offsetEvent = event as MouseEventWithOffset
  screenConfig.value.startX = offsetEvent.offsetX * screenConfig.value.scaleX
  screenConfig.value.startY = offsetEvent.offsetY * screenConfig.value.scaleY
  screenConfig.value.isDrawing = true
  if (!screenConfig.value.isDrawing) {
    drawMask()
  } // 先绘制遮罩层
}

const handleMaskMouseMove = (event: MouseEvent) => {
  handleMagnifierMouseMove(event)
  if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

  // MouseEvent扩展接口，包含offsetX和offsetY
  interface MouseEventWithOffset extends MouseEvent {
    offsetX: number
    offsetY: number
  }
  const offsetEvent = event as MouseEventWithOffset

  // 只在 macOS 上应用性能优化
  if (isMac()) {
    // 在菜单栏区域（y < 30）使用更强的节流来减少卡顿
    const currentY = offsetEvent.offsetY * screenConfig.value.scaleY
    const isInMenuBar = currentY < 30 // 菜单栏区域
    const throttleDelay = isInMenuBar ? 32 : mouseMoveThrottleDelay // 菜单栏区域降低到30FPS

    if (mouseMoveThrottleId) {
      return
    }

    mouseMoveThrottleId = window.setTimeout(() => {
      mouseMoveThrottleId = null

      if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

      const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
      const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
      const width = mouseX - screenConfig.value.startX
      const height = mouseY - screenConfig.value.startY

      // 优化：使用 save/restore 来减少重绘开销
      maskCtx.value.save()

      // 清除之前的矩形区域
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)

      // 重新绘制整个遮罩层
      drawMask()

      // 清除矩形区域内的遮罩，实现透明效果
      maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)

      // 绘制矩形边框
      drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)

      maskCtx.value.restore()
    }, throttleDelay)
  } else {
    const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
    const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
    const width = mouseX - screenConfig.value.startX
    const height = mouseY - screenConfig.value.startY

    // 清除之前的矩形区域
    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)

    // 重新绘制整个遮罩层
    drawMask()

    // 清除矩形区域内的遮罩，实现透明效果
    maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)

    // 绘制矩形边框
    drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)
  }
}

const handleMaskMouseUp = (event: MouseEvent) => {
  if (!screenConfig.value.isDrawing) return
  screenConfig.value.isDrawing = false
  // 记录矩形区域的结束坐标
  // MouseEvent扩展接口，包含offsetX和offsetY
  interface MouseEventWithOffset extends MouseEvent {
    offsetX: number
    offsetY: number
  }
  const offsetEvent = event as MouseEventWithOffset
  screenConfig.value.endX = offsetEvent.offsetX * screenConfig.value.scaleX
  screenConfig.value.endY = offsetEvent.offsetY * screenConfig.value.scaleY

  // 记录矩形区域的宽高
  screenConfig.value.width = Math.abs(screenConfig.value.endX - screenConfig.value.startX)
  screenConfig.value.height = Math.abs(screenConfig.value.endY - screenConfig.value.startY)
  // 判断矩形区域是否有效
  if (screenConfig.value.width > 5 && screenConfig.value.height > 5) {
    // 隐藏放大镜，避免干扰后续操作
    hideMagnifier()

    // 重绘蒙版
    redrawSelection()

    showButtonGroup.value = true // 显示按钮组
    nextTick(() => {
      updateButtonGroupPosition()
    })
  }
}

// Initialize magnifier composable before selection (selection needs handleMagnifierMouseMove)
const magnifierComp = useScreenshotMagnifier({
  imgCanvas,
  imgCtx,
  screenConfig,
  isDragging: tempIsDragging,
  isResizing: tempIsResizing,
  showButtonGroup,
  isImageLoaded,
  magnifier,
  magnifierCanvas,
  magnifierCtx
})

// Destructure magnifier functions
const { initMagnifier, handleMagnifierMouseMove, hideMagnifier } = magnifierComp

// Create refs for isDragging and isResizing to share between composables
const sharedIsDragging = ref(false)
const sharedIsResizing = ref(false)

// Initialize selection composable after redrawSelection and magnifier are defined
const selection = useScreenshotSelection({
  screenConfig,
  currentDrawTool,
  buttonGroup,
  showButtonGroup,
  selectionArea,
  isDragging: sharedIsDragging,
  isResizing: sharedIsResizing,
  onRedrawSelection: redrawSelection,
  onMagnifierUpdate: handleMagnifierMouseMove
})

// Destructure selection state and functions
const {
  selectionAreaStyle,
  isDragging,
  isResizing,
  borderRadiusControllerStyle,
  borderRadius,
  updateSelectionAreaPosition,
  updateButtonGroupPosition,
  handleSelectionDragStart,
  handleSelectionDragMove,
  handleSelectionDragEnd,
  handleResizeStart,
  handleResizeMove,
  handleResizeEnd,
  handleBorderRadiusChange
} = selection

const confirmSelection = async () => {
  // 立即隐藏放大镜，防止被截取到
  hideMagnifier()

  // 检查图像是否已加载
  if (!isImageLoaded) {
    logger.error('图像尚未加载完成，请稍后再试')
    await resetScreenshot()
    return
  }

  // 验证选区
  if (!isValidSelection(screenConfig)) {
    logger.error('❌选区尺寸无效')
    await resetScreenshot()
    return
  }

  try {
    // 处理并导出截图
    await processAndExportScreenshot(
      {
        imgCanvas,
        drawCanvas,
        screenConfig,
        borderRadius
      },
      {
        onSuccess: () => {
          msg.success(t('message.screenshot.save_success'))
          resetScreenshot()
        },
        onError: () => {
          msg.error(t('message.screenshot.save_failed'))
          resetScreenshot()
        }
      }
    )
  } catch (error) {
    logger.error('截图处理失败:', error)
    msg.error(t('message.screenshot.save_failed'))
    await resetScreenshot()
  }
}

// Global mouse click handler for canceling drawing tools
const handleGlobalMouseDown = (event: MouseEvent) => {
  // 只有在绘图工具激活且按钮组显示时才考虑处理
  if (!currentDrawTool.value || !showButtonGroup.value) return

  // 如果点击发生在按钮组内，直接返回，避免误操作
  if (buttonGroup.value && buttonGroup.value.contains(event.target as Node)) {
    return
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    resetScreenshot()
  }
}

const handleRightClick = (event: MouseEvent) => {
  // 阻止默认右键菜单
  event.preventDefault()
  resetScreenshot()
}

const cancelSelection = () => {
  resetScreenshot()
}

// 截图处理函数
const handleScreenshot = () => {
  // 每次开始截图时重置所有状态
  resetDrawTools()
  appWindow.show()
  initCanvas()
  initMagnifier()
}

// Setup event listeners through canvas composable
setupEventListeners({
  onMaskMouseDown: handleMaskMouseDown,
  onMaskMouseMove: handleMaskMouseMove,
  onMaskMouseUp: handleMaskMouseUp,
  onKeyDown: handleKeyDown,
  onRightClick: handleRightClick,
  onGlobalMouseDown: handleGlobalMouseDown
})

onMounted(async () => {
  appWindow.listen('capture', () => {
    resetDrawTools()
    initCanvas()
    initMagnifier()
  })

  // Listen for window hide reset event
  appWindow.listen('capture-reset', () => {
    resetDrawTools()
    resetScreenshot()
  })

  // Listen for custom screenshot event
  window.addEventListener('trigger-screenshot', handleScreenshot)
})

onUnmounted(async () => {
  // Remove event listeners through canvas composable
  removeEventListeners({
    onKeyDown: handleKeyDown,
    onRightClick: handleRightClick,
    onGlobalMouseDown: handleGlobalMouseDown
  })

  // Remove custom event listener
  window.removeEventListener('trigger-screenshot', handleScreenshot)
})
</script>

<style scoped lang="scss">
.canvasbox {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: transparent;
}

canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.magnifier {
  position: absolute;
  pointer-events: none;
  width: 120px;
  height: 120px;
  border: 1px solid #ccc;
  border-radius: 12px;
  overflow: hidden;
  display: none;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.img-canvas {
  z-index: 0;
}

.mask-canvas {
  z-index: 1;
}

.draw-canvas {
  z-index: 5;
  pointer-events: none;
}

.magnifier canvas {
  display: block;
  z-index: 2;
}

.selection-area {
  position: absolute;
  z-index: 2;
  background: transparent;
  box-sizing: border-box;
}

.drag-area {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 10;
  background: transparent;
}

.drag-area.can-drag {
  cursor: move;
}

.drag-area.cannot-drag {
  cursor: not-allowed;
}

.resize-handle {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 4;
  transition: all 0.2s;
}

.resize-handle.disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.5;
}

/* 四个角的控制点 */
.resize-nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

/* 四条边中间的控制点 */
.resize-n {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-e {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-s {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-w {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: w-resize;
}

.button-group {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;
  overflow: visible;

  span {
    cursor: pointer;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex: 0 0 auto;

    svg {
      width: 22px;
      height: 22px;
    }

    &:hover svg {
      color: var(--hula-brand-primary);
    }

    &.active svg {
      color: var(--hula-brand-primary);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
}

.border-radius-controller {
  position: absolute;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;

  label {
    margin: 0;
  }

  input[type='range'] {
    width: 60px;
    height: 4px;
    background: #ddd;
    border-radius: 2px;
    outline: none;
    margin: 0;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      border: none;
      cursor: pointer;
    }
  }

  span {
    font-size: 11px;
    min-width: 25px;
  }
}
</style>
