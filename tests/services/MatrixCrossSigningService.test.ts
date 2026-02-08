import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const createMockClient = () => ({
  getUserId: vi.fn(() => '@user:example.com'),
  getDeviceId: vi.fn(() => 'DEVICE_ID'),
  getDevices: vi.fn().mockResolvedValue({
    devices: [
      {
        device_id: 'DEVICE_1',
        display_name: 'Device 1',
        last_seen_ts: Date.now()
      },
      {
        device_id: 'DEVICE_2',
        display_name: 'Device 2',
        last_seen_ts: Date.now() - 86400000
      }
    ]
  }),
  getCrypto: vi.fn(() => ({
    isCrossSigningReady: vi.fn().mockReturnValue(true),
    bootstrapCrossSigning: vi.fn().mockResolvedValue(undefined),
    setDeviceVerified: vi.fn().mockResolvedValue(undefined),
    setDeviceBlocked: vi.fn().mockResolvedValue(undefined),
    getCrossSigningStatus: vi.fn().mockResolvedValue({
      enabled: true,
      trusted: true,
      publicKeysOnDevice: true,
      privateKeysCachedLocally: {
        masterKey: true,
        selfSigningKey: true,
        userSigningKey: true
      }
    }),
    getDeviceVerificationStatus: vi.fn().mockResolvedValue({
      verified: true,
      blocked: false
    }),
    requestVerificationDM: vi.fn().mockResolvedValue(undefined)
  }))
})

describe('MatrixCrossSigningService', () => {
  let mockClient: ReturnType<typeof createMockClient>
  let clientServiceInstance: ReturnType<typeof MatrixClientService.getInstance>

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
    clientServiceInstance = MatrixClientService.getInstance()
    vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(mockClient as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isCrossSigningEnabled', () => {
    it('should return true when cross signing is ready', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const enabled = await service.isCrossSigningEnabled()

      expect(enabled).toBe(true)
    })

    it('should return false when cross signing is not ready', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue({
        ...createMockClient(),
        getCrypto: vi.fn(() => ({
          isCrossSigningReady: vi.fn().mockReturnValue(false)
        }))
      } as any)

      const service = MatrixCrossSigningService.getInstance()
      const enabled = await service.isCrossSigningEnabled()

      expect(enabled).toBe(false)
    })
  })

  describe('enableCrossSigning', () => {
    it('should enable cross signing successfully', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.enableCrossSigning()

      expect(result).toBe(true)
    })
  })

  describe('bootstrapCrossSigning', () => {
    it('should bootstrap with uploadDeviceSigningKeys option', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.bootstrapCrossSigning({
        uploadDeviceSigningKeys: true
      })

      expect(result).toBe(true)
    })

    it('should bootstrap without uploadDeviceSigningKeys option', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.bootstrapCrossSigning({
        uploadDeviceSigningKeys: false
      })

      expect(result).toBe(true)
    })
  })

  describe('verifyDevice', () => {
    it('should verify device successfully', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.verifyDevice('DEVICE_1')

      expect(result).toBe(true)
    })
  })

  describe('unverifyDevice', () => {
    it('should unverify device successfully', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.unverifyDevice('DEVICE_1')

      expect(result).toBe(true)
    })
  })

  describe('blockDevice', () => {
    it('should block device successfully', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.blockDevice('DEVICE_1')

      expect(result).toBe(true)
    })
  })

  describe('unblockDevice', () => {
    it('should unblock device successfully', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const result = await service.unblockDevice('DEVICE_1')

      expect(result).toBe(true)
    })
  })

  describe('getCrossSigningStatus', () => {
    it('should return cross signing status', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const status = await service.getCrossSigningStatus()

      expect(status).toBeDefined()
      expect(status.enabled).toBe(true)
      expect(status.trusted).toBe(true)
    })
  })

  describe('getVerifiedDeviceCount', () => {
    it('should return verified device count', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const count = await service.getVerifiedDeviceCount()

      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getUnverifiedDeviceCount', () => {
    it('should return unverified device count', async () => {
      const service = MatrixCrossSigningService.getInstance()
      const count = await service.getUnverifiedDeviceCount()

      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MatrixCrossSigningService.getInstance()
      const instance2 = MatrixCrossSigningService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
