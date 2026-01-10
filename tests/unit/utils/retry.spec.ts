/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withRetry } from '@/utils/retry'

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await withRetry(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')

      const promise = withRetry(fn)

      // Advance past all retries
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(800)
      }

      const result = await promise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should use default maxRetries of 3 when not specified', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'))

      const promise = withRetry(fn)

      // Advance past all retries
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(800)
      }

      await expect(promise).rejects.toThrow('Failed')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should use default retryDelay of 800ms when not specified', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail 1')).mockResolvedValue('success')

      const promise = withRetry(fn)

      // First attempt fails
      expect(fn).toHaveBeenCalledTimes(1)

      // Advance past the delay
      await vi.advanceTimersByTimeAsync(800)

      await promise

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should respect custom maxRetries option', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'))

      const promise = withRetry(fn, { maxRetries: 5 })

      // Advance past all retries
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(800)
      }

      await expect(promise).rejects.toThrow('Failed')
      expect(fn).toHaveBeenCalledTimes(5)
    })

    it('should respect custom retryDelay option', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail 1')).mockResolvedValue('success')

      const promise = withRetry(fn, { retryDelay: 500 })

      // First attempt fails
      expect(fn).toHaveBeenCalledTimes(1)

      // Advance past the custom delay
      await vi.advanceTimersByTimeAsync(500)

      await promise

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should throw the last error after all retries are exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Final error'))

      const promise = withRetry(fn, { maxRetries: 2 })

      // Advance past all retries
      for (let i = 0; i < 2; i++) {
        await vi.advanceTimersByTimeAsync(800)
      }

      await expect(promise).rejects.toThrow('Final error')
    })

    it('should not attempt any calls when maxRetries is 0', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'))

      const promise = withRetry(fn, { maxRetries: 0 })

      // When maxRetries=0, the loop condition `i <= 0` is false for i=1
      // So the loop never executes and no attempt is made
      await expect(promise).rejects.toThrow('Failed')
      expect(fn).toHaveBeenCalledTimes(0)
    })

    it('should not retry when maxRetries is 1', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'))

      const promise = withRetry(fn, { maxRetries: 1 })

      await expect(promise).rejects.toThrow('Failed')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should handle different error types', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Type error'))
        .mockRejectedValueOnce(new RangeError('Range error'))
        .mockRejectedValueOnce(new Error('Generic error'))

      const promise = withRetry(fn, { maxRetries: 3 })

      // Advance past all retries
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(800)
      }

      await expect(promise).rejects.toThrow('Generic error')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should work with synchronous functions wrapped in Promise', async () => {
      const fn = vi.fn().mockResolvedValue(42)

      const result = await withRetry(fn)

      expect(result).toBe(42)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should return the correct result type', async () => {
      const fn = vi.fn().mockResolvedValue({ id: 1, name: 'test' })

      const result = await withRetry(fn)

      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should handle retryDelay of 0', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail 1')).mockResolvedValue('success')

      const promise = withRetry(fn, { retryDelay: 0 })

      // Even with delay=0, we need to advance the event loop for the setTimeout
      await vi.advanceTimersByTimeAsync(0)
      await promise

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should handle large retryDelay', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail 1')).mockResolvedValue('success')

      const promise = withRetry(fn, { retryDelay: 5000 })

      // First attempt fails
      expect(fn).toHaveBeenCalledTimes(1)

      // Advance past the delay
      await vi.advanceTimersByTimeAsync(5000)

      await promise

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})
