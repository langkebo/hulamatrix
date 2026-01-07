/**
 * Matrix Screen Share Service
 * Handles screen sharing for Matrix WebRTC calls
 *
 * @module services/matrixScreenShareService
 */

import { logger } from '@/utils/logger'

/**
 * 屏幕共享配置选项
 */
export interface ScreenShareOptions {
  /** 是否共享音频 */
  includeAudio?: boolean
  /** 光标样式 */
  cursor?: 'always' | 'never' | 'motion'
  /** 显示表面类型 */
  displaySurface?: 'monitor' | 'window' | 'application' | 'browser'
  /** 视频约束 */
  videoConstraints?: {
    width?: { ideal?: number; max?: number; min?: number }
    height?: { ideal?: number; max?: number; min?: number }
    frameRate?: { ideal?: number; max?: number; min?: number }
  }
}

/**
 * 屏幕共享状态
 */
export interface ScreenShareState {
  /** 是否正在共享 */
  isSharing: boolean
  /** 共享类型 */
  shareType: 'screen' | 'window' | 'application' | null
  /** 媒体流 */
  stream: MediaStream | null
  /** 视频轨道 */
  videoTrack: MediaStreamTrack | null
  /** 音频轨道 */
  audioTrack: MediaStreamTrack | null
  /** 开始时间 */
  startTime: number | null
}

/**
 * 屏幕共享事件
 */
export type ScreenShareEvent = 'share_started' | 'share_ended' | 'share_paused' | 'share_resumed' | 'share_error'

/**
 * Matrix Screen Share Service
 * 管理屏幕共享功能
 */
export class MatrixScreenShareService {
  private static instance: MatrixScreenShareService

  // 当前屏幕共享状态
  private currentShare: ScreenShareState = {
    isSharing: false,
    shareType: null,
    stream: null,
    videoTrack: null,
    audioTrack: null,
    startTime: null
  }

  // 事件监听器
  private listeners: Map<ScreenShareEvent, Array<(data: unknown) => void>> = new Map()

  // 停止标记
  private stopRequested = false

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixScreenShareService {
    if (!MatrixScreenShareService.instance) {
      MatrixScreenShareService.instance = new MatrixScreenShareService()
    }
    return MatrixScreenShareService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 初始化事件监听器映射
    const events: ScreenShareEvent[] = ['share_started', 'share_ended', 'share_paused', 'share_resumed', 'share_error']
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  /**
   * 检查浏览器是否支持屏幕共享
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function')
  }

  /**
   * 获取当前共享状态
   */
  getState(): ScreenShareState {
    return { ...this.currentShare }
  }

  /**
   * 是否正在共享
   */
  isSharing(): boolean {
    return this.currentShare.isSharing
  }

  /**
   * 开始屏幕共享
   */
  async startScreenShare(options: ScreenShareOptions = {}): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('Screen sharing is not supported in this browser')
    }

    if (this.currentShare.isSharing) {
      logger.warn('[MatrixScreenShareService] Screen share already active')
      return this.currentShare.stream!
    }

    this.stopRequested = false

    try {
      logger.info('[MatrixScreenShareService] Starting screen share', options)

      // 构建媒体约束
      const constraints: MediaStreamConstraints = {
        video: {
          cursor: options.cursor || 'always',
          displaySurface: options.displaySurface,
          frameRate: options.videoConstraints?.frameRate || { ideal: 30 },
          width: options.videoConstraints?.width || { ideal: 1920 },
          height: options.videoConstraints?.height || { ideal: 1080 }
        } as MediaTrackConstraints,
        audio: options.includeAudio || false
      }

      // 获取屏幕流
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)

      // 获取轨道
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()?.[0] || null

      if (!videoTrack) {
        throw new Error('No video track in screen share stream')
      }

      // 监听轨道结束事件
      videoTrack.onended = () => {
        if (!this.stopRequested) {
          logger.info('[MatrixScreenShareService] Screen share ended by user')
          this.stopScreenShare()
        }
      }

      // 更新状态
      this.currentShare = {
        isSharing: true,
        shareType: this.getShareType(videoTrack),
        stream,
        videoTrack,
        audioTrack,
        startTime: Date.now()
      }

      // 发送事件
      this.emit('share_started', {
        type: this.currentShare.shareType,
        stream,
        startTime: this.currentShare.startTime
      })

      logger.info('[MatrixScreenShareService] Screen share started', {
        type: this.currentShare.shareType
      })

      return stream
    } catch (error) {
      logger.error('[MatrixScreenShareService] Failed to start screen share', { error })
      this.emit('share_error', { error })
      throw error
    }
  }

  /**
   * 开始窗口共享
   */
  async startWindowShare(options: ScreenShareOptions = {}): Promise<MediaStream> {
    return this.startScreenShare({
      ...options,
      displaySurface: 'window'
    })
  }

  /**
   * 开始应用共享
   */
  async startApplicationShare(options: ScreenShareOptions = {}): Promise<MediaStream> {
    return this.startScreenShare({
      ...options,
      displaySurface: 'application'
    })
  }

  /**
   * 停止屏幕共享
   */
  async stopScreenShare(): Promise<void> {
    if (!this.currentShare.isSharing) {
      logger.warn('[MatrixScreenShareService] No active screen share to stop')
      return
    }

    this.stopRequested = true

    try {
      logger.info('[MatrixScreenShareService] Stopping screen share')

      // 停止所有轨道
      const tracks = [this.currentShare.videoTrack, this.currentShare.audioTrack].filter(Boolean) as MediaStreamTrack[]

      for (const track of tracks) {
        track.stop()
      }

      // 停止流
      if (this.currentShare.stream) {
        this.currentShare.stream.getTracks().forEach((track) => track.stop())
      }

      // 保存旧状态用于事件
      const oldState = { ...this.currentShare }

      // 重置状态
      this.currentShare = {
        isSharing: false,
        shareType: null,
        stream: null,
        videoTrack: null,
        audioTrack: null,
        startTime: null
      }

      // 发送事件
      this.emit('share_ended', {
        type: oldState.shareType,
        duration: oldState.startTime ? Date.now() - oldState.startTime : 0
      })

      logger.info('[MatrixScreenShareService] Screen share stopped')
    } catch (error) {
      logger.error('[MatrixScreenShareService] Failed to stop screen share', { error })
      this.emit('share_error', { error })
      throw error
    }
  }

  /**
   * 切换屏幕共享
   */
  async toggleScreenShare(options: ScreenShareOptions = {}): Promise<MediaStream | null> {
    if (this.currentShare.isSharing) {
      await this.stopScreenShare()
      return null
    } else {
      return this.startScreenShare(options)
    }
  }

  /**
   * 获取当前共享流
   */
  getStream(): MediaStream | null {
    return this.currentShare.stream || null
  }

  /**
   * 获取视频轨道
   */
  getVideoTrack(): MediaStreamTrack | null {
    return this.currentShare.videoTrack || null
  }

  /**
   * 获取音频轨道
   */
  getAudioTrack(): MediaStreamTrack | null {
    return this.currentShare.audioTrack || null
  }

  /**
   * 获取共享时长
   */
  getDuration(): number {
    if (!this.currentShare.startTime) return 0
    return Date.now() - this.currentShare.startTime
  }

  /**
   * 应用视频约束（用于调整质量）
   */
  async applyVideoConstraints(constraints: MediaTrackConstraints): Promise<void> {
    const track = this.currentShare.videoTrack
    if (!track) {
      throw new Error('No active screen share track')
    }

    try {
      await track.applyConstraints(constraints)
      logger.info('[MatrixScreenShareService] Video constraints applied', { constraints })
    } catch (error) {
      logger.error('[MatrixScreenShareService] Failed to apply constraints', { error })
      throw error
    }
  }

  /**
   * 设置视频质量
   */
  async setVideoQuality(quality: 'low' | 'medium' | 'high'): Promise<void> {
    const qualitySettings = {
      low: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
      medium: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      high: { width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 60 } }
    }

    await this.applyVideoConstraints(qualitySettings[quality])
  }

  /**
   * 添加事件监听器
   */
  on(event: ScreenShareEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: ScreenShareEvent, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(event: ScreenShareEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixScreenShareService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 获取共享类型
   */
  private getShareType(track: MediaStreamTrack): 'screen' | 'window' | 'application' {
    const settings = track.getSettings()
    const displaySurface = (settings as { displaySurface?: string })?.displaySurface

    switch (displaySurface) {
      case 'monitor':
        return 'screen'
      case 'window':
        return 'window'
      case 'browser':
      case 'application':
        return 'application'
      default:
        return 'screen'
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopScreenShare()
    this.listeners.clear()
    logger.info('[MatrixScreenShareService] Disposed')
  }
}

// 导出单例实例
export const matrixScreenShareService = MatrixScreenShareService.getInstance()

// 导出便捷函数
export async function startScreenShare(options?: ScreenShareOptions): Promise<MediaStream> {
  return matrixScreenShareService.startScreenShare(options)
}

export async function stopScreenShare(): Promise<void> {
  return matrixScreenShareService.stopScreenShare()
}

export function isScreenSharing(): boolean {
  return matrixScreenShareService.isSharing()
}

export function getScreenShareStream(): MediaStream | null {
  return matrixScreenShareService.getStream()
}
