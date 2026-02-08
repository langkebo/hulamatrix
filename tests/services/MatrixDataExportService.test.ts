import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixDataExportService from '@/services/matrix/MatrixDataExportService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const createMockClient = () => ({
  getUserId: vi.fn(() => '@user:example.com'),
  getUserProfile: vi.fn().mockResolvedValue({
    displayname: 'Test User',
    avatar_url: 'mxc://example.com/avatar'
  }),
  getRooms: vi.fn(() => []),
  getUsers: vi.fn(() => [])
})

describe('MatrixDataExportService', () => {
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

  describe('exportData', () => {
    it('should export profile when includeProfile is true', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: true,
        includeRooms: false,
        includeMessages: false,
        includeContacts: false
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
      expect(result.filename).toBeDefined()
    })

    it('should export rooms when includeRooms is true', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: false,
        includeRooms: true,
        includeMessages: false,
        includeContacts: false
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
    })

    it('should export messages when includeMessages is true', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: false,
        includeRooms: false,
        includeMessages: true,
        includeContacts: false
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
    })

    it('should export contacts when includeContacts is true', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: false,
        includeRooms: false,
        includeMessages: false,
        includeContacts: true
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
    })

    it('should filter by date range when provided', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: false,
        includeRooms: true,
        includeMessages: false,
        includeContacts: false,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
    })

    it('should export all data when all options are true', async () => {
      const service = MatrixDataExportService.getInstance()
      const result = await service.exportData({
        includeProfile: true,
        includeRooms: true,
        includeMessages: true,
        includeContacts: true
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
    })
  })

  describe('downloadExport', () => {
    it('should throw error when result is invalid', async () => {
      const service = MatrixDataExportService.getInstance()
      const invalidResult = { success: false, error: 'Test error' }

      await expect(service.downloadExport(invalidResult as any)).rejects.toThrow('Invalid export result')
    })
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MatrixDataExportService.getInstance()
      const instance2 = MatrixDataExportService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
