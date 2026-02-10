import MatrixClientService from './MatrixClientService'
import { type MatrixClient } from 'matrix-js-sdk'

interface CrossSigningStatusInfo {
  enabled: boolean
  trusted: boolean
  needsBootstrap: boolean
}

interface UserVerificationStatus {
  userId: string
  verified: boolean
  devices: Array<{
    deviceId: string
    verified: boolean
    lastSeen: number
  }>
}

interface DeviceVerificationStatus {
  deviceId: string
  verified: boolean
  blocked: boolean
}

interface DeviceDisplayInfo {
  deviceId: string
  displayName: string
  lastSeen: number
  lastSeenIp: string
  isVerified: boolean
  isCurrentDevice: boolean
}

class MatrixCrossSigningService {
  private static instance: MatrixCrossSigningService

  static getInstance(): MatrixCrossSigningService {
    if (!MatrixCrossSigningService.instance) {
      MatrixCrossSigningService.instance = new MatrixCrossSigningService()
    }
    return MatrixCrossSigningService.instance
  }

  private getClient(): MatrixClient | null {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  async isCrossSigningEnabled(): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }
      return crypto.isCrossSigningReady()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to check cross signing:', error)
      }
      return false
    }
  }

  async enableCrossSigning(): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.bootstrapCrossSigning({
        setupNewCrossSigning: false
      })

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to enable cross signing:', error)
      }
      return false
    }
  }

  async bootstrapCrossSigning(authData?: { uploadDeviceSigningKeys: boolean }): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      const opts: { setupNewCrossSigning?: boolean } = {}
      if (authData?.uploadDeviceSigningKeys) {
        opts.setupNewCrossSigning = true
      }

      await crypto.bootstrapCrossSigning(opts)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to bootstrap cross signing:', error)
      }
      return false
    }
  }

  async setupCrossSigning(): Promise<boolean> {
    return this.enableCrossSigning()
  }

  async verifyDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      const userId = client.getUserId()
      if (userId) {
        await crypto.setDeviceVerified(userId, deviceId, true)
        return true
      }
      return false
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to verify device:', error)
      }
      return false
    }
  }

  async unverifyDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      const userId = client.getUserId()
      if (userId) {
        await crypto.setDeviceVerified(userId, deviceId, false)
        return true
      }
      return false
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to unverify device:', error)
      }
      return false
    }
  }

  async verifyAllDevices(): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return false
      }

      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices

      for (const device of devices) {
        if (device.device_id) {
          await client.getCrypto()?.setDeviceVerified(userId, device.device_id, true)
        }
      }

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to verify all devices:', error)
      }
      return false
    }
  }

  async verifyUser(userId: string, roomId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.requestVerificationDM(userId, roomId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to verify user:', error)
      }
      return false
    }
  }

  async getCrossSigningStatus(): Promise<CrossSigningStatusInfo> {
    const client = this.getClient()
    if (!client) {
      return { enabled: false, trusted: false, needsBootstrap: true }
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return { enabled: false, trusted: false, needsBootstrap: true }
      }

      const status = await crypto.getCrossSigningStatus()
      return {
        enabled: status.publicKeysOnDevice,
        trusted: status.privateKeysCachedLocally.masterKey,
        needsBootstrap: !status.publicKeysOnDevice
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to get status:', error)
      }
      return { enabled: false, trusted: false, needsBootstrap: true }
    }
  }

  async getVerifiedDeviceCount(): Promise<number> {
    const client = this.getClient()
    if (!client) {
      return 0
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return 0
      }

      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices
      let count = 0

      for (const device of devices) {
        const status = await client.getCrypto()?.getDeviceVerificationStatus(userId, device.device_id)
        if (status && 'verified' in status && status.verified) {
          count++
        }
      }

      return count
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to get device count:', error)
      }
      return 0
    }
  }

  async getUnverifiedDeviceCount(): Promise<number> {
    const client = this.getClient()
    if (!client) {
      return 0
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return 0
      }

      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices
      let count = 0

      for (const device of devices) {
        const status = await client.getCrypto()?.getDeviceVerificationStatus(userId, device.device_id)
        if (!status || !('verified' in status) || !status.verified) {
          count++
        }
      }

      return count
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to get unverified count:', error)
      }
      return 0
    }
  }

  async getUserVerificationStatus(userId: string): Promise<UserVerificationStatus> {
    const client = this.getClient()
    if (!client) {
      return { userId, verified: false, devices: [] }
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return { userId, verified: false, devices: [] }
      }

      const verificationStatus = await crypto.getUserVerificationStatus(userId)
      const devicesResult = await client.getDevices()

      return {
        userId,
        verified: verificationStatus.isVerified(),
        devices: devicesResult.devices.map((d: any) => ({
          deviceId: d.device_id,
          verified: false,
          lastSeen: d.last_seen_ts || Date.now()
        }))
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to get user status:', error)
      }
      return { userId, verified: false, devices: [] }
    }
  }

  async getDeviceVerificationStatus(deviceId: string): Promise<DeviceVerificationStatus> {
    const client = this.getClient()
    if (!client) {
      return { deviceId, verified: false, blocked: false }
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return { deviceId, verified: false, blocked: false }
      }

      const status = await client.getCrypto()?.getDeviceVerificationStatus(userId, deviceId)
      if (status) {
        return {
          deviceId,
          verified: 'verified' in status ? (status as { verified: boolean }).verified : false,
          blocked: 'blocked' in status ? (status as { blocked: boolean }).blocked : false
        }
      }

      return { deviceId, verified: false, blocked: false }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to get device status:', error)
      }
      return { deviceId, verified: false, blocked: false }
    }
  }

  async resetCrossSigning(): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.bootstrapCrossSigning({ setupNewCrossSigning: true })
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to reset cross signing:', error)
      }
      return false
    }
  }

  async deleteAllOtherDevices(): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const currentDeviceId = client.getDeviceId()
      if (!currentDeviceId) {
        return false
      }

      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices

      for (const device of devices) {
        if (device.device_id && device.device_id !== currentDeviceId) {
          await client.deleteDevice(device.device_id)
        }
      }

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to delete other devices:', error)
      }
      return false
    }
  }

  async blockDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return false
      }

      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.setDeviceVerified(userId, deviceId, false)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to block device:', error)
      }
      return false
    }
  }

  async unblockDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return false
      }

      const crypto = client.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.setDeviceVerified(userId, deviceId, true)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixCrossSigningService] Failed to unblock device:', error)
      }
      return false
    }
  }
}

export default MatrixCrossSigningService
export type { CrossSigningStatusInfo, UserVerificationStatus, DeviceVerificationStatus, DeviceDisplayInfo }
