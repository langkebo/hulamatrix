/**
 * End-to-End Encryption (E2EE) Service
 * Handles Matrix device verification, encryption setup, and key management
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MatrixClient } from 'matrix-js-sdk'

// E2EE Type Definitions
interface MatrixCryptoLike {
  getCrossSigningStatus?(): Promise<CrossSigningStatusLike | undefined>
  isSecretStorageReady?(): Promise<boolean>
  bootstrapSecretStorage?(options: { setupCrossSigning?: boolean }): Promise<void>
  getUserDeviceInfo?(userIds: string[]): Promise<Record<string, DeviceInfoLike[]>>
  setDeviceVerified?(userId: string, deviceId: string, verified: boolean): Promise<void>
  setDeviceBlocked?(userId: string, deviceId: string, blocked: boolean): Promise<void>
  beginKeyVerification?(method: string, userId: string, deviceId: string): VerifierLike
  requestDeviceVerification?(userId: string, deviceId: string): Promise<void>
}

interface CrossSigningStatusLike {
  crossSigningReady?: boolean
  hasMasterKey?: boolean
  hasUserSigningKey?: boolean
  hasDeviceSigningKey?: boolean
}

interface DeviceInfoLike {
  deviceId: string
  userId: string
  fingerprint?: string
  displayName?: string
  isVerified?: boolean
  isBlocked?: boolean
  lastSeen?: { ts: number }
  [key: string]: unknown
}

interface VerifierLike {
  on(event: string, handler: (...args: unknown[]) => void): void
  verify(): void
}

interface VerificationEventLike {
  requestId: string
  fromDevice: string
  content?: {
    device_display_name?: string
    [key: string]: unknown
  }
  methods?: string[]
  [key: string]: unknown
}

interface DeviceListEventLike {
  userId: string
  changedDevices: string[]
  [key: string]: unknown
}

interface VerificationStatusEventLike {
  requestId: string
  status: string
  [key: string]: unknown
}

interface MatrixRoomLike {
  roomId: string
  hasEncryptionStateEvent(): boolean
}

export interface DeviceInfo {
  deviceId: string
  userId: string
  deviceKey: string
  displayName?: string
  trustLevel?: 'verified' | 'unverified' | 'blocked'
  lastSeen?: number
  // 兼容性属性
  verified?: boolean
  blocked?: boolean
  lastSeenTs?: number
  lastSeenIp?: string
  fingerprint?: string
  keys?: {
    ed25519: string
    curve25519: string
  }
}

export interface VerificationRequest {
  requestId: string
  fromDevice: DeviceInfo
  toDevice: DeviceInfo
  timestamp: number
  methods: string[]
}

/**
 * E2EE Service class
 */
export class E2EEService {
  private static instance: E2EEService
  private client: MatrixClient | null = null
  private verificationRequests = new Map<string, VerificationRequest>()
  private isSetup = false

  static getInstance(): E2EEService {
    if (!E2EEService.instance) {
      E2EEService.instance = new E2EEService()
    }
    return E2EEService.instance
  }

  /**
   * Check if E2EE is set up
   */
  getIsSetup(): boolean {
    return this.isSetup
  }

  /**
   * Initialize E2EE service
   */
  async initialize(): Promise<void> {
    try {
      this.client = matrixClientService.getClient() as unknown as MatrixClient | null
      if (!this.client) {
        throw new Error('Matrix client not initialized')
      }

      logger.info('[E2EEService] Initializing end-to-end encryption')

      // Check if crypto is available
      const crypto = this.client.getCrypto()
      if (!crypto) {
        throw new Error('E2EE not available - client crypto not initialized')
      }

      // Setup event listeners
      this.setupEventListeners()

      // Setup cross-signing if needed
      await this.setupCrossSigning()

      // Bootstrap secure secret storage if needed
      await this.bootstrapSecretStorage()

      this.isSetup = true
      logger.info('[E2EEService] E2EE initialized successfully')
    } catch (error) {
      logger.error('[E2EEService] Failed to initialize E2EE:', error)
      throw error
    }
  }

  /**
   * Setup cross-signing keys
   */
  async setupCrossSigning(): Promise<void> {
    try {
      const crypto = this.client!.getCrypto()
      if (!crypto) return

      // Check if cross-signing is already set up
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const crossSigningStatus = cryptoLike.getCrossSigningStatus?.()
        ? await cryptoLike.getCrossSigningStatus()
        : undefined

      if (!crossSigningStatus?.crossSigningReady) {
        logger.info('[E2EEService] Setting up cross-signing')

        // This would typically require user interaction in a real app
        // For now, we'll just log that it needs to be done
        logger.warn('[E2EEService] Cross-signing needs to be set up by user')

        // Emit event for UI to handle
        window.dispatchEvent(new CustomEvent('e2ee:cross-signing-required'))
      }
    } catch (error) {
      logger.error('[E2EEService] Failed to setup cross-signing:', error)
    }
  }

  /**
   * Bootstrap secret storage
   */
  private async bootstrapSecretStorage(): Promise<void> {
    try {
      const crypto = this.client!.getCrypto()
      if (!crypto) return

      // Check if secret storage is ready
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const secretStorageReady = cryptoLike.isSecretStorageReady ? await cryptoLike.isSecretStorageReady() : false

      if (!secretStorageReady) {
        logger.info('[E2EEService] Bootstrapping secret storage')

        // Create default secret storage key
        await cryptoLike.bootstrapSecretStorage?.({
          setupCrossSigning: true
        })

        logger.info('[E2EEService] Secret storage bootstrapped')
      }
    } catch (error) {
      logger.error('[E2EEService] Failed to bootstrap secret storage:', error)
    }
  }

  /**
   * Setup event listeners for E2EE events
   */
  private setupEventListeners(): void {
    if (!this.client) return

    const clientLike = this.client as unknown as { on: (event: string, handler: (...args: unknown[]) => void) => void }

    // Listen for device verification requests
    clientLike.on('deviceVerification', (...args: unknown[]) => {
      const [event] = args as [VerificationEventLike]
      this.handleDeviceVerification(event)
    })

    // Listen for device list changes
    clientLike.on('crypto.devices', (...args: unknown[]) => {
      const [event] = args as [DeviceListEventLike]
      this.handleDeviceListChange(event)
    })

    // Listen for room encryption events
    clientLike.on('Room.encryption', (...args: unknown[]) => {
      const [_event, room] = args as [unknown, MatrixRoomLike]
      logger.info('[E2EEService] Room encryption enabled', { roomId: room.roomId })
      this.emitRoomEncryptionUpdate(room.roomId)
    })

    // Listen for verification status changes
    clientLike.on('crypto.verification', (...args: unknown[]) => {
      const [event] = args as [VerificationStatusEventLike]
      this.handleVerificationStatusChange(event)
    })

    logger.info('[E2EEService] Event listeners setup complete')
  }

  /**
   * Handle device verification request
   */
  private async handleDeviceVerification(event: VerificationEventLike): Promise<void> {
    try {
      logger.info('[E2EEService] Device verification request received', {
        requestId: event.requestId,
        fromDevice: event.fromDevice
      })

      const clientLike = this.client as unknown as { getUserId?: () => string; getDeviceId?: () => string }
      const currentUserId = clientLike.getUserId?.() || ''
      const currentDeviceId = clientLike.getDeviceId?.() || ''

      const request: VerificationRequest = (() => {
        const result: VerificationRequest = {
          requestId: event.requestId,
          fromDevice: {
            deviceId: event.fromDevice,
            userId: currentUserId,
            deviceKey: ''
          },
          toDevice: {
            deviceId: currentDeviceId,
            userId: currentUserId,
            deviceKey: ''
          },
          timestamp: Date.now(),
          methods: []
        }
        if (event.content?.device_display_name !== undefined) {
          result.fromDevice.displayName = event.content.device_display_name
        }
        if (event.methods !== undefined) {
          result.methods = event.methods
        }
        return result
      })()

      this.verificationRequests.set(event.requestId, request)

      // Emit event for UI to handle
      window.dispatchEvent(
        new CustomEvent('e2ee:verification-request', {
          detail: request
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to handle device verification:', error)
    }
  }

  /**
   * Handle device list changes
   */
  private async handleDeviceListChange(event: DeviceListEventLike): Promise<void> {
    logger.info('[E2EEService] Device list changed', {
      userId: event.userId,
      changedDevices: event.changedDevices
    })

    // Emit event for UI to update device list
    window.dispatchEvent(
      new CustomEvent('e2ee:device-list-changed', {
        detail: {
          userId: event.userId,
          changedDevices: event.changedDevices
        }
      })
    )
  }

  /**
   * Handle verification status changes
   */
  private handleVerificationStatusChange(event: VerificationStatusEventLike): void {
    logger.info('[E2EEService] Verification status changed', {
      requestId: event.requestId,
      status: event.status
    })

    // Update or remove verification request
    if (event.status === 'done' || event.status === 'cancelled') {
      this.verificationRequests.delete(event.requestId)
    }

    // Emit event for UI
    window.dispatchEvent(
      new CustomEvent('e2ee:verification-status', {
        detail: {
          requestId: event.requestId,
          status: event.status
        }
      })
    )
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const devices = cryptoLike.getUserDeviceInfo ? await cryptoLike.getUserDeviceInfo([userId]) : { [userId]: [] }
      const userDevices = devices[userId] || []

      return userDevices.map((device): DeviceInfo => {
        const result: DeviceInfo = {
          deviceId: device.deviceId,
          userId: device.userId,
          deviceKey: device.fingerprint || '',
          trustLevel: this.getDeviceTrustLevel(device)
        }
        if (device.displayName !== undefined) result.displayName = device.displayName
        if (device.lastSeen?.ts !== undefined) result.lastSeen = device.lastSeen.ts
        return result
      })
    } catch (error) {
      logger.error('[E2EEService] Failed to get user devices:', error)
      return []
    }
  }

  /**
   * Get all current user's devices
   */
  async getMyDevices(): Promise<DeviceInfo[]> {
    const clientLike = this.client as unknown as { getUserId?: () => string }
    const userId = this.client ? clientLike.getUserId?.() : null
    if (!userId) {
      return []
    }

    return this.getUserDevices(userId)
  }

  /**
   * Verify a device
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[E2EEService] Verifying device', { userId, deviceId })

      // Mark device as verified
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      await cryptoLike.setDeviceVerified?.(userId, deviceId, true)

      logger.info('[E2EEService] Device verified successfully', { userId, deviceId })

      // Emit event for UI update
      window.dispatchEvent(
        new CustomEvent('e2ee:device-verified', {
          detail: { userId, deviceId, verified: true }
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to verify device:', error)
      throw error
    }
  }

  /**
   * Block a device
   */
  async blockDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[E2EEService] Blocking device', { userId, deviceId })

      // Mark device as blocked
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      await cryptoLike.setDeviceBlocked?.(userId, deviceId, true)

      logger.info('[E2EEService] Device blocked successfully', { userId, deviceId })

      // Emit event for UI update
      window.dispatchEvent(
        new CustomEvent('e2ee:device-blocked', {
          detail: { userId, deviceId, blocked: true }
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to block device:', error)
      throw error
    }
  }

  /**
   * Get device trust level
   */
  private getDeviceTrustLevel(device: DeviceInfoLike): 'verified' | 'unverified' | 'blocked' {
    if (device.isBlocked) return 'blocked'
    if (device.isVerified) return 'verified'
    return 'unverified'
  }

  /**
   * Accept verification request
   */
  async acceptVerificationRequest(requestId: string): Promise<void> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[E2EEService] Accepting verification request', { requestId })

      const request = this.verificationRequests.get(requestId)
      if (!request) {
        throw new Error('Verification request not found')
      }

      // Begin SAS verification
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const verifier = cryptoLike.beginKeyVerification?.(
        'm.sas.v1',
        request.fromDevice.userId,
        request.fromDevice.deviceId
      )

      if (!verifier) {
        throw new Error('Failed to begin key verification')
      }

      // Handle verification
      verifier.on('showSas', (...args: unknown[]) => {
        const [event] = args as [{ sas?: unknown; emoji?: unknown }]
        window.dispatchEvent(
          new CustomEvent('e2ee:verification-sas', {
            detail: {
              requestId,
              sas: event.sas,
              emoji: event.emoji
            }
          })
        )
      })

      verifier.on('verify', () => {
        logger.info('[E2EEService] Device verified through SAS')
        this.verificationRequests.delete(requestId)

        window.dispatchEvent(
          new CustomEvent('e2ee:verification-complete', {
            detail: { requestId, success: true }
          })
        )
      })

      verifier.verify()
    } catch (error) {
      logger.error('[E2EEService] Failed to accept verification request:', error)
      throw error
    }
  }

  /**
   * Decline verification request
   */
  async declineVerificationRequest(requestId: string): Promise<void> {
    try {
      logger.info('[E2EEService] Declining verification request', { requestId })

      // Remove from pending requests
      this.verificationRequests.delete(requestId)

      // Emit event for UI
      window.dispatchEvent(
        new CustomEvent('e2ee:verification-declined', {
          detail: { requestId }
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to decline verification request:', error)
      throw error
    }
  }

  /**
   * Get pending verification requests
   */
  getPendingVerificationRequests(): VerificationRequest[] {
    return Array.from(this.verificationRequests.values())
  }

  /**
   * Enable encryption for a room
   */
  async enableRoomEncryption(roomId: string): Promise<void> {
    try {
      logger.info('[E2EEService] Enabling encryption for room', { roomId })

      const clientLike = this.client as unknown as {
        sendStateEvent?: (roomId: string, type: string, content: Record<string, unknown>) => Promise<void>
      }
      await clientLike.sendStateEvent?.(roomId, 'm.room.encryption', { algorithm: 'm.megolm.v1.aes-sha2' })

      logger.info('[E2EEService] Room encryption enabled', { roomId })
    } catch (error) {
      logger.error('[E2EEService] Failed to enable room encryption:', error)
      throw error
    }
  }

  /**
   * Check if a room is encrypted
   */
  isRoomEncrypted(roomId: string): boolean {
    const room = this.client?.getRoom(roomId)
    if (!room) return false

    return room.hasEncryptionStateEvent()
  }

  /**
   * Get encryption status
   */
  async getEncryptionStatus(): Promise<{
    enabled: boolean
    crossSigningReady: boolean
    secretStorageReady: boolean
    deviceCount: number
    verifiedDeviceCount: number
  }> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        return {
          enabled: false,
          crossSigningReady: false,
          secretStorageReady: false,
          deviceCount: 0,
          verifiedDeviceCount: 0
        }
      }

      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const crossSigningStatus = cryptoLike.getCrossSigningStatus?.()
        ? await cryptoLike.getCrossSigningStatus()
        : undefined
      const secretStorageReady = cryptoLike.isSecretStorageReady ? await cryptoLike.isSecretStorageReady() : false
      const myDevices = await this.getMyDevices()

      return {
        enabled: true,
        crossSigningReady: !!crossSigningStatus?.crossSigningReady,
        secretStorageReady,
        deviceCount: myDevices.length,
        verifiedDeviceCount: myDevices.filter((d) => d.trustLevel === 'verified').length
      }
    } catch (error) {
      logger.error('[E2EEService] Failed to get encryption status:', error)
      return {
        enabled: false,
        crossSigningReady: false,
        secretStorageReady: false,
        deviceCount: 0,
        verifiedDeviceCount: 0
      }
    }
  }

  /**
   * Emit room encryption update event
   */
  private emitRoomEncryptionUpdate(roomId: string): void {
    window.dispatchEvent(
      new CustomEvent('e2ee:room-encryption-updated', {
        detail: { roomId, encrypted: true }
      })
    )
  }

  /**
   * Reset E2EE - DANGER: This will remove all encryption keys!
   */
  async reset(): Promise<void> {
    try {
      logger.warn('[E2EEService] Resetting E2EE - This will remove all encryption keys!')

      const cryptoLike = this.client?.getCrypto() as unknown as { resetDeviceKeys?: () => Promise<void> }
      if (cryptoLike?.resetDeviceKeys) {
        await cryptoLike.resetDeviceKeys()
      }

      // Clear verification requests
      this.verificationRequests.clear()

      this.isSetup = false

      logger.warn('[E2EEService] E2EE reset complete')
    } catch (error) {
      logger.error('[E2EEService] Failed to reset E2EE:', error)
      throw error
    }
  }

  /**
   * Alias for getPendingVerificationRequests for compatibility
   */
  getVerificationRequests(): VerificationRequest[] {
    return this.getPendingVerificationRequests()
  }

  /**
   * Request device verification with another user
   */
  async requestDeviceVerification(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[E2EEService] Requesting device verification', { userId, deviceId })

      // Begin SAS verification request
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      await cryptoLike.requestDeviceVerification?.(userId, deviceId)

      logger.info('[E2EEService] Device verification request sent')
    } catch (error) {
      logger.error('[E2EEService] Failed to request device verification:', error)
      throw error
    }
  }

  /**
   * Alias for declineVerificationRequest for compatibility
   */
  async rejectVerificationRequest(requestId: string): Promise<void> {
    return this.declineVerificationRequest(requestId)
  }

  /**
   * Confirm verification (for SAS verification)
   */
  async confirmVerification(requestId: string): Promise<void> {
    try {
      logger.info('[E2EEService] Confirming verification', { requestId })

      // This would typically be called after SAS verification is confirmed
      // The actual verification confirmation happens in the verifier.on('verify') callback

      window.dispatchEvent(
        new CustomEvent('e2ee:verification-confirmed', {
          detail: { requestId }
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to confirm verification:', error)
      throw error
    }
  }

  /**
   * Unblock a previously blocked device
   */
  async unblockDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      logger.info('[E2EEService] Unblocking device', { userId, deviceId })

      // Mark device as unblocked
      const cryptoLike = crypto as unknown as MatrixCryptoLike
      await cryptoLike.setDeviceBlocked?.(userId, deviceId, false)

      logger.info('[E2EEService] Device unblocked successfully', { userId, deviceId })

      // Emit event for UI update
      window.dispatchEvent(
        new CustomEvent('e2ee:device-unblocked', {
          detail: { userId, deviceId, blocked: false }
        })
      )
    } catch (error) {
      logger.error('[E2EEService] Failed to unblock device:', error)
      throw error
    }
  }

  /**
   * Get cross-signing status details
   */
  async getCrossSigningStatus(): Promise<{
    masterKey: boolean
    userSigningKey: boolean
    deviceSigningKey: boolean
    complete: boolean
  }> {
    try {
      const crypto = this.client?.getCrypto()
      if (!crypto) {
        return {
          masterKey: false,
          userSigningKey: false,
          deviceSigningKey: false,
          complete: false
        }
      }

      const cryptoLike = crypto as unknown as MatrixCryptoLike
      const status = cryptoLike.getCrossSigningStatus?.() ? await cryptoLike.getCrossSigningStatus() : undefined

      return {
        masterKey: !!status?.hasMasterKey,
        userSigningKey: !!status?.hasUserSigningKey,
        deviceSigningKey: !!status?.hasDeviceSigningKey,
        complete: !!status?.crossSigningReady
      }
    } catch (error) {
      logger.error('[E2EEService] Failed to get cross-signing status:', error)
      return {
        masterKey: false,
        userSigningKey: false,
        deviceSigningKey: false,
        complete: false
      }
    }
  }
}

// Export singleton instance
export const e2eeService = E2EEService.getInstance()
