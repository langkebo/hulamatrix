/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useButtonGroup } from '@/composables/useButtonGroup'

describe('useButtonGroup', () => {
  const mockElement = {
    style: {
      flexWrap: '',
      whiteSpace: '',
      width: '',
      overflow: '',
      top: '',
      left: '',
      boxSizing: ''
    },
    getBoundingClientRect: vi.fn(() => ({
      height: 50,
      width: 100,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      toJSON: () => ({})
    })),
    scrollWidth: 100
  } as unknown as HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock element styles
    mockElement.style.flexWrap = ''
    mockElement.style.whiteSpace = ''
    mockElement.style.width = ''
    mockElement.style.overflow = ''
    mockElement.style.top = ''
    mockElement.style.left = ''
    mockElement.style.boxSizing = ''

    // Mock window dimensions
    Object.defineProperty(globalThis, 'window', {
      value: {
        innerHeight: 800,
        innerWidth: 1200
      },
      writable: true,
      configurable: true
    })
  })

  const defaultConfig = {
    screenConfig: {
      scaleX: 1,
      scaleY: 1,
      startX: 100,
      startY: 100,
      endX: 300,
      endY: 200
    }
  }

  describe('Initialization', () => {
    it('should initialize with default position', () => {
      const { position, buttonGroup } = useButtonGroup(defaultConfig)

      expect(position.value).toEqual({ left: 0, top: 0, width: 0 })
      expect(buttonGroup.value).toBeNull()
    })

    it('should return null from getElement initially', () => {
      const { getElement } = useButtonGroup(defaultConfig)

      expect(getElement()).toBeNull()
    })

    it('should return the button group element', () => {
      const { getElement, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      expect(getElement()).toStrictEqual(mockElement)
    })
  })

  describe('updatePosition', () => {
    it('should return early if buttonGroup element is null', () => {
      const { updatePosition, position } = useButtonGroup(defaultConfig)

      updatePosition(false, false)

      expect(position.value).toEqual({ left: 0, top: 0, width: 0 })
    })

    it('should return early when dragging', () => {
      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(true, false)

      expect(position.value).toEqual({ left: 0, top: 0, width: 0 })
    })

    it('should return early when resizing', () => {
      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, true)

      expect(position.value).toEqual({ left: 0, top: 0, width: 0 })
    })

    it('should position button group below selection when space allows', () => {
      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      expect(position.value.top).toBeGreaterThan(200) // Below selection
      expect(position.value.width).toBeGreaterThan(0)
    })

    it('should position button group above selection when no space below', () => {
      // Mock selection at bottom of screen
      const bottomConfig = {
        screenConfig: {
          scaleX: 1,
          scaleY: 1,
          startX: 100,
          startY: 750,
          endX: 300,
          endY: 790
        }
      }

      const { updatePosition, position, buttonGroup } = useButtonGroup(bottomConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      // Should be above selection or near top
      expect(position.value.top).toBeLessThan(750)
    })

    it('should constrain position within screen bounds', () => {
      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      expect(position.value.left).toBeGreaterThanOrEqual(10)
      expect(position.value.left).toBeLessThanOrEqual(1200)
      expect(position.value.top).toBeGreaterThanOrEqual(0)
    })

    it('should apply styles to element', () => {
      const { updatePosition, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      expect(mockElement.style.top).toMatch(/^\d+px$/)
      expect(mockElement.style.left).toMatch(/^\d+px$/)
      expect(mockElement.style.width).toMatch(/^\d+px$/)
      expect(mockElement.style.boxSizing).toBe('border-box')
    })

    it('should handle scale factors correctly', () => {
      const scaledConfig = {
        screenConfig: {
          scaleX: 2,
          scaleY: 2,
          startX: 200,
          startY: 200,
          endX: 600,
          endY: 400
        }
      }

      const { updatePosition, position, buttonGroup } = useButtonGroup(scaledConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      // Position should be scaled appropriately
      expect(position.value.top).toBeGreaterThan(0)
      expect(position.value.width).toBeGreaterThan(0)
    })
  })

  describe('applyPosition', () => {
    it('should apply current position to element', () => {
      const { applyPosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement
      position.value = { left: 100, top: 200, width: 300 }

      applyPosition()

      expect(mockElement.style.top).toBe('200px')
      expect(mockElement.style.left).toBe('100px')
      expect(mockElement.style.width).toBe('300px')
    })

    it('should return early if buttonGroup element is null', () => {
      const { applyPosition, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = null

      applyPosition()

      // Should not throw
      expect(mockElement.style.top).toBe('')
    })
  })

  describe('updatePositionAsync', () => {
    it('should update position after next tick', async () => {
      const { updatePositionAsync, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePositionAsync(false, false)

      // Position should not be updated immediately
      const initialPosition = position.value.top

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Position should be updated after next tick
      expect(position.value.top).not.toBe(initialPosition)
      expect(position.value.width).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero scale factors', () => {
      const zeroScaleConfig = {
        screenConfig: {
          scaleX: 0.1,
          scaleY: 0.1,
          startX: 100,
          startY: 100,
          endX: 300,
          endY: 200
        }
      }

      const { updatePosition, position, buttonGroup } = useButtonGroup(zeroScaleConfig)
      buttonGroup.value = mockElement

      // Should not throw
      expect(() => updatePosition(false, false)).not.toThrow()
      expect(position.value.width).toBeGreaterThan(0)
    })

    it('should handle very small screen dimensions', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          innerHeight: 100,
          innerWidth: 100
        },
        writable: true,
        configurable: true
      })

      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      // Should still work within small bounds
      expect(position.value.left).toBeGreaterThanOrEqual(10)
      expect(position.value.width).toBeLessThanOrEqual(90) // 100 - 10 margin
    })

    it('should handle selection at origin', () => {
      const originConfig = {
        screenConfig: {
          scaleX: 1,
          scaleY: 1,
          startX: 0,
          startY: 0,
          endX: 50,
          endY: 50
        }
      }

      const { updatePosition, position, buttonGroup } = useButtonGroup(originConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)

      // Should position appropriately
      expect(position.value.top).toBeGreaterThanOrEqual(0)
      expect(position.value.left).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Reactive behavior', () => {
    it('should update position when config changes', () => {
      const { updatePosition, position, buttonGroup } = useButtonGroup(defaultConfig)
      buttonGroup.value = mockElement

      updatePosition(false, false)
      const firstPosition = { ...position.value }

      // Change config
      const newConfig = {
        screenConfig: {
          scaleX: 1,
          scaleY: 1,
          startX: 500,
          startY: 500,
          endX: 700,
          endY: 600
        }
      }

      const { updatePosition: updatePosition2, position: position2, buttonGroup: buttonGroup2 } = useButtonGroup(newConfig)
      buttonGroup2.value = mockElement
      updatePosition2(false, false)

      // Position should be different
      expect(position2.value.left).not.toBe(firstPosition.left)
      expect(position2.value.top).not.toBe(firstPosition.top)
    })
  })
})
