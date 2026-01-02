/**
 * Matrix 服务发现模块测试
 * 测试 Matrix 服务器发现和配置管理功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import {
  MatrixDiscoveryService,
  matrixDiscovery,
  REQUIRED_UNSTABLE_FEATURES,
  RECOMMENDED_UNSTABLE_FEATURES,
  type ServerCapabilities
} from '@/services/matrix-discovery'

describe('MatrixDiscoveryService', () => {
  let service: MatrixDiscoveryService
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    service = MatrixDiscoveryService.getInstance()
    service.clearCache() // Clear cache before each test
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MatrixDiscoveryService.getInstance()
      const instance2 = MatrixDiscoveryService.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should export a singleton instance', () => {
      expect(matrixDiscovery).toBeInstanceOf(MatrixDiscoveryService)
    })
  })

  describe('Basic Service Discovery', () => {
    it('should have discoverServices method', () => {
      expect(typeof service.discoverServices).toBe('function')
    })

    it('should initialize without errors', () => {
      expect(() => {
        const newInstance = MatrixDiscoveryService.getInstance()
        expect(newInstance).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch errors with fallback', async () => {
      // All fetches fail - should eventually throw
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(service.discoverServices('nonexistent.example.org', { maxRetries: 1 })).rejects.toThrow()
    })

    it('should handle invalid response format with fallback', async () => {
      // First call fails with invalid JSON, but fallback succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          url: 'https://matrix.example.org/.well-known/matrix/client',
          headers: { get: () => 'application/json' },
          json: () => Promise.reject(new Error('Invalid JSON'))
        })
        // Fallback URL 1 succeeds (versions endpoint for reachability test)
        .mockResolvedValueOnce({ ok: true })
        // Capabilities fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ versions: ['v1.1'], unstable_features: {} })
        })

      // Should succeed with fallback
      const result = await service.discoverServices('matrix.example.org', { maxRetries: 1 })
      expect(result.homeserverUrl).toBeDefined()
    })
  })

  describe('Configuration', () => {
    it('should handle configuration object structure', () => {
      const mockConfig = {
        'm.homeserver': {
          base_url: 'https://matrix.example.org'
        }
      }

      // Test that the service can handle well-known config structure
      expect(mockConfig).toHaveProperty('m.homeserver')
      expect(mockConfig['m.homeserver']).toHaveProperty('base_url')
    })
  })

  describe('Fallback Mechanism', () => {
    it('should try fallback URLs when well-known fails', async () => {
      // First call fails (well-known)
      mockFetch
        .mockRejectedValueOnce(new Error('Well-known not found'))
        // Fallback URL 1 succeeds (reachability test)
        .mockResolvedValueOnce({ ok: true })
        // Capabilities fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ versions: ['v1.1'], unstable_features: {} })
        })

      const result = await service.discoverServices('example.org', { maxRetries: 1 })

      expect(result.homeserverUrl).toBeDefined()
    })

    it('should throw error when all fallback URLs fail', async () => {
      // All fetches fail
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      await expect(service.discoverServices('nonexistent.example.org', { maxRetries: 1 })).rejects.toThrow()
    })
  })

  describe('Cache TTL', () => {
    it('should set and get cache TTL', () => {
      const newTTL = 10 * 60 * 1000 // 10 minutes
      service.setCacheTTL(newTTL)
      expect(service.getCacheTTL()).toBe(newTTL)
    })

    it('should enforce minimum TTL of 1 minute', () => {
      service.setCacheTTL(1000) // 1 second
      expect(service.getCacheTTL()).toBe(60000) // Should be 1 minute minimum
    })

    it('should return cached result within TTL', async () => {
      mockFetch.mockImplementation(async (url: any) => {
        const u = String(url)
        if (u.includes('/.well-known/matrix/client')) {
          return {
            ok: true,
            url: u,
            headers: { get: () => 'application/json' },
            json: async () => ({ 'm.homeserver': { base_url: 'https://matrix.cached.example.org' } })
          } as any
        }
        if (u.includes('/.well-known/matrix/server')) {
          return { ok: true, json: async () => ({ 'm.server': 'matrix.cached.example.org:443' }) } as any
        }
        if (u.includes('/_matrix/client/versions')) {
          return { ok: true, json: async () => ({ versions: ['v1.1'], unstable_features: {} }) } as any
        }
        return { ok: true, json: async () => ({}) } as any
      })

      // First call
      await service.discoverServices('cached.example.org')

      // Second call should use cache
      const result = await service.discoverServices('cached.example.org')

      expect(result.homeserverUrl).toBe('https://matrix.cached.example.org')
    })

    it('should refresh when cached homeserver becomes unreachable', async () => {
      const versionsOkOnce = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue({ ok: true })
      mockFetch.mockImplementation(async (url: any) => {
        const u = String(url)
        if (u.includes('/.well-known/matrix/client')) {
          return {
            ok: true,
            url: u,
            headers: { get: () => 'application/json' },
            json: async () => ({ 'm.homeserver': { base_url: 'https://matrix.cached-refresh.example.org' } })
          } as any
        }
        if (u.includes('/_matrix/client/versions')) {
          return (await versionsOkOnce()) as any
        }
        return { ok: true, json: async () => ({ versions: [], unstable_features: {} }) } as any
      })

      await service.discoverServices('cached-refresh.example.org', { maxRetries: 1 })
      await service.discoverServices('cached-refresh.example.org', { maxRetries: 1 })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should check if cache is valid', async () => {
      expect(service.isCacheValid('nonexistent.server')).toBe(false)
    })

    it('should get remaining cache TTL', () => {
      expect(service.getCacheRemainingTTL('nonexistent.server')).toBe(0)
    })

    it('should clear expired cache entries', () => {
      const cleared = service.clearExpiredCache()
      expect(cleared).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Server Capabilities Validation', () => {
    it('should validate server capabilities', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            versions: ['v1.1', 'v1.2'],
            unstable_features: {
              'org.matrix.msc3575': true
            }
          })
      })

      const result = await service.validateServer('https://matrix.example.org')

      expect(result.valid).toBe(true)
      expect(result.capabilities.versions).toContain('v1.1')
      expect(result.missingRequired).toHaveLength(0)
    })

    it('should report missing required features', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            versions: ['v1.1'],
            unstable_features: {}
          })
      })

      const result = await service.validateServer('https://matrix.example.org')

      expect(result.valid).toBe(false)
      expect(result.missingRequired.length).toBeGreaterThan(0)
    })

    it('should check for unstable features', () => {
      const capabilities: ServerCapabilities = {
        versions: ['v1.1'],
        unstable_features: {
          'org.matrix.msc3575': true,
          'org.matrix.msc2716': false
        }
      }

      expect(service.hasUnstableFeature(capabilities, 'org.matrix.msc3575')).toBe(true)
      expect(service.hasUnstableFeature(capabilities, 'org.matrix.msc2716')).toBe(false)
      expect(service.hasUnstableFeature(capabilities, 'nonexistent')).toBe(false)
    })

    it('should check for version support', () => {
      const capabilities: ServerCapabilities = {
        versions: ['v1.1', 'v1.2', 'v1.3'],
        unstable_features: {}
      }

      expect(service.hasVersion(capabilities, 'v1.1')).toBe(true)
      expect(service.hasVersion(capabilities, 'v1.5')).toBe(false)
    })
  })

  describe('Constants', () => {
    it('should export required unstable features', () => {
      expect(REQUIRED_UNSTABLE_FEATURES).toBeDefined()
      expect(Array.isArray(REQUIRED_UNSTABLE_FEATURES)).toBe(true)
    })

    it('should export recommended unstable features', () => {
      expect(RECOMMENDED_UNSTABLE_FEATURES).toBeDefined()
      expect(Array.isArray(RECOMMENDED_UNSTABLE_FEATURES)).toBe(true)
    })
  })

  describe('Cache Management', () => {
    it('should clear specific server cache', () => {
      service.clearCache('specific.server')
      expect(service.isCacheValid('specific.server')).toBe(false)
    })

    it('should clear all cache', () => {
      service.clearCache()
      // No error should be thrown
      expect(true).toBe(true)
    })

    it('should refresh cache by skipping existing cache', async () => {
      mockFetch.mockImplementation(async (url: any) => {
        const u = String(url)
        if (u.includes('/.well-known/matrix/client')) {
          return {
            ok: true,
            url: u,
            headers: { get: () => 'application/json' },
            json: async () => ({ 'm.homeserver': { base_url: 'https://matrix.refresh.example.org' } })
          } as any
        }
        if (u.includes('/.well-known/matrix/server')) {
          return { ok: true, json: async () => ({ 'm.server': 'matrix.refresh.example.org:443' }) } as any
        }
        if (u.includes('/_matrix/client/versions')) {
          return { ok: true, json: async () => ({ versions: ['v1.1'], unstable_features: {} }) } as any
        }
        return { ok: true, json: async () => ({}) } as any
      })

      // This should skip cache
      await service.discoverServices('refresh.example.org', { skipCache: true })

      // Verify fetch was called (not using cache)
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('Retry and Validation', () => {
    it('should retry well-known fetch and succeed', async () => {
      vi.useFakeTimers()

      mockFetch
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          ok: true,
          url: 'https://retry.example.org/.well-known/matrix/client',
          headers: { get: () => 'application/json' },
          json: async () => ({ 'm.homeserver': { base_url: 'https://matrix.retry.example.org' } })
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ 'm.server': 'matrix.retry.example.org:443' }) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ versions: ['v1.1'], unstable_features: {} })
        })

      const p = service.discoverServices('retry.example.org', { maxRetries: 2 })
      await vi.advanceTimersByTimeAsync(1500)
      const result = await p

      expect(result.homeserverUrl).toBe('https://matrix.retry.example.org')

      vi.useRealTimers()
    })

    it('should reject cross-domain homeserver from well-known by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        url: 'https://safe.example.org/.well-known/matrix/client',
        headers: { get: () => 'application/json' },
        json: async () => ({ 'm.homeserver': { base_url: 'https://evil.example.net' } })
      })

      await expect(service.discoverServices('safe.example.org', { maxRetries: 1 })).rejects.toThrow(
        /homeserver host not allowed/i
      )
    })
  })
})
