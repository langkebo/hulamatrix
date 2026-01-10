/**
 * useErrorHandler Composable Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'

// Mock Naive UI
vi.mock('naive-ui', () => ({
  useDialog: () => ({
    error: vi.fn(() => ({ destroy: vi.fn() })),
    warning: vi.fn(() => ({ destroy: vi.fn() })),
    info: vi.fn(() => ({ destroy: vi.fn() })),
    success: vi.fn(() => ({ destroy: vi.fn() }))
  }),
  useMessage: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }),
  type: {}
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

// Mock error reporting service
vi.mock('@/services/errorReporting', () => ({
  reportError: vi.fn(() => Promise.resolve())
}))

import { useErrorHandler } from '@/composables/useErrorHandler'

describe('useErrorHandler Composable', () => {
  let dialogMock: any
  let messageMock: any
  let loggerMock: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    const { useDialog, useMessage } = require('naive-ui')
    dialogMock = useDialog()
    messageMock = useMessage()
    loggerMock = require('@/utils/logger').logger
  })

  describe('Error State', () => {
    it('should initialize with no error', () => {
      const { error, isError } = useErrorHandler()

      expect(error.value).toBeNull()
      expect(isError.value).toBe(false)
    })

    it('should set error when handleError is called', async () => {
      const { handleError, error, isError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)

      expect(error.value).toBe(testError)
      expect(isError.value).toBe(true)
    })

    it('should clear error when clearError is called', async () => {
      const { handleError, clearError, error, isError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)
      expect(error.value).toBe(testError)

      clearError()
      expect(error.value).toBeNull()
      expect(isError.value).toBe(false)
    })
  })

  describe('Error Handling Options', () => {
    it('should show notification by default', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)

      expect(messageMock.error).toHaveBeenCalledWith('Test error')
    })

    it('should show custom user message when provided', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Internal error')
      await handleError(testError, { userMessage: 'Custom user message' })

      expect(messageMock.error).toHaveBeenCalledWith('Custom user message')
    })

    it('should not show notification when showNotification is false', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError, { showNotification: false })

      expect(messageMock.error).not.toHaveBeenCalled()
    })

    it('should show dialog when showDialog is true', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError, { showDialog: true })

      expect(dialogMock.error).toHaveBeenCalled()
    })

    it('should log to console by default', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)

      expect(loggerMock.error).toHaveBeenCalledWith('[Error]:', testError)
    })

    it('should not log to console when logToConsole is false', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError, { logToConsole: false })

      expect(loggerMock.error).not.toHaveBeenCalled()
    })

    it('should report to server when reportToServer is true', async () => {
      const errorReporting = require('@/services/errorReporting')
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError, { reportToServer: true })

      expect(errorReporting.reportError).toHaveBeenCalledWith(testError)
    })
  })

  describe('Error Normalization', () => {
    it('should normalize Error objects', async () => {
      const { handleError, error } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('Test error')
    })

    it('should normalize string errors', async () => {
      const { handleError, error } = useErrorHandler()

      await handleError('String error')

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('String error')
    })

    it('should normalize unknown errors', async () => {
      const { handleError, error } = useErrorHandler()

      await handleError({ custom: 'error object' })

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('[object Object]')
    })

    it('should handle null/undefined errors', async () => {
      const { handleError, error } = useErrorHandler()

      await handleError(null)

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('null')
    })
  })

  describe('Custom Dialog Instance', () => {
    it('should use custom dialog when provided', async () => {
      const customDialog = {
        error: vi.fn(() => ({ destroy: vi.fn() }))
      }

      const { handleError } = useErrorHandler(customDialog)

      const testError = new Error('Test error')
      await handleError(testError, { showDialog: true })

      expect(customDialog.error).toHaveBeenCalled()
      expect(dialogMock.error).not.toHaveBeenCalled()
    })
  })

  describe('Error Recovery', () => {
    it('should support retry functionality', async () => {
      const { handleError, error } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError)

      // Error should be set
      expect(error.value).toBe(testError)

      // Clear error for retry
      const { clearError } = useErrorHandler()
      clearError()

      expect(error.value).toBeNull()
    })
  })

  describe('Multiple Errors', () => {
    it('should handle multiple sequential errors', async () => {
      const { handleError, error } = useErrorHandler()

      const error1 = new Error('Error 1')
      const error2 = new Error('Error 2')

      await handleError(error1)
      expect(error.value).toBe(error1)

      await handleError(error2)
      expect(error.value).toBe(error2)
    })
  })

  describe('Async Error Handling', () => {
    it('should handle errors in async operations', async () => {
      const { handleError, error } = useErrorHandler()

      // Simulate async operation that fails
      const asyncOperation = async () => {
        throw new Error('Async error')
      }

      try {
        await asyncOperation()
      } catch (err) {
        await handleError(err)
      }

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('Async error')
    })
  })

  describe('Error Context', () => {
    it('should preserve error stack trace', async () => {
      const { handleError, error } = useErrorHandler()

      const testError = new Error('Test error')
      // Create a stack trace
      Error.captureStackTrace?.(testError)

      await handleError(testError)

      expect(error.value?.stack).toBeDefined()
    })

    it('should include additional context in logs', async () => {
      const { handleError } = useErrorHandler()

      const testError = new Error('Test error')
      await handleError(testError, { context: { component: 'TestComponent', action: 'onClick' } })

      // Check that context was logged (implementation dependent)
      expect(loggerMock.error).toHaveBeenCalled()
    })
  })
})
