/**
 * Screenshot Selection Management Composable
 *
 * Handles selection area dragging, resizing, and positioning
 */

import { ref, type Ref } from 'vue'

export interface SelectionAreaStyle {
  left: string | number
  top: string | number
  width: string | number
  height: string | number
}

export interface SelectionPosition {
  x: number
  y: number
  width: number
  height: number
  left: number
  top: number
}

export interface UseScreenshotSelectionState {
  showButtonGroup: boolean
  isDragging: boolean
  isResizing: boolean
  selectionAreaStyle: SelectionAreaStyle
}

export interface UseScreenshotSelectionActions {
  updateSelectionAreaPosition: () => void
  handleSelectionDragStart: (event: MouseEvent) => void
  handleSelectionDragMove: (event: MouseEvent) => void
  handleSelectionDragEnd: () => void
  handleResizeStart: (event: MouseEvent, direction: string) => void
  handleResizeMove: (event: MouseEvent) => void
  handleResizeEnd: () => void
  confirmSelection: () => void
  cancelSelection: () => void
}

export interface UseScreenshotSelectionOptions {
  selectionArea: Ref<HTMLDivElement | null>
  screenConfig: Ref<{
    scaleX: number
    scaleY: number
    startX: number
    startY: number
    endX: number
    endY: number
  }>
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * Screenshot selection management composable
 */
export function useScreenshotSelection(options: UseScreenshotSelectionOptions) {
  const { selectionArea, screenConfig, onConfirm, onCancel } = options

  // State
  const showButtonGroup = ref(false)
  const isDragging = ref(false)
  const isResizing = ref(false)
  const dragOffset = ref({ x: 0, y: 0 })
  const resizeDirection = ref('')
  const resizeStartPosition = ref<SelectionPosition>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0
  })
  const selectionAreaStyle = ref<SelectionAreaStyle>({
    left: 0,
    top: 0,
    width: 0,
    height: 0
  })

  /**
   * Update selection area position based on screen config
   */
  const updateSelectionAreaPosition = (): void => {
    const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

    const minX = Math.min(startX, endX) / scaleX
    const minY = Math.min(startY, endY) / scaleY
    const maxX = Math.max(startX, endX) / scaleX
    const maxY = Math.max(startY, endY) / scaleY

    const width = maxX - minX
    const height = maxY - minY

    selectionAreaStyle.value = {
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${width}px`,
      height: `${height}px`
    }

    showButtonGroup.value = width > 10 && height > 10
  }

  /**
   * Handle selection drag start
   */
  const handleSelectionDragStart = (event: MouseEvent): void => {
    if (!selectionArea.value) return

    isDragging.value = true
    const rect = selectionArea.value.getBoundingClientRect()
    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  /**
   * Handle selection drag move
   */
  const handleSelectionDragMove = (event: MouseEvent): void => {
    if (!isDragging.value) return

    const newLeft = event.clientX - dragOffset.value.x
    const newTop = event.clientY - dragOffset.value.y

    const selectionWidth = parseFloat(selectionAreaStyle.value.width as string)
    const selectionHeight = parseFloat(selectionAreaStyle.value.height as string)

    const maxLeft = window.innerWidth - selectionWidth
    const maxTop = window.innerHeight - selectionHeight

    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft))
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop))

    selectionAreaStyle.value.left = `${constrainedLeft}px`
    selectionAreaStyle.value.top = `${constrainedTop}px`

    // Update screen config
    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = constrainedLeft * scaleX
    screenConfig.value.startY = constrainedTop * scaleY
    screenConfig.value.endX = (constrainedLeft + selectionWidth) * scaleX
    screenConfig.value.endY = (constrainedTop + selectionHeight) * scaleY
  }

  /**
   * Handle selection drag end
   */
  const handleSelectionDragEnd = (): void => {
    isDragging.value = false
  }

  /**
   * Handle resize start
   */
  const handleResizeStart = (event: MouseEvent, direction: string): void => {
    isResizing.value = true
    resizeDirection.value = direction

    const rect = selectionArea.value?.getBoundingClientRect()
    if (!rect) return

    resizeStartPosition.value = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    }
  }

  /**
   * Handle resize move
   */
  const handleResizeMove = (event: MouseEvent): void => {
    if (!isResizing.value) return

    const deltaX = event.clientX - resizeStartPosition.value.x
    const deltaY = event.clientY - resizeStartPosition.value.y
    const direction = resizeDirection.value

    let newLeft = resizeStartPosition.value.left
    let newTop = resizeStartPosition.value.top
    let newWidth = resizeStartPosition.value.width
    let newHeight = resizeStartPosition.value.height

    const minSize = 20

    // Apply resize based on direction
    if (direction.includes('n')) {
      newTop = resizeStartPosition.value.top + deltaY
      newHeight = resizeStartPosition.value.height - deltaY
      if (newHeight < minSize) {
        newTop = resizeStartPosition.value.top + resizeStartPosition.value.height - minSize
        newHeight = minSize
      }
    }
    if (direction.includes('s')) {
      newHeight = resizeStartPosition.value.height + deltaY
      if (newHeight < minSize) newHeight = minSize
    }
    if (direction.includes('w')) {
      newLeft = resizeStartPosition.value.left + deltaX
      newWidth = resizeStartPosition.value.width - deltaX
      if (newWidth < minSize) {
        newLeft = resizeStartPosition.value.left + resizeStartPosition.value.width - minSize
        newWidth = minSize
      }
    }
    if (direction.includes('e')) {
      newWidth = resizeStartPosition.value.width + deltaX
      if (newWidth < minSize) newWidth = minSize
    }

    // Constrain to window bounds
    newLeft = Math.max(0, newLeft)
    newTop = Math.max(0, newTop)
    newWidth = Math.min(newWidth, window.innerWidth - newLeft)
    newHeight = Math.min(newHeight, window.innerHeight - newTop)

    // Update style
    selectionAreaStyle.value = {
      left: `${newLeft}px`,
      top: `${newTop}px`,
      width: `${newWidth}px`,
      height: `${newHeight}px`
    }

    // Update screen config
    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = newLeft * scaleX
    screenConfig.value.startY = newTop * scaleY
    screenConfig.value.endX = (newLeft + newWidth) * scaleX
    screenConfig.value.endY = (newTop + newHeight) * scaleY
  }

  /**
   * Handle resize end
   */
  const handleResizeEnd = (): void => {
    isResizing.value = false
  }

  /**
   * Confirm selection
   */
  const confirmSelection = (): void => {
    onConfirm?.()
  }

  /**
   * Cancel selection
   */
  const cancelSelection = (): void => {
    showButtonGroup.value = false
    selectionAreaStyle.value = {
      left: 0,
      top: 0,
      width: 0,
      height: 0
    }
    onCancel?.()
  }

  return {
    // State
    showButtonGroup,
    isDragging,
    isResizing,
    selectionAreaStyle,

    // Actions
    updateSelectionAreaPosition,
    handleSelectionDragStart,
    handleSelectionDragMove,
    handleSelectionDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    confirmSelection,
    cancelSelection
  }
}
