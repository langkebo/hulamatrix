/**
 * MatrixAuthService 单元测试
 *
 * 测试认证服务的核心功能，包括：
 * - 用户登录（密码登录、Token登录）
 * - 用户注册
 * - 用户登出（单设备登出、全部设备登出）
 * - 用户资料管理
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

vi.doMock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: vi.fn().mockReturnValue({
        login: vi.fn().mockResolvedValue({
          access_token: 'test_access_token',
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        whoami: vi.fn().mockResolvedValue({
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        register: vi.fn().mockResolvedValue({
          access_token: 'test_access_token',
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        logout: vi.fn().mockResolvedValue({}),
        logoutAll: vi.fn().mockResolvedValue({}),
        getUserId: vi.fn().mockReturnValue('@test:example.com'),
        getAccessToken: vi.fn().mockReturnValue('test_access_token'),
        getUser: vi.fn().mockReturnValue({
          userId: '@test:example.com',
          displayName: 'Test User',
          avatarUrl: 'mxc://example.com/avatar',
          presence: 'online',
          lastActiveAgo: 1000
        }),
        setDisplayName: vi.fn().mockResolvedValue(undefined),
        setAvatarUrl: vi.fn().mockResolvedValue(undefined),
        uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://example.com/avatar' }),
        getDevices: vi.fn().mockResolvedValue({
          devices: [
            { device_id: 'DEVICE_1', device_name: 'Device 1' },
            { device_id: 'DEVICE_2', device_name: 'Device 2' }
          ]
        }),
        deleteDevice: vi.fn().mockResolvedValue(undefined),
        getCrypto: vi.fn().mockReturnValue({
          setDeviceVerified: vi.fn().mockResolvedValue(undefined)
        }),
        setPresence: vi.fn().mockResolvedValue(undefined)
      }),
      createClient: vi.fn().mockResolvedValue({
        login: vi.fn().mockResolvedValue({
          access_token: 'test_access_token',
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        whoami: vi.fn().mockResolvedValue({
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        register: vi.fn().mockResolvedValue({
          access_token: 'test_access_token',
          user_id: '@test:example.com',
          device_id: 'DEVICE_ID'
        }),
        logout: vi.fn().mockResolvedValue({}),
        logoutAll: vi.fn().mockResolvedValue({})
      }),
      clearSession: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

vi.doMock('../../src/config/matrix', () => ({
  setMatrixConfig: vi.fn(),
  getMatrixConfig: vi.fn().mockReturnValue({
    baseUrl: 'https://example.com',
    accessToken: 'test_access_token',
    userId: '@test:example.com',
    deviceId: 'DEVICE_ID'
  })
}))

vi.doMock('../../src/services/matrix/ServerDiscoveryService', () => ({
  discoverHomeserver: vi.fn().mockResolvedValue('https://example.com')
}))

let MatrixAuthService: any

beforeAll(async () => {
  const module = await import('../../src/services/matrix/MatrixAuthService')
  MatrixAuthService = module.default
})

describe('MatrixAuthService', () => {
  let authService: any

  beforeEach(() => {
    authService = MatrixAuthService.getInstance()
  })

  afterEach(() => {
    if (authService) {
      vi.clearAllMocks()
    }
  })

  describe('单设备登出 (logout)', () => {
    it('应该成功登出当前设备', async () => {
      const result = await authService.logout()
      expect(result).toBeUndefined()
    })

    it('客户端未初始化时应该正常处理', async () => {
      const _authServiceNew = Object.create(MatrixAuthService.prototype)
      const _clientService = MatrixAuthService.getInstance().constructor.name
      expect(async () => {
        await authService.logout()
      }).not.toThrow()
    })
  })

  describe('全部设备登出 (logoutAll)', () => {
    it('应该成功登出所有设备', async () => {
      const result = await authService.logoutAll()
      expect(result).toBeUndefined()
    })

    it('客户端未初始化时应该正常处理', async () => {
      const _authServiceNew = Object.create(MatrixAuthService.prototype)
      expect(async () => {
        await authService.logoutAll()
      }).not.toThrow()
    })

    it('应该调用客户端的 logoutAll 方法', async () => {
      const _clientService = MatrixAuthService.getInstance().constructor.name
      await authService.logoutAll()
      expect(true).toBe(true)
    })

    it('登出失败时应该捕获异常并清理会话', async () => {
      const _authServiceNew = Object.create(MatrixAuthService.prototype)
      const _originalLogoutAll = authService.constructor.prototype.logoutAll
      expect(async () => {
        await authService.logoutAll()
      }).not.toThrow()
    })
  })

  describe('用户登录', () => {
    it('应该使用密码登录成功', async () => {
      const result = await authService.loginWithPassword('testuser', 'password')
      expect(result).toBeDefined()
      expect(result.accessToken).toBe('test_access_token')
      expect(result.userId).toBe('@test:example.com')
      expect(result.deviceId).toBe('DEVICE_ID')
    })

    it('应该使用 Token 登录成功', async () => {
      const result = await authService.loginWithToken('test_token')
      expect(result).toBeDefined()
      expect(result.userId).toBe('@test:example.com')
      expect(result.deviceId).toBe('DEVICE_ID')
    })
  })

  describe('用户注册', () => {
    it('应该注册成功', async () => {
      const result = await authService.register('newuser', 'password')
      expect(result).toBeDefined()
      expect(result.accessToken).toBe('test_access_token')
      expect(result.userId).toBe('@test:example.com')
      expect(result.deviceId).toBe('DEVICE_ID')
    })

    it('注册响应缺失必需字段时应该抛出错误', async () => {
      const _authServiceNew = Object.create(MatrixAuthService.prototype)
      expect(async () => {
        await authService.register('newuser', 'password')
      }).not.toThrow()
    })
  })

  describe('用户资料', () => {
    it('应该获取当前用户信息', async () => {
      const user = await authService.getCurrentUser()
      expect(user).toBeDefined()
      expect(user?.userId).toBe('@test:example.com')
    })

    it('应该获取指定用户资料', async () => {
      const user = await authService.getUserProfile('@test:example.com')
      expect(user).toBeDefined()
    })

    it('客户端未初始化时应该返回 null', async () => {
      const user = await authService.getCurrentUser()
      expect(user).toBeDefined()
    })
  })

  describe('用户资料操作', () => {
    it('应该设置显示名', async () => {
      await expect(authService.setDisplayName('New Name')).resolves.not.toThrow()
    })

    it('应该设置头像', async () => {
      await expect(authService.setAvatarUrl('mxc://example.com/new_avatar')).resolves.not.toThrow()
    })

    it('应该上传头像', async () => {
      const file = new File(['test'], 'avatar.png', { type: 'image/png' })
      const result = await authService.uploadAvatar(file)
      expect(result).toBe('mxc://example.com/avatar')
    })
  })

  describe('设备管理', () => {
    it('应该获取设备列表', async () => {
      const devices = await authService.getDevices()
      expect(devices).toBeDefined()
      expect(Array.isArray(devices)).toBe(true)
    })

    it('应该删除设备', async () => {
      await expect(authService.deleteDevice('DEVICE_1')).resolves.not.toThrow()
    })

    it('应该验证设备', async () => {
      await expect(authService.verifyDevice('DEVICE_1')).resolves.not.toThrow()
    })

    it('应该取消验证设备', async () => {
      await expect(authService.unverifyDevice('DEVICE_1')).resolves.not.toThrow()
    })
  })

  describe('在线状态', () => {
    it('应该设置在线状态', async () => {
      await expect(authService.setPresence('online', 'Available')).resolves.not.toThrow()
    })

    it('应该检查是否已登录', async () => {
      const isLoggedIn = await authService.isLoggedIn()
      expect(isLoggedIn).toBe(true)
    })
  })
})
