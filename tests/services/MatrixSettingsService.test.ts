import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixSettingsService from '@/services/matrix/MatrixSettingsService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const createMockClient = () => ({
  getAccountData: vi.fn(() => null),
  setAccountData: vi.fn().mockResolvedValue(undefined),
  getRoom: vi.fn(() => null)
})

describe('MatrixSettingsService', () => {
  let _mockClient: ReturnType<typeof createMockClient>
  let clientServiceInstance: ReturnType<typeof MatrixClientService.getInstance>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _mockClient = createMockClient()
    clientServiceInstance = MatrixClientService.getInstance()
    vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    const service = MatrixSettingsService.getInstance()
    service.resetToDefaults()
  })

  describe('getSettings', () => {
    it('should return default settings when no client', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings).toBeDefined()
      expect(settings.appearance).toBeDefined()
      expect(settings.messages).toBeDefined()
      expect(settings.calls).toBeDefined()
      expect(settings.accessibility).toBeDefined()
      expect(settings.labs).toBeDefined()
    })

    it('should have correct default appearance settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings.appearance.theme).toBe('dark')
      expect(settings.appearance.language).toBe('zh-CN')
      expect(settings.appearance.fontSize).toBe(16)
      expect(settings.appearance.zoom).toBe(100)
    })

    it('should have correct default message settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings.messages.historyLimit).toBe('1m')
      expect(settings.messages.autoRead).toBe(false)
      expect(settings.messages.emojiPanel).toBe(true)
      expect(settings.messages.gifSearch).toBe(true)
    })

    it('should have correct default call settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings.calls.camera).toBe('')
      expect(settings.calls.microphone).toBe('')
      expect(settings.calls.speaker).toBe('')
      expect(settings.calls.noiseSuppression).toBe(true)
      expect(settings.calls.autoAnswer).toBe(false)
      expect(settings.calls.videoQuality).toBe('high')
    })

    it('should have correct default accessibility settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings.accessibility.screenReader).toBe(false)
      expect(settings.accessibility.highContrast).toBe(false)
      expect(settings.accessibility.reduceMotion).toBe(false)
      expect(settings.accessibility.keyboardNavigation).toBe(false)
      expect(settings.accessibility.fontSize).toBe(16)
    })

    it('should have correct default labs settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getSettings()

      expect(settings.labs).toBeDefined()
      expect(settings.labs.enabled).toBe(true)
      expect(Array.isArray(settings.labs.features)).toBe(true)
    })
  })

  describe('updateSettings', () => {
    it('should return true on successful update', async () => {
      const service = MatrixSettingsService.getInstance()
      const result = await service.updateSettings({
        appearance: { theme: 'light', language: 'en-US', fontSize: 18, zoom: 100 }
      })
      expect(result).toBe(true)
    })

    it('should update theme setting', async () => {
      const service = MatrixSettingsService.getInstance()
      await service.updateSettings({
        appearance: { theme: 'light', language: 'zh-CN', fontSize: 16, zoom: 100 }
      })
      const settings = await service.getSettings()
      expect(settings.appearance.theme).toBe('light')
    })

    it('should update language setting', async () => {
      const service = MatrixSettingsService.getInstance()
      await service.updateSettings({
        appearance: { theme: 'dark', language: 'en-US', fontSize: 16, zoom: 100 }
      })
      const settings = await service.getSettings()
      expect(settings.appearance.language).toBe('en-US')
    })

    it('should update multiple settings at once', async () => {
      const service = MatrixSettingsService.getInstance()
      await service.updateSettings({
        appearance: { theme: 'light', language: 'zh-CN', fontSize: 18, zoom: 100 },
        messages: { autoRead: true, historyLimit: '1m', emojiPanel: true, gifSearch: true }
      })
      const settings = await service.getSettings()
      expect(settings.appearance.theme).toBe('light')
      expect(settings.appearance.fontSize).toBe(18)
      expect(settings.messages.autoRead).toBe(true)
    })
  })

  describe('getNotificationSettings', () => {
    it('should return default notification settings without roomId', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getNotificationSettings()

      expect(settings.notifications).toBe('all')
      expect(settings.sound).toBe(true)
      expect(settings.desktop).toBe(true)
      expect(settings.highlights).toEqual([])
    })

    it('should return default notification settings without client', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getNotificationSettings('!room:example.com')

      expect(settings.roomId).toBe('!room:example.com')
      expect(settings.notifications).toBe('all')
    })
  })

  describe('setNotificationSettings', () => {
    it('should return false when no client', async () => {
      const service = MatrixSettingsService.getInstance()
      const result = await service.setNotificationSettings('!room:example.com', {
        notifications: 'mention',
        sound: true,
        desktop: true,
        highlights: []
      })
      expect(result).toBe(false)
    })

    it('should return true when client is available', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ notifications: 'all', sound: true, desktop: true, highlights: [] })
        })),
        setAccountData: vi.fn().mockResolvedValue(undefined),
        getRoom: vi.fn(() => ({}))
      } as any)

      const service = MatrixSettingsService.getInstance()
      const result = await service.setNotificationSettings('!room:example.com', {
        notifications: 'mention',
        sound: true,
        desktop: true,
        highlights: []
      })
      expect(result).toBe(true)
    })
  })

  describe('getPrivacySettings', () => {
    it('should return default privacy settings', async () => {
      const service = MatrixSettingsService.getInstance()
      const settings = await service.getPrivacySettings()

      expect(settings.readReceipts).toBe(true)
      expect(settings.typingIndicator).toBe(true)
      expect(settings.linkPreviews).toBe(true)
      expect(settings.autoDownload).toBe(false)
    })
  })

  describe('setPrivacySettings', () => {
    it('should return false when no client', async () => {
      const service = MatrixSettingsService.getInstance()
      const result = await service.setPrivacySettings({
        readReceipts: false,
        typingIndicator: true,
        linkPreviews: true,
        autoDownload: false,
        allowUserDiscover: true,
        allowGroupInvites: true,
        profileVisibility: 'public',
        presenceVisibility: 'public'
      })
      expect(result).toBe(false)
    })

    it('should return true when client is available', async () => {
      vi.spyOn(clientServiceInstance, 'getClient').mockReturnValue({
        getAccountData: vi.fn(() => null),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      } as any)

      const service = MatrixSettingsService.getInstance()
      const result = await service.setPrivacySettings({
        readReceipts: false,
        typingIndicator: true,
        linkPreviews: true,
        autoDownload: false,
        allowUserDiscover: true,
        allowGroupInvites: true,
        profileVisibility: 'public',
        presenceVisibility: 'public'
      })
      expect(result).toBe(true)
    })
  })

  describe('saveAllSettings', () => {
    it('should not throw error', async () => {
      const service = MatrixSettingsService.getInstance()
      await expect(
        service.saveAllSettings({
          appearance: { theme: 'dark', language: 'zh-CN', fontSize: 16, zoom: 100 },
          messages: { historyLimit: '1m', autoRead: false, emojiPanel: true, gifSearch: true },
          calls: {
            camera: '',
            microphone: '',
            speaker: '',
            noiseSuppression: true,
            autoAnswer: false,
            videoQuality: 'high'
          },
          accessibility: {
            screenReader: false,
            highContrast: false,
            reduceMotion: false,
            keyboardNavigation: false,
            fontSize: 16
          },
          labs: { enabled: true, features: [] }
        })
      ).resolves.not.toThrow()
    })
  })

  describe('resetToDefaults', () => {
    it('should reset settings to defaults', async () => {
      const service = MatrixSettingsService.getInstance()
      await service.updateSettings({
        appearance: { theme: 'light', language: 'zh-CN', fontSize: 16, zoom: 100 }
      })
      await service.resetToDefaults()
      const settings = await service.getSettings()
      expect(settings.appearance.theme).toBe('dark')
    })
  })

  describe('exportSettings', () => {
    it('should return valid JSON string', () => {
      const service = MatrixSettingsService.getInstance()
      const exported = service.exportSettings()

      expect(() => JSON.parse(exported)).not.toThrow()
    })

    it('should contain all setting categories', () => {
      const service = MatrixSettingsService.getInstance()
      const exported = JSON.parse(service.exportSettings())

      expect(exported.appearance).toBeDefined()
      expect(exported.messages).toBeDefined()
      expect(exported.calls).toBeDefined()
      expect(exported.accessibility).toBeDefined()
      expect(exported.labs).toBeDefined()
    })
  })

  describe('importSettings', () => {
    it('should return true for valid JSON', async () => {
      const service = MatrixSettingsService.getInstance()
      const settingsJson = JSON.stringify({
        appearance: { theme: 'light', language: 'zh-CN', fontSize: 16, zoom: 100 }
      })

      const result = await service.importSettings(settingsJson)
      expect(result).toBe(true)
    })

    it('should return false for invalid JSON', async () => {
      const service = MatrixSettingsService.getInstance()
      const result = await service.importSettings('invalid json')

      expect(result).toBe(false)
    })
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MatrixSettingsService.getInstance()
      const instance2 = MatrixSettingsService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
