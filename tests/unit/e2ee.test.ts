/**
 * E2EE 功能测试
 * 测试端到端加密的核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMatrixE2EEManager } from '@/integrations/matrix/e2ee'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('MatrixE2EEManager', () => {
  let e2eeManager: any
  let mockClient: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Matrix Client
    mockClient = {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      isCryptoEnabled: vi.fn(() => true),
      isInitialSyncComplete: vi.fn(() => true),
      getCrypto: vi.fn(() => ({
        setDeviceVerificationStatus: vi.fn(),
        getDeviceList: vi.fn().mockReturnValue([]),
        requestVerification: vi.fn().mockResolvedValue({}),
        acceptVerification: vi.fn().mockResolvedValue({}),
        confirmVerification: vi.fn().mockResolvedValue({}),
        exportRoomKeys: vi.fn().mockResolvedValue({}),
        importRoomKeys: vi.fn().mockResolvedValue({}),
        getSecretStorageKey: vi.fn().mockResolvedValue({}),
        getDefaultSecretStorageKey: vi.fn().mockResolvedValue({}),
        isSecretStorageReady: vi.fn().mockReturnValue(false),
        enableSecretStorage: vi.fn().mockResolvedValue({}),
        getDefaultKeyBackupVersion: vi.fn().mockResolvedValue(null),
        getKeyBackupEnabled: vi.fn().mockResolvedValue(false),
        enableKeyBackup: vi.fn().mockResolvedValue({}),
        requestKeyBackupVersion: vi.fn().mockResolvedValue({}),
        trustCrossSigningDevices: vi.fn().mockResolvedValue({}),
        bootstrapCrossSigning: vi.fn().mockResolvedValue({}),
        bootstrapSecretStorage: vi.fn().mockResolvedValue({}),
        getCrossSigningStatus: vi.fn().mockResolvedValue({
          userMasterKey: { publicKey: 'key1', trusted: true },
          selfSigningKey: { publicKey: 'key2', trusted: true },
          userSigningKey: { publicKey: 'key3', trusted: true }
        }),
        getRoomEncryptionState: vi.fn().mockReturnValue({
          encrypted: true,
          trustState: { trusted: true },
          blacklistedUnverifiedDevices: false,
          blacklistedDevices: []
        })
      })),
      getRoom: vi.fn().mockReturnValue({
        hasEncryptionStateEvent: () => true
      }),
      getRooms: vi.fn(() => [{ roomId: '!room1:example.org' }, { roomId: '!room2:example.org' }]),
      setDeviceDisplayName: vi.fn().mockResolvedValue({}),
      sendEvent: vi.fn().mockResolvedValue({}),
      createRoom: vi.fn().mockResolvedValue({ room_id: '!test:example.org' }),
      getDevices: vi.fn().mockResolvedValue([]),
      getDeviceList: vi.fn().mockResolvedValue([]),
      getUserDevices: vi.fn().mockResolvedValue([]),
      setDeviceVerified: vi.fn().mockResolvedValue({}),
      checkDeviceTrust: vi.fn().mockResolvedValue({}),
      downloadKeys: vi.fn().mockResolvedValue({}),
      getRoomEncryption: vi.fn().mockResolvedValue({}),
      setRoomEncryption: vi.fn().mockResolvedValue({}),
      getOwnDevices: vi.fn().mockResolvedValue(new Map()),
      getKeyBackupVersion: vi.fn().mockResolvedValue(null),
      getKeyBackupVersions: vi.fn().mockResolvedValue([]),
      deleteKeyBackupVersion: vi.fn().mockResolvedValue({}),
      prepareKeyBackupVersion: vi
        .fn()
        .mockResolvedValue({ version: '1', algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2' }),
      startKeyBackup: vi.fn().mockResolvedValue({}),
      restoreKeyBackup: vi.fn().mockResolvedValue(true),
      requestDeviceVerification: vi.fn().mockResolvedValue('transaction1'),
      startDeviceVerification: vi.fn().mockResolvedValue({}),
      acceptDeviceVerification: vi.fn().mockResolvedValue({}),
      confirmDeviceVerification: vi.fn().mockResolvedValue({}),
      getQRCode: vi.fn().mockResolvedValue('qr-code-data'),
      scanQRCode: vi.fn().mockResolvedValue(true),
      resetCrossSigning: vi.fn().mockResolvedValue({}),
      setRoomTopic: vi.fn().mockResolvedValue({}),
      sendStateEvent: vi.fn().mockResolvedValue({}),
      setPowerLevel: vi.fn().mockResolvedValue({}),
      getDeviceId: vi.fn().mockReturnValue('device1'),
      getUserId: vi.fn().mockReturnValue('@user:example.org')
    }

    e2eeManager = createMatrixE2EEManager(mockClient as any)
  })

  describe('初始化', () => {
    it('应该成功初始化 E2EE 管理器', async () => {
      const result = await e2eeManager.initialize()
      expect(result).toBe(true)
      expect(mockClient.getCrypto).toHaveBeenCalled()
    })

    it('应该设置加密默认设置', async () => {
      await e2eeManager.initialize()
      expect(mockClient.on).toHaveBeenCalledWith('deviceVerificationChanged', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith('crypto.keyBackupStatus', expect.any(Function))
    })
  })

  describe('设备管理', () => {
    it('应该获取设备列表', async () => {
      await e2eeManager.initialize()
      const devices = await e2eeManager.getDeviceList('@user:example.org')
      expect(Array.isArray(devices)).toBe(true)
    })

    it('应该验证设备', async () => {
      await e2eeManager.initialize()
      const result = await e2eeManager.verifyDevice('DEVICEID')
      expect(result).toBeDefined()
    })

    it('应该阻止设备', async () => {
      await e2eeManager.initialize()
      const result = await e2eeManager.blockDevice('DEVICEID')
      expect(result).toBeDefined()
    })
  })

  describe('密钥备份', () => {
    it('应该创建密钥备份', async () => {
      await e2eeManager.initialize()
      const result = await e2eeManager.createKeyBackup()
      expect(result).toBeDefined()
    })

    it('应该恢复密钥备份', async () => {
      await e2eeManager.initialize()
      mockClient.getKeyBackupVersions.mockResolvedValueOnce([
        { version: '1', algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2' }
      ])
      const result = await e2eeManager.restoreKeyBackup()
      expect(result).toBeDefined()
    })
  })

  describe('房间加密', () => {
    it('应该启用房间加密', async () => {
      await e2eeManager.initialize()
      const result = await e2eeManager.enableRoomEncryption('!room:example.org')
      expect(result).toBe(true)
    })

    it('应该检查房间加密状态', async () => {
      await e2eeManager.initialize()
      const status = e2eeManager.getRoomEncryptionStatus('!room:example.org')
      expect(status).toHaveProperty('encrypted')
      expect(status).toHaveProperty('trusted')
    })
  })

  describe('安全统计', () => {
    it('应该提供安全统计信息', async () => {
      await e2eeManager.initialize()
      const stats = e2eeManager.getSecurityStats()
      expect(stats).toHaveProperty('totalDevices')
      expect(stats).toHaveProperty('verifiedDevices')
      expect(stats).toHaveProperty('securityLevel')
    })

    it('应该计算安全级别', async () => {
      await e2eeManager.initialize()
      const level = e2eeManager.calculateSecurityLevel()
      expect(['low', 'medium', 'high']).toContain(level)
    })
  })

  describe('交叉签名', () => {
    it('应该启用交叉签名', async () => {
      await e2eeManager.initialize()
      const result = await e2eeManager.enableCrossSigning()
      expect(result).toBeDefined()
    })

    it('应该检查交叉签名状态', async () => {
      await e2eeManager.initialize()
      const status = e2eeManager.getCrossSigningStatus()
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('userMasterKey')
    })
  })

  describe('错误处理', () => {
    it('应该处理初始化错误', async () => {
      mockClient.isCryptoEnabled.mockReturnValueOnce(false)
      const result = await e2eeManager.initialize()
      expect(result).toBe(false)
    })

    it('应该处理设备验证错误', async () => {
      mockClient.setDeviceVerified.mockRejectedValueOnce(new Error('Verification failed'))
      await e2eeManager.initialize()
      const result = await e2eeManager.verifyDevice('DEVICEID')
      expect(result).toBe(false)
    })
  })
})
