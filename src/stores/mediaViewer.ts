/**
 * 统一的媒体查看器 Store
 * 合并了 imageViewer 和 videoViewer 的功能
 */
import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'

// 媒体类型
export type MediaType = 'image' | 'video'

// 媒体项目
export interface MediaItem {
  id: string
  url: string
  type: MediaType
  name?: string
  size?: number
  thumbnail?: string
  poster?: string
  duration?: number // 视频时长（毫秒）
  width?: number
  height?: number
  currentIndex?: number
  list?: MediaItem[]
}

// 查看器状态
export interface ViewerState {
  visible: boolean
  currentItem: MediaItem | null
  currentIndex: number
  list: MediaItem[]
  loading: boolean
  error: string | null
  scale: number
  rotation: number
  // 视频相关
  isPlaying: boolean
  currentTime: number
  volume: number
  playbackRate: number
  isFullscreen: boolean
  // 控制栏可见性
  controlsVisible: boolean
  controlsAutoHideTimer?: number
}

export const useMediaViewerStore = defineStore('mediaViewer', () => {
  const state = ref<ViewerState>({
    visible: false,
    currentItem: null,
    currentIndex: 0,
    list: [],
    loading: false,
    error: null,
    scale: 1,
    rotation: 0,
    isPlaying: false,
    currentTime: 0,
    volume: 1,
    playbackRate: 1,
    isFullscreen: false,
    controlsVisible: true
  })

  // 显示查看器
  const showViewer = (item: MediaItem, list?: MediaItem[]) => {
    state.value.visible = true
    state.value.currentItem = item

    if (list && list.length > 0) {
      state.value.list = list
      state.value.currentIndex = list.findIndex((i) => i.id === item.id)
    } else {
      state.value.list = [item]
      state.value.currentIndex = 0
    }

    // 重置状态
    resetViewerState()
  }

  // 显示图片列表
  const showImageViewer = (items: MediaItem[], startIndex = 0) => {
    const imageItems = items.filter((item) => item.type === 'image')
    if (imageItems.length === 0) return

    state.value.visible = true
    state.value.currentItem = imageItems[startIndex] ?? null
    state.value.list = imageItems
    state.value.currentIndex = startIndex

    resetViewerState()
  }

  // 显示视频
  const showVideoViewer = (item: MediaItem) => {
    if (item.type !== 'video') return

    state.value.visible = true
    state.value.currentItem = item
    state.value.list = [item]
    state.value.currentIndex = 0

    resetViewerState()
    state.value.isPlaying = true
  }

  // 关闭查看器
  const closeViewer = () => {
    state.value.visible = false

    // 清理定时器
    if (state.value.controlsAutoHideTimer) {
      clearTimeout(state.value.controlsAutoHideTimer)
      delete state.value.controlsAutoHideTimer
    }

    // 延迟重置状态，避免关闭动画时的闪烁
    setTimeout(() => {
      if (!state.value.visible) {
        resetViewerState()
      }
    }, 300)
  }

  // 重置查看器状态
  const resetViewerState = () => {
    state.value.loading = false
    state.value.error = null
    state.value.scale = 1
    state.value.rotation = 0
    state.value.isPlaying = false
    state.value.currentTime = 0
    state.value.volume = 1
    state.value.playbackRate = 1
    state.value.isFullscreen = false
    state.value.controlsVisible = true
  }

  // 导航到上一个/下一个
  const navigatePrev = () => {
    if (state.value.currentIndex > 0) {
      state.value.currentIndex--
      state.value.currentItem = state.value.list[state.value.currentIndex] ?? null
      resetViewerState()
    }
  }

  const navigateNext = () => {
    if (state.value.currentIndex < state.value.list.length - 1) {
      state.value.currentIndex++
      state.value.currentItem = state.value.list[state.value.currentIndex] ?? null
      resetViewerState()
    }
  }

  // 兼容旧调用方法
  const viewMedia = (item: MediaItem, list?: MediaItem[]) => {
    showViewer(item, list)
  }
  const prevMedia = () => navigatePrev()
  const nextMedia = () => navigateNext()
  const hideViewer = () => closeViewer()

  // 跳转到指定索引
  const navigateToIndex = (index: number) => {
    if (index >= 0 && index < state.value.list.length) {
      state.value.currentIndex = index
      state.value.currentItem = state.value.list[index] ?? null
      resetViewerState()
    }
  }

  // 缩放控制
  const zoomIn = () => {
    state.value.scale = Math.min(state.value.scale * 1.2, 5)
  }

  const zoomOut = () => {
    state.value.scale = Math.max(state.value.scale * 0.8, 0.1)
  }

  const resetZoom = () => {
    state.value.scale = 1
  }

  const fitToWindow = () => {
    // 计算适合窗口的缩放比例
    // 这里需要实际的窗口尺寸，暂时返回默认值
    state.value.scale = 1
  }

  // 旋转控制
  const rotateLeft = () => {
    state.value.rotation -= 90
  }

  const rotateRight = () => {
    state.value.rotation += 90
  }

  const resetRotation = () => {
    state.value.rotation = 0
  }

  // 视频控制
  const togglePlay = () => {
    if (state.value.currentItem?.type === 'video') {
      state.value.isPlaying = !state.value.isPlaying
    }
  }

  const pause = () => {
    state.value.isPlaying = false
  }

  const play = () => {
    if (state.value.currentItem?.type === 'video') {
      state.value.isPlaying = true
    }
  }

  const setCurrentTime = (time: number) => {
    state.value.currentTime = time
  }

  const setVolume = (volume: number) => {
    state.value.volume = Math.max(0, Math.min(1, volume))
  }

  const setPlaybackRate = (rate: number) => {
    state.value.playbackRate = Math.max(0.25, Math.min(2, rate))
  }

  const toggleFullscreen = () => {
    state.value.isFullscreen = !state.value.isFullscreen
  }

  // 控制栏自动隐藏
  const showControls = () => {
    state.value.controlsVisible = true

    // 清除现有定时器
    if (state.value.controlsAutoHideTimer) {
      clearTimeout(state.value.controlsAutoHideTimer)
    }

    // 视频播放时设置自动隐藏定时器
    if (state.value.currentItem?.type === 'video' && state.value.isPlaying) {
      state.value.controlsAutoHideTimer = setTimeout(() => {
        if (state.value.isPlaying && state.value.isFullscreen) {
          state.value.controlsVisible = false
        }
      }, 3000) as unknown as number
    }
  }

  const hideControls = () => {
    state.value.controlsVisible = false
    if (state.value.controlsAutoHideTimer) {
      clearTimeout(state.value.controlsAutoHideTimer)
      delete state.value.controlsAutoHideTimer
    }
  }

  // 键盘事件处理
  const handleKeydown = (event: KeyboardEvent) => {
    if (!state.value.visible) return

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        navigatePrev()
        break
      case 'ArrowRight':
        event.preventDefault()
        navigateNext()
        break
      case 'Escape':
        event.preventDefault()
        closeViewer()
        break
      case ' ':
        if (state.value.currentItem?.type === 'video') {
          event.preventDefault()
          togglePlay()
        }
        break
      case '+':
      case '=':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          zoomIn()
        }
        break
      case '-':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          zoomOut()
        }
        break
      case '0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          resetZoom()
        }
        break
    }
  }

  // 滚轮缩放
  const handleWheel = (event: WheelEvent, delta: number) => {
    if (!state.value.visible) return

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      if (delta < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    }
  }

  return {
    // 状态
    state: readonly(state),

    // 基础控制
    showViewer,
    showImageViewer,
    showVideoViewer,
    closeViewer,
    viewMedia,
    prevMedia,
    nextMedia,
    hideViewer,

    // 导航
    navigatePrev,
    navigateNext,
    navigateToIndex,

    // 图片控制
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWindow,
    rotateLeft,
    rotateRight,
    resetRotation,

    // 视频控制
    togglePlay,
    pause,
    play,
    setCurrentTime,
    setVolume,
    setPlaybackRate,
    toggleFullscreen,

    // UI 控制
    showControls,
    hideControls,
    handleKeydown,
    handleWheel
  }
})
