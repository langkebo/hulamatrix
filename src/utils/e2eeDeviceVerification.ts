/**
 * E2EE 设备验证管理
 * 提供设备密钥验证、指纹比对、设备信任管理等功能
 *
 * @module utils/e2eeDeviceVerification
 */

import { logger } from '@/utils/logger'
import { sha256 } from './cryptoHelpers'

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备 ID */
  deviceId: string
  /** 用户 ID */
  userId: string
  /** 设备显示名称 */
  displayName?: string
  /** 设备公钥指纹 */
  fingerprint: string
  /** 验证状态 */
  verified: boolean
  /** 信任状态 */
  trusted: boolean
  /** 首次发现时间 */
  firstSeen: number
  /** 最后活跃时间 */
  lastSeen: number
}

/**
 * 设备验证请求
 */
export interface DeviceVerificationRequest {
  /** 请求 ID */
  requestId: string
  /** 发起用户 ID */
  fromUserId: string
  /** 目标用户 ID */
  toUserId: string
  /** 设备 ID */
  deviceId: string
  /** 验证方法 */
  method: 'sas' | 'qrcode' | 'manual'
  /** 请求状态 */
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  /** 创建时间 */
  createdAt: number
  /** 过期时间 */
  expiresAt: number
}

/**
 * SAS (Short Authentication String) 验证会话
 */
export interface SASVerificationSession {
  /** 会话 ID */
  sessionId: string
  /** 设备 ID */
  deviceId: string
  /** 验证字符串 */
  sasValues: {
    decimal: string[]
    emoji: string[]
  }
  /** 双方确认状态 */
  confirmed: {
    local: boolean
    remote: boolean
  }
  /** 创建时间 */
  createdAt: number
}

/**
 * 设备验证管理器
 */
export class E2EEDeviceVerificationManager {
  private devices: Map<string, DeviceInfo> = new Map()
  private verificationRequests: Map<string, DeviceVerificationRequest> = new Map()
  private sasSessions: Map<string, SASVerificationSession> = new Map()
  private myDeviceId: string = ''
  private myUserId: string = ''

  constructor(userId: string, deviceId: string) {
    this.myUserId = userId
    this.myDeviceId = deviceId
    this.loadFromStorage()
  }

  /**
   * 注册/更新设备信息
   */
  async registerDevice(device: Partial<DeviceInfo> & { userId: string; deviceId: string }): Promise<void> {
    const now = Date.now()
    const existing = this.devices.get(this.getDeviceKey(device.userId, device.deviceId))

    const deviceInfo: DeviceInfo = {
      deviceId: device.deviceId,
      userId: device.userId,
      displayName: device.displayName,
      fingerprint: device.fingerprint || (await this.generateFingerprint(device.deviceId)),
      verified: existing?.verified || false,
      trusted: existing?.trusted || false,
      firstSeen: existing?.firstSeen || now,
      lastSeen: now
    }

    this.devices.set(this.getDeviceKey(device.userId, device.deviceId), deviceInfo)
    await this.saveToStorage()

    logger.info('[E2EEDeviceVerification] Device registered', {
      userId: device.userId,
      deviceId: device.deviceId,
      verified: deviceInfo.verified
    })
  }

  /**
   * 生成设备指纹
   */
  private async generateFingerprint(deviceId: string): Promise<string> {
    // 使用设备 ID 和时间戳生成唯一指纹
    const data = `${deviceId}:${Date.now()}:${Math.random()}`
    return await sha256(data)
  }

  /**
   * 获取设备信息
   */
  getDevice(userId: string, deviceId: string): DeviceInfo | null {
    return this.devices.get(this.getDeviceKey(userId, deviceId)) || null
  }

  /**
   * 获取用户的所有设备
   */
  getUserDevices(userId: string): DeviceInfo[] {
    const devices: DeviceInfo[] = []
    for (const [_key, device] of this.devices.entries()) {
      if (device.userId === userId) {
        devices.push(device)
      }
    }
    return devices.sort((a, b) => a.lastSeen - b.lastSeen)
  }

  /**
   * 验证设备指纹（手动比对）
   */
  async verifyDevice(userId: string, deviceId: string, fingerprint: string): Promise<boolean> {
    const device = this.getDevice(userId, deviceId)
    if (!device) {
      logger.warn('[E2EEDeviceVerification] Device not found', { userId, deviceId })
      return false
    }

    const isValid = device.fingerprint === fingerprint
    if (isValid) {
      device.verified = true
      device.trusted = true
      await this.saveToStorage()
      logger.info('[E2EEDeviceVerification] Device verified', { userId, deviceId })
    } else {
      logger.warn('[E2EEDeviceVerification] Fingerprint mismatch', {
        userId,
        deviceId,
        expected: device.fingerprint,
        provided: fingerprint
      })
    }

    return isValid
  }

  /**
   * 创建 SAS 验证会话
   */
  async createSASSession(userId: string, deviceId: string): Promise<SASVerificationSession> {
    const sessionId = `sas_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

    // 生成 SAS 验证字符串
    const sasValues = await this.generateSASValues()

    const session: SASVerificationSession = {
      sessionId,
      deviceId: `${userId}:${deviceId}`,
      sasValues,
      confirmed: { local: false, remote: false },
      createdAt: Date.now()
    }

    this.sasSessions.set(sessionId, session)

    logger.info('[E2EEDeviceVerification] SAS session created', { sessionId, userId, deviceId })
    return session
  }

  /**
   * 生成 SAS 验证字符串
   */
  private async generateSASValues(): Promise<{ decimal: string[]; emoji: string[] }> {
    // 生成随机验证码
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)

    // 生成十进制验证码（3个数字，每个4位）
    const decimal: string[] = []
    for (let i = 0; i < 3; i++) {
      const value = ((randomBytes[i]! << 8) | randomBytes[i + 1]!) % 10000
      decimal.push(value.toString().padStart(4, '0'))
    }

    // 生成表情符号验证码（7个表情符号）
    const emojiList = [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🪱',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🪰',
      '🪲',
      '🪳',
      '🦗',
      '🕷️',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
      '🦐'
    ]

    const emoji: string[] = []
    for (let i = 12; i < 19; i++) {
      const index = randomBytes[i]! % emojiList.length
      emoji.push(emojiList[index]!)
    }

    return { decimal, emoji }
  }

  /**
   * 确认 SAS 验证（本地）
   */
  async confirmSAS(sessionId: string): Promise<boolean> {
    const session = this.sasSessions.get(sessionId)
    if (!session) {
      logger.warn('[E2EEDeviceVerification] SAS session not found', { sessionId })
      return false
    }

    session.confirmed.local = true

    // 如果双方都确认了，标记设备为已验证
    if (session.confirmed.local && session.confirmed.remote) {
      const [userId, deviceId] = session.deviceId.split(':')
      const device = this.getDevice(userId!, deviceId!)
      if (device) {
        device.verified = true
        device.trusted = true
        await this.saveToStorage()
        logger.info('[E2EEDeviceVerification] Device verified via SAS', { userId, deviceId })
      }
    }

    return true
  }

  /**
   * 取消设备验证
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    const device = this.getDevice(userId, deviceId)
    if (device) {
      device.verified = false
      device.trusted = false
      await this.saveToStorage()
      logger.info('[E2EEDeviceVerification] Device unverified', { userId, deviceId })
    }
  }

  /**
   * 阻止设备（标记为不受信任）
   */
  async blockDevice(userId: string, deviceId: string): Promise<void> {
    const device = this.getDevice(userId, deviceId)
    if (device) {
      device.trusted = false
      device.verified = false
      await this.saveToStorage()
      logger.warn('[E2EEDeviceVerification] Device blocked', { userId, deviceId })
    }
  }

  /**
   * 检查设备是否已验证
   */
  isDeviceVerified(userId: string, deviceId: string): boolean {
    const device = this.getDevice(userId, deviceId)
    return device?.verified || false
  }

  /**
   * 检查设备是否受信任
   */
  isDeviceTrusted(userId: string, deviceId: string): boolean {
    const device = this.getDevice(userId, deviceId)
    return device?.trusted || false
  }

  /**
   * 获取未验证的设备列表
   */
  getUnverifiedDevices(userId: string): DeviceInfo[] {
    const devices = this.getUserDevices(userId)
    return devices.filter((d) => !d.verified)
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values())
  }

  /**
   * 清理过期的验证请求
   */
  cleanupExpiredRequests(): void {
    const now = Date.now()
    for (const [requestId, request] of this.verificationRequests.entries()) {
      if (request.expiresAt < now) {
        this.verificationRequests.delete(requestId)
      }
    }
  }

  /**
   * 清理过期的 SAS 会话
   */
  cleanupExpiredSASSessions(): void {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10分钟

    for (const [sessionId, session] of this.sasSessions.entries()) {
      if (now - session.createdAt > maxAge) {
        this.sasSessions.delete(sessionId)
      }
    }
  }

  /**
   * 生成设备密钥
   */
  get deviceKey(): string {
    return `${this.myUserId}:${this.myDeviceId}`
  }

  /**
   * 获取设备唯一键
   */
  private getDeviceKey(userId: string, deviceId: string): string {
    return `${userId}:${deviceId}`
  }

  /**
   * 保存到本地存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        devices: Array.from(this.devices.entries()),
        myUserId: this.myUserId,
        myDeviceId: this.myDeviceId
      }
      localStorage.setItem('e2ee_devices', JSON.stringify(data))
    } catch (error) {
      logger.error('[E2EEDeviceVerification] Failed to save to storage', { error })
    }
  }

  /**
   * 从本地存储加载
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('e2ee_devices')
      if (data) {
        const parsed = JSON.parse(data)
        this.devices = new Map(parsed.devices || [])
        if (parsed.myUserId) this.myUserId = parsed.myUserId
        if (parsed.myDeviceId) this.myDeviceId = parsed.myDeviceId
      }
    } catch (error) {
      logger.error('[E2EEDeviceVerification] Failed to load from storage', { error })
    }
  }

  /**
   * 重置所有设备数据
   */
  async reset(): Promise<void> {
    this.devices.clear()
    this.verificationRequests.clear()
    this.sasSessions.clear()
    localStorage.removeItem('e2ee_devices')
    logger.warn('[E2EEDeviceVerification] All device data reset')
  }
}

/**
 * 创建设备验证管理器实例
 */
export function createDeviceVerificationManager(userId: string, deviceId: string): E2EEDeviceVerificationManager {
  return new E2EEDeviceVerificationManager(userId, deviceId)
}
