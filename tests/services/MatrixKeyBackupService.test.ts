import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixKeyBackupService from '@/services/matrix/MatrixKeyBackupService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const createMockClient = () => ({
  getCrypto: vi.fn(() => ({
    getActiveSessionBackupVersion: vi.fn().mockResolvedValue('1'),
    hasKeyBackup: vi.fn().mockResolvedValue(true),
    getKeyBackupInfo: vi.fn().mockResolvedValue({
      version: '1',
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      count: 100,
      etag: 'test-etag'
    }),
    deleteKeyBackupVersion: vi.fn().mockResolvedValue(undefined),
    resetKeyBackup: vi.fn().mockResolvedValue(undefined),
    enableKeyBackup: vi.fn().mockResolvedValue(undefined),
    disableKeyBackup: vi.fn().mockResolvedValue(undefined),
    restoreKeyBackup: vi.fn().mockResolvedValue(undefined),
    restoreKeyBackupWithPassphrase: vi.fn().mockResolvedValue(undefined)
  }))
})

const createMockClientNoBackup = () => ({
  getCrypto: vi.fn(() => ({
    getActiveSessionBackupVersion: vi.fn().mockResolvedValue(null),
    hasKeyBackup: vi.fn().mockResolvedValue(false),
    getKeyBackupInfo: vi.fn().mockResolvedValue(null),
    deleteKeyBackupVersion: vi.fn().mockResolvedValue(undefined),
    resetKeyBackup: vi.fn().mockResolvedValue(undefined),
    enableKeyBackup: vi.fn().mockResolvedValue(undefined),
    disableKeyBackup: vi.fn().mockResolvedValue(undefined),
    restoreKeyBackup: vi.fn().mockResolvedValue(undefined),
    restoreKeyBackupWithPassphrase: vi.fn().mockResolvedValue(undefined)
  }))
})

describe('MatrixKeyBackupService', () => {
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

  describe('isBackupEnabled', () => {
    it('should return true when backup is enabled', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const enabled = await service.isBackupEnabled()

      expect(enabled).toBe(true)
    })

    it('should return false when backup is disabled', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(createMockClientNoBackup() as any)

      const service = MatrixKeyBackupService.getInstance()
      const enabled = await service.isBackupEnabled()

      expect(enabled).toBe(false)
    })
  })

  describe('hasBackup', () => {
    it('should return true when backup exists', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const hasBackup = await service.hasBackup()

      expect(hasBackup).toBe(true)
    })

    it('should return false when no backup exists', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(createMockClientNoBackup() as any)

      const service = MatrixKeyBackupService.getInstance()
      const hasBackup = await service.hasBackup()

      expect(hasBackup).toBe(false)
    })
  })

  describe('getBackupInfo', () => {
    it('should return backup info', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const info = await service.getBackupInfo()

      expect(info).toBeDefined()
      expect(info?.version).toBe('1')
      expect(info?.algorithm).toBe('m.megolm_backup.v1.curve25519-aes-sha2')
      expect(info?.count).toBe(100)
    })

    it('should return null when no backup info', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(createMockClientNoBackup() as any)

      const service = MatrixKeyBackupService.getInstance()
      const info = await service.getBackupInfo()

      expect(info).toBeNull()
    })
  })

  describe('enableBackup', () => {
    it('should enable backup successfully', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.enableBackup()

      expect(result).toBe(true)
    })
  })

  describe('disableBackup', () => {
    it('should disable backup successfully', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.disableBackup()

      expect(result).toBe(true)
    })
  })

  describe('createBackup', () => {
    it('should create backup with password', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.createBackup('test-password')

      expect(result).toBeDefined()
      expect(result?.backupId).toBe('1')
    })

    it('should create backup without password', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.createBackup('')

      expect(result).toBeDefined()
      expect(result?.backupId).toBe('1')
    })
  })

  describe('restoreBackupWithPassphrase', () => {
    it('should restore backup with passphrase', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.restoreBackupWithPassphrase('test-passphrase')

      expect(result).toBe(true)
    })
  })

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      const service = MatrixKeyBackupService.getInstance()
      const result = await service.deleteBackup()

      expect(result).toBe(true)
    })
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MatrixKeyBackupService.getInstance()
      const instance2 = MatrixKeyBackupService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
