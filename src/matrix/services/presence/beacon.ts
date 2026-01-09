/**
 * Matrix Beacon Service
 * Handles real-time location sharing using Matrix Beacon (MSC 3488)
 *
 * @module services/matrixBeaconService
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Type definitions for Matrix SDK objects
interface MatrixClientLike {
  getUserId?(): string
  sendStateEvent?(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey: string
  ): Promise<unknown>
  sendEvent?(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>
  ): Promise<{ event_id?: string } | string>
  getRoom?(roomId: string): MatrixRoomLike | null
}

interface MatrixRoomLike {
  roomId: string
  currentState?: {
    getStateEvents?(eventType: string): Record<string, unknown> | unknown
  }
}

interface MatrixEventLike {
  getStateKey?(): string
  getContent?(): Record<string, unknown>
}

/**
 * Beacon 信息状态
 */
export interface BeaconInfo {
  description: string
  timeout: number // 毫秒
  live: boolean
  start: number
  expires?: number
}

/**
 * Beacon 位置数据
 */
export interface BeaconLocation {
  uri: string // geo:latitude,longitude
  description?: string
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp: number
}

/**
 * Beacon 完整信息
 */
export interface Beacon {
  id: string // beaconInfoId
  stateKey: string // userId:beaconId
  roomId: string
  ownerId: string
  info: BeaconInfo
  latestLocation?: BeaconLocation
  isLive: boolean
  isExpired: boolean
  remainingTime?: number // 剩余毫秒数
}

/**
 * 创建 Beacon 选项
 */
export interface CreateBeaconOptions {
  description?: string
  duration?: number // 持续时间（毫秒），默认 1 小时
  initialLocation?: BeaconLocation
}

/**
 * 监听 Beacon 更新的回调
 */
export type BeaconUpdateCallback = (beacon: Beacon) => void

/**
 * 监听位置更新的回调
 */
export type LocationUpdateCallback = (beaconId: string, location: BeaconLocation) => void

/**
 * 监听存活状态变化的回调
 */
export type LivenessChangeCallback = (beaconId: string, isLive: boolean) => void

/**
 * Matrix Beacon Service
 */
export class MatrixBeaconService {
  private static instance: MatrixBeaconService

  // 当前活跃的 Beacons
  private activeBeacons: Map<string, Beacon> = new Map()

  // 定时器集合
  private updateTimers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private expiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // 监听器
  private updateListeners: Map<string, Set<BeaconUpdateCallback>> = new Map()
  private locationListeners: Map<string, Set<LocationUpdateCallback>> = new Map()
  private livenessListeners: Map<string, Set<LivenessChangeCallback>> = new Map()

  static getInstance(): MatrixBeaconService {
    if (!MatrixBeaconService.instance) {
      MatrixBeaconService.instance = new MatrixBeaconService()
    }
    return MatrixBeaconService.instance
  }

  /**
   * 创建新的 Beacon
   */
  async createBeacon(roomId: string, options: CreateBeaconOptions = {}): Promise<string> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const userId = client.getUserId?.() || ''
    if (!userId) {
      throw new Error('User ID not available')
    }

    const beaconInfoId = `$${Date.now()}`
    const stateKey = `${userId}:${beaconInfoId}`

    const now = Date.now()
    const duration = options.duration || 3600000 // 默认 1 小时

    const beaconInfo: BeaconInfo = {
      description: options.description || 'Live Location',
      timeout: duration,
      live: true,
      start: now,
      expires: now + duration
    }

    // 发送 m.beacon_info 状态事件
    const sendStateEvent = client.sendStateEvent as
      | ((roomId: string, eventType: string, content: Record<string, unknown>, stateKey: string) => Promise<unknown>)
      | undefined

    await sendStateEvent?.(
      roomId,
      'm.beacon_info',
      {
        description: beaconInfo.description,
        timeout: beaconInfo.timeout,
        live: beaconInfo.live,
        start: beaconInfo.start,
        // MSC 3488 格式
        'org.matrix.msc3488.beacon_info': {
          description: beaconInfo.description,
          timeout: beaconInfo.timeout,
          live: beaconInfo.live
        }
      },
      stateKey
    )

    // 创建 Beacon 对象
    const beacon: Beacon = {
      id: beaconInfoId,
      stateKey,
      roomId,
      ownerId: userId,
      info: beaconInfo,
      latestLocation: options.initialLocation,
      isLive: true,
      isExpired: false,
      remainingTime: duration
    }

    this.activeBeacons.set(stateKey, beacon)

    // 设置过期定时器
    this.setExpiryTimer(stateKey, beacon)

    // 如果提供了初始位置，发送位置数据
    if (options.initialLocation) {
      await this.sendLocationUpdate(roomId, stateKey, options.initialLocation)
    }

    logger.info('[BeaconService] Beacon created', { beaconId: beaconInfoId, roomId, duration })

    return beaconInfoId
  }

  /**
   * 发送位置更新
   */
  async sendLocationUpdate(roomId: string, stateKey: string, location: BeaconLocation): Promise<void> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // 更新 Beacon 的最新位置
    const beacon = this.activeBeacons.get(stateKey)
    if (beacon) {
      beacon.latestLocation = location
      this.notifyLocationUpdate(stateKey, location)
    }

    // 发送 m.beacon 事件
    const sendEvent = client.sendEvent as
      | ((
          roomId: string,
          eventType: string,
          content: Record<string, unknown>
        ) => Promise<{ event_id?: string } | string>)
      | undefined

    await sendEvent?.(roomId, 'm.beacon', {
      'org.matrix.msc3488.location': {
        uri: location.uri,
        description: location.description || 'Current Location'
      },
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp
    })

    logger.debug('[BeaconService] Location update sent', { stateKey, location })
  }

  /**
   * 启动定期位置更新
   */
  async startLiveUpdates(
    roomId: string,
    beaconId: string,
    getPosition: () => Promise<BeaconLocation | null>,
    interval: number = 30000 // 默认 30 秒
  ): Promise<void> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    const userId = client?.getUserId?.() || ''
    const stateKey = `${userId}:${beaconId}`

    const beacon = this.activeBeacons.get(stateKey)
    if (!beacon) {
      throw new Error('Beacon not found')
    }

    // 清除现有定时器
    this.stopLiveUpdates(beaconId)

    // 立即发送一次位置
    const position = await getPosition()
    if (position) {
      await this.sendLocationUpdate(roomId, stateKey, position)
    }

    // 设置定期更新
    const timer = setInterval(async () => {
      const position = await getPosition()
      if (position) {
        await this.sendLocationUpdate(roomId, stateKey, position)
      }
    }, interval)

    this.updateTimers.set(beaconId, timer)

    logger.info('[BeaconService] Live updates started', { beaconId, roomId, interval })
  }

  /**
   * 停止定期位置更新
   */
  stopLiveUpdates(beaconId: string): void {
    const timer = this.updateTimers.get(beaconId)
    if (timer) {
      clearInterval(timer)
      this.updateTimers.delete(beaconId)
      logger.info('[BeaconService] Live updates stopped', { beaconId })
    }
  }

  /**
   * 停止 Beacon
   */
  async stopBeacon(roomId: string, beaconId: string): Promise<void> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    const userId = client?.getUserId?.() || ''
    const stateKey = `${userId}:${beaconId}`

    // 停止定期更新
    this.stopLiveUpdates(beaconId)

    // 清除过期定时器
    const expiryTimer = this.expiryTimers.get(stateKey)
    if (expiryTimer) {
      clearTimeout(expiryTimer)
      this.expiryTimers.delete(stateKey)
    }

    // 更新 Beacon 状态为非活跃
    const beacon = this.activeBeacons.get(stateKey)
    if (beacon) {
      beacon.isLive = false
      this.notifyLivenessChange(stateKey, false)
    }

    // 发送状态更新
    const sendStateEvent = client.sendStateEvent as
      | ((roomId: string, eventType: string, content: Record<string, unknown>, stateKey: string) => Promise<unknown>)
      | undefined

    await sendStateEvent?.(
      roomId,
      'm.beacon_info',
      {
        live: false
      },
      stateKey
    )

    logger.info('[BeaconService] Beacon stopped', { beaconId, roomId })
  }

  /**
   * 获取房间中的所有 Beacons
   */
  async getRoomBeacons(roomId: string): Promise<Beacon[]> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      return []
    }

    const getRoom = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
    const room = getRoom?.(roomId)
    if (!room) {
      return []
    }

    const currentState = room.currentState
    if (!currentState) {
      return []
    }

    // 获取所有 m.beacon_info 事件
    const getStateEvents = currentState.getStateEvents as ((eventType: string) => Record<string, unknown>) | undefined
    const beaconInfoEvents = getStateEvents?.('m.beacon_info') || {}

    const beacons: Beacon[] = []

    for (const [stateKey, event] of Object.entries(beaconInfoEvents)) {
      const eventLike = event as unknown as MatrixEventLike
      const content = eventLike.getContent?.()

      if (content && typeof content === 'object') {
        const info = content as Record<string, unknown>
        const beacon: Beacon = {
          id: stateKey.split(':')[1] || '',
          stateKey,
          roomId,
          ownerId: stateKey.split(':')[0] || '',
          info: {
            description: (info.description as string) || '',
            timeout: (info.timeout as number) || 3600000,
            live: (info.live as boolean) || false,
            start: (info.start as number) || Date.now(),
            expires: info.expires as number
          },
          isLive: (info.live as boolean) || false,
          isExpired: false
        }

        // 计算剩余时间
        if (beacon.info.expires) {
          const remaining = beacon.info.expires - Date.now()
          beacon.remainingTime = remaining > 0 ? remaining : 0
          beacon.isExpired = remaining <= 0
        }

        beacons.push(beacon)
      }
    }

    return beacons
  }

  /**
   * 获取活跃的 Beacons
   */
  getActiveBeacons(): Beacon[] {
    return Array.from(this.activeBeacons.values()).filter((b) => b.isLive && !b.isExpired)
  }

  /**
   * 获取特定 Beacon
   */
  getBeacon(beaconId: string): Beacon | undefined {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    const userId = client?.getUserId?.() || ''
    const stateKey = `${userId}:${beaconId}`
    return this.activeBeacons.get(stateKey)
  }

  /**
   * 设置过期定时器
   */
  private setExpiryTimer(stateKey: string, beacon: Beacon): void {
    const duration = beacon.info.timeout || 3600000

    const timer = setTimeout(async () => {
      // 标记为过期
      beacon.isLive = false
      beacon.isExpired = true

      // 通知监听器
      this.notifyLivenessChange(stateKey, false)

      logger.info('[BeaconService] Beacon expired', { stateKey })
    }, duration)

    this.expiryTimers.set(stateKey, timer)
  }

  /**
   * 监听 Beacon 更新
   */
  onUpdate(beaconId: string, callback: BeaconUpdateCallback): () => void {
    if (!this.updateListeners.has(beaconId)) {
      this.updateListeners.set(beaconId, new Set())
    }
    this.updateListeners.get(beaconId)!.add(callback)

    // 返回取消监听函数
    return () => {
      this.updateListeners.get(beaconId)?.delete(callback)
    }
  }

  /**
   * 监听位置更新
   */
  onLocationUpdate(beaconId: string, callback: LocationUpdateCallback): () => void {
    if (!this.locationListeners.has(beaconId)) {
      this.locationListeners.set(beaconId, new Set())
    }
    this.locationListeners.get(beaconId)!.add(callback)

    return () => {
      this.locationListeners.get(beaconId)?.delete(callback)
    }
  }

  /**
   * 监听存活状态变化
   */
  onLivenessChange(beaconId: string, callback: LivenessChangeCallback): () => void {
    if (!this.livenessListeners.has(beaconId)) {
      this.livenessListeners.set(beaconId, new Set())
    }
    this.livenessListeners.get(beaconId)!.add(callback)

    return () => {
      this.livenessListeners.get(beaconId)?.delete(callback)
    }
  }

  /**
   * 通知位置更新
   */
  private notifyLocationUpdate(stateKey: string, location: BeaconLocation): void {
    const beaconId = stateKey.split(':')[1]
    const listeners = this.locationListeners.get(beaconId)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(beaconId, location)
        } catch (error) {
          logger.error('[BeaconService] Error in location update callback:', error)
        }
      })
    }
  }

  /**
   * 通知存活状态变化
   */
  private notifyLivenessChange(stateKey: string, isLive: boolean): void {
    const beaconId = stateKey.split(':')[1]
    const listeners = this.livenessListeners.get(beaconId)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(beaconId, isLive)
        } catch (error) {
          logger.error('[BeaconService] Error in liveness change callback:', error)
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 停止所有定时器
    this.updateTimers.forEach((timer) => clearInterval(timer))
    this.expiryTimers.forEach((timer) => clearTimeout(timer))

    this.updateTimers.clear()
    this.expiryTimers.clear()

    // 清除所有监听器
    this.updateListeners.clear()
    this.locationListeners.clear()
    this.livenessListeners.clear()

    // 清除 Beacons
    this.activeBeacons.clear()

    logger.info('[BeaconService] Disposed')
  }
}

// 导出单例实例
export const matrixBeaconService = MatrixBeaconService.getInstance()

// 导出便捷函数
export async function createBeacon(roomId: string, options?: CreateBeaconOptions): Promise<string> {
  return matrixBeaconService.createBeacon(roomId, options)
}

export async function sendLocationUpdate(roomId: string, stateKey: string, location: BeaconLocation): Promise<void> {
  return matrixBeaconService.sendLocationUpdate(roomId, stateKey, location)
}

export async function startLiveUpdates(
  roomId: string,
  beaconId: string,
  getPosition: () => Promise<BeaconLocation | null>,
  interval?: number
): Promise<void> {
  return matrixBeaconService.startLiveUpdates(roomId, beaconId, getPosition, interval)
}

export function stopLiveUpdates(beaconId: string): void {
  matrixBeaconService.stopLiveUpdates(beaconId)
}

export async function stopBeacon(roomId: string, beaconId: string): Promise<void> {
  return matrixBeaconService.stopBeacon(roomId, beaconId)
}

export async function getRoomBeacons(roomId: string): Promise<Beacon[]> {
  return matrixBeaconService.getRoomBeacons(roomId)
}

export function getActiveBeacons(): Beacon[] {
  return matrixBeaconService.getActiveBeacons()
}

export function getBeacon(beaconId: string): Beacon | undefined {
  return matrixBeaconService.getBeacon(beaconId)
}
