/**
 * Matrix 加密管理器
 * 集成 Matrix SDK 的 E2EE 功能，提供完整的加密管理
 *
 * @module services/matrixCryptoManager
 */

import { logger } from '@/utils/logger'

// 本地 Matrix 类型定义（与项目其他部分保持一致）
interface MatrixDevice {
  deviceId: string
  [key: string]: unknown
}

interface MatrixRoomState {
  getContent?(): RoomEncryptionContent
  [key: string]: unknown
}

interface RoomEncryptionContent {
  algorithm?: string
  [key: string]: unknown
}

interface MatrixRoom {
  hasEncryptionState?(): boolean
  getEncryptionTargetMembers?(): unknown[]
  getState?(eventType: string): MatrixRoomState | undefined
  sendSharedHistoryKeys?(): Promise<void>
  [key: string]: unknown
}

interface DeviceTrustLevel {
  isVerified?: boolean
  [key: string]: unknown
}

interface MatrixClient {
  getRoom?(roomId: string): MatrixRoom | null | undefined
  getDeviceId?(): string
  getUserId?(): string
  getStoredDevicesForUser?(userId: string): Promise<MatrixDevice[] | undefined>
  checkDeviceTrust?(userId: string, deviceId: string): DeviceTrustLevel | undefined
  setDeviceVerified?(userId: string, deviceId: string, verified: boolean): Promise<void>
  setRoomEncryption?(roomId: string, config: Record<string, unknown>): Promise<void>
  resetDeviceOutboundRoomAlgorithm?(roomId: string): Promise<void>
  [key: string]: unknown
}

// 事件类型定义
type EventListener = (...args: unknown[]) => void
type EventData = {
  userId?: string
  deviceId?: string
  deviceInfo?: Record<string, unknown>
  roomId?: string
  config?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * 加密管理器配置
 */
export interface CryptoManagerConfig {
  /** 是否自动上传设备密钥 */
  autoUploadKeys?: boolean
  /** 是否启用密钥备份 */
  enableBackup?: boolean
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  trustLevel: 'trusted' | 'untrusted' | 'unknown'
  isVerified: boolean
  isCurrentDevice: boolean
}

/**
 * Matrix 加密管理器
 * 整合所有 Matrix E2EE 功能
 */
export class MatrixCryptoManager {
  private client: MatrixClient
  private config: Required<CryptoManagerConfig>
  private initialized = false

  // 事件监听器
  private listeners: Map<string, EventListener[]> = new Map()

  constructor(client: MatrixClient, config: CryptoManagerConfig = {}) {
    this.client = client
    this.config = {
      autoUploadKeys: config.autoUploadKeys ?? true,
      enableBackup: config.enableBackup ?? true
    }
  }

  /**
   * 初始化加密
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[MatrixCryptoManager] Already initialized')
      return
    }

    try {
      logger.info('[MatrixCryptoManager] Initializing...', { config: this.config })

      // 注意：initRustCrypto 由 matrix-js-sdk 自动处理
      // 这里我们只需要验证加密是否可用
      const crypto = this.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[MatrixCryptoManager] Encryption initialized')

      // 设置事件监听器
      this.setupEventListeners()

      this.initialized = true
      logger.info('[MatrixCryptoManager] Initialization complete')
    } catch (error) {
      logger.error('[MatrixCryptoManager] Initialization failed', { error })
      throw error
    }
  }

  /**
   * 获取加密 API
   */
  private getCrypto(): { on?: (event: string, handler: (...args: unknown[]) => void) => void } | null {
    return (
      (
        this.client as unknown as {
          getCrypto?: () => { on?: (event: string, handler: (...args: unknown[]) => void) => void } | null
        }
      ).getCrypto?.() || null
    )
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const crypto = this.getCrypto()
    if (!crypto) return

    // 监听设备验证变化
    if (crypto.on) {
      crypto.on('deviceVerificationChanged', (...args: unknown[]) => {
        const [userId, deviceId, deviceInfo] = args as [string, string, Record<string, unknown>]
        logger.info('[MatrixCryptoManager] Device verification changed', { userId, deviceId })
        this.emit('device.verification.changed', { userId, deviceId, deviceInfo })
      })
    }

    logger.debug('[MatrixCryptoManager] Event listeners set up')
  }

  /**
   * 获取用户设备列表
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const devices = await this.client.getStoredDevicesForUser?.(userId)
      const deviceList: DeviceInfo[] = []

      if (devices && Array.isArray(devices)) {
        const currentDeviceId = this.client.getDeviceId?.()

        for (const device of devices) {
          const deviceId = device.deviceId
          const trustInfo = this.client.checkDeviceTrust?.(userId, deviceId)

          deviceList.push({
            deviceId,
            userId,
            displayName: (device as any).displayName || device.deviceId,
            trustLevel: trustInfo?.isVerified ? 'trusted' : 'untrusted',
            isVerified: trustInfo?.isVerified || false,
            isCurrentDevice: deviceId === currentDeviceId
          })
        }
      }

      return deviceList
    } catch (error) {
      logger.error('[MatrixCryptoManager] Failed to get user devices', { error, userId })
      throw error
    }
  }

  /**
   * 验证设备
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await this.client.setDeviceVerified?.(userId, deviceId, true)
      logger.info('[MatrixCryptoManager] Device verified', { userId, deviceId })

      this.emit('device.verified', { userId, deviceId })
    } catch (error) {
      logger.error('[MatrixCryptoManager] Failed to verify device', { error })
      throw error
    }
  }

  /**
   * 阻止设备
   */
  async blockDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await this.client.setDeviceVerified?.(userId, deviceId, false)
      logger.warn('[MatrixCryptoManager] Device blocked', { userId, deviceId })

      this.emit('device.blocked', { userId, deviceId })
    } catch (error) {
      logger.error('[MatrixCryptoManager] Failed to block device', { error })
      throw error
    }
  }

  /**
   * 检查设备信任状态
   */
  async checkDeviceTrust(userId: string, deviceId: string): Promise<boolean> {
    try {
      const trustInfo = this.client.checkDeviceTrust?.(userId, deviceId)
      const isVerified = trustInfo?.isVerified || false
      logger.debug('[MatrixCryptoManager] Device trust status', { userId, deviceId, isVerified })
      return isVerified
    } catch (error) {
      logger.error('[MatrixCryptoManager] Failed to check device trust', { error })
      return false
    }
  }

  /**
   * 为房间启用加密
   */
  async enableRoomEncryption(
    roomId: string,
    config?: {
      algorithm?: string
      rotation_period_ms?: number
      rotation_period_msgs?: number
    }
  ): Promise<void> {
    try {
      const encryptionConfig = {
        algorithm: config?.algorithm || 'm.megolm.v1.aes-sha2',
        rotation_period_ms: config?.rotation_period_ms || 604800000, // 7天
        rotation_period_msgs: config?.rotation_period_msgs || 100
      }

      await this.client.setRoomEncryption?.(roomId, encryptionConfig)
      logger.info('[MatrixCryptoManager] Room encryption enabled', { roomId, config: encryptionConfig })

      this.emit('room.encryption.enabled', { roomId, config: encryptionConfig })
    } catch (error) {
      logger.error('[MatrixCryptoManager] Failed to enable room encryption', { error })
      throw error
    }
  }

  /**
   * 检查房间加密状态
   */
  checkRoomEncryption(roomId: string): { isEncrypted: boolean; algorithm?: string } {
    const room = this.client.getRoom?.(roomId)
    if (!room) {
      return { isEncrypted: false }
    }

    const isEncrypted = room.hasEncryptionState?.() || false
    const algorithm = room.getState?.('m.room.encryption')?.getContent?.()?.algorithm

    return {
      isEncrypted,
      algorithm
    }
  }

  /**
   * 事件发射器
   */
  private emit(event: string, data: EventData): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixCryptoManager] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 添加事件监听器
   */
  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
    logger.debug('[MatrixCryptoManager] Event listener added', { event })
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
        logger.debug('[MatrixCryptoManager] Event listener removed', { event })
      }
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.listeners.clear()
    this.initialized = false
    logger.info('[MatrixCryptoManager] Disposed')
  }
}

/**
 * 创建加密管理器实例
 */
export function createMatrixCryptoManager(client: MatrixClient, config?: CryptoManagerConfig): MatrixCryptoManager {
  return new MatrixCryptoManager(client, config)
}
