/**
 * Screenshot Selection Composable
 * Handles selection area drag and resize functionality
 */

import { ref, type Ref, nextTick } from 'vue'

export interface SelectionConfig {
  scaleX: number
  scaleY: number
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface SelectionState {
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  dragOffset: Ref<{ x: number; y: number }>
  resizeDirection: Ref<string>
  resizeStartPosition: Ref<{
    x: number
    y: number
    width: number
    height: number
    left: number
    top: number
  }>
  handleDragStart: (event: MouseEvent, selectionStyle: Ref<Record<string, string>>) => void
  handleDragMove: (event: MouseEvent) => void
  handleDragEnd: () => void
  handleResizeStart: (event: MouseEvent, direction: string, selectionStyle: Ref<Record<string, string>>) => void
  handleResizeMove: (event: MouseEvent) => void
  handleResizeEnd: () => void
  getSelectionBounds: () => { minX: number; minY: number; maxX: number; maxY: number }
  constrainToScreen: (left: number, top: number, width: number, height: number) => { left: number; top: number }
}

export interface SelectionCallbacks {
  onRedrawSelection: () => void
  onUpdatePosition: () => void
}

export function useSelection(selectionConfig: Ref<SelectionConfig>, callbacks: SelectionCallbacks): SelectionState {
  const isDragging = ref(false)
  const isResizing = ref(false)
  const dragOffset = ref({ x: 0, y: 0 })
  const resizeDirection = ref('')
  const resizeStartPosition = ref({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0
  })

  // Local state for event handlers
  let currentSelectionStyle: Ref<Record<string, string>> | null = null

  /**
   * Update screen config based on selection area
   */
  const updateScreenConfig = (left: number, top: number, width: number, height: number) => {
    const { scaleX, scaleY } = selectionConfig.value
    selectionConfig.value.startX = left * scaleX
    selectionConfig.value.startY = top * scaleY
    selectionConfig.value.endX = (left + width) * scaleX
    selectionConfig.value.endY = (top + height) * scaleY
  }

  /**
   * Get selection bounds
   */
  const getSelectionBounds = () => {
    const { scaleX, scaleY, startX, startY, endX, endY } = selectionConfig.value
    return {
      minX: Math.min(startX, endX) / scaleX,
      minY: Math.min(startY, endY) / scaleY,
      maxX: Math.max(startX, endX) / scaleX,
      maxY: Math.max(startY, endY) / scaleY
    }
  }

  /**
   * Constrain position to screen bounds
   */
  const constrainToScreen = (left: number, top: number, width: number, height: number) => {
    const maxLeft = window.innerWidth - width
    const maxTop = window.innerHeight - height
    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top: Math.max(0, Math.min(top, maxTop))
    }
  }

  /**
   * Handle drag move (bound to document event)
   */
  const handleDragMove = (event: MouseEvent) => {
    if (!isDragging.value || !currentSelectionStyle) return

    event.preventDefault()

    const newLeft = event.clientX - dragOffset.value.x
    const newTop = event.clientY - dragOffset.value.y

    const width = parseFloat(currentSelectionStyle.value.width || '0')
    const height = parseFloat(currentSelectionStyle.value.height || '0')

    const constrained = constrainToScreen(newLeft, newTop, width, height)

    currentSelectionStyle.value.left = `${constrained.left}px`
    currentSelectionStyle.value.top = `${constrained.top}px`

    updateScreenConfig(constrained.left, constrained.top, width, height)
    callbacks.onRedrawSelection()
  }

  /**
   * Handle drag end
   */
  const handleDragEnd = () => {
    isDragging.value = false
    currentSelectionStyle = null
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)

    nextTick(() => {
      callbacks.onUpdatePosition()
    })
  }

  /**
   * Handle drag start
   */
  const handleDragStart = (event: MouseEvent, selectionStyle: Ref<Record<string, string>>) => {
    event.preventDefault()
    event.stopPropagation()

    currentSelectionStyle = selectionStyle
    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - parseFloat(selectionStyle.value.left || '0'),
      y: event.clientY - parseFloat(selectionStyle.value.top || '0')
    }

    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }

  /**
   * Handle resize move (bound to document event)
   */
  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing.value || !currentSelectionStyle) return

    event.preventDefault()

    const deltaX = event.clientX - resizeStartPosition.value.x
    const deltaY = event.clientY - resizeStartPosition.value.y

    let newLeft = resizeStartPosition.value.left
    let newTop = resizeStartPosition.value.top
    let newWidth = resizeStartPosition.value.width
    let newHeight = resizeStartPosition.value.height

    // Adjust based on direction
    switch (resizeDirection.value) {
      case 'nw':
        newLeft += deltaX
        newTop += deltaY
        newWidth -= deltaX
        newHeight -= deltaY
        break
      case 'ne':
        newTop += deltaY
        newWidth += deltaX
        newHeight -= deltaY
        break
      case 'sw':
        newLeft += deltaX
        newWidth -= deltaX
        newHeight += deltaY
        break
      case 'se':
        newWidth += deltaX
        newHeight += deltaY
        break
      case 'n':
        newTop += deltaY
        newHeight -= deltaY
        break
      case 'e':
        newWidth += deltaX
        break
      case 's':
        newHeight += deltaY
        break
      case 'w':
        newLeft += deltaX
        newWidth -= deltaX
        break
    }

    // Ensure minimum size
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

    // Constrain to screen
    const constrained = constrainToScreen(newLeft, newTop, newWidth, newHeight)

    currentSelectionStyle.value = {
      left: `${constrained.left}px`,
      top: `${constrained.top}px`,
      width: `${newWidth}px`,
      height: `${newHeight}px`
    }

    updateScreenConfig(constrained.left, constrained.top, newWidth, newHeight)
    callbacks.onRedrawSelection()

    if (currentSelectionStyle.value.width) {
      callbacks.onUpdatePosition()
    }
  }

  /**
   * Handle resize end
   */
  const handleResizeEnd = () => {
    isResizing.value = false
    resizeDirection.value = ''
    currentSelectionStyle = null

    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)

    nextTick(() => {
      callbacks.onUpdatePosition()
    })
  }

  /**
   * Handle resize start
   */
  const handleResizeStart = (event: MouseEvent, direction: string, selectionStyle: Ref<Record<string, string>>) => {
    event.preventDefault()
    event.stopPropagation()

    currentSelectionStyle = selectionStyle
    isResizing.value = true
    resizeDirection.value = direction

    resizeStartPosition.value = {
      x: event.clientX,
      y: event.clientY,
      width: parseFloat(selectionStyle.value.width || '0'),
      height: parseFloat(selectionStyle.value.height || '0'),
      left: parseFloat(selectionStyle.value.left || '0'),
      top: parseFloat(selectionStyle.value.top || '0')
    }

    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  return {
    isDragging,
    isResizing,
    dragOffset,
    resizeDirection,
    resizeStartPosition,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    getSelectionBounds,
    constrainToScreen
  }
}
