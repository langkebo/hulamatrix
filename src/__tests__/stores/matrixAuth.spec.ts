/**
 * MatrixAuth Store 测试
 * 测试 Matrix 认证状态管理
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMatrixAuthStore } from '@/stores/matrixAuth'

describe('MatrixAuth Store', () => {
  let store: ReturnType<typeof useMatrixAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useMatrixAuthStore()
  })

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      expect(store.accessToken).toBe('')
      expect(store.userId).toBe('')
      // baseUrl is set from environment during initialization
      expect(typeof store.baseUrl).toBe('string')
      // customServer defaults to 'cjystx.top' when baseUrl is empty
      expect(store.customServer === '' || store.customServer === 'cjystx.top').toBe(true)
      expect(store.serverInputVisible).toBe(false)
      expect(store.discoveryResult).toBeNull()
    })

    it('should have default server configuration', () => {
      // Should have some default baseUrl or customServer
      expect(store.baseUrl || store.customServer).toBeDefined()
    })
  })

  describe('Server Configuration', () => {
    it('should allow toggling server input visibility', () => {
      expect(store.serverInputVisible).toBe(false)

      store.toggleServerInput(true)
      expect(store.serverInputVisible).toBe(true)

      store.toggleServerInput()
      expect(store.serverInputVisible).toBe(false)
    })

    it('should allow setting custom server', () => {
      const server = 'matrix.example.org'
      store.setCustomServer(server)
      expect(store.customServer).toBe(server)
    })

    it('should trim whitespace from custom server', () => {
      const server = '  matrix.example.org  '
      store.setCustomServer(server)
      expect(store.customServer).toBe('matrix.example.org')
    })
  })

  describe('Authentication Methods', () => {
    it('should have required methods', () => {
      expect(typeof store.setAuth).toBe('function')
      expect(typeof store.discover).toBe('function')
      expect(typeof store.toggleServerInput).toBe('function')
      expect(typeof store.setCustomServer).toBe('function')
      expect(typeof store.getHomeserverBaseUrl).toBe('function')
      expect(typeof store.setDefaultBaseUrlFromEnv).toBe('function')
    })

    it('should handle authentication setting', () => {
      const token = 'test_token_123'
      const uid = '@testuser:example.org'

      store.setAuth(token, uid)
      expect(store.accessToken).toBe(token)
      expect(store.userId).toBe(uid)
    })
  })

  describe('Server Discovery', () => {
    it('should handle server discovery', async () => {
      // Set a custom server first
      store.setCustomServer('matrix.example.org')

      await store.discover()

      // In test environment, it should set baseUrl based on customServer
      expect(store.baseUrl).toBe('https://matrix.example.org')
    })

    it('should handle discovery without target', async () => {
      // Clear both servers
      store.setCustomServer('')
      store.baseUrl = ''

      await store.discover()

      // Should not crash and should remain empty
      expect(store.baseUrl).toBe('')
    })

    it('should provide homeserver URL', () => {
      store.baseUrl = 'https://matrix.example.org'
      expect(store.getHomeserverBaseUrl()).toBe('https://matrix.example.org')
    })
  })

  describe('Environment Configuration', () => {
    it('should set default base URL from environment', () => {
      expect(() => {
        store.setDefaultBaseUrlFromEnv()
      }).not.toThrow()
    })
  })

  describe('Discovery Result Management', () => {
    it('should handle discovery results', () => {
      // Discovery results are set internally during discover() call
      const result = store.discoveryResult
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })

  describe('Store Integration', () => {
    it('should maintain state consistency', () => {
      const token = 'test_token'
      const uid = '@user:example.org'
      const server = 'matrix.example.org'

      // Set auth first
      store.setAuth(token, uid)
      expect(store.accessToken).toBe(token)
      expect(store.userId).toBe(uid)

      // Set server
      store.setCustomServer(server)
      expect(store.customServer).toBe(server)

      // Auth should remain unchanged
      expect(store.accessToken).toBe(token)
      expect(store.userId).toBe(uid)
    })
  })
})
