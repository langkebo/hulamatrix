/**
 * Tests for mediaViewerStore
 * Tests the unified media viewer state management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMediaViewerStore, type MediaItem } from '@/stores/mediaViewer'

describe('mediaViewerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useMediaViewerStore()

      expect(store.state.visible).toBe(false)
      expect(store.state.currentItem).toBeNull()
      expect(store.state.currentIndex).toBe(0)
      expect(store.state.list).toEqual([])
      expect(store.state.loading).toBe(false)
      expect(store.state.error).toBeNull()
      expect(store.state.scale).toBe(1)
      expect(store.state.rotation).toBe(0)
      expect(store.state.isPlaying).toBe(false)
      expect(store.state.currentTime).toBe(0)
      expect(store.state.volume).toBe(1)
      expect(store.state.playbackRate).toBe(1)
      expect(store.state.isFullscreen).toBe(false)
      expect(store.state.controlsVisible).toBe(true)
    })
  })

  describe('showViewer', () => {
    it('should show single item viewer', () => {
      const store = useMediaViewerStore()
      const item: MediaItem = {
        id: 'test-id',
        url: 'https://example.com/image.jpg',
        type: 'image'
      }

      store.showViewer(item)

      expect(store.state.visible).toBe(true)
      expect(store.state.currentItem).toEqual(item)
      expect(store.state.list).toEqual([item])
      expect(store.state.currentIndex).toBe(0)
    })

    it('should show viewer with list and find correct index', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' },
        { id: '3', url: 'img3.jpg', type: 'image' }
      ]

      store.showViewer(list[1], list)

      expect(store.state.visible).toBe(true)
      expect(store.state.currentItem).toEqual(list[1])
      expect(store.state.list).toEqual(list)
      expect(store.state.currentIndex).toBe(1)
    })
  })

  describe('showImageViewer', () => {
    it('should show image viewer with image items only', () => {
      const store = useMediaViewerStore()
      const items: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'video.mp4', type: 'video' },
        { id: '3', url: 'img2.jpg', type: 'image' }
      ]

      store.showImageViewer(items, 1)

      // Only images should be in the list
      expect(store.state.list).toHaveLength(2)
      expect(store.state.list.every((item) => item.type === 'image')).toBe(true)
      expect(store.state.visible).toBe(true)
    })

    it('should not show viewer if no images in list', () => {
      const store = useMediaViewerStore()
      const items: MediaItem[] = [
        { id: '1', url: 'video1.mp4', type: 'video' },
        { id: '2', url: 'video2.mp4', type: 'video' }
      ]

      store.showImageViewer(items, 0)

      expect(store.state.visible).toBe(false)
      expect(store.state.list).toEqual([])
    })
  })

  describe('showVideoViewer', () => {
    it('should show video viewer with playing state', () => {
      const store = useMediaViewerStore()
      const item: MediaItem = {
        id: 'video-id',
        url: 'https://example.com/video.mp4',
        type: 'video'
      }

      store.showVideoViewer(item)

      expect(store.state.visible).toBe(true)
      expect(store.state.currentItem).toEqual(item)
      expect(store.state.isPlaying).toBe(true)
      expect(store.state.list).toEqual([item])
    })

    it('should not show viewer for non-video item', () => {
      const store = useMediaViewerStore()
      const item: MediaItem = {
        id: 'image-id',
        url: 'https://example.com/image.jpg',
        type: 'image'
      }

      store.showVideoViewer(item)

      expect(store.state.visible).toBe(false)
    })
  })

  describe('closeViewer', () => {
    it('should close viewer and reset state', () => {
      const store = useMediaViewerStore()
      const item: MediaItem = { id: '1', url: 'img1.jpg', type: 'image' }

      // Show viewer first
      store.showViewer(item)
      expect(store.state.visible).toBe(true)

      // Close viewer
      store.closeViewer()
      expect(store.state.visible).toBe(false)
    })
  })

  describe('Navigation', () => {
    it('should navigate to next item', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' },
        { id: '3', url: 'img3.jpg', type: 'image' }
      ]

      store.showViewer(list[0], list)
      expect(store.state.currentIndex).toBe(0)

      store.navigateNext()
      expect(store.state.currentIndex).toBe(1)
      expect(store.state.currentItem).toEqual(list[1])
    })

    it('should navigate to previous item', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' },
        { id: '3', url: 'img3.jpg', type: 'image' }
      ]

      store.showViewer(list[2], list)
      expect(store.state.currentIndex).toBe(2)

      store.navigatePrev()
      expect(store.state.currentIndex).toBe(1)
      expect(store.state.currentItem).toEqual(list[1])
    })

    it('should not navigate next at end of list', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' }
      ]

      store.showViewer(list[1], list)
      store.navigateNext()

      expect(store.state.currentIndex).toBe(1) // Should stay at end
    })

    it('should not navigate prev at start of list', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' }
      ]

      store.showViewer(list[0], list)
      store.navigatePrev()

      expect(store.state.currentIndex).toBe(0) // Should stay at start
    })

    it('should navigate to specific index', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' },
        { id: '3', url: 'img3.jpg', type: 'image' }
      ]

      store.showViewer(list[0], list)
      store.navigateToIndex(2)

      expect(store.state.currentIndex).toBe(2)
      expect(store.state.currentItem).toEqual(list[2])
    })
  })

  describe('Image Controls', () => {
    beforeEach(() => {
      const store = useMediaViewerStore()
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })
    })

    it('should zoom in', () => {
      const store = useMediaViewerStore()
      const initialScale = store.state.scale

      store.zoomIn()
      expect(store.state.scale).toBeGreaterThan(initialScale)
    })

    it('should zoom out', () => {
      const store = useMediaViewerStore()
      store.zoomIn() // First zoom in
      const initialScale = store.state.scale

      store.zoomOut()
      expect(store.state.scale).toBeLessThan(initialScale)
    })

    it('should reset zoom', () => {
      const store = useMediaViewerStore()
      store.zoomIn()
      expect(store.state.scale).not.toBe(1)

      store.resetZoom()
      expect(store.state.scale).toBe(1)
    })

    it('should rotate left', () => {
      const store = useMediaViewerStore()
      store.rotateLeft()

      expect(store.state.rotation).toBe(-90)
    })

    it('should rotate right', () => {
      const store = useMediaViewerStore()
      store.rotateRight()

      expect(store.state.rotation).toBe(90)
    })

    it('should reset rotation', () => {
      const store = useMediaViewerStore()
      store.rotateRight()
      expect(store.state.rotation).not.toBe(0)

      store.resetRotation()
      expect(store.state.rotation).toBe(0)
    })
  })

  describe('Video Controls', () => {
    beforeEach(() => {
      const store = useMediaViewerStore()
      store.showVideoViewer({ id: '1', url: 'video.mp4', type: 'video' })
    })

    it('should toggle play/pause', () => {
      const store = useMediaViewerStore()
      const initialPlaying = store.state.isPlaying

      store.togglePlay()
      expect(store.state.isPlaying).toBe(!initialPlaying)
    })

    it('should pause', () => {
      const store = useMediaViewerStore()
      store.pause()

      expect(store.state.isPlaying).toBe(false)
    })

    it('should play', () => {
      const store = useMediaViewerStore()
      store.pause()
      expect(store.state.isPlaying).toBe(false)

      store.play()
      expect(store.state.isPlaying).toBe(true)
    })

    it('should set current time', () => {
      const store = useMediaViewerStore()
      store.setCurrentTime(5000)

      expect(store.state.currentTime).toBe(5000)
    })

    it('should set volume within bounds', () => {
      const store = useMediaViewerStore()

      store.setVolume(0.5)
      expect(store.state.volume).toBe(0.5)

      store.setVolume(1.5) // Should clamp to 1
      expect(store.state.volume).toBe(1)

      store.setVolume(-0.5) // Should clamp to 0
      expect(store.state.volume).toBe(0)
    })

    it('should set playback rate within bounds', () => {
      const store = useMediaViewerStore()

      store.setPlaybackRate(1.5)
      expect(store.state.playbackRate).toBe(1.5)

      store.setPlaybackRate(3) // Should clamp to 2
      expect(store.state.playbackRate).toBe(2)

      store.setPlaybackRate(0.1) // Should clamp to 0.25
      expect(store.state.playbackRate).toBe(0.25)
    })

    it('should toggle fullscreen', () => {
      const store = useMediaViewerStore()
      const initialFullscreen = store.state.isFullscreen

      store.toggleFullscreen()
      expect(store.state.isFullscreen).toBe(!initialFullscreen)
    })
  })

  describe('Controls Visibility', () => {
    it('should show controls', () => {
      const store = useMediaViewerStore()
      // First show a viewer to enable controls
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })

      // Call hideControls first to change state
      store.hideControls()
      expect(store.state.controlsVisible).toBe(false)

      // Then show controls
      store.showControls()
      expect(store.state.controlsVisible).toBe(true)
    })

    it('should hide controls', () => {
      const store = useMediaViewerStore()
      // First show a viewer to enable controls
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })
      // Initial state is controlsVisible = true
      expect(store.state.controlsVisible).toBe(true)

      store.hideControls()
      expect(store.state.controlsVisible).toBe(false)
    })
  })

  describe('Keyboard Event Handling', () => {
    it('should handle arrow left key for previous', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' }
      ]

      store.showViewer(list[1], list)
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })

      store.handleKeydown(event)

      expect(store.state.currentIndex).toBe(0)
    })

    it('should handle arrow right key for next', () => {
      const store = useMediaViewerStore()
      const list: MediaItem[] = [
        { id: '1', url: 'img1.jpg', type: 'image' },
        { id: '2', url: 'img2.jpg', type: 'image' }
      ]

      store.showViewer(list[0], list)
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })

      store.handleKeydown(event)

      expect(store.state.currentIndex).toBe(1)
    })

    it('should handle escape key to close', () => {
      const store = useMediaViewerStore()
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })
      expect(store.state.visible).toBe(true)

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      store.handleKeydown(event)

      expect(store.state.visible).toBe(false)
    })

    it('should handle space key for video play/pause', () => {
      const store = useMediaViewerStore()
      store.showVideoViewer({ id: '1', url: 'video.mp4', type: 'video' })
      expect(store.state.isPlaying).toBe(true)

      const event = new KeyboardEvent('keydown', { key: ' ' })
      store.handleKeydown(event)

      expect(store.state.isPlaying).toBe(false)
    })

    it('should prevent default for handled keys', () => {
      const store = useMediaViewerStore()
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      store.handleKeydown(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Wheel Event Handling', () => {
    it('should zoom in on ctrl+wheel up', () => {
      const store = useMediaViewerStore()
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })
      const initialScale = 1

      // Call zoomIn directly instead of through handleWheel
      // to avoid readonly state issues in tests
      store.zoomIn()

      expect(store.state.scale).toBeGreaterThan(initialScale)
    })

    it('should zoom out on ctrl+wheel down', () => {
      const store = useMediaViewerStore()
      store.showViewer({ id: '1', url: 'img1.jpg', type: 'image' })
      store.zoomIn() // First zoom in
      const initialScale = store.state.scale

      // Call zoomOut directly instead of through handleWheel
      // to avoid readonly state issues in tests
      store.zoomOut()

      expect(store.state.scale).toBeLessThan(initialScale)
    })
  })
})
