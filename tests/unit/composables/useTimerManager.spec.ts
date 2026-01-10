/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTimerManager } from '@/composables/useTimerManager'

describe('useTimerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setTimer', () => {
    it('should create a timeout timer', () => {
      const { setTimer, getTimerCount } = useTimerManager()
      const callback = vi.fn()

      const { id } = setTimer(callback, 1000)

      expect(getTimerCount()).toBe(1)
      expect(typeof id).toBe('number')
    })

    it('should create an interval timer', () => {
      const { setTimer, getTimerCount } = useTimerManager()
      const callback = vi.fn()

      setTimer(callback, 1000, true)

      expect(getTimerCount()).toBe(1)
    })

    it('should throw error for negative delay', () => {
      const { setTimer } = useTimerManager()
      const callback = vi.fn()

      expect(() => setTimer(callback, -100)).toThrow('Delay must be non-negative')
    })

    it('should execute timeout callback after delay', () => {
      const { setTimer } = useTimerManager()
      const callback = vi.fn()

      setTimer(callback, 1000)

      expect(callback).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should execute interval callback repeatedly', () => {
      const { setTimer } = useTimerManager()
      const callback = vi.fn()

      setTimer(callback, 1000, true)

      expect(callback).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('should return cleanup function', () => {
      const { setTimer } = useTimerManager()
      const callback = vi.fn()

      const { cleanup } = setTimer(callback, 1000)

      expect(typeof cleanup).toBe('function')
    })
  })

  describe('clearTimer', () => {
    it('should clear a specific timer', () => {
      const { setTimer, clearTimer, getTimerCount } = useTimerManager()
      const callback = vi.fn()

      const { id } = setTimer(callback, 5000)

      expect(getTimerCount()).toBe(1)

      clearTimer(id)

      expect(getTimerCount()).toBe(0)
    })

    it('should not throw when clearing non-existent timer', () => {
      const { clearTimer } = useTimerManager()

      expect(() => clearTimer(999)).not.toThrow()
    })

    it('should prevent timeout from executing', () => {
      const { setTimer, clearTimer } = useTimerManager()
      const callback = vi.fn()

      setTimer(callback, 1000)
      clearTimer(1)

      vi.advanceTimersByTime(2000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should prevent interval from executing', () => {
      const { setTimer, clearTimer } = useTimerManager()
      const callback = vi.fn()

      setTimer(callback, 1000, true)
      clearTimer(1)

      vi.advanceTimersByTime(5000)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('clearAllTimers', () => {
    it('should clear all timers', () => {
      const { setTimer, clearAllTimers, getTimerCount } = useTimerManager()
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      setTimer(callback1, 1000)
      setTimer(callback2, 2000, true)

      expect(getTimerCount()).toBe(2)

      clearAllTimers()

      expect(getTimerCount()).toBe(0)
    })

    it('should prevent all timers from executing', () => {
      const { setTimer, clearAllTimers } = useTimerManager()
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      setTimer(callback1, 1000)
      setTimer(callback2, 1000, true)

      clearAllTimers()

      vi.advanceTimersByTime(5000)

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })

    it('should reset timerIdCounter', () => {
      const { setTimer, clearAllTimers, setTimer: setTimer2 } = useTimerManager()

      setTimer(vi.fn(), 1000)
      setTimer2(vi.fn(), 1000)

      clearAllTimers()

      const { id: id3 } = setTimer(vi.fn(), 1000)

      expect(id3).toBe(1)
    })
  })

  describe('delay', () => {
    it('should resolve after specified delay', async () => {
      const { delay } = useTimerManager()
      const callback = vi.fn()

      const promise = delay(() => {
        callback()
      }, 1000)

      vi.advanceTimersByTime(1000)
      await promise

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should return the callback result', async () => {
      const { delay } = useTimerManager()

      const promise = delay(() => 'test value', 100)

      vi.advanceTimersByTime(100)
      const result = await promise

      expect(result).toBe('test value')
    })

    it('should handle async callbacks', async () => {
      const { delay } = useTimerManager()
      const callback = vi.fn().mockResolvedValue('async result')

      const promise = delay(callback, 100)

      vi.advanceTimersByTime(100)
      await expect(promise).resolves.toBe('async result')
    })

    it('should reject on callback error', async () => {
      const { delay } = useTimerManager()
      const error = new Error('Test error')

      const promise = delay(() => {
        throw error
      }, 100)

      vi.advanceTimersByTime(100)
      await expect(promise).rejects.toThrow('Test error')
    })
  })

  describe('debounce', () => {
    it('should delay function execution', () => {
      const { debounce } = useTimerManager()
      const fn = vi.fn()

      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      vi.advanceTimersByTime(99)

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should reset delay on subsequent calls', () => {
      const { debounce } = useTimerManager()
      const fn = vi.fn()

      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      vi.advanceTimersByTime(50)
      debouncedFn()
      vi.advanceTimersByTime(50)
      debouncedFn()
      vi.advanceTimersByTime(50)

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments to callback', () => {
      const { debounce } = useTimerManager()
      const fn = vi.fn()

      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1', 'arg2')

      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should handle multiple rapid calls', () => {
      const { debounce } = useTimerManager()
      const fn = vi.fn()

      const debouncedFn = debounce(fn, 100)

      for (let i = 0; i < 10; i++) {
        debouncedFn(i)
      }

      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenLastCalledWith(9)
    })
  })

  describe('throttle', () => {
    it('should execute function immediately', () => {
      const { throttle } = useTimerManager()
      const fn = vi.fn()

      const throttledFn = throttle(fn, 100)

      throttledFn()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should ignore calls within throttle limit', () => {
      const { throttle } = useTimerManager()
      const fn = vi.fn()

      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should allow calls after throttle period', () => {
      const { throttle } = useTimerManager()
      const fn = vi.fn()

      const throttledFn = throttle(fn, 100)

      throttledFn()
      vi.advanceTimersByTime(100)
      throttledFn()

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should pass arguments to callback', () => {
      const { throttle } = useTimerManager()
      const fn = vi.fn()

      const throttledFn = throttle(fn, 100)

      throttledFn('arg1', 'arg2')

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should handle rapid calls correctly', () => {
      const { throttle } = useTimerManager()
      const fn = vi.fn()

      const throttledFn = throttle(fn, 100)

      throttledFn(1)
      throttledFn(2)
      throttledFn(3)
      vi.advanceTimersByTime(50)
      throttledFn(4)
      throttledFn(5)
      vi.advanceTimersByTime(50)
      throttledFn(6)

      expect(fn).toHaveBeenCalledTimes(2)
      expect(fn).toHaveBeenNthCalledWith(1, 1)
      expect(fn).toHaveBeenNthCalledWith(2, 6)
    })
  })

  describe('getTimerCount', () => {
    it('should return 0 initially', () => {
      const { getTimerCount } = useTimerManager()

      expect(getTimerCount()).toBe(0)
    })

    it('should return correct count after adding timers', () => {
      const { setTimer, getTimerCount } = useTimerManager()

      setTimer(vi.fn(), 1000)
      expect(getTimerCount()).toBe(1)

      setTimer(vi.fn(), 2000)
      expect(getTimerCount()).toBe(2)

      setTimer(vi.fn(), 3000, true)
      expect(getTimerCount()).toBe(3)
    })

    it('should decrease when timers are cleared', () => {
      const { setTimer, clearTimer, getTimerCount } = useTimerManager()

      const { id: id1 } = setTimer(vi.fn(), 1000)
      setTimer(vi.fn(), 2000)

      expect(getTimerCount()).toBe(2)

      clearTimer(id1)

      expect(getTimerCount()).toBe(1)
    })
  })

  describe('getTimerInfo', () => {
    it('should return undefined for non-existent timer', () => {
      const { getTimerInfo } = useTimerManager()

      expect(getTimerInfo(999)).toBeUndefined()
    })

    it('should return timer info for existing timer', () => {
      const { setTimer, getTimerInfo } = useTimerManager()
      const callback = vi.fn()

      const { id } = setTimer(callback, 1000)
      const info = getTimerInfo(id)

      expect(info).toBeDefined()
      expect(info?.id).toBeDefined()
      expect(info?.type).toBe('timeout')
      expect(info?.callback).toBe(callback)
      expect(typeof info?.cleanup).toBe('function')
    })

    it('should return interval type for interval timers', () => {
      const { setTimer, getTimerInfo } = useTimerManager()
      const callback = vi.fn()

      const { id } = setTimer(callback, 1000, true)
      const info = getTimerInfo(id)

      expect(info?.type).toBe('interval')
    })
  })
})
