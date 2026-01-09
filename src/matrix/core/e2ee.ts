/**
 * Matrix端到端加密(E2EE)集成
 * 提供完整的加密消息管理功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'

// Matrix crypto extensions for TypeScript
interface MatrixCryptoClient {
  isCryptoEnabled?(): boolean
  getCrypto?(): MatrixCrypto | undefined
  getUserDevices?(userId: string): Promise<DeviceRaw[]>
  getOwnDevices?(): Promise<Map<string, DeviceRaw>>
  setDeviceVerified?(deviceId: string, verified: boolean): Promise<boolean>
  requestDeviceVerification?(deviceId: string, options: VerificationRequestOptions): Promise<string>
  getDeviceId?(): string
  startDeviceVerification?(transactionId: string): Promise<void>
  acceptVerification?(transactionId: string): Promise<void>
  confirmVerification?(transactionId: string): Promise<void>
  getQRCode?(transactionId: string): Promise<string>
  scanQRCode?(transactionId: string, qrData: string): Promise<boolean>
  bootstrapCrossSigning?(): Promise<boolean>
  resetCrossSigning?(): Promise<boolean>
  prepareKeyBackupVersion?(passphrase?: string): Promise<KeyBackupInfoRaw | undefined>
  startKeyBackup?(backupInfo: KeyBackupInfoRaw): Promise<void>
  getKeyBackupVersions?(): Promise<KeyBackupInfoRaw[]>
  restoreKeyBackup?(version: KeyBackupInfoRaw, passphrase?: string): Promise<boolean>
  deleteKeyBackupVersion?(): Promise<void>
  setRoomEncryption?(roomId: string, config: EncryptionConfig): Promise<void>
  getKeyBackupVersion?(): Promise<KeyBackupInfoRaw | undefined>
  isInitialSyncComplete?(): boolean
  getRooms?(): RoomRaw[]
  on?(event: string, handler: (...args: unknown[]) => void): void
}

interface MatrixCrypto {
  isDeviceVerificationReady?(): boolean
  getCrossSigningStatus(): Promise<CrossSigningStatusRaw>
  getRoomEncryptionState(roomId: string): EncryptionState | undefined
}

interface RoomRaw {
  roomId: string
  [key: string]: unknown
}

interface VerificationRequestOptions {
  method: 'qrcode' | 'sas'
  from_device_id: string
  [key: string]: unknown
}

interface DeviceRaw {
  device_id: string
  user_id: string
  display_name?: string
  last_seen_ts?: number
  keys: {
    ed25519: string
    curve25519: string
  }
  algorithms?: string[]
  verified?: boolean
  [key: string]: unknown
}

interface CrossSigningStatusRaw {
  userMasterKey?: { publicKey: string; trusted: boolean }
  selfSigningKey?: { publicKey: string; trusted: boolean }
  userSigningKey?: { publicKey: string; trusted: boolean }
}

interface KeyBackupInfoRaw {
  version: string
  algorithm: string
  auth_data?: {
    megolm_backup_info?: { count: number }
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface EncryptionConfig {
  algorithm: string
  [key: string]: unknown
}

interface EncryptionState {
  encrypted?: boolean
  trustState?: { trusted?: boolean }
  blacklistedUnverifiedDevices?: boolean
  blacklistedDevices?: string[]
  [key: string]: unknown
}

// Matrix event type definitions for better type safety
interface MatrixDeviceVerificationEvent {
  deviceId: string
  verified: boolean
  wasPreviouslyVerified?: boolean
  [key: string]: unknown
}

interface MatrixKeyBackupEvent {
  algorithm: string
  count: number
  authData?: Record<string, unknown>
  [key: string]: unknown
}

interface MatrixRoomKeyEvent {
  roomId?: string
  senderKey?: string
  sessionId?: string
  [key: string]: unknown
}

export interface Device {
  deviceId: string
  userId: string
  displayName?: string
  lastSeen?: number
  keys: {
    ed25519: string
    curve25519: string
  }
  algorithms: string[]
  verified: boolean
  blocked: boolean
}

export interface CrossSigningInfo {
  userMasterKey: {
    publicKey: string
    privateKey?: string
    trusted: boolean
  }
  selfSigningKey: {
    publicKey: string
    privateKey?: string
    trusted: boolean
  }
  userSigningKey: {
    publicKey: string
    privateKey?: string
    trusted: boolean
  }
}

export interface EncryptionEvent {
  type: 'device_verification' | 'key_request' | 'key_backup' | 'cross_signing'
  deviceId?: string
  userId?: string
  timestamp: number
  data: Record<string, unknown>
}

export interface KeyBackupInfo {
  version?: string
  algorithm: string
  authData?: Record<string, unknown>
  count: number
  etag?: string
  mac?: string
}

/**
 * Matrix E2EE管理器
 */
export class MatrixE2EEManager {
  private client: MatrixClient
  private devices = new Map<string, Device>()
  private crossSigningInfo: CrossSigningInfo | null = null
  private keyBackupInfo: KeyBackupInfo | null = null
  private eventListeners = new Map<string, Array<(...args: unknown[]) => void>>()

  constructor(client: MatrixClient) {
    this.client = client
    this.setupEventListeners()
  }

  /**
   * 初始化E2EE
   */
  async initialize(): Promise<boolean> {
    try {
      // 检查客户端是否支持E2EE
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      if (!cryptoClient.isCryptoEnabled?.()) {
        logger.warn('Client does not support end-to-end encryption')
        return false
      }

      // 等待客户端初始化
      await this.waitForClientInit()

      // 加载设备列表
      await this.loadDevices()

      // 加载交叉签名信息
      await this.loadCrossSigningInfo()

      // 检查密钥备份状态
      await this.checkKeyBackup()

      this.emit('e2ee:initialized', {})
      return true
    } catch (error) {
      logger.error('Failed to initialize E2EE:', error)
      this.emit('e2ee:error', { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 获取E2EE状态
   */
  getStatus(): {
    enabled: boolean
    deviceCount: number
    crossSigningEnabled: boolean
    keyBackupEnabled: boolean
    lastError?: string
  } {
    const cryptoClient = this.client as unknown as MatrixCryptoClient
    const crypto = cryptoClient.getCrypto?.()

    return {
      enabled: crypto?.isDeviceVerificationReady?.() || true,
      deviceCount: this.devices.size,
      crossSigningEnabled: this.crossSigningInfo?.userMasterKey?.trusted || false,
      keyBackupEnabled: !!this.keyBackupInfo
    }
  }

  /**
   * 获取用户的所有设备
   */
  async getUserDevices(userId: string): Promise<Device[]> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const devices = (await cryptoClient.getUserDevices?.(userId)) || []
      return devices.map((device: DeviceRaw): Device => {
        const result: Device = {
          deviceId: device.device_id,
          userId: device.user_id,
          keys: {
            ed25519: device.keys.ed25519,
            curve25519: device.keys.curve25519
          },
          algorithms: device.algorithms || [],
          verified: device.verified || false,
          blocked: device.verified === false
        }
        if (device.display_name !== undefined) {
          result.displayName = device.display_name
        }
        if (device.last_seen_ts !== undefined) {
          result.lastSeen = device.last_seen_ts
        }
        return result
      })
    } catch (error) {
      logger.error(`Failed to get devices for user ${userId}:`, error)
      return []
    }
  }

  /**
   * 获取设备列表
   */
  async getDeviceList(userId: string): Promise<Device[]> {
    return this.getUserDevices(userId)
  }

  /**
   * 验证设备
   */
  async verifyDevice(deviceId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const success = await cryptoClient.setDeviceVerified?.(deviceId, true)
      if (success) {
        const device = this.devices.get(deviceId)
        if (device) {
          device.verified = true
          device.blocked = false
        }
        this.emit('device:verified', { deviceId })
      }
      return success || false
    } catch (error) {
      logger.error(`Failed to verify device ${deviceId}:`, error)
      return false
    }
  }

  /**
   * 屏蔽设备
   */
  async blockDevice(deviceId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const success = await cryptoClient.setDeviceVerified?.(deviceId, false)
      if (success) {
        const device = this.devices.get(deviceId)
        if (device) {
          device.verified = false
          device.blocked = true
        }
        this.emit('device:blocked', { deviceId })
      }
      return success || false
    } catch (error) {
      logger.error(`Failed to block device ${deviceId}:`, error)
      return false
    }
  }

  /**
   * 请求设备验证
   */
  async requestDeviceVerification(deviceId: string, method: 'qrcode' | 'sas' = 'sas'): Promise<string | null> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const transactionId = await cryptoClient.requestDeviceVerification?.(deviceId, {
        method,
        from_device_id: cryptoClient.getDeviceId?.() || 'unknown'
      })

      this.emit('device:verification_requested', { deviceId, method, transactionId })
      return transactionId || null
    } catch (error) {
      logger.error(`Failed to request verification for device ${deviceId}:`, error)
      return null
    }
  }

  /**
   * 开始SAS验证
   */
  async startSASVerification(transactionId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      await cryptoClient.startDeviceVerification?.(transactionId)
      this.emit('sas:started', { transactionId })
      return true
    } catch (error) {
      logger.error(`Failed to start SAS verification for ${transactionId}:`, error)
      return false
    }
  }

  /**
   * 接受SAS验证
   */
  async acceptSASVerification(transactionId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      await cryptoClient.acceptVerification?.(transactionId)
      this.emit('sas:accepted', { transactionId })
      return true
    } catch (error) {
      logger.error(`Failed to accept SAS verification for ${transactionId}:`, error)
      return false
    }
  }

  /**
   * 确认SAS匹配
   */
  async confirmSASVerification(transactionId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      await cryptoClient.confirmVerification?.(transactionId)
      this.emit('sas:confirmed', { transactionId })
      return true
    } catch (error) {
      logger.error(`Failed to confirm SAS verification for ${transactionId}:`, error)
      return false
    }
  }

  /**
   * 生成二维码验证
   */
  async generateQRCode(transactionId: string): Promise<string | null> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const qrData = await cryptoClient.getQRCode?.(transactionId)
      this.emit('qrcode:generated', { transactionId, qrData })
      return qrData || null
    } catch (error) {
      logger.error(`Failed to generate QR code for ${transactionId}:`, error)
      return null
    }
  }

  /**
   * 扫描二维码验证
   */
  async scanQRCode(transactionId: string, qrData: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const success = await cryptoClient.scanQRCode?.(transactionId, qrData)
      if (success) {
        this.emit('qrcode:scanned', { transactionId })
      }
      return success || false
    } catch (error) {
      logger.error(`Failed to scan QR code for ${transactionId}:`, error)
      return false
    }
  }

  /**
   * 启用交叉签名
   */
  async enableCrossSigning(): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const success = await cryptoClient.bootstrapCrossSigning?.()
      if (success) {
        await this.loadCrossSigningInfo()
        this.emit('cross_signing:enabled', {})
      }
      return success || false
    } catch (error) {
      logger.error('Failed to enable cross signing:', error)
      return false
    }
  }

  /**
   * 重置交叉签名
   */
  async resetCrossSigning(): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const success = await cryptoClient.resetCrossSigning?.()
      if (success) {
        this.crossSigningInfo = null
        this.emit('cross_signing:reset', {})
      }
      return success || false
    } catch (error) {
      logger.error('Failed to reset cross signing:', error)
      return false
    }
  }

  /**
   * 检查交叉签名状态
   */
  async checkCrossSigning(): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const crypto = cryptoClient.getCrypto?.()
      if (!crypto) return false

      const crossSigningInfo = await crypto.getCrossSigningStatus()
      this.crossSigningInfo = {
        userMasterKey: {
          publicKey: crossSigningInfo.userMasterKey?.publicKey || '',
          trusted: crossSigningInfo.userMasterKey?.trusted || false
        },
        selfSigningKey: {
          publicKey: crossSigningInfo.selfSigningKey?.publicKey || '',
          trusted: crossSigningInfo.selfSigningKey?.trusted || false
        },
        userSigningKey: {
          publicKey: crossSigningInfo.userSigningKey?.publicKey || '',
          trusted: crossSigningInfo.userSigningKey?.trusted || false
        }
      }

      return this.crossSigningInfo.userMasterKey.trusted
    } catch (error) {
      logger.error('Failed to check cross signing status:', error)
      return false
    }
  }

  /**
   * 创建密钥备份
   */
  async createKeyBackup(passphrase?: string): Promise<string | null> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const backupInfo = await cryptoClient.prepareKeyBackupVersion?.(passphrase)
      if (backupInfo) {
        await cryptoClient.startKeyBackup?.(backupInfo)
        await this.checkKeyBackup()
        this.emit('key_backup:created', { backupInfo })
        return backupInfo.version
      }
      return null
    } catch (error) {
      logger.error('Failed to create key backup:', error)
      return null
    }
  }

  /**
   * 恢复密钥备份
   */
  async restoreKeyBackup(passphrase?: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const versions = await cryptoClient.getKeyBackupVersions?.()
      if (!versions || versions.length === 0) {
        throw new Error('No key backup versions found')
      }

      const latestVersion = versions[versions.length - 1]
      if (!latestVersion) {
        throw new Error('No key backup versions found')
      }
      const success = await cryptoClient.restoreKeyBackup?.(latestVersion, passphrase)

      if (success) {
        await this.checkKeyBackup()
        this.emit('key_backup:restored', { version: latestVersion?.version })
      }

      return success || false
    } catch (error) {
      logger.error('Failed to restore key backup:', error)
      return false
    }
  }

  /**
   * 删除密钥备份
   */
  async deleteKeyBackup(): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      await cryptoClient.deleteKeyBackupVersion?.()
      this.keyBackupInfo = null
      this.emit('key_backup:deleted', {})
      return true
    } catch (error) {
      logger.error('Failed to delete key backup:', error)
      return false
    }
  }

  /**
   * 获取加密状态
   */
  getRoomEncryptionStatus(roomId: string): {
    encrypted: boolean
    trusted: boolean
    blacklistedUnverifiedDevices: boolean
    blacklistedDevices: string[]
  } {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const crypto = cryptoClient.getCrypto?.()
      if (!crypto) {
        return {
          encrypted: false,
          trusted: false,
          blacklistedUnverifiedDevices: false,
          blacklistedDevices: []
        }
      }

      const status = crypto.getRoomEncryptionState(roomId)
      return {
        encrypted: status?.encrypted || false,
        trusted: status?.trustState?.trusted || false,
        blacklistedUnverifiedDevices: status?.blacklistedUnverifiedDevices || false,
        blacklistedDevices: status?.blacklistedDevices || []
      }
    } catch (error) {
      logger.error(`Failed to get encryption status for room ${roomId}:`, error)
      return {
        encrypted: false,
        trusted: false,
        blacklistedUnverifiedDevices: false,
        blacklistedDevices: []
      }
    }
  }

  /**
   * 获取加密统计
   */
  getEncryptionStats(): {
    totalDevices: number
    verifiedDevices: number
    blockedDevices: number
    encryptedRooms: number
    secureRooms: number
    keyBackupEnabled: boolean
  } {
    const verifiedDevices = Array.from(this.devices.values()).filter((d) => d.verified).length
    const blockedDevices = Array.from(this.devices.values()).filter((d) => d.blocked).length

    // 计算加密房间数量
    let encryptedRooms = 0
    let secureRooms = 0

    const cryptoClient = this.client as unknown as MatrixCryptoClient
    const rooms = cryptoClient.getRooms?.() || []
    for (const room of rooms) {
      const status = this.getRoomEncryptionStatus(room.roomId)
      if (status.encrypted) {
        encryptedRooms++
        if (status.trusted) {
          secureRooms++
        }
      }
    }

    return {
      totalDevices: this.devices.size,
      verifiedDevices,
      blockedDevices,
      encryptedRooms,
      secureRooms,
      keyBackupEnabled: !!this.keyBackupInfo
    }
  }

  // ========== 私有方法 ==========

  private setupEventListeners() {
    const cryptoClient = this.client as unknown as MatrixCryptoClient

    // 设备验证相关事件
    cryptoClient.on?.('deviceVerificationChanged', (event: unknown) => {
      const verificationEvent = event as MatrixDeviceVerificationEvent
      const { deviceId } = verificationEvent
      const device = this.devices.get(deviceId)
      if (device) {
        device.verified = verificationEvent.verified
        device.blocked = !verificationEvent.verified && !!verificationEvent.wasPreviouslyVerified
        this.emit('device:verification_changed', verificationEvent as Record<string, unknown>)
      }
    })

    // 加密相关事件
    cryptoClient.on?.('crypto.keyBackupStatus', (event: unknown) => {
      const backupEvent = event as MatrixKeyBackupEvent
      this.keyBackupInfo = {
        algorithm: backupEvent.algorithm,
        count: backupEvent.count
      }
      this.emit('key_backup:status_changed', backupEvent as Record<string, unknown>)
    })

    cryptoClient.on?.('crypto.roomKeyRequest', (event: unknown) => {
      const keyEvent = event as MatrixRoomKeyEvent
      this.emit('key_request', keyEvent as Record<string, unknown>)
    })

    cryptoClient.on?.('crypto.roomKeyRequestCancellation', (event: unknown) => {
      const keyEvent = event as MatrixRoomKeyEvent
      this.emit('key_request_cancelled', keyEvent as Record<string, unknown>)
    })
  }

  private async waitForClientInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      if (cryptoClient.isInitialSyncComplete?.()) {
        resolve()
        return
      }

      const checkInit = () => {
        if (cryptoClient.isInitialSyncComplete?.()) {
          resolve()
        } else {
          setTimeout(checkInit, 100)
        }
      }

      setTimeout(checkInit, 100)

      // 超时处理
      setTimeout(() => {
        reject(new Error('Client initialization timeout'))
      }, 30000)
    })
  }

  private async loadDevices(): Promise<void> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const deviceMap = await cryptoClient.getOwnDevices?.()
      this.devices.clear()

      deviceMap?.forEach((device: DeviceRaw, deviceId: string) => {
        const deviceInfo: Device = {
          deviceId,
          userId: device.user_id,
          keys: {
            ed25519: device.keys.ed25519,
            curve25519: device.keys.curve25519
          },
          algorithms: device.algorithms || [],
          verified: device.verified || false,
          blocked: false
        }
        if (device.display_name !== undefined) deviceInfo.displayName = device.display_name
        if (device.last_seen_ts !== undefined) deviceInfo.lastSeen = device.last_seen_ts
        this.devices.set(deviceId, deviceInfo)
      })
    } catch (error) {
      logger.error('Failed to load devices:', error)
    }
  }

  private async loadCrossSigningInfo(): Promise<void> {
    try {
      await this.checkCrossSigning()
    } catch (error) {
      logger.error('Failed to load cross signing info:', error)
    }
  }

  private async checkKeyBackup(): Promise<void> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      const backupInfo = await cryptoClient.getKeyBackupVersion?.()
      this.keyBackupInfo = backupInfo
        ? ({
            version: backupInfo.version,
            algorithm: backupInfo.algorithm,
            count: backupInfo.auth_data?.megolm_backup_info?.count || 0
          } as KeyBackupInfo)
        : null
    } catch (_error) {
      // 没有密钥备份是正常的
      this.keyBackupInfo = null
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        logger.error(`Error in E2EE event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 事件监听器管理
   */
  public addEventListener(event: string, listener: (...args: unknown[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  public removeEventListener(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 清理资源
   */
  public destroy() {
    this.devices.clear()
    this.crossSigningInfo = null
    this.keyBackupInfo = null
    this.eventListeners.clear()
  }

  public getKeyBackupInfo(): KeyBackupInfo | null {
    return this.keyBackupInfo
  }

  /**
   * 启用房间加密
   */
  async enableRoomEncryption(roomId: string): Promise<boolean> {
    try {
      const cryptoClient = this.client as unknown as MatrixCryptoClient
      await cryptoClient.setRoomEncryption?.(roomId, {
        algorithm: 'm.megolm.v1.aes-sha2'
      })
      this.emit('room:encryption_enabled', { roomId })
      return true
    } catch (error) {
      logger.error(`Failed to enable encryption for room ${roomId}:`, error)
      return false
    }
  }

  /**
   * 获取房间加密状态（扩展版本）
   */
  getRoomEncryptionStatusExtended(roomId: string): {
    encrypted: boolean
    trusted: boolean
    blacklistedUnverifiedDevices: boolean
    blacklistedDevices: string[]
    deviceCount: number
    verifiedDeviceCount: number
  } {
    const baseStatus = this.getRoomEncryptionStatus(roomId)
    return {
      ...baseStatus,
      deviceCount: this.devices.size,
      verifiedDeviceCount: Array.from(this.devices.values()).filter((d) => d.verified).length
    }
  }

  /**
   * 获取安全统计
   */
  getSecurityStats(): {
    totalDevices: number
    verifiedDevices: number
    blockedDevices: number
    encryptedRooms: number
    secureRooms: number
    keyBackupEnabled: boolean
    crossSigningEnabled: boolean
    securityLevel: 'low' | 'medium' | 'high'
  } {
    const stats = this.getEncryptionStats()
    const securityLevel = this.calculateSecurityLevel()

    return {
      ...stats,
      crossSigningEnabled: this.crossSigningInfo?.userMasterKey?.trusted || false,
      securityLevel
    }
  }

  /**
   * 计算安全级别
   */
  calculateSecurityLevel(): 'low' | 'medium' | 'high' {
    let score = 0

    // 加密房间比例 (30分)
    const cryptoClient = this.client as unknown as MatrixCryptoClient
    const totalRooms = cryptoClient.getRooms?.()?.length || 0
    if (totalRooms > 0) {
      const rooms = cryptoClient.getRooms?.() || []
      const encryptedRoomCount = rooms.filter(
        (room: RoomRaw) => this.getRoomEncryptionStatus(room.roomId).encrypted
      ).length
      score += Math.floor((encryptedRoomCount / totalRooms) * 30)
    }

    // 设备验证比例 (30分)
    if (this.devices.size > 0) {
      const verifiedCount = Array.from(this.devices.values()).filter((d) => d.verified).length
      score += Math.floor((verifiedCount / this.devices.size) * 30)
    }

    // 密钥备份 (20分)
    if (this.keyBackupInfo) {
      score += 20
    }

    // 交叉签名 (20分)
    if (this.crossSigningInfo?.userMasterKey?.trusted) {
      score += 20
    }

    if (score >= 80) return 'high'
    if (score >= 50) return 'medium'
    return 'low'
  }

  /**
   * 获取交叉签名状态
   */
  getCrossSigningStatus(): {
    enabled: boolean
    userMasterKey: {
      publicKey: string
      trusted: boolean
    } | null
    selfSigningKey: {
      publicKey: string
      trusted: boolean
    } | null
    userSigningKey: {
      publicKey: string
      trusted: boolean
    } | null
  } {
    if (!this.crossSigningInfo) {
      return {
        enabled: false,
        userMasterKey: null,
        selfSigningKey: null,
        userSigningKey: null
      }
    }

    return {
      enabled: this.crossSigningInfo.userMasterKey.trusted,
      userMasterKey: this.crossSigningInfo.userMasterKey,
      selfSigningKey: this.crossSigningInfo.selfSigningKey,
      userSigningKey: this.crossSigningInfo.userSigningKey
    }
  }
}

/**
 * 创建Matrix E2EE管理器
 */
export function createMatrixE2EEManager(client: MatrixClient): MatrixE2EEManager {
  return new MatrixE2EEManager(client)
}
