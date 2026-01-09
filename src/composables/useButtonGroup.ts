/**
 * Screenshot Button Group Composable
 * Handles button group positioning logic
 */

import { ref, nextTick } from 'vue'

export interface ButtonGroupConfig {
  screenConfig: {
    scaleX: number
    scaleY: number
    startX: number
    startY: number
    endX: number
    endY: number
  }
}

export interface ButtonGroupPosition {
  left: number
  top: number
  width: number
}

export function useButtonGroup(config: ButtonGroupConfig) {
  const buttonGroup = ref<HTMLDivElement | null>(null)
  const position = ref<ButtonGroupPosition>({ left: 0, top: 0, width: 0 })

  /**
   * Update button group position based on selection area
   */
  const updatePosition = (isDragging: boolean, isResizing: boolean) => {
    if (!buttonGroup.value) return

    // Skip positioning during interactions
    if (isDragging || isResizing) {
      return
    }

    const { scaleX, scaleY, startX, startY, endX, endY } = config.screenConfig

    // Selection bounds
    const minY = Math.min(startY, endY) / scaleY
    const maxX = Math.max(startX, endX) / scaleX
    const maxY = Math.max(startY, endY) / scaleY

    // Available screen dimensions
    const availableHeight = window.innerHeight
    const availableWidth = window.innerWidth

    // Measure button group
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

    // Determine if it fits below selection
    const spaceBelow = availableHeight - maxY
    const canFitBelow = spaceBelow >= measuredHeight + 10

    let leftPosition: number
    let topPosition: number

    if (canFitBelow) {
      // Place below selection
      topPosition = maxY + 4
      leftPosition = maxX - finalWidth
      leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
    } else {
      // Place above selection
      topPosition = minY - (measuredHeight + 4)
      if (topPosition < 0) topPosition = 10

      leftPosition = maxX - finalWidth
      leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
    }

    position.value = { left: leftPosition, top: topPosition, width: finalWidth }

    // Apply styles
    el.style.top = `${topPosition}px`
    el.style.left = `${leftPosition}px`
    el.style.width = `${finalWidth}px`
    el.style.boxSizing = 'border-box'
  }

  /**
   * Apply current position to element
   */
  const applyPosition = () => {
    if (!buttonGroup.value) return

    const { left, top, width } = position.value
    buttonGroup.value.style.top = `${top}px`
    buttonGroup.value.style.left = `${left}px`
    buttonGroup.value.style.width = `${width}px`
  }

  /**
   * Update position in next tick
   */
  const updatePositionAsync = (isDragging: boolean, isResizing: boolean) => {
    nextTick(() => {
      updatePosition(isDragging, isResizing)
    })
  }

  /**
   * Get button group element
   */
  const getElement = () => buttonGroup.value

  return {
    buttonGroup,
    position,
    updatePosition,
    applyPosition,
    updatePositionAsync,
    getElement
  }
}
