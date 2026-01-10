/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlatform, useReactivePlatform } from '@/composables/usePlatform'

describe('usePlatform', () => {
  const originalUserAgent = globalThis.navigator?.userAgent
  const originalTauri = (globalThis.window as any)?.__TAURI__

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default browser environment (no Tauri)
    if (originalTauri !== undefined) {
      ;(globalThis.window as any).__TAURI__ = originalTauri
    } else {
      delete (globalThis.window as any).__TAURI__
    }
    // Restore original user agent
    if (originalUserAgent) {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: originalUserAgent },
        writable: true,
        configurable: true
      })
    }
  })

  describe('Tauri environment detection', () => {
    it('should detect Tauri environment when __TAURI__ exists', () => {
      // Mock Tauri environment
      ;(globalThis.window as any).__TAURI__ = { invoke: vi.fn() }

      const result = usePlatform()
      expect(result.isTauri).toBe(true)
    })

    it('should not detect Tauri environment when __TAURI__ does not exist', () => {
      // Remove Tauri global
      delete (globalThis.window as any).__TAURI__

      const result = usePlatform()
      expect(result.isTauri).toBe(false)
    })
  })

  describe('Browser environment (user agent detection)', () => {
    beforeEach(() => {
      delete (globalThis.window as any).__TAURI__
    })

    it('should detect Android from user agent', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.platform).toBe('android')
      expect(result.isMobile).toBe(true)
      expect(result.isDesktop).toBe(false)
    })

    it('should detect iOS from user agent (iPhone)', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.platform).toBe('ios')
      expect(result.isMobile).toBe(true)
      expect(result.isDesktop).toBe(false)
    })

    it('should detect iOS from user agent (iPad)', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)' },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.platform).toBe('ios')
      expect(result.isMobile).toBe(true)
      expect(result.isDesktop).toBe(false)
    })

    it('should detect iOS from user agent (iPod)', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)' },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.platform).toBe('ios')
      expect(result.isMobile).toBe(true)
      expect(result.isDesktop).toBe(false)
    })

    it('should return unknown platform for desktop browser user agent', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.platform).toBe('unknown')
      expect(result.isDesktop).toBe(false)
      expect(result.isMobile).toBe(false)
    })
  })

  describe('Platform type detection', () => {
    beforeEach(() => {
      delete (globalThis.window as any).__TAURI__
    })

    it('should correctly identify mobile platforms', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.isMobile).toBe(true)
      expect(result.isDesktop).toBe(false)
    })

    it('should correctly identify unknown platforms as neither mobile nor desktop', () => {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        writable: true,
        configurable: true
      })

      const result = usePlatform()
      expect(result.isMobile).toBe(false)
      expect(result.isDesktop).toBe(false)
    })
  })

  describe('Reactive platform', () => {
    it('should provide reactive platform info in browser environment', () => {
      delete (globalThis.window as any).__TAURI__
      Object.defineProperty(globalThis.window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        writable: true,
        configurable: true
      })

      const result = useReactivePlatform()

      expect(result.isTauri.value).toBe(false)
      expect(result.platform.value).toBe('android')
      expect(result.isMobile.value).toBe(true)
      expect(result.isDesktop.value).toBe(false)
    })
  })
})
