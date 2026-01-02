/**
 * Matrix Error Handler Property-Based Tests
 *
 * **Feature: sdk-integration-audit, Property 2: Error Code Classification**
 * **Feature: sdk-integration-audit, Property 3: Network Error Distinction**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Tests:
 * - Property 2: All errors are classified into valid MatrixErrorCode values
 * - Property 3: Network errors produce distinct codes for appropriate UI guidance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import { MatrixErrorHandler, MatrixErrorCode } from '@/utils/error-handler'

// Mock dependencies
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key // Return key as-is for testing
  })
}))

describe('MatrixErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property-Based Test: Error Code Classification
   * **Feature: sdk-integration-audit, Property 2: Error Code Classification**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * *For any* Matrix SDK error, the MatrixErrorHandler SHALL classify it into
   * one of the defined MatrixErrorCode values and produce a user-friendly message.
   */
  describe('Property 2: Error Code Classification', () => {
    // Get all valid error codes as an array
    const validErrorCodes = Object.values(MatrixErrorCode)

    it('should classify any arbitrary error message into a valid MatrixErrorCode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(), // Any arbitrary error message
          async (errorMessage) => {
            const error = new Error(errorMessage)
            const result = MatrixErrorHandler.handle(error)

            // Property: result.code MUST be one of the defined MatrixErrorCode values
            expect(validErrorCodes).toContain(result.code)

            // Property: result MUST have all required MatrixError fields
            expect(result).toHaveProperty('code')
            expect(result).toHaveProperty('message')
            expect(result).toHaveProperty('userMessage')

            // Property: userMessage MUST be a non-empty string
            expect(typeof result.userMessage).toBe('string')
            expect(result.userMessage.length).toBeGreaterThan(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify non-Error values into valid MatrixErrorCode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            // Use a simple record with string values to avoid objects with
            // non-stringifiable properties like { toString: [] }
            fc.record({ key: fc.string() })
          ),
          async (errorValue) => {
            const result = MatrixErrorHandler.handle(errorValue)

            // Property: Even non-Error values MUST be classified into valid codes
            expect(validErrorCodes).toContain(result.code)
            expect(typeof result.userMessage).toBe('string')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve original error message in result.message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // Non-empty error message
          async (errorMessage) => {
            const error = new Error(errorMessage)
            const result = MatrixErrorHandler.handle(error)

            // Property: Original message MUST be preserved
            expect(result.message).toBe(errorMessage)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return MatrixError with originalError reference', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (errorMessage) => {
          const error = new Error(errorMessage)
          const result = MatrixErrorHandler.handle(error)

          // Property: originalError MUST reference the input Error
          expect(result.originalError).toBe(error)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property-Based Test: Network Error Distinction
   * **Feature: sdk-integration-audit, Property 3: Network Error Distinction**
   * **Validates: Requirements 2.3**
   *
   * *For any* network-related error (timeout, connection refused, offline),
   * the MatrixErrorHandler SHALL produce distinct error codes that allow
   * the UI to show appropriate guidance.
   */
  describe('Property 3: Network Error Distinction', () => {
    // Network error codes that should be distinct
    const networkErrorCodes = [
      MatrixErrorCode.NETWORK_TIMEOUT,
      MatrixErrorCode.NETWORK_OFFLINE,
      MatrixErrorCode.NETWORK_CONNECTION_REFUSED
    ]

    // Timeout error keywords
    const timeoutKeywords = ['timeout', 'timed out', 'etimedout', 'request timeout']

    // Connection refused keywords
    const connectionRefusedKeywords = ['connection refused', 'econnrefused', 'econnreset', 'enotfound']

    // Network offline keywords
    const networkOfflineKeywords = ['network', 'fetch', 'failed to fetch', 'network request failed', 'net::err']

    it('should classify timeout errors as NETWORK_TIMEOUT', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...timeoutKeywords),
          fc.string(), // prefix
          fc.string(), // suffix
          async (keyword, prefix, suffix) => {
            const errorMessage = `${prefix}${keyword}${suffix}`
            const error = new Error(errorMessage)
            const result = MatrixErrorHandler.handle(error)

            // Property: Timeout errors MUST be classified as NETWORK_TIMEOUT
            expect(result.code).toBe(MatrixErrorCode.NETWORK_TIMEOUT)

            // Property: isNetworkError helper MUST return true
            expect(MatrixErrorHandler.isNetworkError(result)).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify connection refused errors as NETWORK_CONNECTION_REFUSED', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...connectionRefusedKeywords),
          fc.string(), // prefix
          fc.string(), // suffix
          async (keyword, prefix, suffix) => {
            const errorMessage = `${prefix}${keyword}${suffix}`
            const error = new Error(errorMessage)
            const result = MatrixErrorHandler.handle(error)

            // Property: Connection refused errors MUST be classified as NETWORK_CONNECTION_REFUSED
            expect(result.code).toBe(MatrixErrorCode.NETWORK_CONNECTION_REFUSED)

            // Property: isNetworkError helper MUST return true
            expect(MatrixErrorHandler.isNetworkError(result)).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify network offline errors as NETWORK_OFFLINE', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...networkOfflineKeywords), async (keyword) => {
          // Use keyword alone to avoid interference from other patterns
          const error = new Error(keyword)
          const result = MatrixErrorHandler.handle(error)

          // Property: Network offline errors MUST be classified as NETWORK_OFFLINE
          expect(result.code).toBe(MatrixErrorCode.NETWORK_OFFLINE)

          // Property: isNetworkError helper MUST return true
          expect(MatrixErrorHandler.isNetworkError(result)).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should produce distinct codes for different network error types', async () => {
      // Test that each network error type produces a unique code
      const timeoutError = MatrixErrorHandler.handle(new Error('request timeout'))
      const connectionError = MatrixErrorHandler.handle(new Error('connection refused'))
      const offlineError = MatrixErrorHandler.handle(new Error('network request failed'))

      // Property: Each network error type MUST have a distinct code
      expect(timeoutError.code).toBe(MatrixErrorCode.NETWORK_TIMEOUT)
      expect(connectionError.code).toBe(MatrixErrorCode.NETWORK_CONNECTION_REFUSED)
      expect(offlineError.code).toBe(MatrixErrorCode.NETWORK_OFFLINE)

      // Property: All three codes MUST be different
      const codes = [timeoutError.code, connectionError.code, offlineError.code]
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(3)
    })

    it('should identify all network errors via isNetworkError helper', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...networkErrorCodes), async (networkCode) => {
          // Property: isNetworkError MUST return true for all network error codes
          expect(MatrixErrorHandler.isNetworkError(networkCode)).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should NOT identify non-network errors as network errors', async () => {
      const nonNetworkCodes = Object.values(MatrixErrorCode).filter((code) => !networkErrorCodes.includes(code))

      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...nonNetworkCodes), async (nonNetworkCode) => {
          // Property: isNetworkError MUST return false for non-network error codes
          expect(MatrixErrorHandler.isNetworkError(nonNetworkCode)).toBe(false)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should mark network errors as retryable', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...networkErrorCodes), async (networkCode) => {
          // Property: Network errors SHOULD be retryable
          expect(MatrixErrorHandler.isRetryable(networkCode)).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional unit tests for specific error classifications
   */
  describe('Error Classification - Specific Cases', () => {
    it('should classify authentication errors correctly', () => {
      const invalidCredentials = MatrixErrorHandler.handle(new Error('invalid password'))
      expect(invalidCredentials.code).toBe(MatrixErrorCode.AUTH_INVALID_CREDENTIALS)
      expect(MatrixErrorHandler.isAuthError(invalidCredentials)).toBe(true)

      const tokenExpired = MatrixErrorHandler.handle(new Error('m_unknown_token'))
      expect(tokenExpired.code).toBe(MatrixErrorCode.AUTH_TOKEN_EXPIRED)
      expect(MatrixErrorHandler.isAuthError(tokenExpired)).toBe(true)

      const forbidden = MatrixErrorHandler.handle(new Error('m_forbidden'))
      expect(forbidden.code).toBe(MatrixErrorCode.AUTH_FORBIDDEN)
      expect(MatrixErrorHandler.isAuthError(forbidden)).toBe(true)
    })

    it('should classify room errors correctly', () => {
      const notFound = MatrixErrorHandler.handle(new Error('room not found'))
      expect(notFound.code).toBe(MatrixErrorCode.ROOM_NOT_FOUND)
      expect(MatrixErrorHandler.isRoomError(notFound)).toBe(true)

      const accessDenied = MatrixErrorHandler.handle(new Error('not invited'))
      expect(accessDenied.code).toBe(MatrixErrorCode.ROOM_ACCESS_DENIED)
      expect(MatrixErrorHandler.isRoomError(accessDenied)).toBe(true)

      const alreadyJoined = MatrixErrorHandler.handle(new Error('already joined'))
      expect(alreadyJoined.code).toBe(MatrixErrorCode.ROOM_ALREADY_JOINED)
      expect(MatrixErrorHandler.isRoomError(alreadyJoined)).toBe(true)
    })

    it('should classify encryption errors correctly', () => {
      const deviceNotVerified = MatrixErrorHandler.handle(new Error('device not verified'))
      expect(deviceNotVerified.code).toBe(MatrixErrorCode.E2EE_DEVICE_NOT_VERIFIED)
      expect(MatrixErrorHandler.isEncryptionError(deviceNotVerified)).toBe(true)

      const keyNotFound = MatrixErrorHandler.handle(new Error('key not found'))
      expect(keyNotFound.code).toBe(MatrixErrorCode.E2EE_KEY_NOT_FOUND)
      expect(MatrixErrorHandler.isEncryptionError(keyNotFound)).toBe(true)
    })

    it('should classify server errors correctly', () => {
      const serverError = MatrixErrorHandler.handle(new Error('500 internal server error'))
      expect(serverError.code).toBe(MatrixErrorCode.SERVER_ERROR)
      expect(MatrixErrorHandler.isRetryable(serverError)).toBe(true)
    })

    it('should classify unknown errors as UNKNOWN_ERROR', () => {
      const unknownError = MatrixErrorHandler.handle(new Error('some random error'))
      expect(unknownError.code).toBe(MatrixErrorCode.UNKNOWN_ERROR)
    })
  })

  /**
   * Test createError helper method
   */
  describe('createError helper', () => {
    it('should create MatrixError with specified code and message', () => {
      const error = MatrixErrorHandler.createError(MatrixErrorCode.ROOM_NOT_FOUND, 'Room !abc:matrix.org not found', {
        roomId: '!abc:matrix.org'
      })

      expect(error.code).toBe(MatrixErrorCode.ROOM_NOT_FOUND)
      expect(error.message).toBe('Room !abc:matrix.org not found')
      expect(error.details).toEqual({ roomId: '!abc:matrix.org' })
      expect(typeof error.userMessage).toBe('string')
    })
  })
})
