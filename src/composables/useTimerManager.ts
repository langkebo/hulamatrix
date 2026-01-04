/**
 * 定时器管理器
 * 用于统一管理 setTimeout 和 setInterval，防止内存泄漏
 */

type TimerHandle = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>

export interface TimerInfo {
  id: TimerHandle
  type: 'timeout' | 'interval'
  callback: (...args: unknown[]) => unknown
  cleanup: () => void
}

export const useTimerManager = () => {
  const timers = new Map<number, TimerInfo>()
  let timerIdCounter = 0

  /**
   * 设置定时器
   * @param callback 回调函数
   * @param delay 延迟时间（毫秒）
   * @param interval 是否为 setInterval
   * @returns 定时器ID和清理函数
   */
  const setTimer = (
    callback: (...args: unknown[]) => unknown,
    delay: number,
    interval = false
  ): { id: number; cleanup: () => void } => {
    if (delay < 0) {
      throw new Error('Delay must be non-negative')
    }

    const id = ++timerIdCounter
    let timerId: TimerHandle

    const cleanup = () => {
      if (timers.has(id)) {
        timers.delete(id)
        if (interval) {
          clearInterval(timerId as NodeJS.Timeout)
        } else {
          clearTimeout(timerId as NodeJS.Timeout)
        }
      }
    }

    if (interval) {
      timerId = setInterval(callback as (...args: unknown[]) => unknown, delay)
    } else {
      timerId = setTimeout(() => {
        ;(callback as () => void)()
        timers.delete(id)
      }, delay)
    }

    const timerInfo: TimerInfo = {
      id: timerId,
      type: interval ? 'interval' : 'timeout',
      callback,
      cleanup
    }

    timers.set(id, timerInfo)
    return { id, cleanup }
  }

  /**
   * 清理所有定时器
   */
  const clearAllTimers = () => {
    timers.forEach((timerInfo) => {
      timerInfo.cleanup()
    })
    timers.clear()
    timerIdCounter = 0
  }

  /**
   * 清理特定的定时器
   * @param id 定时器ID
   */
  const clearTimer = (id: number) => {
    const timerInfo = timers.get(id)
    if (timerInfo) {
      timerInfo.cleanup()
    }
  }

  /**
   * 延迟执行（返回 Promise）
   * @param callback 回调函数
   * @param delay 延迟时间（毫秒）
   */
  const delay = <T = void>(callback: () => T | Promise<T>, delayMs: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      setTimer(() => {
        try {
          const result = callback()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, delayMs)
    })
  }

  /**
   * 防抖函数
   * @param func 要防抖的函数
   * @param wait 等待时间
   * @returns 防抖后的函数
   */
  const debounce = <T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: number | NodeJS.Timeout | null = null

    return (...args: Parameters<T>) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        func(...args)
        timeoutId = null
      }, wait)
    }
  }

  /**
   * 节流函数
   * @param func 要节流的函数
   * @param limit 时间限制
   * @returns 节流后的函数
   */
  const throttle = <T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle = false

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => {
          inThrottle = false
        }, limit)
      }
    }
  }

  /**
   * 获取当前定时器数量
   */
  const getTimerCount = () => timers.size

  /**
   * 获取定时器信息
   * @param id 定时器ID
   */
  const getTimerInfo = (id: number): TimerInfo | undefined => {
    return timers.get(id)
  }

  return {
    setTimer,
    clearTimer,
    clearAllTimers,
    delay,
    debounce,
    throttle,
    getTimerCount,
    getTimerInfo
  }
}
