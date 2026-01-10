/**
 * E2EE (End-to-End Encryption) 相关功能 Hook
 * 提供设备管理、加密状态管理等功能
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

// Crypto API interfaces
interface CryptoApi {
  getUserDeviceInfo?(userIds: string[]): Promise<Map<string, DeviceInfo[]> | undefined>
  setDeviceVerification?(deviceId: string, verified: boolean): Promise<void>
  setDeviceBlocked?(deviceId: string, blocked: boolean): Promise<void>
  getDeviceVerificationStatus?(deviceId: string): Promise<DeviceVerificationResult>
}

export interface E2EEState {
  isEnabled: boolean
  isDeviceVerified: boolean
  deviceCount: number
  verifiedDeviceCount: number
  blockedDeviceCount: number
}

export interface DeviceInfo {
  deviceId: string
  isVerified(): boolean
  isBlocked(): boolean
}

export interface DeviceVerificationResult {
  success: boolean
  deviceId: string
  verified: boolean
  error?: string
}

export function useE2EE() {
  const client = ref<any>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // E2EE状态
  const e2eeState = ref<E2EEState>({
    isEnabled: false,
    isDeviceVerified: false,
    deviceCount: 0,
    verifiedDeviceCount: 0,
    blockedDeviceCount: 0
  })

  // 计算属性
  const isE2EEEnabled = computed(() => e2eeState.value.isEnabled)
  const deviceVerificationProgress = computed(() => {
    if (e2eeState.value.deviceCount === 0) return 0
    return (e2eeState.value.verifiedDeviceCount / e2eeState.value.deviceCount) * 100
  })

  /**
   * 初始化E2EE
   */
  const initializeE2EE = async (matrixClient: any) => {
    client.value = matrixClient
    isLoading.value = true
    error.value = null

    try {
      // 检查E2EE是否启用
      const crypto = matrixClient.getCrypto()
      if (crypto) {
        e2eeState.value.isEnabled = true

        // 获取设备信息
        await loadDeviceInfo()
      } else {
        e2eeState.value.isEnabled = false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'E2EE初始化失败'
      logger.error('E2EE initialization failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载设备信息
   */
  const loadDeviceInfo = async () => {
    if (!client.value) return

    try {
      const crypto = client.value.getCrypto()
      if (!crypto) return

      // 获取当前用户的设备列表
      const deviceId = client.value?.getDeviceId?.()
      const userId = client.value?.getUserId?.()

      if (deviceId && userId) {
        const cryptoApi = crypto as unknown as CryptoApi
        const devices = await cryptoApi.getUserDeviceInfo?.([userId])
        const userDevices = devices?.get?.(userId) || []

        e2eeState.value.deviceCount = userDevices.length
        e2eeState.value.verifiedDeviceCount = userDevices.filter((d: DeviceInfo) => d.isVerified()).length
        e2eeState.value.blockedDeviceCount = userDevices.filter((d: DeviceInfo) => d.isBlocked()).length

        // 检查当前设备是否已验证
        const currentDevice = userDevices.find((d: DeviceInfo) => d.deviceId === deviceId)
        e2eeState.value.isDeviceVerified = currentDevice?.isVerified() || false
      }
    } catch (err) {
      logger.error('Failed to load device info:', err)
      error.value = err instanceof Error ? err.message : '加载设备信息失败'
    }
  }

  /**
   * 验证设备
   */
  const verifyDevice = async (deviceId: string): Promise<DeviceVerificationResult> => {
    if (!client.value) {
      return {
        success: false,
        deviceId,
        verified: false,
        error: 'Matrix客户端未初始化'
      }
    }

    try {
      const crypto = client.value.getCrypto()
      if (!crypto) {
        return {
          success: false,
          deviceId,
          verified: false,
          error: '加密功能未启用'
        }
      }

      // 设置设备为已验证
      const cryptoApi = crypto as unknown as CryptoApi
      await cryptoApi.setDeviceVerification?.(deviceId, true)

      // 刷新设备信息
      await loadDeviceInfo()

      return {
        success: true,
        deviceId,
        verified: true
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '设备验证失败'
      error.value = errorMessage

      return {
        success: false,
        deviceId,
        verified: false,
        error: errorMessage
      }
    }
  }

  /**
   * 取消设备验证
   */
  const unverifyDevice = async (deviceId: string): Promise<DeviceVerificationResult> => {
    if (!client.value) {
      return {
        success: false,
        deviceId,
        verified: false,
        error: 'Matrix客户端未初始化'
      }
    }

    try {
      const crypto = client.value.getCrypto()
      if (!crypto) {
        return {
          success: false,
          deviceId,
          verified: false,
          error: '加密功能未启用'
        }
      }

      // 设置设备为未验证
      const cryptoApi = crypto as unknown as CryptoApi
      await cryptoApi.setDeviceVerification?.(deviceId, false)

      // 刷新设备信息
      await loadDeviceInfo()

      return {
        success: true,
        deviceId,
        verified: false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消设备验证失败'
      error.value = errorMessage

      return {
        success: false,
        deviceId,
        verified: false,
        error: errorMessage
      }
    }
  }

  /**
   * 屏蔽设备
   */
  const blockDevice = async (deviceId: string): Promise<DeviceVerificationResult> => {
    if (!client.value) {
      return {
        success: false,
        deviceId,
        verified: false,
        error: 'Matrix客户端未初始化'
      }
    }

    try {
      const crypto = client.value.getCrypto()
      if (!crypto) {
        return {
          success: false,
          deviceId,
          verified: false,
          error: '加密功能未启用'
        }
      }

      // 屏蔽设备
      const cryptoApi = crypto as unknown as CryptoApi
      await cryptoApi.setDeviceBlocked?.(deviceId, true)

      // 刷新设备信息
      await loadDeviceInfo()

      return {
        success: true,
        deviceId,
        verified: false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '设备屏蔽失败'
      error.value = errorMessage

      return {
        success: false,
        deviceId,
        verified: false,
        error: errorMessage
      }
    }
  }

  /**
   * 取消设备屏蔽
   */
  const unblockDevice = async (deviceId: string): Promise<DeviceVerificationResult> => {
    if (!client.value) {
      return {
        success: false,
        deviceId,
        verified: false,
        error: 'Matrix客户端未初始化'
      }
    }

    try {
      const crypto = client.value.getCrypto()
      if (!crypto) {
        return {
          success: false,
          deviceId,
          verified: false,
          error: '加密功能未启用'
        }
      }

      // 取消屏蔽设备
      const cryptoApi = crypto as unknown as CryptoApi
      await cryptoApi.setDeviceBlocked?.(deviceId, false)

      // 刷新设备信息
      await loadDeviceInfo()

      return {
        success: true,
        deviceId,
        verified: false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消设备屏蔽失败'
      error.value = errorMessage

      return {
        success: false,
        deviceId,
        verified: false,
        error: errorMessage
      }
    }
  }

  /**
   * 重置E2EE状态
   */
  const resetE2EE = () => {
    client.value = null
    error.value = null
    e2eeState.value = {
      isEnabled: false,
      isDeviceVerified: false,
      deviceCount: 0,
      verifiedDeviceCount: 0,
      blockedDeviceCount: 0
    }
  }

  return {
    // 状态
    isLoading,
    error,
    e2eeState,

    // 计算属性
    isE2EEEnabled,
    deviceVerificationProgress,

    // 方法
    initializeE2EE,
    loadDeviceInfo,
    verifyDevice,
    unverifyDevice,
    blockDevice,
    unblockDevice,
    resetE2EE
  }
}
