/**
 * Matrix Call Device Service
 * 管理音视频设备，支持设备枚举、选择和切换
 *
 * @module services/matrixCallDeviceService
 */

import { logger } from '@/utils/logger'

/**
 * 设备类型
 */
export enum DeviceType {
  AUDIOINPUT = 'audioinput',
  AUDIOOUTPUT = 'audiooutput',
  VIDEOINPUT = 'videoinput'
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  deviceId: string
  kind: MediaDeviceKind
  label: string
  groupId?: string
  isDefault?: boolean
}

/**
 * 设备权限状态
 */
export interface DevicePermissions {
  audio: boolean | null
  video: boolean | null
}

/**
 * 设备配置
 */
export interface DeviceConfig {
  audioInput?: string
  audioOutput?: string
  videoInput?: string
}

/**
 * 媒体约束
 */
export interface MediaConstraints {
  audio?: boolean | MediaTrackConstraints
  video?: boolean | MediaTrackConstraints
}

/**
 * 事件类型
 */
export type DeviceEvent = 'device_list_changed' | 'device_permission_changed' | 'device_selected' | 'device_error'

/**
 * Matrix Call Device Service
 * 管理音视频设备
 */
export class MatrixCallDeviceService {
  private static instance: MatrixCallDeviceService

  // 设备列表缓存
  private devices: Map<DeviceType, MediaDeviceInfo[]> = new Map()

  // 当前选择的设备
  private selectedDevices: DeviceConfig = {}

  // 权限状态
  private permissions: DevicePermissions = {
    audio: null,
    video: null
  }

  // 事件监听器
  private listeners: Map<DeviceEvent, Array<(data: unknown) => void>> = new Map()

  // 设备变化监听
  private deviceChangeListener: ((this: MediaDevices, ev: Event) => unknown) | null = null

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixCallDeviceService {
    if (!MatrixCallDeviceService.instance) {
      MatrixCallDeviceService.instance = new MatrixCallDeviceService()
    }
    return MatrixCallDeviceService.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    logger.info('[MatrixCallDeviceService] Initializing')

    // 检查设备枚举支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      logger.error('[MatrixCallDeviceService] MediaDevices not supported')
      throw new Error('MediaDevices API not supported')
    }

    // 刷新设备列表
    await this.refreshDevices()

    // 监听设备变化
    this.setupDeviceChangeMonitoring()

    // 检查权限
    await this.checkPermissions()
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: DeviceEvent[] = [
      'device_list_changed',
      'device_permission_changed',
      'device_selected',
      'device_error'
    ]
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  /**
   * 设置设备变化监听
   */
  private setupDeviceChangeMonitoring(): void {
    if (!navigator.mediaDevices) return

    this.deviceChangeListener = () => {
      logger.info('[MatrixCallDeviceService] Device list changed')
      this.refreshDevices()
      this.emit('device_list_changed', {})
    }

    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener)
  }

  /**
   * 刷新设备列表
   */
  async refreshDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      // 按类型分组
      const audioInputs: MediaDeviceInfo[] = []
      const audioOutputs: MediaDeviceInfo[] = []
      const videoInputs: MediaDeviceInfo[] = []

      devices.forEach((device) => {
        switch (device.kind) {
          case 'audioinput':
            audioInputs.push(device)
            break
          case 'audiooutput':
            audioOutputs.push(device)
            break
          case 'videoinput':
            videoInputs.push(device)
            break
        }
      })

      this.devices.set(DeviceType.AUDIOINPUT, audioInputs)
      this.devices.set(DeviceType.AUDIOOUTPUT, audioOutputs)
      this.devices.set(DeviceType.VIDEOINPUT, videoInputs)

      logger.debug('[MatrixCallDeviceService] Devices refreshed', {
        audioInputs: audioInputs.length,
        audioOutputs: audioOutputs.length,
        videoInputs: videoInputs.length
      })
    } catch (error) {
      logger.error('[MatrixCallDeviceService] Failed to refresh devices', { error })
      this.emit('device_error', { error })
    }
  }

  /**
   * 获取设备列表
   */
  getDevices(type: DeviceType): MediaDeviceInfo[] {
    return this.devices.get(type) || []
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): Map<DeviceType, MediaDeviceInfo[]> {
    return new Map(this.devices)
  }

  /**
   * 获取音频输入设备
   */
  getAudioInputDevices(): MediaDeviceInfo[] {
    return this.getDevices(DeviceType.AUDIOINPUT)
  }

  /**
   * 获取音频输出设备
   */
  getAudioOutputDevices(): MediaDeviceInfo[] {
    return this.getDevices(DeviceType.AUDIOOUTPUT)
  }

  /**
   * 获取视频输入设备
   */
  getVideoInputDevices(): MediaDeviceInfo[] {
    return this.getDevices(DeviceType.VIDEOINPUT)
  }

  /**
   * 选择设备
   */
  selectDevice(type: DeviceType, deviceId: string): void {
    switch (type) {
      case DeviceType.AUDIOINPUT:
        this.selectedDevices.audioInput = deviceId
        break
      case DeviceType.AUDIOOUTPUT:
        this.selectedDevices.audioOutput = deviceId
        break
      case DeviceType.VIDEOINPUT:
        this.selectedDevices.videoInput = deviceId
        break
    }

    logger.debug('[MatrixCallDeviceService] Device selected', { type, deviceId })
    this.emit('device_selected', { type, deviceId })
  }

  /**
   * 获取选择的设备配置
   */
  getSelectedDevices(): DeviceConfig {
    return { ...this.selectedDevices }
  }

  /**
   * 获取选择的音频输入设备
   */
  getSelectedAudioInput(): string | undefined {
    return this.selectedDevices.audioInput
  }

  /**
   * 获取选择的音频输出设备
   */
  getSelectedAudioOutput(): string | undefined {
    return this.selectedDevices.audioOutput
  }

  /**
   * 获取选择的视频输入设备
   */
  getSelectedVideoInput(): string | undefined {
    return this.selectedDevices.videoInput
  }

  /**
   * 获取媒体流
   */
  async getMediaStream(constraints: MediaConstraints = {}): Promise<MediaStream> {
    try {
      const finalConstraints: MediaStreamConstraints = {}

      // 音频约束
      if (constraints.audio !== false) {
        const audioConstraints: MediaTrackConstraints = {}
        if (this.selectedDevices.audioInput) {
          audioConstraints.deviceId = { exact: this.selectedDevices.audioInput }
        }
        finalConstraints.audio =
          constraints.audio === true ? audioConstraints : { ...constraints.audio, ...audioConstraints }
      }

      // 视频约束
      if (constraints.video !== false) {
        const videoConstraints: MediaTrackConstraints = {}
        if (this.selectedDevices.videoInput) {
          videoConstraints.deviceId = { exact: this.selectedDevices.videoInput }
        }
        finalConstraints.video =
          constraints.video === true ? videoConstraints : { ...constraints.video, ...videoConstraints }
      }

      logger.debug('[MatrixCallDeviceService] Getting media stream', finalConstraints)

      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)

      // 更新权限状态
      if (stream.getAudioTracks().length > 0) {
        this.permissions.audio = true
      }
      if (stream.getVideoTracks().length > 0) {
        this.permissions.video = true
      }

      this.emit('device_permission_changed', this.permissions)

      return stream
    } catch (error) {
      logger.error('[MatrixCallDeviceService] Failed to get media stream', { error })

      // 更新权限状态
      if (String(error).includes('audio')) {
        this.permissions.audio = false
      }
      if (String(error).includes('video')) {
        this.permissions.video = false
      }

      this.emit('device_permission_changed', this.permissions)
      this.emit('device_error', { error })

      throw error
    }
  }

  /**
   * 获取音频流
   */
  async getAudioStream(): Promise<MediaStream> {
    return this.getMediaStream({ audio: true, video: false })
  }

  /**
   * 获取视频流
   */
  async getVideoStream(): Promise<MediaStream> {
    return this.getMediaStream({ audio: false, video: true })
  }

  /**
   * 获取音视频流
   */
  async getAVStream(): Promise<MediaStream> {
    return this.getMediaStream({ audio: true, video: true })
  }

  /**
   * 切换摄像头
   */
  async switchCamera(): Promise<MediaStream | null> {
    const videoDevices = this.getVideoInputDevices()
    if (videoDevices.length < 2) {
      logger.warn('[MatrixCallDeviceService] No alternative camera available')
      return null
    }

    const currentDeviceId = this.selectedDevices.videoInput
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId)
    const nextIndex = (currentIndex + 1) % videoDevices.length
    const nextDevice = videoDevices[nextIndex]

    logger.info('[MatrixCallDeviceService] Switching camera', {
      from: currentDeviceId,
      to: nextDevice.deviceId
    })

    this.selectDevice(DeviceType.VIDEOINPUT, nextDevice.deviceId)

    // 返回新的流（需要重新获取）
    try {
      return await this.getVideoStream()
    } catch (error) {
      logger.error('[MatrixCallDeviceService] Failed to switch camera', { error })
      return null
    }
  }

  /**
   * 检查权限
   */
  async checkPermissions(): Promise<DevicePermissions> {
    const permissions: DevicePermissions = {
      audio: null,
      video: null
    }

    // 检查音频权限
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStream.getTracks().forEach((track) => track.stop())
      permissions.audio = true
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        permissions.audio = false
      }
    }

    // 检查视频权限
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoStream.getTracks().forEach((track) => track.stop())
      permissions.video = true
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        permissions.video = false
      }
    }

    this.permissions = permissions

    logger.debug('[MatrixCallDeviceService] Permissions checked', permissions)

    return permissions
  }

  /**
   * 获取权限状态
   */
  getPermissions(): DevicePermissions {
    return { ...this.permissions }
  }

  /**
   * 请求权限
   */
  async requestPermissions(audio: boolean, video: boolean): Promise<DevicePermissions> {
    const constraints: MediaStreamConstraints = {}
    if (audio) constraints.audio = true
    if (video) constraints.video = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      stream.getTracks().forEach((track) => track.stop())

      if (audio) this.permissions.audio = true
      if (video) this.permissions.video = true

      logger.info('[MatrixCallDeviceService] Permissions granted', { audio, video })
    } catch (error) {
      logger.error('[MatrixCallDeviceService] Permissions denied', { error })

      if (audio && (String(error).includes('audio') || !String(error).includes('video'))) {
        this.permissions.audio = false
      }
      if (video) {
        this.permissions.video = false
      }
    }

    this.emit('device_permission_changed', this.permissions)

    return this.getPermissions()
  }

  /**
   * 获取默认设备配置
   */
  getDefaultDeviceConfig(): DeviceConfig {
    const config: DeviceConfig = {}

    const audioInputs = this.getAudioInputDevices()
    const audioOutputs = this.getAudioOutputDevices()
    const videoInputs = this.getVideoInputDevices()

    // 查找默认设备
    const defaultAudioInput = audioInputs.find((d) => (d as Partial<DeviceInfo>).isDefault)
    const defaultAudioOutput = audioOutputs.find((d) => (d as Partial<DeviceInfo>).isDefault)
    const defaultVideoInput = videoInputs.find((d) => (d as Partial<DeviceInfo>).isDefault)

    if (defaultAudioInput) config.audioInput = defaultAudioInput.deviceId
    if (defaultAudioOutput) config.audioOutput = defaultAudioOutput.deviceId
    if (defaultVideoInput) config.videoInput = defaultVideoInput.deviceId

    // 如果没有默认设备，使用第一个
    if (!config.audioInput && audioInputs.length > 0) {
      config.audioInput = audioInputs[0].deviceId
    }
    if (!config.audioOutput && audioOutputs.length > 0) {
      config.audioOutput = audioOutputs[0].deviceId
    }
    if (!config.videoInput && videoInputs.length > 0) {
      config.videoInput = videoInputs[0].deviceId
    }

    return config
  }

  /**
   * 添加事件监听器
   */
  on(event: DeviceEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: DeviceEvent, listener: (data: unknown) => void): void {
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
  private emit(event: DeviceEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixCallDeviceService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 移除设备变化监听
    if (this.deviceChangeListener && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener)
      this.deviceChangeListener = null
    }

    // 清理监听器
    this.listeners.clear()

    // 清理缓存
    this.devices.clear()
    this.selectedDevices = {}

    logger.info('[MatrixCallDeviceService] Disposed')
  }
}

// 导出单例实例
export const matrixCallDeviceService = MatrixCallDeviceService.getInstance()

// 导出便捷函数
export async function initializeCallDevices(): Promise<void> {
  return matrixCallDeviceService.initialize()
}

export function getAudioInputDevices(): MediaDeviceInfo[] {
  return matrixCallDeviceService.getAudioInputDevices()
}

export function getVideoInputDevices(): MediaDeviceInfo[] {
  return matrixCallDeviceService.getVideoInputDevices()
}

export async function getUserMedia(constraints?: MediaConstraints): Promise<MediaStream> {
  return matrixCallDeviceService.getMediaStream(constraints)
}
