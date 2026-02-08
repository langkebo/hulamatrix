import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixDataDeletionService from '@/services/matrix/MatrixDataDeletionService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const createMockClient = () => ({
  getUserId: vi.fn(() => '@user:example.com'),
  getRooms: vi.fn(() => []),
  getIgnoredUsers: vi.fn(() => []),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
  redactEvent: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn().mockResolvedValue(undefined),
  setDisplayName: vi.fn().mockResolvedValue(undefined),
  setAvatarUrl: vi.fn().mockResolvedValue(undefined),
  unignoreUser: vi.fn().mockResolvedValue(undefined)
})

describe('MatrixDataDeletionService', () => {
  let mockClient: ReturnType<typeof createMockClient>
  let clientServiceInstance: ReturnType<typeof MatrixClientService.getInstance>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockClient = createMockClient()
    clientServiceInstance = MatrixClientService.getInstance()
    vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(mockClient as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('deleteData', () => {
    it('should delete messages when deleteMessages is true', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: true,
        deleteRooms: false,
        deleteContacts: false,
        deleteProfile: false,
        deleteAccount: false
      })

      expect(result.success).toBe(true)
    })

    it('should delete rooms when deleteRooms is true', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: false,
        deleteRooms: true,
        deleteContacts: false,
        deleteProfile: false,
        deleteAccount: false
      })

      expect(result.success).toBe(true)
    })

    it('should delete contacts when deleteContacts is true', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: false,
        deleteRooms: false,
        deleteContacts: true,
        deleteProfile: false,
        deleteAccount: false
      })

      expect(result.success).toBe(true)
    })

    it('should delete profile when deleteProfile is true', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: false,
        deleteRooms: false,
        deleteContacts: false,
        deleteProfile: true,
        deleteAccount: false
      })

      expect(result.success).toBe(true)
    })

    it('should delete account when deleteAccount is true', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: false,
        deleteRooms: false,
        deleteContacts: false,
        deleteProfile: false,
        deleteAccount: true
      })

      expect(result.success).toBe(true)
    })

    it('should return error when client not initialized', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(null)

      const service = MatrixDataDeletionService.getInstance()
      const result = await service.deleteData({
        deleteMessages: true,
        deleteRooms: false,
        deleteContacts: false,
        deleteProfile: false,
        deleteAccount: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })
  })

  describe('getDeletionPreview', () => {
    it('should return preview with counts', async () => {
      const service = MatrixDataDeletionService.getInstance()
      const preview = await service.getDeletionPreview()

      expect(preview).toBeDefined()
      expect(preview.messages).toBeDefined()
      expect(preview.rooms).toBeDefined()
      expect(preview.contacts).toBeDefined()
    })

    it('should return preview with zero counts when no client', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(null)

      const service = MatrixDataDeletionService.getInstance()
      const preview = await service.getDeletionPreview()

      expect(preview).toBeDefined()
      expect(preview.messages).toBe(0)
      expect(preview.rooms).toBe(0)
      expect(preview.contacts).toBe(0)
    })
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MatrixDataDeletionService.getInstance()
      const instance2 = MatrixDataDeletionService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
