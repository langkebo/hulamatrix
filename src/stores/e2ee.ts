import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

// Matrix SDK 类型定义（兼容性处理）
interface MatrixClientCompat {
  getUserId?(): string
  getUser?(userId: string): { userId: string } | null
  getDeviceId?(): string
  getDevice?(deviceId: string): { deviceId: string } | null
  deleteDevice(deviceId: string): Promise<void>
  getStoredDevicesForUser?(
    userId: string
  ): Array<{ deviceId: string; displayName?: string; verified?: boolean; blocked?: boolean; lastSeenTs?: number }>
}

interface CryptoApiCompat {
  getCrossSigningId?(): { masterKey?: string; userSigningKey?: string; selfSigningKey?: string }
  getCrossSigningKeyId?(): { masterKey?: string; userSigningKey?: string; selfSigningKey?: string }
  checkKeyBackupAndEnable?():
    | { version?: string; backupVersion?: string }
    | PromiseLike<{ version?: string; backupVersion?: string }>
  isKeyBackupTrusted?(backupInfo: {
    version?: string
  }): { usable?: boolean; trusted_locally?: boolean } | PromiseLike<{ usable?: boolean; trusted_locally?: boolean }>
  getBackupKeyCount?(): number | PromiseLike<number>
  resetKeyBackup?():
    | { version?: string; backupVersion?: string; recoveryKey?: string; recovery_key?: string }
    | PromiseLike<{ version?: string; backupVersion?: string; recoveryKey?: string; recovery_key?: string }>
  restoreKeyBackupWithRecoveryKey?(
    key: string
  ): { imported?: number; total?: number } | PromiseLike<{ imported?: number; total?: number }>
  setDeviceVerified?(userId: string, deviceId: string): void | PromiseLike<void>
  setDeviceBlocked?(userId: string, deviceId: string, blocked: boolean): void | PromiseLike<void>
}

/**
 * E2EE Store - 端到端加密状态管理
 */

interface CrossSigningInfo {
  userMasterKey?: {
    publicKey: string
    trusted: boolean
  }
  userSigningKey?: {
    publicKey: string
    trusted: boolean
  }
  selfSigningKey?: {
    publicKey: string
    trusted: boolean
  }
}

interface E2EEStats {
  keyBackupEnabled: boolean
  keyBackupVersion?: string
  keyCount?: number
  trustInfo?: {
    usable: boolean
    trusted: boolean
  }
}

interface DeviceInfo {
  deviceId: string
  userId?: string
  displayName?: string
  verified: boolean
  blocked?: boolean
  lastSeenTs?: number
}

export const useE2EEStore = defineStore('e2ee', () => {
  const initialized = ref(false)
  const enabled = ref(false)
  const crossSigningInfo = ref<CrossSigningInfo | null>(null)
  const stats = ref<E2EEStats>({ keyBackupEnabled: false })
  const devices = ref<Map<string, DeviceInfo[]>>(new Map())

  const isReady = computed(() => initialized.value && enabled.value)
  const hasBackup = computed(() => stats.value.keyBackupEnabled)
  const isCrossSigningReady = computed(() => crossSigningInfo.value?.userMasterKey?.trusted || false)
  // Alias for compatibility
  const available = computed(() => enabled.value)

  async function initialize(): Promise<void> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      enabled.value = !!crypto

      if (crypto) {
        await loadCrossSigningInfo()
        await loadKeyBackupStatus()
        await loadAllDevices()
        initialized.value = true
        logger.info('[E2EEStore] E2EE initialized')
      }
    } catch (error) {
      logger.error('[E2EEStore] Failed to initialize:', error)
    }
  }

  async function loadCrossSigningInfo(): Promise<void> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return

      // 尝试不同的 API
      const crossSigning = crypto.getCrossSigningId?.() || crypto.getCrossSigningKeyId?.()
      if (crossSigning) {
        crossSigningInfo.value = {
          userMasterKey: { publicKey: crossSigning.masterKey || '', trusted: true },
          userSigningKey: { publicKey: crossSigning.userSigningKey || '', trusted: true },
          selfSigningKey: { publicKey: crossSigning.selfSigningKey || '', trusted: true }
        }
      }
    } catch (error) {
      logger.error('[E2EEStore] Failed to load cross-signing:', error)
    }
  }

  async function loadKeyBackupStatus(): Promise<void> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return

      const backupInfo = await crypto.checkKeyBackupAndEnable?.()
      if (backupInfo) {
        const backupTrust = await crypto.isKeyBackupTrusted?.({
          version: backupInfo.version || backupInfo.backupVersion
        })
        const keyCount = await crypto.getBackupKeyCount?.()
        stats.value = {
          keyBackupEnabled: true,
          keyBackupVersion: backupInfo.version || backupInfo.backupVersion,
          keyCount,
          trustInfo: {
            usable: backupTrust?.usable ?? false,
            trusted: backupTrust?.trusted_locally ?? false
          }
        }
      }
    } catch (error) {
      logger.error('[E2EEStore] Failed to load backup status:', error)
    }
  }

  async function loadAllDevices(): Promise<void> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return

      const userId = client.getUserId?.()
      if (!userId) return

      const deviceList = client.getStoredDevicesForUser?.(userId) || []
      const deviceInfos: DeviceInfo[] = deviceList.map(
        (device: {
          deviceId: string
          displayName?: string
          verified?: boolean
          blocked?: boolean
          lastSeenTs?: number
        }) => ({
          deviceId: device.deviceId,
          userId,
          displayName: device.displayName,
          verified: device.verified || false,
          blocked: device.blocked || false,
          lastSeenTs: device.lastSeenTs
        })
      )
      devices.value.set(userId, deviceInfos)
    } catch (error) {
      logger.error('[E2EEStore] Failed to load devices:', error)
    }
  }

  async function createKeyBackup(): Promise<{ version: string; recoveryKey: string } | null> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return null

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return null

      const result = await crypto.resetKeyBackup?.()
      if (!result) return null

      await loadKeyBackupStatus()
      return {
        version: result.version || result.backupVersion || '',
        recoveryKey: result.recoveryKey || result.recovery_key || ''
      }
    } catch (error) {
      logger.error('[E2EEStore] Failed to create backup:', error)
      return null
    }
  }

  async function restoreKeyBackup(recoveryKey: string): Promise<{ imported: number; total: number } | null> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return null

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return null

      const result = await crypto.restoreKeyBackupWithRecoveryKey?.(recoveryKey)
      if (!result) return null

      await loadKeyBackupStatus()
      return {
        imported: result.imported ?? 0,
        total: result.total ?? 0
      }
    } catch (error) {
      logger.error('[E2EEStore] Failed to restore backup:', error)
      return null
    }
  }

  async function verifyDevice(deviceId: string): Promise<boolean> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return false

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return false

      const userId = client.getUserId?.()
      if (!userId) return false

      await crypto.setDeviceVerified?.(userId, deviceId)
      await loadAllDevices()
      return true
    } catch (error) {
      logger.error('[E2EEStore] Failed to verify device:', error)
      return false
    }
  }

  async function blockDevice(deviceId: string): Promise<boolean> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return false

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return false

      const userId = client.getUserId?.()
      if (!userId) return false

      await crypto.setDeviceBlocked?.(userId, deviceId, true)
      await loadAllDevices()
      return true
    } catch (error) {
      logger.error('[E2EEStore] Failed to block device:', error)
      return false
    }
  }

  async function unblockDevice(deviceId: string): Promise<boolean> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return false

      const crypto = (client as unknown as { getCrypto?: () => CryptoApiCompat | null }).getCrypto?.()
      if (!crypto) return false

      const userId = client.getUserId?.()
      if (!userId) return false

      await crypto.setDeviceBlocked?.(userId, deviceId, false)
      await loadAllDevices()
      return true
    } catch (error) {
      logger.error('[E2EEStore] Failed to unblock device:', error)
      return false
    }
  }

  async function deleteDevice(deviceId: string): Promise<boolean> {
    try {
      const matrixClientService = (await import('@/services/matrixClientService')) as {
        default: { getClient: () => MatrixClientCompat | null }
      }
      const client = matrixClientService.default.getClient()
      if (!client) return false

      const myDeviceId = client.getDeviceId?.()
      if (deviceId === myDeviceId) return false

      await client.deleteDevice(deviceId)
      await loadAllDevices()
      return true
    } catch (error) {
      logger.error('[E2EEStore] Failed to delete device:', error)
      return false
    }
  }

  function getAllDevices(): DeviceInfo[] {
    const userId = Array.from(devices.value.keys())[0]
    if (!userId) return []
    return devices.value.get(userId) || []
  }

  function getUnverifiedDevices(): DeviceInfo[] {
    return getAllDevices().filter((d) => !d.verified && !d.blocked)
  }

  // Additional helper methods for compatibility
  function setAvailable(value: boolean): void {
    // Alias for compatibility
    enabled.value = value
  }

  function setEnabled(value: boolean): void {
    enabled.value = value
  }

  function setInitialized(value: boolean): void {
    initialized.value = value
  }

  function updateDevices(deviceList: DeviceInfo[]): void {
    const userId = Array.from(devices.value.keys())[0]
    if (userId) {
      devices.value.set(userId, deviceList)
    }
  }

  function updateDevice(deviceId: string, data: Partial<DeviceInfo>): void {
    const userId = Array.from(devices.value.keys())[0]
    if (!userId) return

    const deviceList = devices.value.get(userId)
    if (!deviceList) return

    const index = deviceList.findIndex((d) => d.deviceId === deviceId)
    if (index !== -1) {
      deviceList[index] = { ...deviceList[index], ...data }
    }
  }

  function isDeviceVerified(deviceId: string): boolean {
    const device = getAllDevices().find((d) => d.deviceId === deviceId)
    return device?.verified || false
  }

  function isDeviceBlocked(deviceId: string): boolean {
    const device = getAllDevices().find((d) => d.deviceId === deviceId)
    return device?.blocked || false
  }

  const deviceVerificationProgress = ref(0)
  const securityLevel = ref<'none' | 'basic' | 'advanced' | 'medium' | 'high'>('none')

  return {
    initialized,
    enabled,
    crossSigningInfo,
    stats,
    devices,
    isReady,
    hasBackup,
    isCrossSigningReady,
    available,
    initialize,
    loadCrossSigningInfo,
    loadKeyBackupStatus,
    loadAllDevices,
    createKeyBackup,
    restoreKeyBackup,
    verifyDevice,
    blockDevice,
    unblockDevice,
    deleteDevice,
    getAllDevices,
    getUnverifiedDevices,
    // Additional methods for compatibility
    setAvailable,
    setEnabled,
    setInitialized,
    updateDevices,
    updateDevice,
    isDeviceVerified,
    isDeviceBlocked,
    deviceVerificationProgress,
    securityLevel
  }
})
