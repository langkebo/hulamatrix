/**
 * Platform Detection Composable
 *
 * Provides utilities to detect the current platform (desktop/mobile)
 * and platform-specific features.
 *
 * @module composables/usePlatform
 */

import { computed } from 'vue'

/**
 * Platform detection result
 */
export interface PlatformInfo {
  /** Is mobile platform */
  isMobile: boolean
  /** Is desktop platform */
  isDesktop: boolean
  /** Platform name */
  platform: 'windows' | 'darwin' | 'linux' | 'android' | 'ios' | 'unknown'
  /** Is Tauri environment */
  isTauri: boolean
}

/**
 * Detect if running in Tauri
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Get current platform from Tauri environment variable
 */
function getTauriPlatform(): 'windows' | 'darwin' | 'linux' | 'android' | 'ios' | 'unknown' {
  try {
    const platform = import.meta.env.TAURI_ENV_PLATFORM
    switch (platform) {
      case 'windows':
      case 'darwin':
      case 'linux':
      case 'android':
      case 'ios':
        return platform
      default:
        return 'unknown'
    }
  } catch {
    return 'unknown'
  }
}

/**
 * Detect platform from user agent (fallback)
 */
function detectPlatformFromUA(): 'android' | 'ios' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'

  const ua = window.navigator.userAgent

  if (/Android/i.test(ua)) {
    return 'android'
  }

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios'
  }

  return 'unknown'
}

/**
 * Platform detection composable
 */
export function usePlatform() {
  const isTauri = isTauriEnvironment()
  const tauriPlatform = getTauriPlatform()
  const uaPlatform = detectPlatformFromUA()

  const platform = computed<'windows' | 'darwin' | 'linux' | 'android' | 'ios' | 'unknown'>(() => {
    if (isTauri) {
      return tauriPlatform
    }
    return uaPlatform === 'unknown' ? 'unknown' : uaPlatform
  })

  const isMobile = computed(() => {
    return platform.value === 'android' || platform.value === 'ios'
  })

  const isDesktop = computed(() => {
    return platform.value === 'windows' || platform.value === 'darwin' || platform.value === 'linux'
  })

  return {
    isMobile: isMobile.value,
    isDesktop: isDesktop.value,
    platform: platform.value,
    isTauri
  } as PlatformInfo
}

/**
 * Reactive platform info (for use in components)
 */
export function useReactivePlatform() {
  return {
    isMobile: computed(() => {
      const { isMobile } = usePlatform()
      return isMobile
    }),
    isDesktop: computed(() => {
      const { isDesktop } = usePlatform()
      return isDesktop
    }),
    platform: computed(() => {
      const { platform } = usePlatform()
      return platform
    }),
    isTauri: computed(() => {
      const { isTauri } = usePlatform()
      return isTauri
    })
  }
}

export default usePlatform
