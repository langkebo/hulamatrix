import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import type { MatrixClient } from 'matrix-js-sdk'
import type { Device, CrossSigningInfo, KeyBackupInfo } from '@/integrations/matrix/e2ee'

export const useE2EEStore = defineStore('e2ee', () => {
  // 基础状态
  const available = ref(false)
  const enabled = ref(false)
  const initialized = ref(false)
  const lastError = ref<string | null>(null)
  const isLoading = ref(false)

  // 设备相关
  const devices = ref<Map<string, Device>>(new Map())
  const crossSigningInfo = ref<CrossSigningInfo | null>(null)
  const keyBackupInfo = ref<KeyBackupInfo | null>(null)

  // 统计信息
  const stats = ref({
    totalDevices: 0,
    verifiedDevices: 0,
    blockedDevices: 0,
    encryptedRooms: 0,
    secureRooms: 0,
    keyBackupEnabled: false
  })

  // 计算属性
  const deviceVerificationProgress = computed(() => {
    if (stats.value.totalDevices === 0) return 0
    return Math.round((stats.value.verifiedDevices / stats.value.totalDevices) * 100)
  })

  const isSecure = computed(() => {
    return (
      stats.value.verifiedDevices > 0 && stats.value.keyBackupEnabled && crossSigningInfo.value?.userMasterKey?.trusted
    )
  })

  const securityLevel = computed(() => {
    if (!isSecure.value) return 'low'
    if (stats.value.verifiedDevices === stats.value.totalDevices && stats.value.keyBackupEnabled) return 'high'
    return 'medium'
  })

  // 设置方法
  const setAvailable = (v: boolean) => (available.value = v)
  const setEnabled = (v: boolean) => (enabled.value = v)
  const setInitialized = (v: boolean) => (initialized.value = v)
  const setError = (e: string | null) => (lastError.value = e)
  const setLoading = (v: boolean) => (isLoading.value = v)

  // 更新设备列表
  const updateDevices = (deviceList: Device[]) => {
    devices.value.clear()
    deviceList.forEach((device) => {
      devices.value.set(device.deviceId, device)
    })

    // 更新统计
    stats.value.totalDevices = deviceList.length
    stats.value.verifiedDevices = deviceList.filter((d) => d.verified).length
    stats.value.blockedDevices = deviceList.filter((d) => d.blocked).length
  }

  // 更新单个设备
  const updateDevice = (deviceId: string, updates: Partial<Device>) => {
    const device = devices.value.get(deviceId)
    if (device) {
      devices.value.set(deviceId, { ...device, ...updates })

      // 重新计算统计
      const deviceList = Array.from(devices.value.values())
      stats.value.totalDevices = deviceList.length
      stats.value.verifiedDevices = deviceList.filter((d) => d.verified).length
      stats.value.blockedDevices = deviceList.filter((d) => d.blocked).length
    }
  }

  // 更新交叉签名信息
  const updateCrossSigningInfo = (info: CrossSigningInfo | null) => {
    crossSigningInfo.value = info
  }

  // 更新密钥备份信息
  const updateKeyBackupInfo = (info: KeyBackupInfo | null) => {
    keyBackupInfo.value = info
    stats.value.keyBackupEnabled = !!info
  }

  // 更新房间加密统计
  const updateRoomStats = (encryptedRooms: number, secureRooms: number) => {
    stats.value.encryptedRooms = encryptedRooms
    stats.value.secureRooms = secureRooms
  }

  // 获取设备
  const getDevice = (deviceId: string): Device | undefined => {
    return devices.value.get(deviceId)
  }

  // 获取所有设备
  const getAllDevices = (): Device[] => {
    return Array.from(devices.value.values())
  }

  // 获取已验证设备
  const getVerifiedDevices = (): Device[] => {
    return getAllDevices().filter((d) => d.verified)
  }

  // 获取未验证设备
  const getUnverifiedDevices = (): Device[] => {
    return getAllDevices().filter((d) => !d.verified && !d.blocked)
  }

  // 获取被屏蔽设备
  const getBlockedDevices = (): Device[] => {
    return getAllDevices().filter((d) => d.blocked)
  }

  // 检查设备是否已验证
  const isDeviceVerified = (deviceId: string): boolean => {
    const device = devices.value.get(deviceId)
    return device?.verified || false
  }

  // 检查设备是否被屏蔽
  const isDeviceBlocked = (deviceId: string): boolean => {
    const device = devices.value.get(deviceId)
    return device?.blocked || false
  }

  // 重置状态
  const reset = () => {
    available.value = false
    enabled.value = false
    initialized.value = false
    lastError.value = null
    isLoading.value = false
    devices.value.clear()
    crossSigningInfo.value = null
    keyBackupInfo.value = null
    stats.value = {
      totalDevices: 0,
      verifiedDevices: 0,
      blockedDevices: 0,
      encryptedRooms: 0,
      secureRooms: 0,
      keyBackupEnabled: false
    }
  }

  // 初始化E2EE
  const initialize = async (client: MatrixClient) => {
    setLoading(true)
    setError(null)

    try {
      // 动态导入E2EE管理器
      const { createMatrixE2EEManager } = await import('@/integrations/matrix/e2ee')
      const e2eeManager = createMatrixE2EEManager(client)

      // 初始化E2EE
      const success = await e2eeManager.initialize()
      if (!success) {
        throw new Error('Failed to initialize E2EE')
      }

      // 获取状态
      const status = e2eeManager.getStatus()
      setAvailable(true)
      setEnabled(status.enabled)
      setInitialized(true)

      // 获取设备列表
      const clientLike = client as unknown as { getUserId?: () => string }
      const userId = clientLike.getUserId?.()
      if (userId) {
        const userDevices = await e2eeManager.getUserDevices(userId)
        updateDevices(userDevices)
      }

      // 获取交叉签名信息
      const _crossSigningEnabled = await e2eeManager.checkCrossSigning()
      // 更新交叉签名信息到 store
      const crossSigningStatus = e2eeManager.getCrossSigningStatus()
      updateCrossSigningInfo(
        crossSigningStatus.enabled
          ? {
              userMasterKey: crossSigningStatus.userMasterKey || { publicKey: '', trusted: false },
              selfSigningKey: crossSigningStatus.selfSigningKey || { publicKey: '', trusted: false },
              userSigningKey: crossSigningStatus.userSigningKey || { publicKey: '', trusted: false }
            }
          : null
      )

      // 获取加密统计
      const encryptionStats = e2eeManager.getEncryptionStats()
      updateRoomStats(encryptionStats.encryptedRooms, encryptionStats.secureRooms)

      logger.info('[E2EE Store] Initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      logger.error('[E2EE Store] Initialization failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    // 状态
    available,
    enabled,
    initialized,
    lastError,
    isLoading,
    devices,
    crossSigningInfo,
    keyBackupInfo,
    stats,

    // 计算属性
    deviceVerificationProgress,
    isSecure,
    securityLevel,

    // 设置方法
    setAvailable,
    setEnabled,
    setInitialized,
    setError,
    setLoading,

    // 更新方法
    updateDevices,
    updateDevice,
    updateCrossSigningInfo,
    updateKeyBackupInfo,
    updateRoomStats,

    // 获取方法
    getDevice,
    getAllDevices,
    getVerifiedDevices,
    getUnverifiedDevices,
    getBlockedDevices,
    isDeviceVerified,
    isDeviceBlocked,

    // 操作方法
    initialize,
    reset
  }
})
