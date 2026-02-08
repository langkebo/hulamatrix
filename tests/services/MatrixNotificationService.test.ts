/**
 * MatrixNotificationService 单元测试（Mock 版本）
 *
 * 测试通知服务的核心功能，包括：
 * - 推送规则管理
 * - 通知权限检查
 * - 静音控制
 * - 高亮词管理
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

vi.doMock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: () => ({
        getPushRules: vi.fn().mockResolvedValue({
          global: {
            override: [],
            room: [],
            sender: [],
            content: [],
            underride: []
          }
        }),
        setPushRuleEnabled: vi.fn().mockResolvedValue(undefined),
        addPushRule: vi.fn().mockResolvedValue(undefined),
        deletePushRule: vi.fn().mockResolvedValue(undefined),
        getRooms: vi.fn().mockReturnValue([])
      }),
      isInitialized: () => false,
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

let MatrixNotificationService: any

beforeAll(async () => {
  const module = await import('../../src/services/matrix/MatrixNotificationService')
  MatrixNotificationService = module.default
})

describe('MatrixNotificationService', () => {
  let notificationService: any

  beforeEach(() => {
    notificationService = MatrixNotificationService.getInstance()
    notificationService['mutedRooms'] = new Set()
    notificationService['pushRules'] = {
      global: {
        override: [],
        room: [],
        sender: [],
        content: [],
        underride: []
      }
    }
    notificationService['highlightKeywords'] = []
    notificationService['_pushRules'].value = []
    notificationService['_settings'].value = {
      enabled: true,
      sound: true,
      desktop: true,
      desktopPreview: 'all',
      mentionOnly: false,
      dndEnabled: false,
      dndStart: 0,
      dndEnd: 0
    }
  })

  afterEach(() => {
    if (notificationService) {
      notificationService.destroy()
    }
  })

  describe('推送规则管理', () => {
    it('应该返回全局规则', () => {
      const rules = notificationService.globalRules
      expect(rules).toBeDefined()
      expect(Array.isArray(rules)).toBe(true)
    })

    it('应该返回房间规则', () => {
      const rules = notificationService.roomRules
      expect(rules).toBeDefined()
      expect(Array.isArray(rules)).toBe(true)
    })

    it('应该返回内容规则', () => {
      const rules = notificationService.contentRules
      expect(rules).toBeDefined()
      expect(Array.isArray(rules)).toBe(true)
    })

    it('应该返回禁用规则', () => {
      const rules = notificationService.disabledRules
      expect(rules).toBeDefined()
      expect(Array.isArray(rules)).toBe(true)
    })
  })

  describe('房间通知设置', () => {
    it('应该获取房间通知设置', async () => {
      const settings = await notificationService.getRoomNotificationSettings()
      expect(settings).toBeDefined()
      expect(Array.isArray(settings)).toBe(true)
    })

    it('设置应该包含必要字段', async () => {
      const settings = await notificationService.getRoomNotificationSettings()

      if (settings.length > 0) {
        const first = settings[0]
        expect(first).toHaveProperty('roomId')
        expect(first).toHaveProperty('notificationsEnabled')
        expect(first).toHaveProperty('soundEnabled')
        expect(first).toHaveProperty('highlightEnabled')
        expect(first).toHaveProperty('name')
      }
    })
  })

  describe('静音控制', () => {
    it('应该静音房间', async () => {
      const roomId = '!test:example.com'
      const result = await notificationService.muteRoom(roomId)
      expect(typeof result).toBe('boolean')
    })

    it('应该取消房间静音', async () => {
      const roomId = '!test:example.com'
      const result = await notificationService.unmuteRoom(roomId)
      expect(typeof result).toBe('boolean')
    })

    it('应该检查房间是否已静音', () => {
      const isMuted = notificationService.isRoomMuted('!test:example.com')
      expect(typeof isMuted).toBe('boolean')
    })
  })

  describe('规则启用/禁用', () => {
    it('应该启用规则', async () => {
      const ruleId = 'test-rule'
      const result = await notificationService.enablePushRule(ruleId)
      expect(typeof result).toBe('boolean')
    })

    it('应该禁用规则', async () => {
      const ruleId = 'test-rule'
      const result = await notificationService.disablePushRule(ruleId)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('通知权限', () => {
    it('应该请求通知权限', async () => {
      const result = await notificationService.requestNotificationPermission()
      expect(typeof result).toBe('string')
    })

    it('应该检查通知权限状态', () => {
      const status = notificationService.getNotificationPermissionStatus()
      expect(['granted', 'denied', 'default', 'unsupported']).toContain(status)
    })

    it('应该返回是否支持通知', () => {
      const supported = notificationService.isNotificationSupported()
      expect(typeof supported).toBe('boolean')
    })
  })

  describe('高亮词管理', () => {
    it('应该添加高亮词', async () => {
      const word = 'test-keyword'
      const result = await notificationService.addHighlightKeyword(word)
      expect(typeof result).toBe('boolean')
    })

    it('应该移除高亮词', async () => {
      const word = 'test-keyword'
      const result = await notificationService.removeHighlightKeyword(word)
      expect(typeof result).toBe('boolean')
    })

    it('应该返回高亮词列表', () => {
      const keywords = notificationService.getHighlightKeywords()
      expect(Array.isArray(keywords)).toBe(true)
    })
  })

  describe('事件系统', () => {
    it('应该支持事件监听', () => {
      const listener = vi.fn()
      notificationService.on('testEvent', listener)
      expect(notificationService['notificationListeners'].has('testEvent')).toBe(true)
    })

    it('应该支持事件取消监听', () => {
      const listener = vi.fn()
      notificationService.on('testEvent', listener)
      notificationService.off('testEvent', listener)
    })

    it('应该触发事件', () => {
      const listener = vi.fn()
      notificationService.on('testEvent', listener)
      notificationService.notifyListeners('testEvent', { data: 'test' })
      expect(listener).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  describe('通知状态', () => {
    it('应该返回当前通知状态', () => {
      const status = notificationService.notificationStatus
      expect(status).toHaveProperty('isEnabled')
      expect(status).toHaveProperty('permission')
      expect(status).toHaveProperty('roomCount')
    })
  })

  describe('清理', () => {
    it('应该正确清理资源', () => {
      notificationService.destroy()
      expect(notificationService['notificationListeners'].size).toBe(0)
    })
  })
})
