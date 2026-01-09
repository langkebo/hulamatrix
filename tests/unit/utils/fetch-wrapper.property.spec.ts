/**
 * Property-Based Tests for Fetch Wrapper
 * Tests for timeout, cancellation, retry, and error transformation
 *
 * **Feature: sdk-backend-integration, Property 12: Fetch Wrapper Timeout and Cancellation**
 * **Validates: Requirements 12.1, 12.4, 12.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'

import {
  fetchWithTimeout,
  fetchWithRetry,
  unifiedFetch,
  createCancellableFetch,
  FetchError
} from '@/utils/fetch-wrapper'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Store original fetch
const originalFetch = global.fetch

describe('Fetch Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  // ==================== Unit Tests ====================
  describe('fetchWithTimeout', () => {
    it('should return response when request completes within timeout', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const response = await fetchWithTimeout('https://api.example.com/data', {
        timeout: 5000
      })

      expect(response.status).toBe(200)
    })

    it('should throw FetchError with TIMEOUT code when request times out', async () => {
      // Mock fetch that takes too long
      global.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal as AbortSignal | undefined
            if (signal) {
              signal.addEventListener('abort', () => {
                const error = new Error('The operation was aborted')
                error.name = 'AbortError'
                reject(error)
              })
            }
          })
      )

      await expect(
        fetchWithTimeout('https://api.example.com/data', {
          timeout: 50
        })
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
        timeoutMs: 50
      })
    }, 10000)

    it('should throw immediately if controller is already aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(
        fetchWithTimeout('https://api.example.com/data', {
          abortController: controller
        })
      ).rejects.toMatchObject({
        code: 'ABORTED'
      })
    })
  })

  describe('fetchWithRetry', () => {
    it('should retry on transient errors', async () => {
      let callCount = 0

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.resolve(new Response('', { status: 503 }))
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      })

      const response = await fetchWithRetry('https://api.example.com/data', {
        maxRetries: 3,
        retryDelay: 10,
        timeout: 5000
      })

      expect(response.status).toBe(200)
      expect(callCount).toBe(3)
    }, 10000)

    it('should not retry on non-transient errors', async () => {
      let callCount = 0

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve(new Response('', { status: 404 }))
      })

      const response = await fetchWithRetry('https://api.example.com/data', {
        maxRetries: 3,
        retryDelay: 10,
        timeout: 5000
      })

      expect(response.status).toBe(404)
      expect(callCount).toBe(1)
    })

    it('should respect custom shouldRetry function', async () => {
      let callCount = 0

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount < 2) {
          const error = new Error('Custom error')
          return Promise.reject(error)
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      })

      const response = await fetchWithRetry('https://api.example.com/data', {
        maxRetries: 3,
        retryDelay: 10,
        timeout: 5000,
        shouldRetry: (error, attempt) => {
          return attempt < 3 && error.message.includes('Custom')
        }
      })

      expect(response.status).toBe(200)
      expect(callCount).toBe(2)
    }, 10000)
  })

  describe('unifiedFetch', () => {
    it('should parse JSON response', async () => {
      const mockData = { id: 1, name: 'Test' }
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

      const result = await unifiedFetch<typeof mockData>('https://api.example.com/data')

      expect(result.data).toEqual(mockData)
      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
    })

    it('should throw FetchError with user-friendly message on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      )

      await expect(unifiedFetch('https://api.example.com/data')).rejects.toMatchObject({
        code: 'HTTP_404',
        userMessage: '请求的资源不存在'
      })
    })
  })

  describe('createCancellableFetch', () => {
    it('should create cancellable fetch instance', async () => {
      global.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal as AbortSignal | undefined
            if (signal) {
              if (signal.aborted) {
                const error = new Error('The operation was aborted')
                error.name = 'AbortError'
                reject(error)
                return
              }
              signal.addEventListener('abort', () => {
                const error = new Error('The operation was aborted')
                error.name = 'AbortError'
                reject(error)
              })
            }
          })
      )

      const { fetch: cancellableFetch, cancel, isCancelled } = createCancellableFetch()

      expect(isCancelled()).toBe(false)

      const responsePromise = cancellableFetch('https://api.example.com/data')

      // Cancel immediately
      cancel()

      expect(isCancelled()).toBe(true)

      await expect(responsePromise).rejects.toThrow(FetchError)
    })
  })
})

// ==================== Property-Based Tests ====================

/**
 * Property-Based Tests for Fetch Wrapper
 *
 * **Feature: sdk-backend-integration, Property 12: Fetch Wrapper Timeout and Cancellation**
 * **Validates: Requirements 12.1, 12.4, 12.5**
 */
describe('Fetch Wrapper Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  /**
   * Property 12: Fetch Wrapper Timeout and Cancellation
   *
   * *For any* API request with timeout, the request should be aborted after
   * the specified timeout and return a clear timeout error message.
   * Requests should be cancellable via AbortController.
   *
   * **Validates: Requirements 12.1, 12.4, 12.5**
   */
  describe('Property 12: Fetch Wrapper Timeout and Cancellation', () => {
    it('should be cancellable via AbortController for any request', async () => {
      await fc.assert(
        fc.asyncProperty(fc.webUrl(), async (url) => {
          const controller = new AbortController()

          // Mock fetch that respects abort signal
          global.fetch = vi.fn().mockImplementation(
            (_url, options) =>
              new Promise((_resolve, reject) => {
                const signal = options?.signal as AbortSignal | undefined
                if (signal) {
                  if (signal.aborted) {
                    const error = new Error('The operation was aborted')
                    error.name = 'AbortError'
                    reject(error)
                    return
                  }
                  signal.addEventListener('abort', () => {
                    const error = new Error('The operation was aborted')
                    error.name = 'AbortError'
                    reject(error)
                  })
                }
              })
          )

          const responsePromise = fetchWithTimeout(url, {
            timeout: 10000,
            abortController: controller
          })

          // Cancel immediately
          controller.abort()

          // Property: Request should be cancelled
          try {
            await responsePromise
            return false
          } catch (error) {
            if (error instanceof FetchError) {
              // Property: Cancelled requests should have appropriate error
              expect(['TIMEOUT', 'ABORTED']).toContain(error.code)
              return true
            }
            return false
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should provide clear error messages for any HTTP status code', async () => {
      const transientStatuses = [408, 429, 500, 502, 503, 504]
      const nonTransientStatuses = [400, 401, 403, 404, 409, 413]

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...transientStatuses, ...nonTransientStatuses),
          fc.webUrl(),
          async (status, url) => {
            global.fetch = vi.fn().mockResolvedValue(
              new Response(JSON.stringify({ error: 'Error' }), {
                status,
                headers: { 'Content-Type': 'application/json' }
              })
            )

            try {
              // Disable retry to avoid timeout issues in tests
              await unifiedFetch(url, { enableRetry: false })
              return false
            } catch (error) {
              if (error instanceof FetchError) {
                // Property: Error should have HTTP status code
                expect(error.status).toBe(status)
                // Property: Error code should include status
                expect(error.code).toBe(`HTTP_${status}`)
                // Property: User message should be non-empty
                expect(error.userMessage).toBeTruthy()
                expect(error.userMessage.length).toBeGreaterThan(0)
                // Property: Transient errors should be retryable
                if (transientStatuses.includes(status)) {
                  expect(error.retryable).toBe(true)
                }
                return true
              }
              return false
            }
          }
        ),
        { numRuns: 20, timeout: 10000 }
      )
    }, 60000)

    it('should retry transient errors up to maxRetries times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          fc.constantFrom(408, 429, 500, 502, 503, 504),
          fc.webUrl(),
          async (maxRetries, status, url) => {
            let callCount = 0

            global.fetch = vi.fn().mockImplementation(() => {
              callCount++
              return Promise.resolve(new Response('', { status }))
            })

            await fetchWithRetry(url, {
              maxRetries,
              retryDelay: 1,
              timeout: 5000
            })

            // Property: Should retry up to maxRetries times
            // (initial attempt + retries = maxRetries + 1)
            expect(callCount).toBe(maxRetries + 1)

            return true
          }
        ),
        { numRuns: 100 }
      )
    }, 30000)

    it('should not retry non-transient errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          fc.constantFrom(400, 401, 403, 404, 409),
          fc.webUrl(),
          async (maxRetries, status, url) => {
            let callCount = 0

            global.fetch = vi.fn().mockImplementation(() => {
              callCount++
              return Promise.resolve(new Response('', { status }))
            })

            await fetchWithRetry(url, {
              maxRetries,
              retryDelay: 1,
              timeout: 5000
            })

            // Property: Should NOT retry non-transient errors
            expect(callCount).toBe(1)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should succeed on retry if server recovers', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 3 }), fc.webUrl(), async (failuresBeforeSuccess, url) => {
          const maxRetries = failuresBeforeSuccess + 1
          let callCount = 0

          global.fetch = vi.fn().mockImplementation(() => {
            callCount++
            if (callCount <= failuresBeforeSuccess) {
              return Promise.resolve(new Response('', { status: 503 }))
            }
            return Promise.resolve(
              new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              })
            )
          })

          const response = await fetchWithRetry(url, {
            maxRetries,
            retryDelay: 1,
            timeout: 5000
          })

          // Property: Should eventually succeed
          expect(response.status).toBe(200)
          // Property: Should have retried correct number of times
          expect(callCount).toBe(failuresBeforeSuccess + 1)

          return true
        }),
        { numRuns: 100 }
      )
    }, 30000)

    it('should have FetchError with all required properties', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(400, 401, 403, 404, 500, 502, 503), fc.webUrl(), async (status, url) => {
          global.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'Test error' }), {
              status,
              headers: { 'Content-Type': 'application/json' }
            })
          )

          try {
            // Disable retry to avoid timeout issues in tests
            await unifiedFetch(url, { enableRetry: false })
            return false
          } catch (error) {
            if (error instanceof FetchError) {
              // Property: FetchError should have all required properties
              expect(typeof error.code).toBe('string')
              expect(typeof error.userMessage).toBe('string')
              expect(typeof error.retryable).toBe('boolean')
              expect(error.status).toBe(status)
              expect(error.message).toBeTruthy()
              return true
            }
            return false
          }
        }),
        { numRuns: 20, timeout: 10000 }
      )
    }, 60000)
  })
})
