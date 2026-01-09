import { ref, type Ref, nextTick } from 'vue'

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

export interface UseScreenshotSelectionOptions {
  screenConfig: Ref<ScreenConfig>
  currentDrawTool: Ref<string | null>
  buttonGroup: Ref<HTMLDivElement | null>
  showButtonGroup: Ref<boolean>
  selectionArea: Ref<HTMLDivElement | null>
  isDragging?: Ref<boolean>
  isResizing?: Ref<boolean>
  onRedrawSelection?: () => void
  onMagnifierUpdate?: (event: MouseEvent) => void
}

export interface UseScreenshotSelectionReturn {
  // State
  selectionAreaStyle: Ref<Record<string, string>>
  isDragging: Ref<boolean>
  dragOffset: Ref<{ x: number; y: number }>
  isResizing: Ref<boolean>
  resizeDirection: Ref<string>
  resizeStartPosition: Ref<{
    x: number
    y: number
    width: number
    height: number
    left: number
    top: number
  }>
  borderRadiusControllerStyle: Ref<Record<string, string>>
  borderRadius: Ref<number>

  // Actions
  updateSelectionAreaPosition: () => void
  updateButtonGroupPosition: () => void
  handleSelectionDragStart: (event: MouseEvent) => void
  handleSelectionDragMove: (event: MouseEvent) => void
  handleSelectionDragEnd: () => void
  handleResizeStart: (event: MouseEvent, direction: string) => void
  handleResizeMove: (event: MouseEvent) => void
  handleResizeEnd: () => void
  handleBorderRadiusChange: (event: Event) => void
}

/**
 * Composable for screenshot selection area management
 * Handles selection area dragging, resizing, positioning, and border radius control
 */
export function useScreenshotSelection(options: UseScreenshotSelectionOptions): UseScreenshotSelectionReturn {
  const {
    screenConfig,
    currentDrawTool,
    buttonGroup,
    showButtonGroup,
    selectionArea,
    isDragging: externalIsDragging,
    isResizing: externalIsResizing,
    onRedrawSelection,
    onMagnifierUpdate
  } = options

  // State
  const selectionAreaStyle = ref<Record<string, string>>({})
  const isDragging = externalIsDragging || ref(false)
  const dragOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 })
  const isResizing = externalIsResizing || ref(false)
  const resizeDirection = ref('')
  const resizeStartPosition = ref({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0
  })
  const borderRadiusControllerStyle = ref<Record<string, string>>({})
  const borderRadius = ref(0)

  // 更新选区拖动区域位置
  const updateSelectionAreaPosition = () => {
    if (!selectionArea.value) return

    const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

    // 矩形的边界
    const minX = Math.min(startX, endX) / scaleX
    const minY = Math.min(startY, endY) / scaleY
    const maxX = Math.max(startX, endX) / scaleX
    const maxY = Math.max(startY, endY) / scaleY

    selectionAreaStyle.value = {
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${maxX - minX}px`,
      height: `${maxY - minY}px`,
      borderRadius: `${borderRadius.value}px`,
      border: '2px solid var(--hula-brand-primary)'
    }

    // 更新圆角控制器位置，确保不超出屏幕边界
    updateBorderRadiusControllerPosition(minX, minY)
  }

  // 更新圆角控制器位置
  const updateBorderRadiusControllerPosition = (selectionLeft: number, selectionTop: number) => {
    const controllerHeight = 35 // 控制器高度
    const controllerWidth = 120 // 控制器宽度

    let left = selectionLeft
    let top = selectionTop - controllerHeight

    // 确保控制器不超出屏幕左边界
    if (left < 0) {
      left = 0
    }

    // 确保控制器不超出屏幕右边界
    if (left + controllerWidth > window.innerWidth) {
      left = window.innerWidth - controllerWidth - 10
    }

    // 确保控制器不超出屏幕上边界
    if (top < 0) {
      top = selectionTop + 4 // 如果超出上边界，显示在选区内部
    }

    borderRadiusControllerStyle.value = {
      left: `${left - selectionLeft}px`, // 相对于选区的位置
      top: `${top - selectionTop}px`
    }
  }

  // 计算矩形区域工具栏位置
  const updateButtonGroupPosition = () => {
    if (!buttonGroup.value) return

    // 按钮组不可见、正在拖动或正在调整大小时，不进行尺寸测量和定位
    if (!showButtonGroup.value || isDragging.value || isResizing.value) {
      updateSelectionAreaPosition()
      return
    }

    const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

    // 矩形的边界
    const minY = Math.min(startY, endY) / scaleY
    const maxX = Math.max(startX, endX) / scaleX
    const maxY = Math.max(startY, endY) / scaleY

    // 可用屏幕尺寸
    const availableHeight = window.innerHeight
    const availableWidth = window.innerWidth

    const el = buttonGroup.value
    el.style.flexWrap = 'nowrap'
    el.style.whiteSpace = 'nowrap'
    el.style.width = 'max-content'
    el.style.overflow = 'visible'

    const rect = el.getBoundingClientRect()
    const measuredHeight = rect.height
    const contentWidth = el.scrollWidth || rect.width

    const maxAllowedWidth = availableWidth - 20
    const finalWidth = Math.min(contentWidth, maxAllowedWidth)

    // 判断是否能放在选区下方
    const spaceBelow = availableHeight - maxY
    const canFitBelow = spaceBelow >= measuredHeight + 10 // 留10px缓冲

    let leftPosition: number
    let topPosition: number

    if (canFitBelow) {
      // 优先放在选区下方
      topPosition = maxY + 4

      // 与选区右对齐
      leftPosition = maxX - finalWidth
      leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
    } else {
      // 选区下方空间不足，放在选区上方
      topPosition = minY - (measuredHeight + 4)
      if (topPosition < 0) topPosition = 10

      // 与选区右对齐
      leftPosition = maxX - finalWidth
      leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
    }

    // 应用最终位置与宽度
    el.style.top = `${topPosition}px`
    el.style.left = `${leftPosition}px`
    el.style.width = `${finalWidth}px`
    el.style.boxSizing = 'border-box'

    // 更新选区拖动区域位置
    updateSelectionAreaPosition()
  }

  // 选区拖动开始
  const handleSelectionDragStart = (event: MouseEvent) => {
    // 如果有绘图工具处于激活状态，禁止拖动
    if (currentDrawTool.value) {
      event.preventDefault()
      event.stopPropagation()
      return // 直接返回，不执行拖动
    }

    // 确保拖动功能不受绘图工具状态影响
    event.preventDefault()
    event.stopPropagation()

    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - parseFloat(selectionAreaStyle.value.left || '0'),
      y: event.clientY - parseFloat(selectionAreaStyle.value.top || '0')
    }

    // 添加全局鼠标事件监听
    document.addEventListener('mousemove', handleSelectionDragMove)
    document.addEventListener('mouseup', handleSelectionDragEnd)
  }

  // 选区拖动移动
  const handleSelectionDragMove = (event: MouseEvent) => {
    if (!isDragging.value) return

    event.preventDefault()

    // 拖动选区时不显示放大镜
    const newLeft = event.clientX - dragOffset.value.x
    const newTop = event.clientY - dragOffset.value.y

    // 确保选区不超出屏幕边界
    const selectionWidth = parseFloat(selectionAreaStyle.value.width || '0')
    const selectionHeight = parseFloat(selectionAreaStyle.value.height || '0')
    const maxLeft = window.innerWidth - selectionWidth
    const maxTop = window.innerHeight - selectionHeight

    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft))
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop))

    selectionAreaStyle.value.left = `${constrainedLeft}px`
    selectionAreaStyle.value.top = `${constrainedTop}px`
    selectionAreaStyle.value.borderRadius = `${borderRadius.value}px`
    selectionAreaStyle.value.border = '2px solid var(--hula-brand-primary)'

    // 更新screenConfig
    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = constrainedLeft * scaleX
    screenConfig.value.startY = constrainedTop * scaleY
    screenConfig.value.endX = (constrainedLeft + selectionWidth) * scaleX
    screenConfig.value.endY = (constrainedTop + selectionHeight) * scaleY

    // 重新绘制矩形
    if (onRedrawSelection) {
      onRedrawSelection()
    }
    // 拖动过程中不定位按钮组
    if (!isDragging.value) {
      updateButtonGroupPosition()
    }
  }

  // 选区拖动结束
  const handleSelectionDragEnd = () => {
    isDragging.value = false

    // 移除全局鼠标事件监听
    document.removeEventListener('mousemove', handleSelectionDragMove)
    document.removeEventListener('mouseup', handleSelectionDragEnd)

    nextTick(() => {
      updateButtonGroupPosition()
    })
  }

  // resize开始
  const handleResizeStart = (event: MouseEvent, direction: string) => {
    // 如果有绘图工具处于激活状态，禁止resize
    if (currentDrawTool.value) {
      event.preventDefault()
      event.stopPropagation()
      return // 直接返回，不执行resize
    }

    event.preventDefault()
    event.stopPropagation()

    isResizing.value = true
    resizeDirection.value = direction

    resizeStartPosition.value = {
      x: event.clientX,
      y: event.clientY,
      width: parseFloat(selectionAreaStyle.value.width || '0'),
      height: parseFloat(selectionAreaStyle.value.height || '0'),
      left: parseFloat(selectionAreaStyle.value.left || '0'),
      top: parseFloat(selectionAreaStyle.value.top || '0')
    }

    // 添加全局鼠标事件监听
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  // resize移动
  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing.value) return

    event.preventDefault()

    // 调整大小时也显示放大镜，辅助精确定位
    if (onMagnifierUpdate) {
      onMagnifierUpdate(event)
    }

    const deltaX = event.clientX - resizeStartPosition.value.x
    const deltaY = event.clientY - resizeStartPosition.value.y

    let newLeft = resizeStartPosition.value.left
    let newTop = resizeStartPosition.value.top
    let newWidth = resizeStartPosition.value.width
    let newHeight = resizeStartPosition.value.height

    // 根据resize方向调整位置和尺寸
    switch (resizeDirection.value) {
      case 'nw': // 左上角
        newLeft += deltaX
        newTop += deltaY
        newWidth -= deltaX
        newHeight -= deltaY
        break
      case 'ne': // 右上角
        newTop += deltaY
        newWidth += deltaX
        newHeight -= deltaY
        break
      case 'sw': // 左下角
        newLeft += deltaX
        newWidth -= deltaX
        newHeight += deltaY
        break
      case 'se': // 右下角
        newWidth += deltaX
        newHeight += deltaY
        break
      case 'n': // 上边
        newTop += deltaY
        newHeight -= deltaY
        break
      case 'e': // 右边
        newWidth += deltaX
        break
      case 's': // 下边
        newHeight += deltaY
        break
      case 'w': // 左边
        newLeft += deltaX
        newWidth -= deltaX
        break
    }

    // 确保最小尺寸
    const minSize = 20
    if (newWidth < minSize) {
      if (resizeDirection.value.includes('w')) {
        newLeft = resizeStartPosition.value.left + resizeStartPosition.value.width - minSize
      }
      newWidth = minSize
    }
    if (newHeight < minSize) {
      if (resizeDirection.value.includes('n')) {
        newTop = resizeStartPosition.value.top + resizeStartPosition.value.height - minSize
      }
      newHeight = minSize
    }

    // 确保不超出屏幕边界
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - newWidth))
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - newHeight))

    // 更新样式
    selectionAreaStyle.value = {
      left: `${newLeft}px`,
      top: `${newTop}px`,
      width: `${newWidth}px`,
      height: `${newHeight}px`,
      borderRadius: `${borderRadius.value}px`,
      border: '2px solid var(--hula-brand-primary)'
    }

    // 更新screenConfig
    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = newLeft * scaleX
    screenConfig.value.startY = newTop * scaleY
    screenConfig.value.endX = (newLeft + newWidth) * scaleX
    screenConfig.value.endY = (newTop + newHeight) * scaleY

    // 重新绘制选区
    if (onRedrawSelection) {
      onRedrawSelection()
    }
    if (showButtonGroup.value) {
      updateButtonGroupPosition()
    }
  }

  // resize结束
  const handleResizeEnd = () => {
    isResizing.value = false
    resizeDirection.value = ''

    // 移除全局鼠标事件监听
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)

    // 调整结束后再定位按钮组
    nextTick(() => {
      if (showButtonGroup.value) {
        updateButtonGroupPosition()
      }
    })
  }

  // 圆角变化处理
  const handleBorderRadiusChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    borderRadius.value = parseInt(target.value, 10)

    // 更新选区样式，包括边框显示
    updateSelectionAreaPosition()
  }

  return {
    selectionAreaStyle,
    isDragging,
    dragOffset,
    isResizing,
    resizeDirection,
    resizeStartPosition,
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
  }
}
