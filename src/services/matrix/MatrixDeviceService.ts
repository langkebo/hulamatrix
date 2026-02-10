import MatrixClientService from './MatrixClientService'
import { type MatrixClient } from 'matrix-js-sdk'

interface DeviceInfo {
  deviceId: string
  displayName: string
  lastSeen: number
  lastSeenIp: string
  isVerified: boolean
  isCurrentDevice: boolean
}

interface DeviceListResponse {
  devices: DeviceInfo[]
}

class MatrixDeviceService {
  private static instance: MatrixDeviceService

  static getInstance(): MatrixDeviceService {
    if (!MatrixDeviceService.instance) {
      MatrixDeviceService.instance = new MatrixDeviceService()
    }
    return MatrixDeviceService.instance
  }

  private getClient(): MatrixClient | null {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  async getDeviceDisplayInfo(): Promise<DeviceInfo[]> {
    const client = this.getClient()
    if (!client) {
      return []
    }

    try {
      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices
      const currentDeviceId = client.getDeviceId()

      const deviceInfos: DeviceInfo[] = []

      for (const device of devices) {
        const crypto = client.getCrypto()
        let isVerified = false

        if (crypto) {
          const userId = client.getUserId()
          if (userId) {
            const status = await crypto.getDeviceVerificationStatus(userId, device.device_id)
            isVerified = status && 'verified' in status ? (status as { verified: boolean }).verified : false
          }
        }

        deviceInfos.push({
          deviceId: device.device_id,
          displayName: device.display_name || device.device_id,
          lastSeen: device.last_seen_ts || Date.now(),
          lastSeenIp: device.last_seen_ip || '',
          isVerified,
          isCurrentDevice: device.device_id === currentDeviceId
        })
      }

      return deviceInfos
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to get devices:', error)
      }
      return []
    }
  }

  async getDeviceList(): Promise<DeviceListResponse> {
    const devices = await this.getDeviceDisplayInfo()
    return { devices }
  }

  async getCurrentDevice(): Promise<DeviceInfo | null> {
    const client = this.getClient()
    if (!client) {
      return null
    }

    try {
      const deviceId = client.getDeviceId()
      if (!deviceId) {
        return null
      }

      const devicesResult = await client.getDevices()
      const devices = devicesResult.devices
      const currentDevice = devices.find((d: any) => d.device_id === deviceId)

      if (currentDevice) {
        return {
          deviceId: currentDevice.device_id,
          displayName: currentDevice.display_name || deviceId,
          lastSeen: currentDevice.last_seen_ts || Date.now(),
          lastSeenIp: currentDevice.last_seen_ip || '',
          isVerified: false,
          isCurrentDevice: true
        }
      }

      return {
        deviceId,
        displayName: deviceId,
        lastSeen: Date.now(),
        lastSeenIp: '',
        isVerified: false,
        isCurrentDevice: true
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to get current device:', error)
      }
      return null
    }
  }

  async renameDevice(deviceId: string, newName: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      await client.setDeviceDetails(deviceId, { display_name: newName })
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to rename device:', error)
      }
      return false
    }
  }

  async deleteDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      await client.deleteDevice(deviceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to delete device:', error)
      }
      return false
    }
  }

  async verifyDevice(deviceId: string): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const userId = client.getUserId()
      if (userId) {
        await client.getCrypto()?.setDeviceVerified(userId, deviceId, true)
        return true
      }
      return false
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to verify device:', error)
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
      const userId = client.getUserId()
      if (userId) {
        await client.getCrypto()?.setDeviceVerified(userId, deviceId, false)
        return true
      }
      return false
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to unverify device:', error)
      }
      return false
    }
  }

  async getDeviceVerificationStatus(deviceId: string): Promise<{
    verified: boolean
    blocked: boolean
  } | null> {
    const client = this.getClient()
    if (!client) {
      return null
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return null
      }

      const status = await client.getCrypto()?.getDeviceVerificationStatus(userId, deviceId)
      if (!status) {
        return null
      }

      return {
        verified: 'verified' in status ? (status as { verified: boolean }).verified : false,
        blocked: 'blocked' in status ? (status as { blocked: boolean }).blocked : false
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to get device status:', error)
      }
      return null
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
        if (device.device_id !== currentDeviceId) {
          await client.deleteDevice(device.device_id)
        }
      }

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDeviceService] Failed to delete all other devices:', error)
      }
      return false
    }
  }
}

export default MatrixDeviceService
export type { DeviceInfo, DeviceListResponse }
