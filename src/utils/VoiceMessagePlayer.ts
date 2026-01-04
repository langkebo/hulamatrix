/**
 * Voice Message Player
 * Provides a unified API for voice message playback with full metadata support
 *
 * Features:
 * - Audio playback with play/pause/stop/seek
 * - Waveform data generation and visualization
 * - Metadata extraction (duration, format, bitrate, sample rate)
 * - Volume control with fade in/out
 * - Playback speed adjustment
 * - A-B loop functionality
 * - Event-driven architecture
 */

import { logger } from './logger'

/** Audio metadata */
export interface AudioMetadata {
  duration: number // Duration in seconds
  format: string // Audio format (mp3, m4a, wav, etc.)
  sampleRate: number // Sample rate in Hz
  channels: number // Number of audio channels
  bitrate?: number // Bitrate in kbps (if available)
  size: number // File size in bytes
  codec?: string // Audio codec
}

/** Waveform data point */
export interface WaveformDataPoint {
  amplitude: number // Normalized amplitude (0-1)
  timestamp: number // Time position in seconds
}

/** Playback state */
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'

/** Playback events */
export type PlaybackEvent =
  | 'loadstart'
  | 'loadedmetadata'
  | 'canplay'
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'seeked'
  | 'volumechange'
  | 'ratechange'
  | 'error'

/** Playback event handler */
type PlaybackEventHandler = (event: PlaybackEventDetail) => void

/** Playback event detail */
export interface PlaybackEventDetail {
  type: PlaybackEvent
  currentTime: number
  duration: number
  progress: number // 0-1
  error?: Error
}

/** Player options */
export interface VoicePlayerOptions {
  /** Initial volume (0-1) */
  volume?: number
  /** Initial playback rate (0.5-2.0) */
  playbackRate?: number
  /** Enable fade in/out on play/pause */
  enableFade?: boolean
  /** Fade duration in milliseconds */
  fadeDuration?: number
  /** Auto-play when loaded */
  autoplay?: boolean
  /** Loop playback */
  loop?: boolean
  /** A-B loop start time (seconds) */
  loopStart?: number
  /** A-B loop end time (seconds) */
  loopEnd?: number
}

/** Voice message info */
export interface VoiceMessageInfo {
  url: string
  duration: number
  metadata?: AudioMetadata
  waveform?: WaveformDataPoint[]
}

/**
 * Voice Message Player Class
 * Provides comprehensive audio playback functionality
 */
export class VoiceMessagePlayer {
  private audioElement: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private audioBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  private _state: PlaybackState = 'idle'
  private _currentTime = 0
  private _duration = 0
  private _volume = 1
  private _playbackRate = 1
  private _metadata: AudioMetadata | null = null
  private _waveformData: WaveformDataPoint[] = []

  private options: Required<VoicePlayerOptions>
  private eventHandlers: Map<PlaybackEvent, Set<PlaybackEventHandler>> = new Map()
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null
  private updateInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: VoicePlayerOptions = {}) {
    this.options = {
      volume: options.volume ?? 1,
      playbackRate: options.playbackRate ?? 1,
      enableFade: options.enableFade ?? true,
      fadeDuration: options.fadeDuration ?? 200,
      autoplay: options.autoplay ?? false,
      loop: options.loop ?? false,
      loopStart: options.loopStart ?? 0,
      loopEnd: options.loopEnd ?? 0
    }

    this.createAudioElement()
  }

  /**
   * Create audio element
   */
  private createAudioElement(): void {
    this.audioElement = new Audio()
    this.audioElement.preload = 'metadata'
    this.audioElement.volume = this.options.volume
    this.audioElement.playbackRate = this.options.playbackRate
    this.audioElement.loop = this.options.loop

    this.attachEventListeners()
  }

  /**
   * Attach event listeners to audio element
   */
  private attachEventListeners(): void {
    if (!this.audioElement) return

    const events: Partial<Record<keyof HTMLMediaElementEventMap, PlaybackEvent>> = {
      loadstart: 'loadstart',
      loadedmetadata: 'loadedmetadata',
      canplay: 'canplay',
      play: 'play',
      pause: 'pause',
      ended: 'ended',
      timeupdate: 'timeupdate',
      seeked: 'seeked',
      volumechange: 'volumechange',
      ratechange: 'ratechange',
      error: 'error'
    }

    Object.entries(events).forEach(([domEvent, playerEvent]) => {
      this.audioElement?.addEventListener(domEvent, () => {
        if (playerEvent) this.emit(playerEvent)
      })
    })
  }

  /**
   * Load audio from URL
   */
  async load(url: string): Promise<void> {
    this.setState('loading')

    try {
      if (!this.audioElement) {
        this.createAudioElement()
      }

      // Check again after creation
      if (!this.audioElement) {
        throw new Error('Failed to create audio element')
      }

      this.audioElement.src = url

      // Wait for metadata to load
      await new Promise<void>((resolve, reject) => {
        if (!this.audioElement) return reject(new Error('Audio element not created'))

        const onLoadedMetadata = () => {
          this.audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata)
          this.audioElement?.removeEventListener('error', onError)
          resolve()
        }

        const onError = () => {
          this.audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata)
          this.audioElement?.removeEventListener('error', onError)
          reject(new Error('Failed to load audio'))
        }

        this.audioElement.addEventListener('loadedmetadata', onLoadedMetadata)
        this.audioElement.addEventListener('error', onError)
      })

      this._duration = this.audioElement.duration
      this._currentTime = 0
      this.setState('idle')

      // Extract metadata
      await this.extractMetadata(url)

      // Auto-play if enabled
      if (this.options.autoplay) {
        await this.play()
      }
    } catch (error) {
      this.setState('error')
      this.emit('error', { error: error as Error })
      throw error
    }
  }

  /**
   * Load audio from Blob
   */
  async loadFromBlob(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)
    try {
      await this.load(url)
    } finally {
      // Don't revoke immediately as the audio needs to play
      // Store for cleanup later
    }
  }

  /**
   * Load audio from ArrayBuffer
   */
  async loadFromArrayBuffer(buffer: ArrayBuffer, format = 'audio/mp3'): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    try {
      this.audioBuffer = await this.audioContext.decodeAudioData(buffer)
      this._duration = this.audioBuffer.duration

      // Extract metadata from buffer
      this._metadata = {
        duration: this.audioBuffer.duration,
        format: format.split('/')[1] || 'unknown',
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
        size: buffer.byteLength
      }

      // Generate waveform data
      await this.generateWaveformData()

      this.setState('idle')
    } catch (error) {
      this.setState('error')
      this.emit('error', { error: error as Error })
      throw error
    }
  }

  /**
   * Play audio
   */
  async play(): Promise<void> {
    if (!this.audioElement || !this.audioElement.src) {
      throw new Error('No audio loaded')
    }

    this.setState('loading')

    try {
      // Apply fade in if enabled
      if (this.options.enableFade && this.gainNode) {
        await this.fadeIn()
      }

      await this.audioElement.play()
      this.startUpdateInterval()
      this.setState('playing')
      this.emit('play')
    } catch (error) {
      this.setState('error')
      this.emit('error', { error: error as Error })
      throw error
    }
  }

  /**
   * Pause audio
   */
  async pause(): Promise<void> {
    if (!this.audioElement) return

    // Apply fade out if enabled
    if (this.options.enableFade) {
      await this.fadeOut()
    }

    this.audioElement.pause()
    this.stopUpdateInterval()
    this.setState('paused')
    this.emit('pause')
  }

  /**
   * Stop audio and reset to beginning
   */
  async stop(): Promise<void> {
    if (!this.audioElement) return

    await this.pause()
    this.currentTime = 0
    this.setState('stopped')
  }

  /**
   * Seek to position
   */
  seek(time: number): void {
    if (!this.audioElement) return

    const targetTime = Math.max(0, Math.min(time, this.duration))
    this.audioElement.currentTime = targetTime
    this._currentTime = targetTime
    this.emit('seeked')
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    this._volume = clampedVolume

    if (this.audioElement) {
      this.audioElement.volume = clampedVolume
    }

    if (this.gainNode) {
      this.gainNode.gain.value = clampedVolume
    }

    this.emit('volumechange')
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate))
    this._playbackRate = clampedRate

    if (this.audioElement) {
      this.audioElement.playbackRate = clampedRate
    }

    this.emit('ratechange')
  }

  /**
   * Set A-B loop
   */
  setLoop(start: number, end: number): void {
    this.options.loopStart = Math.max(0, start)
    this.options.loopEnd = Math.min(this._duration, end)

    if (this.audioElement) {
      this.audioElement.loop = true
    }

    // Monitor timeupdate to loop within range
    this.on('timeupdate', () => {
      if (this._currentTime >= this.options.loopEnd && this.options.loopEnd > 0) {
        this.seek(this.options.loopStart)
      }
    })
  }

  /**
   * Clear A-B loop
   */
  clearLoop(): void {
    this.options.loopStart = 0
    this.options.loopEnd = 0

    if (this.audioElement) {
      this.audioElement.loop = this.options.loop
    }
  }

  /**
   * Extract audio metadata
   */
  private async extractMetadata(url: string): Promise<void> {
    if (!this.audioElement) return

    // Basic metadata from audio element
    this._metadata = {
      duration: this.audioElement.duration,
      format: this.getFormatFromUrl(url),
      sampleRate: 0, // Not available from HTMLAudioElement
      channels: 2, // Default assumption
      size: 0
    }

    // Try to get more detailed metadata by fetching as blob
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      this._metadata.size = blob.size
    } catch {
      // Ignore fetch errors
    }
  }

  /**
   * Get format from URL
   */
  private getFormatFromUrl(url: string): string {
    const extensionMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i)
    return extensionMatch ? extensionMatch[1].toLowerCase() : 'unknown'
  }

  /**
   * Generate waveform data from audio buffer
   */
  private async generateWaveformData(): Promise<void> {
    if (!this.audioBuffer) return

    const rawData = this.audioBuffer.getChannelData(0) // Use first channel
    const samples = 200 // Number of waveform points
    const blockSize = Math.floor(rawData.length / samples)
    const waveform: WaveformDataPoint[] = []

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize
      let sum = 0

      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[start + j])
      }

      const average = sum / blockSize
      waveform.push({
        amplitude: Math.min(1, average * 10), // Amplify for better visualization
        timestamp: (i / samples) * this._duration
      })
    }

    this._waveformData = waveform
  }

  /**
   * Get waveform data
   */
  async getWaveformData(_samples = 200): Promise<WaveformDataPoint[]> {
    if (this._waveformData.length > 0) {
      return this._waveformData
    }

    // Generate waveform from audio element if not already done
    if (!this.audioElement || !this.audioElement.src) {
      return []
    }

    // Need to decode audio data for waveform
    try {
      const response = await fetch(this.audioElement.src)
      const arrayBuffer = await response.arrayBuffer()

      if (!this.audioContext) {
        this.audioContext = new AudioContext()
      }

      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      await this.generateWaveformData()

      return this._waveformData
    } catch (error) {
      logger.error('Failed to generate waveform data:', error)
      return []
    }
  }

  /**
   * Fade in
   */
  private async fadeIn(): Promise<void> {
    if (!this.gainNode) return

    const startVolume = this.gainNode.gain.value
    const targetVolume = this._volume
    const steps = 10
    const stepDuration = this.options.fadeDuration / steps
    const volumeStep = (targetVolume - startVolume) / steps

    return new Promise((resolve) => {
      let step = 0

      const fade = () => {
        step++
        if (step <= steps) {
          if (this.gainNode) {
            this.gainNode.gain.value = startVolume + volumeStep * step
          }
          this.fadeTimeout = setTimeout(fade, stepDuration)
        } else {
          resolve()
        }
      }

      fade()
    })
  }

  /**
   * Fade out
   */
  private async fadeOut(): Promise<void> {
    if (!this.gainNode) return

    const startVolume = this.gainNode.gain.value
    const steps = 10
    const stepDuration = this.options.fadeDuration / steps
    const volumeStep = startVolume / steps

    return new Promise((resolve) => {
      let step = 0

      const fade = () => {
        step++
        if (step <= steps) {
          if (this.gainNode) {
            this.gainNode.gain.value = startVolume - volumeStep * step
          }
          this.fadeTimeout = setTimeout(fade, stepDuration)
        } else {
          resolve()
        }
      }

      fade()
    })
  }

  /**
   * Start update interval for time tracking
   */
  private startUpdateInterval(): void {
    if (this.updateInterval) return

    this.updateInterval = setInterval(() => {
      if (this.audioElement) {
        this._currentTime = this.audioElement.currentTime
        this.emit('timeupdate')
      }
    }, 100) // 10 updates per second
  }

  /**
   * Stop update interval
   */
  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  /**
   * Set player state
   */
  private setState(state: PlaybackState): void {
    this._state = state
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: PlaybackEvent, detail?: Partial<PlaybackEventDetail>): void {
    const handlers = this.eventHandlers.get(event)
    if (!handlers) return

    const eventDetail: PlaybackEventDetail = {
      type: event,
      currentTime: this._currentTime,
      duration: this._duration,
      progress: this._duration > 0 ? this._currentTime / this._duration : 0,
      ...detail
    }

    handlers.forEach((handler) => {
      try {
        handler(eventDetail)
      } catch (error) {
        logger.error(`Error in ${event} handler:`, error)
      }
    })
  }

  /**
   * Add event listener
   */
  on(event: PlaybackEvent, handler: PlaybackEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    this.eventHandlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.off(event, handler)
    }
  }

  /**
   * Remove event listener
   */
  off(event: PlaybackEvent, handler: PlaybackEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Get current playback progress (0-1)
   */
  get progress(): number {
    return this._duration > 0 ? this._currentTime / this._duration : 0
  }

  /**
   * Get current state
   */
  get state(): PlaybackState {
    return this._state
  }

  /**
   * Get current time in seconds
   */
  get currentTime(): number {
    return this._currentTime
  }

  /**
   * Set current time
   */
  set currentTime(time: number) {
    this.seek(time)
  }

  /**
   * Get duration in seconds
   */
  get duration(): number {
    return this._duration
  }

  /**
   * Get volume (0-1)
   */
  get volume(): number {
    return this._volume
  }

  /**
   * Get playback rate
   */
  get playbackRate(): number {
    return this._playbackRate
  }

  /**
   * Get metadata
   */
  get metadata(): AudioMetadata | null {
    return this._metadata
  }

  /**
   * Check if is playing
   */
  get isPlaying(): boolean {
    return this._state === 'playing'
  }

  /**
   * Check if is paused
   */
  get isPaused(): boolean {
    return this._state === 'paused'
  }

  /**
   * Check if is loading
   */
  get isLoading(): boolean {
    return this._state === 'loading'
  }

  /**
   * Check if has error
   */
  get hasError(): boolean {
    return this._state === 'error'
  }

  /**
   * Get voice message info
   */
  getInfo(): VoiceMessageInfo | null {
    if (!this.audioElement?.src) return null

    return {
      url: this.audioElement.src,
      duration: this._duration,
      metadata: this._metadata ?? undefined,
      waveform: this._waveformData.length > 0 ? this._waveformData : undefined
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop playback
    this.stop()

    // Clear fade timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout)
      this.fadeTimeout = null
    }

    // Stop update interval
    this.stopUpdateInterval()

    // Clear event handlers
    this.eventHandlers.clear()

    // Disconnect audio nodes
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {
        // Ignore
      }
      this.sourceNode = null
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect()
      } catch {
        // Ignore
      }
      this.gainNode = null
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect()
      } catch {
        // Ignore
      }
      this.analyserNode = null
    }

    // Close audio context
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch {
        // Ignore
      }
      this.audioContext = null
    }

    // Clear audio buffer
    this.audioBuffer = null

    // Reset audio element
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement.load()
      this.audioElement = null
    }

    // Reset state
    this._state = 'idle'
    this._currentTime = 0
    this._duration = 0
    this._waveformData = []
  }
}

/**
 * Voice metadata extraction utility
 */
export class VoiceMetadataExtractor {
  /**
   * Extract metadata from audio file
   */
  static async extract(blob: Blob): Promise<AudioMetadata> {
    const audio = new Audio()
    const url = URL.createObjectURL(blob)

    try {
      const metadata = await new Promise<AudioMetadata>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
          const metadata: AudioMetadata = {
            duration: audio.duration,
            format: blob.type.split('/')[1] || 'unknown',
            sampleRate: 0,
            channels: 2,
            size: blob.size
          }
          resolve(metadata)
        })

        audio.addEventListener('error', () => {
          reject(new Error('Failed to load audio metadata'))
        })

        audio.src = url
      })

      return metadata
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * Extract waveform data from audio blob
   */
  static async extractWaveform(blob: Blob, samples = 200): Promise<WaveformDataPoint[]> {
    const arrayBuffer = await blob.arrayBuffer()
    const audioContext = new AudioContext()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const rawData = audioBuffer.getChannelData(0)
    const blockSize = Math.floor(rawData.length / samples)
    const waveform: WaveformDataPoint[] = []

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize
      let sum = 0

      for (let j = 0; j < blockSize && start + j < rawData.length; j++) {
        sum += Math.abs(rawData[start + j])
      }

      const average = sum / blockSize
      waveform.push({
        amplitude: Math.min(1, average * 10),
        timestamp: (i / samples) * audioBuffer.duration
      })
    }

    await audioContext.close()
    return waveform
  }

  /**
   * Get audio info from file
   */
  static async getAudioInfo(file: File): Promise<AudioMetadata & { waveform: WaveformDataPoint[] }> {
    const [metadata, waveform] = await Promise.all([
      VoiceMetadataExtractor.extract(file),
      VoiceMetadataExtractor.extractWaveform(file)
    ])

    return {
      ...metadata,
      waveform
    }
  }
}

/**
 * Factory function to create a new voice player
 */
export function createVoicePlayer(options?: VoicePlayerOptions): VoiceMessagePlayer {
  return new VoiceMessagePlayer(options)
}
