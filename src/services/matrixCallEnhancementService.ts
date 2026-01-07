/**
 * Matrix Call Enhancement Service
 * 通话增强功能：录音、侧音控制、通话统计等
 *
 * @module services/matrixCallEnhancementService
 */

import { logger } from '@/utils/logger'

/**
 * 录音配置
 */
export interface CallRecordingOptions {
  /** 录音质量 */
  mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
  /** 音频比特率 */
  audioBitsPerSecond?: number
  /** 是否包含本地音频 */
  includeLocalAudio?: boolean
  /** 是否包含远程音频 */
  includeRemoteAudio?: boolean
}

/**
 * 录音状态
 */
export interface RecordingState {
  /** 是否正在录音 */
  isRecording: boolean
  /** 开始时间 */
  startTime: number | null
  /** 录音时长 */
  duration: number
  /** 录音数据块 */
  chunks: Blob[]
  /** 录音器 */
  mediaRecorder: MediaRecorder | null
}

/**
 * 侧音配置
 */
export interface SidetoneConfig {
  /** 是否启用 */
  enabled: boolean
  /** 音量 (0-1) */
  volume: number
  /** 延迟 */
  delay: number
}

/**
 * 通话统计
 */
export interface CallStatistics {
  /** 通话 ID */
  callId: string
  /** 开始时间 */
  startTime: number
  /** 结束时间 */
  endTime?: number
  /** 通话时长 */
  duration?: number
  /** 字节数 */
  bytesReceived: number
  bytesSent: number
  /** 包数量 */
  packetsReceived: number
  packetsSent: number
  /** 丢包 */
  packetsLost: number
  /** 音频级别 */
  audioLevel?: number
  /** 视频统计 */
  videoStats?: {
    width: number
    height: number
    frameRate: number
    keyFramesDecoded: number
    keyFramesEncoded: number
    framesDecoded: number
    framesEncoded: number
    framesDropped: number
  }
}

/**
 * 事件类型
 */
export type CallEnhancementEvent =
  | 'recording_started'
  | 'recording_stopped'
  | 'recording_paused'
  | 'recording_resumed'
  | 'recording_error'
  | 'sidetone_changed'
  | 'statistics_updated'

/**
 * Matrix Call Enhancement Service
 * 提供通话增强功能
 */
export class MatrixCallEnhancementService {
  private static instance: MatrixCallEnhancementService

  // 录音状态映射
  private recordings: Map<string, RecordingState> = new Map()

  // 侧音配置
  private sidetoneConfig: SidetoneConfig = {
    enabled: false,
    volume: 0.3,
    delay: 0
  }

  // 通话统计
  private statistics: Map<string, CallStatistics> = new Map()

  // 定时器
  private recordingTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

  // 事件监听器
  private listeners: Map<CallEnhancementEvent, Array<(data: unknown) => void>> = new Map()

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixCallEnhancementService {
    if (!MatrixCallEnhancementService.instance) {
      MatrixCallEnhancementService.instance = new MatrixCallEnhancementService()
    }
    return MatrixCallEnhancementService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: CallEnhancementEvent[] = [
      'recording_started',
      'recording_stopped',
      'recording_paused',
      'recording_resumed',
      'recording_error',
      'sidetone_changed',
      'statistics_updated'
    ]
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  // ==================== 录音功能 ====================

  /**
   * 开始录音
   */
  async startRecording(
    callId: string,
    streams: { local?: MediaStream; remote?: MediaStream },
    options: CallRecordingOptions = {}
  ): Promise<void> {
    if (this.recordings.has(callId)) {
      logger.warn('[MatrixCallEnhancementService] Recording already exists', { callId })
      return
    }

    try {
      logger.info('[MatrixCallEnhancementService] Starting recording', { callId, options })

      // 混合音频流
      const mixedStream = this.mixAudioStreams(streams, options)

      // 创建录音器
      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: options.mimeType || 'audio/webm',
        audioBitsPerSecond: options.audioBitsPerSecond || 128000
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        logger.debug('[MatrixCallEnhancementService] Recording stopped', { callId })
      }

      // 开始录音
      mediaRecorder.start(1000) // 每秒生成一个数据块

      // 创建录音状态
      const recordingState: RecordingState = {
        isRecording: true,
        startTime: Date.now(),
        duration: 0,
        chunks,
        mediaRecorder
      }

      this.recordings.set(callId, recordingState)

      // 启动计时器
      const timer = setInterval(() => {
        const state = this.recordings.get(callId)
        if (state) {
          state.duration = Date.now() - (state.startTime || 0)
        }
      }, 1000)

      this.recordingTimers.set(callId, timer)

      this.emit('recording_started', { callId, startTime: Date.now() })
    } catch (error) {
      logger.error('[MatrixCallEnhancementService] Failed to start recording', { callId, error })
      this.emit('recording_error', { callId, error })
      throw error
    }
  }

  /**
   * 停止录音
   */
  async stopRecording(callId: string): Promise<Blob | null> {
    const recording = this.recordings.get(callId)
    if (!recording || !recording.isRecording) {
      logger.warn('[MatrixCallEnhancementService] No active recording', { callId })
      return null
    }

    try {
      logger.info('[MatrixCallEnhancementService] Stopping recording', { callId })

      // 停止录音器
      if (recording.mediaRecorder && recording.mediaRecorder.state !== 'inactive') {
        recording.mediaRecorder.stop()
      }

      // 停止计时器
      const timer = this.recordingTimers.get(callId)
      if (timer) {
        clearInterval(timer)
        this.recordingTimers.delete(callId)
      }

      // 创建 Blob
      const blob = new Blob(recording.chunks, {
        type: recording.mediaRecorder?.mimeType || 'audio/webm'
      })

      // 更新状态
      recording.isRecording = false

      this.emit('recording_stopped', {
        callId,
        duration: recording.duration,
        size: blob.size
      })

      return blob
    } catch (error) {
      logger.error('[MatrixCallEnhancementService] Failed to stop recording', { callId, error })
      this.emit('recording_error', { callId, error })
      throw error
    }
  }

  /**
   * 暂停录音
   */
  pauseRecording(callId: string): void {
    const recording = this.recordings.get(callId)
    if (!recording || !recording.isRecording) {
      logger.warn('[MatrixCallEnhancementService] No active recording to pause', { callId })
      return
    }

    if (recording.mediaRecorder && recording.mediaRecorder.state === 'recording') {
      recording.mediaRecorder.pause()
      this.emit('recording_paused', { callId })
    }
  }

  /**
   * 恢复录音
   */
  resumeRecording(callId: string): void {
    const recording = this.recordings.get(callId)
    if (!recording || !recording.isRecording) {
      logger.warn('[MatrixCallEnhancementService] No recording to resume', { callId })
      return
    }

    if (recording.mediaRecorder && recording.mediaRecorder.state === 'paused') {
      recording.mediaRecorder.resume()
      this.emit('recording_resumed', { callId })
    }
  }

  /**
   * 获取录音状态
   */
  getRecordingState(callId: string): RecordingState | null {
    return this.recordings.get(callId) || null
  }

  /**
   * 混合音频流
   */
  private mixAudioStreams(
    streams: { local?: MediaStream; remote?: MediaStream },
    options: CallRecordingOptions
  ): MediaStream {
    const audioTracks: MediaStreamTrack[] = []

    if (options.includeLocalAudio && streams.local) {
      const localTracks = streams.local.getAudioTracks()
      audioTracks.push(...localTracks)
    }

    if (options.includeRemoteAudio && streams.remote) {
      const remoteTracks = streams.remote.getAudioTracks()
      audioTracks.push(...remoteTracks)
    }

    // 创建混合流
    const mixedStream = new MediaStream(audioTracks)

    // 如果没有音频轨，添加静音轨
    if (mixedStream.getAudioTracks().length === 0) {
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      gain.gain.value = 0 // 静音
      oscillator.connect(gain)
      gain.connect(destination)
      oscillator.start()

      mixedStream.addTrack(destination.stream.getAudioTracks()[0])
    }

    return mixedStream
  }

  // ==================== 侧音控制 ====================

  /**
   * 配置侧音
   */
  configureSidetone(config: Partial<SidetoneConfig>): void {
    this.sidetoneConfig = { ...this.sidetoneConfig, ...config }
    logger.info('[MatrixCallEnhancementService] Sidetone configured', this.sidetoneConfig)
    this.emit('sidetone_changed', this.sidetoneConfig)
  }

  /**
   * 获取侧音配置
   */
  getSidetoneConfig(): SidetoneConfig {
    return { ...this.sidetoneConfig }
  }

  /**
   * 启用侧音
   */
  enableSidetone(volume?: number): void {
    this.sidetoneConfig.enabled = true
    if (volume !== undefined) {
      this.sidetoneConfig.volume = Math.max(0, Math.min(1, volume))
    }
    logger.info('[MatrixCallEnhancementService] Sidetone enabled', { volume: this.sidetoneConfig.volume })
    this.emit('sidetone_changed', this.sidetoneConfig)
  }

  /**
   * 禁用侧音
   */
  disableSidetone(): void {
    this.sidetoneConfig.enabled = false
    logger.info('[MatrixCallEnhancementService] Sidetone disabled')
    this.emit('sidetone_changed', this.sidetoneConfig)
  }

  // ==================== 通话统计 ====================

  /**
   * 初始化统计
   */
  initStatistics(callId: string): void {
    this.statistics.set(callId, {
      callId,
      startTime: Date.now(),
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      packetsLost: 0
    })
  }

  /**
   * 更新统计
   */
  updateStatistics(callId: string, stats: Partial<CallStatistics>): void {
    const current = this.statistics.get(callId)
    if (!current) {
      logger.warn('[MatrixCallEnhancementService] Statistics not initialized', { callId })
      return
    }

    const updated = { ...current, ...stats }
    this.statistics.set(callId, updated)

    this.emit('statistics_updated', updated)
  }

  /**
   * 获取统计
   */
  getStatistics(callId: string): CallStatistics | null {
    return this.statistics.get(callId) || null
  }

  /**
   * 完成统计
   */
  finalizeStatistics(callId: string): CallStatistics | null {
    const stats = this.statistics.get(callId)
    if (!stats) return null

    stats.endTime = Date.now()
    stats.duration = stats.endTime - stats.startTime

    this.statistics.set(callId, stats)
    return stats
  }

  /**
   * 清除统计
   */
  clearStatistics(callId: string): void {
    this.statistics.delete(callId)
  }

  // ==================== 事件处理 ====================

  /**
   * 添加事件监听器
   */
  on(event: CallEnhancementEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: CallEnhancementEvent, listener: (data: unknown) => void): void {
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
  private emit(event: CallEnhancementEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixCallEnhancementService] Event listener error', { event, error })
        }
      })
    }
  }

  // ==================== 清理 ====================

  /**
   * 清理通话相关资源
   */
  cleanup(callId: string): void {
    // 停止录音
    this.stopRecording(callId).catch(() => {
      // 忽略错误
    })

    // 清除计时器
    const timer = this.recordingTimers.get(callId)
    if (timer) {
      clearInterval(timer)
      this.recordingTimers.delete(callId)
    }

    // 清除录音状态
    this.recordings.delete(callId)

    // 完成统计
    this.finalizeStatistics(callId)

    logger.debug('[MatrixCallEnhancementService] Cleaned up', { callId })
  }

  /**
   * 清理所有资源
   */
  dispose(): void {
    // 停止所有录音
    for (const callId of this.recordings.keys()) {
      this.cleanup(callId)
    }

    // 清除所有数据
    this.recordings.clear()
    this.statistics.clear()
    this.recordingTimers.clear()
    this.listeners.clear()

    logger.info('[MatrixCallEnhancementService] Disposed')
  }
}

// 导出单例实例
export const matrixCallEnhancementService = MatrixCallEnhancementService.getInstance()

// 导出便捷函数
export async function startCallRecording(
  callId: string,
  streams: { local?: MediaStream; remote?: MediaStream },
  options?: CallRecordingOptions
): Promise<void> {
  return matrixCallEnhancementService.startRecording(callId, streams, options)
}

export async function stopCallRecording(callId: string): Promise<Blob | null> {
  return matrixCallEnhancementService.stopRecording(callId)
}

export function getCallRecordingState(callId: string): RecordingState | null {
  return matrixCallEnhancementService.getRecordingState(callId)
}
