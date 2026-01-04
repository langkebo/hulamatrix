import { logger } from '@/utils/logger'

/**
 * Matrix 加密相关功能
 */

// Type definitions for Matrix SDK client and crypto
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
  getState(eventType: string): MatrixRoomState | undefined
  sendSharedHistoryKeys?(): Promise<void>
  [key: string]: unknown
}

interface DeviceTrustLevel {
  isVerified?: boolean
  [key: string]: unknown
}

interface MatrixClient {
  getRoom(roomId: string): MatrixRoom | undefined
  getDeviceId(): string
  getUserId(): string
  getStoredDevicesForUser(userId: string): Promise<MatrixDevice[] | undefined>
  checkDeviceTrust(userId: string, deviceId: string): DeviceTrustLevel | undefined
  setDeviceVerified(userId: string, deviceId: string, verified: boolean): Promise<void>
  setRoomEncryption(roomId: string, config: Record<string, unknown>): Promise<void>
  resetDeviceOutboundRoomAlgorithm(roomId: string): Promise<void>
  [key: string]: unknown
}

interface RoomEncryptionConfig {
  algorithm?: string
  rotation_period_ms?: number
  rotation_period_msgs?: number
  [key: string]: unknown
}

interface CheckRoomEncryptionResult {
  isEncrypted: boolean
  algorithm?: string
  deviceId?: string
  isDeviceTrusted?: boolean
}

/**
 * 检查房间是否启用加密
 */
export async function checkRoomEncryption(client: MatrixClient, roomId: string): Promise<CheckRoomEncryptionResult> {
  try {
    const room = client.getRoom(roomId)
    if (!room) {
      return { isEncrypted: false }
    }

    // 检查房间是否启用了端到端加密
    const isEncrypted = room.hasEncryptionState?.() || !!room.getEncryptionTargetMembers?.()

    if (isEncrypted) {
      // 获取加密算法
      const algorithm = room.getState('m.room.encryption')?.getContent?.()?.algorithm

      // 获取当前设备ID
      const deviceId = client.getDeviceId()

      // 检查设备是否被信任
      const isDeviceTrusted = await checkDeviceTrust(client, client.getUserId(), deviceId)

      return {
        isEncrypted: true,
        algorithm,
        deviceId,
        isDeviceTrusted
      }
    }

    return { isEncrypted: false }
  } catch (error) {
    logger.error('Failed to check room encryption:', error)
    return { isEncrypted: false }
  }
}

/**
 * 检查设备是否被信任
 */
export async function checkDeviceTrust(client: MatrixClient, userId: string, deviceId: string): Promise<boolean> {
  try {
    // 获取设备列表
    const devices = await client.getStoredDevicesForUser(userId)
    const device = devices?.find((d: MatrixDevice) => d.deviceId === deviceId)

    if (!device) {
      return false
    }

    // 检查设备是否已验证
    const deviceTrustLevel = client.checkDeviceTrust(userId, deviceId)
    return deviceTrustLevel?.isVerified || false
  } catch (error) {
    logger.error('Failed to check device trust:', error)
    return false
  }
}

/**
 * 验证设备
 */
export async function verifyDevice(client: MatrixClient, userId: string, deviceId: string): Promise<void> {
  try {
    await client.setDeviceVerified(userId, deviceId, true)
  } catch (error) {
    logger.error('Failed to verify device:', error)
    throw error
  }
}

/**
 * 取消验证设备
 */
export async function unverifyDevice(client: MatrixClient, userId: string, deviceId: string): Promise<void> {
  try {
    await client.setDeviceVerified(userId, deviceId, false)
  } catch (error) {
    logger.error('Failed to unverify device:', error)
    throw error
  }
}

/**
 * 获取房间的加密配置
 */
export async function getRoomEncryptionConfig(
  client: MatrixClient,
  roomId: string
): Promise<RoomEncryptionConfig | null> {
  try {
    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }

    const state = room.getState('m.room.encryption')
    return state?.getContent?.() || null
  } catch (error) {
    logger.error('Failed to get room encryption config:', error)
    return null
  }
}

/**
 * 启用房间加密
 */
export async function enableRoomEncryption(
  client: MatrixClient,
  roomId: string,
  algorithm: string = 'm.megolm.v1.aes-sha2'
): Promise<void> {
  try {
    await client.setRoomEncryption(roomId, {
      algorithm,
      rotation_period_ms: 604800000, // 7天
      rotation_period_msgs: 100
    })
  } catch (error) {
    logger.error('Failed to enable room encryption:', error)
    throw error
  }
}

/**
 * 重新发送加密密钥
 */
export async function resendRoomKeys(client: MatrixClient, roomId: string): Promise<void> {
  try {
    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error('Room not found')
    }

    // 重新发送房间的加密密钥给未收到密钥的设备
    await room.sendSharedHistoryKeys?.()
  } catch (error) {
    logger.error('Failed to resend room keys:', error)
    throw error
  }
}

/**
 * 重置会话加密
 */
export async function resetSessionEncryption(client: MatrixClient, roomId: string): Promise<void> {
  try {
    // 重置设备的出站会话
    await client.resetDeviceOutboundRoomAlgorithm(roomId)
  } catch (error) {
    logger.error('Failed to reset session encryption:', error)
    throw error
  }
}
