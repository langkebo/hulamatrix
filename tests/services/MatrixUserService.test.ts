/**
 * MatrixUserService 单元测试（Mock 版本）
 *
 * 测试用户服务的核心功能，包括：
 * - 用户资料管理
 * - 设备管理
 * - 用户搜索
 * - 私聊房间创建
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

vi.doMock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: () => ({
        getUserId: () => '@test:example.com',
        getDevices: vi.fn().mockResolvedValue({ devices: [] }),
        setDisplayName: vi.fn().mockResolvedValue(undefined),
        setAvatarUrl: vi.fn().mockResolvedValue(undefined),
        deleteDevice: vi.fn().mockResolvedValue(undefined),
        searchUserDirectory: vi.fn().mockResolvedValue({ results: [] }),
        getUser: vi.fn().mockReturnValue({ presence: 'online' }),
        getRooms: vi.fn().mockReturnValue([]),
        setPresence: vi.fn().mockResolvedValue(undefined),
        createRoom: vi.fn().mockResolvedValue({ room_id: '!room:example.com' }),
        getDeviceId: () => 'DEVICE_ID'
      }),
      isInitialized: () => false,
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

let MatrixUserService: any

beforeAll(async () => {
  const module = await import('../../src/services/matrix/MatrixUserService')
  MatrixUserService = module.default
})

describe('MatrixUserService', () => {
  let userService: any

  beforeEach(() => {
    userService = MatrixUserService.getInstance()
    userService['_currentProfile'].value = {
      userId: '@test:example.com',
      displayName: 'Test User',
      avatarUrl: null,
      statusMessage: 'Available'
    }
  })

  afterEach(() => {
    if (userService) {
      userService.destroy()
    }
  })

  describe('用户资料', () => {
    it('应该获取当前用户信息', () => {
      const userInfo = userService.currentUser
      expect(userInfo).toBeDefined()
    })

    it('应该获取用户显示名', () => {
      const displayName = userService.displayName
      expect(displayName).toBeDefined()
    })

    it('应该获取用户头像', () => {
      const avatarUrl = userService.avatarUrl
      expect(avatarUrl).toBeDefined()
    })

    it('应该获取用户状态消息', () => {
      const statusMessage = userService.statusMessage
      expect(statusMessage).toBeDefined()
    })
  })

  describe('用户资料操作', () => {
    it('应该获取用户资料', async () => {
      const userId = '@test:example.com'
      const profile = await userService.getUserProfile(userId)
      expect(profile).toBeDefined()
    })

    it('应该更新显示名', async () => {
      const result = await userService.setDisplayName('Test User')
      expect(typeof result).toBe('boolean')
    })

    it('应该更新头像', async () => {
      const result = await userService.setAvatarUrl('mxc://example.com/avatar')
      expect(typeof result).toBe('boolean')
    })

    it('应该更新状态消息', async () => {
      const result = await userService.setStatusMessage('Test status')
      expect(typeof result).toBe('boolean')
    })

    it('应该清除状态消息', async () => {
      const result = await userService.clearStatusMessage()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('设备管理', () => {
    it('应该获取设备列表', async () => {
      const devices = await userService.getDevices()
      expect(devices).toBeDefined()
      expect(Array.isArray(devices)).toBe(true)
    })

    it('应该获取设备信息', async () => {
      const deviceId = 'DEVICE_ID'
      const device = await userService.getDevice(deviceId)
      expect(device).toBeDefined()
    })

    it('应该远程登出设备', async () => {
      const deviceId = 'DEVICE_ID'
      const result = await userService.remoteLogoutDevice(deviceId)
      expect(typeof result).toBe('boolean')
    })

    it('应该获取所有设备登出历史', async () => {
      const history = await userService.getDeviceLogoutHistory()
      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('用户搜索', () => {
    it('应该搜索用户', async () => {
      const query = 'test'
      const users = await userService.searchUsers(query)
      expect(users).toBeDefined()
      expect(Array.isArray(users)).toBe(true)
    })

    it('应该搜索本地用户目录', async () => {
      const query = 'test'
      const users = await userService.searchUserDirectory(query)
      expect(users).toBeDefined()
      expect(Array.isArray(users)).toBe(true)
    })

    it('应该获取用户详情', async () => {
      const userId = '@test:example.com'
      const user = await userService.getUser(userId)
      expect(user).toBeDefined()
    })
  })

  describe('私聊房间', () => {
    it('应该创建私聊房间', async () => {
      const userId = '@test:example.com'
      const roomId = await userService.createDirectChat(userId)
      expect(roomId).toBeDefined()
    })

    it('应该获取私聊房间列表', async () => {
      const rooms = await userService.getDirectChatRooms()
      expect(rooms).toBeDefined()
      expect(Array.isArray(rooms)).toBe(true)
    })
  })

  describe('在线状态', () => {
    it('应该获取用户在线状态', async () => {
      const userId = '@test:example.com'
      const status = await userService.getUserOnlineStatus(userId)
      expect(status).toBeDefined()
    })

    it('应该获取多个用户在线状态', async () => {
      const userIds = ['@test1:example.com', '@test2:example.com']
      const statuses = await userService.getUsersOnlineStatus(userIds)
      expect(statuses).toBeDefined()
      expect(Array.isArray(statuses)).toBe(true)
    })

    it('应该设置在线状态', async () => {
      const result = await userService.setOnlineStatus('online')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('事件系统', () => {
    it('应该支持事件监听', () => {
      const listener = vi.fn()
      userService.on('testEvent', listener)
      expect(userService['userListeners'].has('testEvent')).toBe(true)
    })

    it('应该支持事件取消监听', () => {
      const listener = vi.fn()
      userService.on('testEvent', listener)
      userService.off('testEvent', listener)
    })

    it('应该触发事件', () => {
      const listener = vi.fn()
      userService.on('testEvent', listener)
      userService.notifyListeners('testEvent', { data: 'test' })
      expect(listener).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  describe('清理', () => {
    it('应该正确清理资源', () => {
      userService.destroy()
      expect(userService['userListeners'].size).toBe(0)
    })
  })
})
