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
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import type { Ref } from 'vue'
import { useCanvasTool } from '@/hooks/useCanvasTool'
import { useScreenshotSelection } from '@/composables/useScreenshotSelection'
import { useScreenshotMagnifier } from '@/composables/useScreenshotMagnifier'
import { isMac } from '@/utils/PlatformConstants'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import {
  drawRectangle as drawRectUtil,
  drawSizeText,
  drawMask as drawMaskUtil,
  redrawSelection as redrawSelUtil
} from '@/utils/screenshotCanvasUtils'

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

// 获取当前窗口实例
const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const canvasbox: Ref<HTMLDivElement | null> = ref(null)

// 图像层
const imgCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const imgCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// 蒙版层
const maskCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const maskCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// 绘图层
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

let drawTools: CanvasTool | null
// 是否可撤回
const canUndo = ref(false)

// 放大镜
const magnifier: Ref<HTMLDivElement | null> = ref(null)
const magnifierCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const magnifierCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// 按钮组
const buttonGroup: Ref<HTMLDivElement | null> = ref(null)
const showButtonGroup: Ref<boolean> = ref(false) // 控制按钮组显示

// 选区拖动区域
const selectionArea: Ref<HTMLDivElement | null> = ref(null)

// 截屏信息
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

// 截屏图片
let screenshotImage: HTMLImageElement
let isImageLoaded: boolean = false

// 当前选择的绘图工具
const currentDrawTool: Ref<string | null> = ref(null)

// 性能优化：鼠标移动事件节流（仅 macOS）
let mouseMoveThrottleId: number | null = null
const mouseMoveThrottleDelay = 16 // 约60FPS，在菜单栏区域降低频率

// 窗口状态恢复函数
const restoreWindowState = async () => {
  await appWindow.hide()
}

/**
 * 绘制图形
 * @param {string} type - 图形类型
 */
const drawImgCanvas = (type: string) => {
  if (!drawTools) {
    logger.warn('绘图工具未初始化')
    return
  }

  const drawableTypes = ['rect', 'circle', 'arrow', 'mosaic']

  if (drawableTypes.includes(type)) {
    // 如果点击的是当前已激活的工具，保持选中，不进行任何操作（不可取消，只能切换其他选项）
    if (currentDrawTool.value === type) {
      return
    }

    // 先停止之前的工具
    if (currentDrawTool.value) {
      drawTools.stopDrawing && drawTools.stopDrawing()
    }

    // 激活新的绘图工具
    currentDrawTool.value = type

    // 启用绘图Canvas事件接收
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'auto'
    }

    // 绘制马赛克时设置笔宽
    if (type === 'mosaic') {
      drawTools.drawMosaicBrushSize && drawTools.drawMosaicBrushSize(20)
    }

    // 调用绘图方法，确保绘图工具被正确激活
    try {
      drawTools.draw(type)
    } catch (error) {
      logger.error(`绘图工具激活失败: ${type}`, error)
      currentDrawTool.value = null
      // 激活失败时也要禁用事件
      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'none'
      }
    }
  } else if (type === 'redo') {
    // 需求：点击“重做”清空绘图画布的全部涂鸦
    if (drawTools.clearAll) {
      drawTools.clearAll()
    }
    // 清空后重置工具状态并禁用绘图事件穿透
    currentDrawTool.value = null
    drawTools.resetState && drawTools.resetState()
    drawTools.clearEvents && drawTools.clearEvents()
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
    logger.debug('已清空全部涂鸦 (通过重做按钮)', undefined, 'Screenshot')
  } else if (type === 'undo') {
    // 没有可撤回的内容时直接忽略点击
    if (!canUndo.value) return
    // 先停止可能正在进行的绘制，确保一次点击立即生效
    drawTools.stopDrawing && drawTools.stopDrawing()
    drawTools.undo && drawTools.undo()
    logger.debug('执行撤销', undefined, 'Screenshot')
  }
}

// 重置绘图工具状态
const resetDrawTools = () => {
  currentDrawTool.value = null
  if (drawTools) {
    // 停止当前绘图操作
    drawTools.stopDrawing && drawTools.stopDrawing()
    // 重置绘图工具到默认状态
    drawTools.resetState && drawTools.resetState()
    // 清除绘图工具的事件监听
    drawTools.clearEvents && drawTools.clearEvents()
  }

  // 清除绘图canvas的内容
  if (drawCtx.value && drawCanvas.value) {
    drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    logger.debug('绘图内容已清除', undefined, 'Screenshot')
  }

  // 重置时禁用绘图canvas事件，让事件穿透到选区
  if (drawCanvas.value) {
    drawCanvas.value.style.pointerEvents = 'none'
    drawCanvas.value.style.zIndex = '5'
  }

  logger.debug('绘图工具已重置', undefined, 'Screenshot')
}

/**
 * 初始化canvas
 */
const initCanvas = async () => {
  // 在截图前隐藏放大镜，避免被截进去
  hideMagnifier()
  // 重置绘图工具状态
  resetDrawTools()

  // 重置图像加载状态
  isImageLoaded = false

  // 重置其他状态
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

  if (imgCanvas.value && maskCanvas.value) {
    imgCanvas.value.width = canvasWidth
    imgCanvas.value.height = canvasHeight
    maskCanvas.value.width = canvasWidth
    maskCanvas.value.height = canvasHeight
    drawCanvas.value!.width = canvasWidth
    drawCanvas.value!.height = canvasHeight

    imgCtx.value = imgCanvas.value.getContext('2d')
    maskCtx.value = maskCanvas.value.getContext('2d')
    drawCtx.value = drawCanvas.value!.getContext('2d', { willReadFrequently: true })

    // 清除绘图canvas的内容
    if (drawCtx.value) {
      drawCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
    }

    // 获取屏幕缩放比例
    const { clientWidth: containerWidth, clientHeight: containerHeight } = imgCanvas.value!
    screenConfig.value.scaleX = canvasWidth / containerWidth
    screenConfig.value.scaleY = canvasHeight / containerHeight

    screenshotImage = new Image()

    screenshotImage.onload = () => {
      if (imgCtx.value) {
        try {
          imgCtx.value.drawImage(screenshotImage, 0, 0, canvasWidth, canvasHeight)

          // 绘制全屏绿色边框
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

          if (drawCanvas.value && drawCtx.value && imgCtx.value) {
            drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
            // 初始化时禁用绘图canvas事件，让事件穿透到选区
            drawCanvas.value.style.pointerEvents = 'none'
            drawCanvas.value.style.zIndex = '5'
            // 同步 canUndo 状态到本组件用于禁用撤回按钮
            const currentDrawTools = drawTools
            if (currentDrawTools?.canUndo) {
              watch(
                () => currentDrawTools.canUndo?.value,
                (val) => (canUndo.value = val ?? false),
                { immediate: true }
              )
            }
            logger.debug('绘图工具初始化完成 (备用方式)', undefined, 'Screenshot')
          }
          isImageLoaded = true
        } catch (error) {
          logger.error('绘制图像到canvas失败:', error)
        }
      } else {
        logger.error('imgCtx.value为空')
      }
    }

    // 直接将原始buffer绘制到canvas，不使用Image对象
    if (screenshotData && imgCtx.value) {
      try {
        // 解码base64数据
        const binaryString = atob(screenshotData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // 创建ImageData并绘制到canvas
        const imageData = new ImageData(new Uint8ClampedArray(bytes), canvasWidth, canvasHeight)
        imgCtx.value.putImageData(imageData, 0, 0)

        // 绘制全屏绿色边框
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

        if (drawCanvas.value && drawCtx.value && imgCtx.value) {
          drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
          // 初始化时禁用绘图canvas事件，让事件穿透到选区
          drawCanvas.value.style.pointerEvents = 'none'
          drawCanvas.value.style.zIndex = '5'
          // 同步 canUndo 状态到本组件用于禁用撤回按钮
          const currentDrawTools = drawTools
          if (currentDrawTools?.canUndo) {
            watch(
              () => currentDrawTools.canUndo?.value,
              (val) => (canUndo.value = val ?? false),
              { immediate: true }
            )
          }
          logger.debug('绘图工具初始化完成', undefined, 'Screenshot')
        }
        isImageLoaded = true
      } catch (error) {
        // 如果直接绘制失败，回退到Image对象方式
        screenshotImage.src = `data:image/png;base64,${screenshotData}`
      }
    } else {
      screenshotImage.src = `data:image/png;base64,${screenshotData}`
    }
  }

  // 添加鼠标监听事件
  maskCanvas.value?.addEventListener('mousedown', handleMaskMouseDown)
  maskCanvas.value?.addEventListener('mousemove', handleMaskMouseMove)
  maskCanvas.value?.addEventListener('mouseup', handleMaskMouseUp)
  maskCanvas.value?.addEventListener('contextmenu', handleRightClick)

  // 添加键盘监听事件
  document.addEventListener('keydown', handleKeyDown)

  // 添加全局右键监听事件
  document.addEventListener('contextmenu', handleRightClick)

  // 添加全局点击监听，用于取消绘图工具
  document.addEventListener('mousedown', handleGlobalMouseDown)
}

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

/**
 * 绘制矩形（支持圆角）
 */
const drawRectangle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 2
) => {
  drawRectUtil(context, x, y, width, height, lineWidth, borderRadius.value, screenConfig.value.scaleX)
  drawSizeText(context, x, y, width, height)
}

/**
 * 绘制蒙版
 */
const drawMask = () => {
  drawMaskUtil(maskCtx, maskCanvas)
}

// 重绘蒙版为透明选区 + 无描边，避免与 DOM 选区边框重复
const redrawSelection = () => {
  redrawSelUtil(maskCtx, maskCanvas, screenConfig)
}

// Initialize magnifier composable before selection (selection needs handleMagnifierMouseMove)
const magnifierComp = useScreenshotMagnifier({
  imgCanvas,
  imgCtx,
  screenConfig,
  isDragging: ref(false), // Will be overridden by selection composable
  isResizing: ref(false), // Will be overridden by selection composable
  showButtonGroup,
  isImageLoaded: ref(false),
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

  const { startX, startY, endX, endY } = screenConfig.value
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  if (width < 1 || height < 1) {
    logger.error('❌选区尺寸无效:', { width, height })
    await resetScreenshot()
    return
  }

  // 计算选区的左上角位置
  const rectX = Math.min(startX, endX)
  const rectY = Math.min(startY, endY)

  // 创建一个临时 canvas 来合成最终图像
  const mergedCanvas = document.createElement('canvas')
  const mergedCtx = mergedCanvas.getContext('2d')

  // 设置合成canvas的尺寸与imgCanvas相同
  mergedCanvas.width = imgCanvas.value!.width
  mergedCanvas.height = imgCanvas.value!.height

  if (mergedCtx) {
    try {
      // 先绘制原始截图（从imgCanvas）
      mergedCtx.drawImage(imgCanvas.value!, 0, 0)

      // 然后绘制用户的绘图内容（从drawCanvas），使用source-over模式确保正确合成
      mergedCtx.globalCompositeOperation = 'source-over'
      mergedCtx.drawImage(drawCanvas.value!, 0, 0)

      // 创建最终的裁剪canvas
      const offscreenCanvas = document.createElement('canvas')
      const offscreenCtx = offscreenCanvas.getContext('2d')

      // 设置临时 canvas 的尺寸
      offscreenCanvas.width = width
      offscreenCanvas.height = height

      if (offscreenCtx) {
        // 从合成后的canvas裁剪选区
        offscreenCtx.drawImage(
          mergedCanvas,
          rectX,
          rectY,
          width,
          height, // 裁剪区域
          0,
          0,
          width,
          height // 绘制到临时 canvas 的区域
        )

        // 如果设置了圆角，则将裁剪结果应用圆角蒙版，导出带透明圆角的 PNG
        if (borderRadius.value > 0) {
          const scale = screenConfig.value.scaleX || 1
          const r = Math.min(borderRadius.value * scale, width / 2, height / 2)
          if (r > 0) {
            offscreenCtx.save()
            // 仅保留圆角矩形内的内容
            offscreenCtx.globalCompositeOperation = 'destination-in'

            offscreenCtx.beginPath()
            // 在 (0,0,width,height) 上构建圆角矩形路径
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

        // 测试：检查canvas数据是否有效
        try {
          offscreenCtx.getImageData(0, 0, Math.min(10, width), Math.min(10, height))
        } catch (error) {
          logger.error('获取ImageData失败,可能是安全限制:', error)
        }

        offscreenCanvas.toBlob(async (blob) => {
          if (blob && blob.size > 0) {
            try {
              // 将 Blob 转换为 ArrayBuffer 以便通过 Tauri 事件传递
              const arrayBuffer = await blob.arrayBuffer()
              const buffer = new Uint8Array(arrayBuffer)

              try {
                await emitTo('home', 'screenshot', {
                  type: 'image',
                  buffer: Array.from(buffer),
                  mimeType: 'image/png'
                })
              } catch (e) {
                logger.warn('发送截图到主窗口失败:', e)
              }

              try {
                await writeImage(buffer)
                msg.success(t('message.screenshot.save_success'))
              } catch (clipboardError) {
                logger.error('复制到剪贴板失败:', clipboardError)
                msg.error(t('message.screenshot.save_failed'))
              }

              await resetScreenshot()
            } catch (error) {
              msg.error(t('message.screenshot.save_failed'))
              await resetScreenshot()
            }
          } else {
            msg.error(t('message.screenshot.save_failed'))
            await resetScreenshot()
          }
        }, 'image/png')
      }
    } catch (error) {
      logger.error('Canvas操作失败:', error)
      msg.error(t('message.screenshot.save_failed'))
      await resetScreenshot()
    }
  }
}

const resetScreenshot = async () => {
  try {
    // 清理性能优化相关的定时器（仅 macOS）
    if (isMac() && mouseMoveThrottleId) {
      clearTimeout(mouseMoveThrottleId)
      mouseMoveThrottleId = null
    }

    // 重置绘图工具状态
    resetDrawTools()

    // 重置所有状态
    showButtonGroup.value = false
    isImageLoaded = false
    borderRadius.value = 0 // 重置圆角
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

    // 清除所有canvas内容
    if (imgCtx.value && imgCanvas.value) {
      imgCtx.value.clearRect(0, 0, imgCanvas.value.width, imgCanvas.value.height)
    }
    if (maskCtx.value && maskCanvas.value) {
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    }
    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
      // 重置时禁用绘图canvas事件
      drawCanvas.value.style.pointerEvents = 'none'
    }

    // 隐藏放大镜
    hideMagnifier()

    // 恢复窗口状态（macOS需要退出全屏）
    await restoreWindowState()
  } catch (error) {
    // 即使出错也要尝试恢复窗口状态
    await restoreWindowState()
  }
}

// 全局鼠标点击处理，用于取消绘图工具
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

onMounted(async () => {
  appWindow.listen('capture', () => {
    resetDrawTools()
    initCanvas()
    initMagnifier()
  })

  // 监听窗口隐藏时的重置事件
  appWindow.listen('capture-reset', () => {
    resetDrawTools()
    resetScreenshot()
  })

  // 监听自定义截图事件
  window.addEventListener('trigger-screenshot', handleScreenshot)
})

onUnmounted(async () => {
  // 清理性能优化相关的定时器（仅 macOS）
  if (isMac() && mouseMoveThrottleId) {
    clearTimeout(mouseMoveThrottleId)
    mouseMoveThrottleId = null
  }

  // 清理键盘监听事件
  document.removeEventListener('keydown', handleKeyDown)

  // 清理全局右键监听事件
  document.removeEventListener('contextmenu', handleRightClick)

  // 清理全局点击监听事件
  document.removeEventListener('mousedown', handleGlobalMouseDown)

  // 清理右键监听事件
  if (maskCanvas.value) {
    maskCanvas.value.removeEventListener('contextmenu', handleRightClick)
  }

  // 清理自定义事件监听
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
      color: #13987f;
    }

    &.active svg {
      color: #13987f;
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
