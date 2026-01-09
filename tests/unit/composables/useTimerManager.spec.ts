import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTimerManager } from '@/composables/useTimerManager'

describe('useTimerManager', () => {
  let timerManager: ReturnType<typeof useTimerManager>

  beforeEach(() => {
    vi.useFakeTimers()
    timerManager = useTimerManager()
  })

  afterEach(() => {
    timerManager.clearAllTimers()
    vi.useRealTimers()
  })

  it('should set timeout', () => {
    const callback = vi.fn()

    const { id, cleanup } = timerManager.setTimer(callback, 1000)
    expect(typeof id).toBe('number')
    expect(typeof cleanup).toBe('function')

    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should set interval', () => {
    const callback = vi.fn()

    const { cleanup } = timerManager.setTimer(callback, 1000, true)

    vi.advanceTimersByTime(3000)
    expect(callback).toHaveBeenCalledTimes(3)

    cleanup()
    vi.advanceTimersByTime(2000)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('should clear timer manually', () => {
    const callback = vi.fn()

    const { id } = timerManager.setTimer(callback, 1000)
    timerManager.clearTimer(id)

    vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should clean up all timers', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const callback3 = vi.fn()

    timerManager.setTimer(callback1, 1000)
    timerManager.setTimer(callback2, 500, true)
    timerManager.setTimer(callback3, 2000)

    timerManager.clearAllTimers()

    vi.advanceTimersByTime(3000)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()
    expect(callback3).not.toHaveBeenCalled()
  })

  it('should handle multiple timeouts', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const callback3 = vi.fn()

    timerManager.setTimer(callback1, 100)
    timerManager.setTimer(callback2, 200)
    timerManager.setTimer(callback3, 300)

    vi.advanceTimersByTime(100)
    expect(callback1).toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()
    expect(callback3).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(callback2).toHaveBeenCalled()
    expect(callback3).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(callback3).toHaveBeenCalled()
  })

  it('should support delay function', async () => {
    const callback = vi.fn().mockReturnValue('test result')

    const promise = timerManager.delay(callback, 1000)
    expect(promise).toBeInstanceOf(Promise)

    vi.advanceTimersByTime(1000)
    const result = await promise
    expect(result).toBe('test result')
    expect(callback).toHaveBeenCalled()
  })

  it('should support debounce', () => {
    const callback = vi.fn()

    const debouncedFn = timerManager.debounce(callback, 500)

    // Call multiple times quickly
    debouncedFn()
    debouncedFn()
    debouncedFn()

    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)

    // Call again after delay
    debouncedFn()
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should throw error for invalid delay', () => {
    const callback = vi.fn()

    expect(() => {
      timerManager.setTimer(callback, -1000)
    }).toThrow('Delay must be non-negative')
  })
})
