/**
 * Matrix Call DTMF Service
 * 提供 DTMF (双音多频) 音频信号发送功能
 *
 * @module services/matrixCallDtmfService
 */

import { logger } from '@/utils/logger'

/**
 * DTMF 音调频率映射
 */
const DTMF_FREQUENCIES: Record<string, { low: number; high: number }> = {
  '1': { low: 697, high: 1209 },
  '2': { low: 697, high: 1336 },
  '3': { low: 697, high: 1477 },
  A: { low: 697, high: 1633 },
  '4': { low: 770, high: 1209 },
  '5': { low: 770, high: 1336 },
  '6': { low: 770, high: 1477 },
  B: { low: 770, high: 1633 },
  '7': { low: 852, high: 1209 },
  '8': { low: 852, high: 1336 },
  '9': { low: 852, high: 1477 },
  C: { low: 852, high: 1633 },
  '*': { low: 941, high: 1209 },
  '0': { low: 941, high: 1336 },
  '#': { low: 941, high: 1477 },
  D: { low: 941, high: 1633 }
}

/**
 * DTMF 配置选项
 */
export interface DtmfOptions {
  /** 音调持续时间 */
  duration?: number
  /** 音调间隔时间 */
  gap?: number
  /** 音量 */
  volume?: number
}

/**
 * DTMF 发送结果
 */
export interface DtmfResult {
  /** 是否成功 */
  success: boolean
  /** 发送的字符 */
  tone: string
  /** 发送时间戳 */
  timestamp: number
  /** 错误信息 */
  error?: string
}

/**
 * DTMF 事件
 */
export type DtmfEvent = 'tone_sent' | 'tone_failed' | 'sequence_started' | 'sequence_ended'

/**
 * Matrix Call DTMF Service
 * 管理 DTMF 音频信号发送
 */
export class MatrixCallDtmfService {
  private static instance: MatrixCallDtmfService

  // 音频上下文
  private audioContext: AudioContext | null = null

  // 当前活跃的音调
  activeOscillators: Map<string, OscillatorNode[]> = new Map()

  // 事件监听器
  private listeners: Map<DtmfEvent, Array<(data: unknown) => void>> = new Map()

  // 默认配置
  private config = {
    duration: 100, // 100ms
    gap: 50, // 50ms
    volume: 0.3 // 30% 音量
  }

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixCallDtmfService {
    if (!MatrixCallDtmfService.instance) {
      MatrixCallDtmfService.instance = new MatrixCallDtmfService()
    }
    return MatrixCallDtmfService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: DtmfEvent[] = ['tone_sent', 'tone_failed', 'sequence_started', 'sequence_ended']
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  /**
   * 检查是否支持 DTMF
   */
  isSupported(): boolean {
    return (
      typeof AudioContext !== 'undefined' ||
      typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined'
    )
  }

  /**
   * 获取音频上下文
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass =
        window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported')
      }
      this.audioContext = new AudioContextClass()
    }
    return this.audioContext
  }

  /**
   * 验证 DTMF 字符
   */
  isValidTone(tone: string): boolean {
    return tone in DTMF_FREQUENCIES
  }

  /**
   * 发送单个 DTMF 音调
   */
  async sendTone(tone: string, options: DtmfOptions = {}): Promise<DtmfResult> {
    if (!this.isSupported()) {
      const error = 'DTMF is not supported in this browser'
      logger.error('[MatrixCallDtmfService] ' + error)
      return {
        success: false,
        tone,
        timestamp: Date.now(),
        error
      }
    }

    if (!this.isValidTone(tone)) {
      const error = `Invalid DTMF tone: ${tone}`
      logger.error('[MatrixCallDtmfService] ' + error)
      return {
        success: false,
        tone,
        timestamp: Date.now(),
        error
      }
    }

    try {
      const config = { ...this.config, ...options }
      const frequencies = DTMF_FREQUENCIES[tone]

      logger.debug('[MatrixCallDtmfService] Sending DTMF tone', { tone, config })

      // 播放 DTMF 音调
      await this.playDtmfTone(frequencies.low, frequencies.high, config.duration, config.volume)

      const result: DtmfResult = {
        success: true,
        tone,
        timestamp: Date.now()
      }

      this.emit('tone_sent', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[MatrixCallDtmfService] Failed to send tone', { tone, error })

      const result: DtmfResult = {
        success: false,
        tone,
        timestamp: Date.now(),
        error: errorMessage
      }

      this.emit('tone_failed', result)

      return result
    }
  }

  /**
   * 发送 DTMF 序列
   */
  async sendSequence(sequence: string, options: DtmfOptions = {}): Promise<DtmfResult[]> {
    const config = { ...this.config, ...options }
    const results: DtmfResult[] = []

    this.emit('sequence_started', { sequence, config })

    logger.info('[MatrixCallDtmfService] Sending DTMF sequence', { sequence, length: sequence.length })

    for (let i = 0; i < sequence.length; i++) {
      const tone = sequence[i]
      const result = await this.sendTone(tone, config)
      results.push(result)

      // 等待间隔时间
      if (i < sequence.length - 1) {
        await this.delay(config.gap)
      }
    }

    this.emit('sequence_ended', { sequence, results })

    return results
  }

  /**
   * 使用 WebRTC RTCDTMFSender 发送 DTMF
   */
  async sendToneWithRtpSender(sender: RTCDTMFSender, tone: string, options: DtmfOptions = {}): Promise<DtmfResult> {
    try {
      const config = { ...this.config, ...options }

      if (!this.isValidTone(tone)) {
        throw new Error(`Invalid DTMF tone: ${tone}`)
      }

      logger.debug('[MatrixCallDtmfService] Sending DTMF via RTP sender', { tone, config })

      // 使用 RTCDTMFSender 插入 DTMF
      await sender.insertDTMF(tone, config.duration, config.gap)

      const result: DtmfResult = {
        success: true,
        tone,
        timestamp: Date.now()
      }

      this.emit('tone_sent', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[MatrixCallDtmfService] Failed to send tone via RTP', { tone, error })

      const result: DtmfResult = {
        success: false,
        tone,
        timestamp: Date.now(),
        error: errorMessage
      }

      this.emit('tone_failed', result)

      return result
    }
  }

  /**
   * 播放 DTMF 音调
   */
  private async playDtmfTone(lowFreq: number, highFreq: number, duration: number, volume: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = this.getAudioContext()

        // 创建低频振荡器
        const lowOscillator = audioContext.createOscillator()
        lowOscillator.type = 'sine'
        lowOscillator.frequency.value = lowFreq

        // 创建高频振荡器
        const highOscillator = audioContext.createOscillator()
        highOscillator.type = 'sine'
        highOscillator.frequency.value = highFreq

        // 创建增益节点
        const gainNode = audioContext.createGain()
        gainNode.gain.value = volume

        // 连接节点
        lowOscillator.connect(gainNode)
        highOscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // 启动振荡器
        lowOscillator.start()
        highOscillator.start()

        // 持续时间后停止
        setTimeout(() => {
          lowOscillator.stop()
          highOscillator.stop()

          // 清理
          lowOscillator.disconnect()
          highOscillator.disconnect()
          gainNode.disconnect()

          resolve()
        }, duration)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 配置 DTMF 选项
   */
  configure(options: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...options }
    logger.info('[MatrixCallDtmfService] Configuration updated', this.config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): typeof this.config {
    return { ...this.config }
  }

  /**
   * 停止所有正在播放的音调
   */
  stopAllTones(): void {
    this.activeOscillators.forEach((oscillators) => {
      oscillators.forEach((osc) => {
        try {
          osc.stop()
          osc.disconnect()
        } catch (error) {
          logger.error('[MatrixCallDtmfService] Failed to stop oscillator', { error })
        }
      })
    })
    this.activeOscillators.clear()
  }

  /**
   * 添加事件监听器
   */
  on(event: DtmfEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: DtmfEvent, listener: (data: unknown) => void): void {
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
  private emit(event: DtmfEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixCallDtmfService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopAllTones()

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.listeners.clear()

    logger.info('[MatrixCallDtmfService] Disposed')
  }
}

// 导出单例实例
export const matrixCallDtmfService = MatrixCallDtmfService.getInstance()

// 导出便捷函数
export async function sendDtmfTone(tone: string, options?: DtmfOptions): Promise<DtmfResult> {
  return matrixCallDtmfService.sendTone(tone, options)
}

export async function sendDtmfSequence(sequence: string, options?: DtmfOptions): Promise<DtmfResult[]> {
  return matrixCallDtmfService.sendSequence(sequence, options)
}

export function isDtmfSupported(): boolean {
  return matrixCallDtmfService.isSupported()
}
