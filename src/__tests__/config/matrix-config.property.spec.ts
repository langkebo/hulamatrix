/**
 * Matrix Config Property-Based Tests
 * Tests for config discovery consistency
 *
 * **Feature: project-redundancy-cleanup, Property 1: Config Discovery Consistency**
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock the discovery module
vi.mock('@/integrations/matrix/discovery', () => ({
  safeAutoDiscovery: vi.fn()
}))

import { discoverServer, clearDiscoveryCache, getMatrixConfigState } from '@/config/matrix-config'
import { safeAutoDiscovery } from '@/integrations/matrix/discovery'

// Get the mock function reference
const mockSafeAutoDiscovery = vi.mocked(safeAutoDiscovery)

describe('Matrix Config Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearDiscoveryCache()
    mockSafeAutoDiscovery.mockReset()
  })

  afterEach(() => {
    clearDiscoveryCache()
    vi.clearAllMocks()
  })

  /**
   * Property-Based Test: Config Discovery Consistency
   * **Feature: project-redundancy-cleanup, Property 1: Config Discovery Consistency**
   * **Validates: Requirements 1.2**
   *
   * *For any* valid server name, calling `discoverServer()` multiple times
   * with the same server name should return equivalent results (cached or fresh).
   */
  describe('Property 1: Config Discovery Consistency', () => {
    // Generate valid server name patterns
    const validServerNameArb = fc.oneof(
      // Simple domain names
      fc.stringMatching(/^[a-z][a-z0-9-]{2,10}\.[a-z]{2,4}$/),
      // Subdomains
      fc.stringMatching(/^[a-z][a-z0-9-]{1,5}\.[a-z][a-z0-9-]{2,8}\.[a-z]{2,4}$/),
      // Common patterns
      fc.constantFrom('example.org', 'matrix.example.org', 'test.example.com', 'chat.example.net', 'server.example.io')
    )

    it('should return equivalent results for repeated calls with same server name', async () => {
      await fc.assert(
        fc.asyncProperty(validServerNameArb, async (serverName) => {
          // Clear cache before each iteration
          clearDiscoveryCache()

          // Mock the discovery to return consistent results
          const mockHomeserverUrl = `https://matrix.${serverName}`
          const mockResult = {
            homeserverUrl: mockHomeserverUrl,
            capabilities: { versions: ['v1.1'], unstable_features: {} }
          }

          mockSafeAutoDiscovery.mockResolvedValue(mockResult)

          // First call
          const result1 = await discoverServer(serverName)

          // Second call (should use cache)
          const result2 = await discoverServer(serverName)

          // Property: Both calls should return equivalent homeserverUrl
          expect(result1.homeserverUrl).toBe(result2.homeserverUrl)

          // Property: Both calls should return equivalent capabilities
          expect(result1.capabilities).toEqual(result2.capabilities)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should cache results and return them on subsequent calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          validServerNameArb,
          fc.integer({ min: 2, max: 5 }), // Number of repeated calls
          async (serverName, repeatCount) => {
            // Clear cache before each iteration
            clearDiscoveryCache()

            // Mock the discovery
            const mockHomeserverUrl = `https://matrix.${serverName}`
            const mockResult = {
              homeserverUrl: mockHomeserverUrl,
              capabilities: { versions: ['v1.1'], unstable_features: {} }
            }

            mockSafeAutoDiscovery.mockResolvedValue(mockResult)

            // First call
            const firstResult = await discoverServer(serverName)

            // Clear mock call count after first call
            mockSafeAutoDiscovery.mockClear()

            // Subsequent calls
            const subsequentResults: Array<{ homeserverUrl: string }> = []
            for (let i = 0; i < repeatCount - 1; i++) {
              const result = await discoverServer(serverName)
              subsequentResults.push(result)
            }

            // Property: All subsequent calls should return same homeserverUrl
            for (const result of subsequentResults) {
              expect(result.homeserverUrl).toBe(firstResult.homeserverUrl)
            }

            // Property: safeAutoDiscovery should NOT be called again (cache hit)
            expect(mockSafeAutoDiscovery).not.toHaveBeenCalled()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should update config state consistently after discovery', async () => {
      await fc.assert(
        fc.asyncProperty(validServerNameArb, async (serverName) => {
          // Clear cache before each iteration
          clearDiscoveryCache()

          // Mock the discovery
          const mockHomeserverUrl = `https://matrix.${serverName}`
          const mockResult = {
            homeserverUrl: mockHomeserverUrl,
            capabilities: { versions: ['v1.1'], unstable_features: {} }
          }

          mockSafeAutoDiscovery.mockResolvedValue(mockResult)

          // Perform discovery
          const result = await discoverServer(serverName)

          // Get config state
          const configState = getMatrixConfigState()

          // Property: Config state should reflect the discovery result
          expect(configState.homeserverUrl).toBe(result.homeserverUrl)
          expect(configState.discovered).toBe(true)
          expect(configState.serverName).toBe(serverName)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should return different results for different server names', async () => {
      await fc.assert(
        fc.asyncProperty(validServerNameArb, validServerNameArb, async (serverName1, serverName2) => {
          // Skip if server names are the same
          if (serverName1 === serverName2) {
            return true
          }

          // Clear cache before each iteration
          clearDiscoveryCache()

          // Mock the discovery to return different results for different servers
          mockSafeAutoDiscovery.mockImplementation(async (server: string) => {
            return {
              homeserverUrl: `https://matrix.${server}`,
              capabilities: { versions: ['v1.1'], unstable_features: {} }
            }
          })

          // Discover both servers
          const result1 = await discoverServer(serverName1)
          const result2 = await discoverServer(serverName2)

          // Property: Different server names should produce different homeserverUrls
          expect(result1.homeserverUrl).not.toBe(result2.homeserverUrl)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should maintain consistency after cache clear and re-discovery', async () => {
      await fc.assert(
        fc.asyncProperty(validServerNameArb, async (serverName) => {
          // Clear cache before each iteration
          clearDiscoveryCache()

          // Mock the discovery to return consistent results
          const mockHomeserverUrl = `https://matrix.${serverName}`
          const mockResult = {
            homeserverUrl: mockHomeserverUrl,
            capabilities: { versions: ['v1.1'], unstable_features: {} }
          }

          mockSafeAutoDiscovery.mockResolvedValue(mockResult)

          // First discovery
          const result1 = await discoverServer(serverName)

          // Clear cache
          clearDiscoveryCache()

          // Re-discover
          const result2 = await discoverServer(serverName)

          // Property: Results should be equivalent even after cache clear
          expect(result1.homeserverUrl).toBe(result2.homeserverUrl)
          expect(result1.capabilities).toEqual(result2.capabilities)

          return true
        }),
        { numRuns: 100 }
      )
    })

    // Note: Error handling consistency test is omitted because discoverServer
    // has built-in retry logic with delays (up to 3 retries with exponential backoff)
    // which makes property-based testing impractical for error scenarios.
    // The core property (consistency of successful discoveries) is covered above.
  })
})
