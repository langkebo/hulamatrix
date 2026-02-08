import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'
import type { CryptoKeyBackupInfo, CrossSigningInfo } from '@/types/matrix-extended'

interface UserIdentityInfo {
  userId: string
  verified: boolean
  masterKey?: string
  selfSigningKey?: string
}

export const CryptoStatus = {
  Disabled: 'disabled',
  Enabled: 'enabled',
  Unverified: 'unverified',
  Verifying: 'verifying',
  Error: 'error'
}

export type CryptoStatusValue =
  | typeof CryptoStatus.Disabled
  | typeof CryptoStatus.Enabled
  | typeof CryptoStatus.Unverified
  | typeof CryptoStatus.Verifying
  | typeof CryptoStatus.Error

export const VerificationStatus = {
  Unverified: 'unverified',
  Verified: 'verified',
  Pending: 'pending',
  Cancelled: 'cancelled'
}

export type VerificationStatusValue =
  | typeof VerificationStatus.Unverified
  | typeof VerificationStatus.Verified
  | typeof VerificationStatus.Pending
  | typeof VerificationStatus.Cancelled

class MatrixCryptoService {
  private static instance: MatrixCryptoService
  private crypto: any = null
  private cryptoListeners: Map<string, ((data: unknown) => void)[]> = new Map()

  private _cryptoStatus: Ref<CryptoStatusValue> = ref(CryptoStatus.Disabled)
  private _verificationStatus: Ref<VerificationStatusValue> = ref(VerificationStatus.Unverified)
  private _keyBackupInfo: Ref<CryptoKeyBackupInfo | null> = ref(null)
  private _isKeyBackupEnabled: Ref<boolean> = ref(false)
  private _crossSigningInfo: Ref<CrossSigningInfo | null> = ref(null)

  private constructor() {}

  static getInstance(): MatrixCryptoService {
    if (!MatrixCryptoService.instance) {
      MatrixCryptoService.instance = new MatrixCryptoService()
    }
    return MatrixCryptoService.instance
  }

  get cryptoStatus(): Ref<CryptoStatusValue> {
    return this._cryptoStatus
  }

  get verificationStatus(): Ref<VerificationStatusValue> {
    return this._verificationStatus
  }

  get keyBackupInfo(): Ref<CryptoKeyBackupInfo | null> {
    return this._keyBackupInfo
  }

  get isKeyBackupEnabled(): Ref<boolean> {
    return this._isKeyBackupEnabled
  }

  get crossSigningInfo(): Ref<CrossSigningInfo | null> {
    return this._crossSigningInfo
  }

  async initializeCrypto(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      this._cryptoStatus.value = CryptoStatus.Enabled

      const crypto = client.getCrypto()
      if (crypto) {
        this.crypto = crypto
        await this.loadCryptoState()
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to initialize crypto:', error)
      }
      this._cryptoStatus.value = CryptoStatus.Error
      throw error
    }
  }

  async loadCryptoState(): Promise<void> {
    if (!this.crypto) return

    try {
      await this.loadKeyBackupInfo()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load crypto state:', error)
      }
    }
  }

  async loadKeyBackupInfo(): Promise<void> {
    if (!this.crypto) return

    try {
      const backupInfo = await this.crypto.getKeyBackupInfo()
      if (backupInfo) {
        this._keyBackupInfo.value = backupInfo as unknown as CryptoKeyBackupInfo
        this._isKeyBackupEnabled.value = true
      } else {
        this._keyBackupInfo.value = null
        this._isKeyBackupEnabled.value = false
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load key backup info:', error)
      }
    }
  }

  async enableKeyBackup(): Promise<{ recoveryKey: string } | null> {
    if (!this.crypto) return null

    try {
      await this.crypto.resetKeyBackup()
      this._isKeyBackupEnabled.value = true
      await this.loadKeyBackupInfo()
      return { recoveryKey: '[stored-in-secret-storage]' }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to enable key backup:', error)
      }
      return null
    }
  }

  async disableKeyBackup(): Promise<void> {
    if (!this.crypto) return

    try {
      const backupInfo = await this.crypto.getKeyBackupInfo()
      if (backupInfo?.version) {
        await this.crypto.deleteKeyBackupVersion(backupInfo.version)
      }
      this._isKeyBackupEnabled.value = false
      this._keyBackupInfo.value = null
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to disable key backup:', error)
      }
      throw error
    }
  }

  async verifyDevice(deviceId: string): Promise<void> {
    if (!this.crypto) return

    const client = MatrixClientService.getInstance().getClient()
    const userId = client?.getUserId()
    if (!userId) return

    try {
      await this.crypto.setDeviceVerified(userId, deviceId, true)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to verify device:', error)
      }
      throw error
    }
  }

  async unverifyDevice(deviceId: string): Promise<void> {
    if (!this.crypto) return

    const client = MatrixClientService.getInstance().getClient()
    const userId = client?.getUserId()
    if (!userId) return

    try {
      await this.crypto.setDeviceVerified(userId, deviceId, false)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to unverify device:', error)
      }
      throw error
    }
  }

  async exportRoomKeys(): Promise<string> {
    if (!this.crypto) return '{}'

    try {
      if (typeof this.crypto.exportRoomKeys === 'function') {
        const exportedKeys = await this.crypto.exportRoomKeys()
        return JSON.stringify(exportedKeys)
      }
      return '{}'
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to export room keys:', error)
      }
      return '{}'
    }
  }

  async importRoomKeys(keysJson: string): Promise<number> {
    if (!this.crypto) return 0

    try {
      if (typeof this.crypto.importRoomKeys === 'function') {
        const keys = JSON.parse(keysJson) as unknown
        if (!Array.isArray(keys)) {
          return 0
        }
        await this.crypto.importRoomKeys(keys)
        return keys.length
      }
      return 0
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to import room keys:', error)
      }
      return 0
    }
  }

  async getUserIdentity(userId: string): Promise<UserIdentityInfo | null> {
    if (!this.crypto) return null

    try {
      const status = await this.crypto.getUserVerificationStatus(userId)
      return { userId, verified: status.isVerified() }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get user identity:', error)
      }
      return null
    }
  }

  async getCrossSigningStatus(): Promise<{
    enabled: boolean
    ready: boolean
    trusted: boolean
  }> {
    if (!this.crypto) {
      return { enabled: false, ready: false, trusted: false }
    }

    try {
      const ready = await this.crypto.isCrossSigningReady()
      return {
        enabled: ready,
        ready,
        trusted: ready && this.crypto.getTrustCrossSignedDevices()
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get cross signing status:', error)
      }
      return { enabled: false, ready: false, trusted: false }
    }
  }

  async verifyUser(userId: string): Promise<boolean> {
    if (!this.crypto) return false

    try {
      await this.crypto.pinCurrentUserIdentity(userId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to verify user:', error)
      }
      return false
    }
  }

  async getVerificationRequests(userId: string): Promise<unknown[]> {
    if (!this.crypto) return []

    try {
      return this.crypto.getVerificationRequestsToDeviceInProgress(userId)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get verification requests:', error)
      }
      return []
    }
  }

  async requestVerification(userId: string, _methods?: string[]): Promise<unknown> {
    if (!this.crypto) return null

    try {
      const { default: MatrixUserService } = await import('./MatrixUserService')
      const roomId = await MatrixUserService.getInstance().startDirectMessage(userId)
      return await this.crypto.requestVerificationDM(userId, roomId)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to request verification:', error)
      }
      return null
    }
  }

  async getDeviceVerificationStatus(deviceId: string): Promise<{
    verified: boolean
    blocked: boolean
  }> {
    if (!this.crypto) {
      return { verified: false, blocked: false }
    }

    try {
      const client = MatrixClientService.getInstance().getClient()
      const userId = client?.getUserId()
      if (!userId) return { verified: false, blocked: false }

      const status = await this.crypto.getDeviceVerificationStatus(userId, deviceId)
      if (status) return { verified: status.isVerified(), blocked: false }
      return { verified: false, blocked: false }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get device status:', error)
      }
      return { verified: false, blocked: false }
    }
  }

  async getAllVerifiedUsers(): Promise<string[]> {
    if (!this.crypto) return []

    try {
      return []
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get verified users:', error)
      }
      return []
    }
  }

  async hasUserVerified(userId: string): Promise<boolean> {
    if (!this.crypto) return false

    try {
      const status = await this.crypto.getUserVerificationStatus(userId)
      return status.isVerified()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to check user verification:', error)
      }
      return false
    }
  }

  onCryptoStatusChange(callback: (status: CryptoStatusValue) => void): () => void {
    const listenerId = Math.random().toString(36)
    const wrappedCallback = (data: unknown) => {
      if (typeof data === 'string') {
        callback(data as CryptoStatusValue)
      }
    }
    if (!this.cryptoListeners.has(listenerId)) {
      this.cryptoListeners.set(listenerId, [])
    }
    this.cryptoListeners.get(listenerId)?.push(wrappedCallback)
    return () => {
      this.cryptoListeners.delete(listenerId)
    }
  }

  cleanup(): void {
    this.cryptoListeners.clear()
    this.crypto = null
    this._cryptoStatus.value = CryptoStatus.Disabled
    this._verificationStatus.value = VerificationStatus.Unverified
  }
}

export default MatrixCryptoService
export type { UserIdentityInfo, CryptoKeyBackupInfo }
