/**
 * Cache Cleanup Utility
 * Helps clear various caches including chat history, message lists, and session data
 */

import { StoresEnum } from '@/enums'
import { logger } from '@/utils/logger'

/** Window 扩展类型 - 开发工具函数 */
interface WindowWithDevTools extends Window {
  clearChatList?: () => void
  clearMessageHistory?: () => void
  clearAllChatData?: () => void
  getCacheInfo?: () => void
}

export interface CacheCleanupOptions {
  /** Clear chat session list */
  clearSessions?: boolean
  /** Clear message history */
  clearMessages?: boolean
  /** Clear room/member data */
  clearRooms?: boolean
  /** Clear media cache */
  clearMedia?: boolean
  /** Clear all caches */
  clearAll?: boolean
}

export class CacheCleanupUtil {
  /**
   * Clear localStorage data for a specific store or pattern
   */
  static clearStoreData(pattern: string): void {
    const keysToRemove: string[] = []

    // Find all keys matching the pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes(pattern)) {
        keysToRemove.push(key)
      }
    }

    // Remove matching keys
    keysToRemove.forEach((key) => localStorage.removeItem(key))

    logger.debug(`[CacheCleanup] Removed ${keysToRemove.length} items matching pattern: ${pattern}`)
  }

  /**
   * Clear Pinia store persisted state
   */
  static clearPiniaStore(storeName: StoresEnum | string): void {
    const key = `pinia-${storeName}`
    localStorage.removeItem(key)
    logger.debug(`[CacheCleanup] Cleared Pinia store: ${storeName}`)
  }

  /**
   * Clear all chat-related caches
   */
  static clearChatCache(options: CacheCleanupOptions = {}): void {
    const {
      clearSessions = true,
      clearMessages = true,
      clearRooms = true,
      clearMedia = false,
      clearAll = false
    } = options

    logger.debug('[CacheCleanup] Starting chat cache cleanup...', options)

    if (clearAll || clearSessions) {
      // Clear chat store (session list, current session)
      CacheCleanupUtil.clearPiniaStore(StoresEnum.CHAT)
      CacheCleanupUtil.clearPiniaStore(StoresEnum.GLOBAL)
    }

    if (clearAll || clearMessages) {
      // Clear message-related data
      CacheCleanupUtil.clearStoreData('message')
      CacheCleanupUtil.clearStoreData('msg')
    }

    if (clearAll || clearRooms) {
      // Clear room/group data
      CacheCleanupUtil.clearPiniaStore(StoresEnum.GROUP)
      CacheCleanupUtil.clearStoreData('room')
    }

    if (clearAll || clearMedia) {
      // Clear media cache
      CacheCleanupUtil.clearStoreData('media')
      CacheCleanupUtil.clearStoreData('file')
    }

    logger.debug('[CacheCleanup] Chat cache cleanup completed')
  }

  /**
   * Get cache size estimate (in bytes)
   */
  static getCacheSize(): number {
    let totalSize = 0

    for (const key in localStorage) {
      if (Object.hasOwn(localStorage, key)) {
        totalSize += localStorage[key].length + key.length
      }
    }

    return totalSize
  }

  /**
   * Get cache size as human-readable string
   */
  static getCacheSizeFormatted(): string {
    const sizeInBytes = CacheCleanupUtil.getCacheSize()

    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(2)} KB`
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
    }
  }

  /**
   * List all localStorage keys with sizes
   */
  static listCacheKeys(): Array<{ key: string; size: number }> {
    const result: Array<{ key: string; size: number }> = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) || ''
        result.push({
          key,
          size: key.length + value.length
        })
      }
    }

    // Sort by size (descending)
    result.sort((a, b) => b.size - a.size)

    return result
  }

  /**
   * Clear all app data (use with caution!)
   */
  static clearAllData(): void {
    logger.warn('[CacheCleanup] Clearing all app data!')

    // Get all keys that belong to our app
    const appKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        // Keep only non-app keys (like theme preference)
        if (!key.startsWith('pinia-') && !key.includes('chat') && !key.includes('message') && !key.includes('room')) {
          continue
        }
        appKeys.push(key)
      }
    }

    // Remove all app keys
    appKeys.forEach((key) => localStorage.removeItem(key))

    logger.debug(`[CacheCleanup] Cleared ${appKeys.length} items`)

    // Reload page to apply changes
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }
}

/**
 * Developer utility function to clear chat list
 * Can be called from browser console during development
 */
export function clearChatList(): void {
  CacheCleanupUtil.clearChatCache({
    clearSessions: true,
    clearMessages: false, // Keep messages
    clearRooms: false // Keep room data
  })
}

/**
 * Developer utility function to clear all message history
 */
export function clearMessageHistory(): void {
  CacheCleanupUtil.clearChatCache({
    clearSessions: false,
    clearMessages: true,
    clearRooms: false
  })
}

/**
 * Developer utility function to clear all chat data (sessions + messages)
 * This is useful when you want to completely reset your chat history
 */
export function clearAllChatData(): void {
  CacheCleanupUtil.clearChatCache({
    clearSessions: true,
    clearMessages: true,
    clearRooms: false
  })
}

/**
 * Developer utility function to get cache info
 */
export function getCacheInfo(): void {
  logger.debug('=== Cache Information ===')
  logger.debug(`Total Cache Size: ${CacheCleanupUtil.getCacheSizeFormatted()}`)
  logger.debug('\nTop 10 Largest Keys:')
  const keys = CacheCleanupUtil.listCacheKeys().slice(0, 10)
  keys.forEach((item, index) => {
    logger.debug(`  ${index + 1}. ${item.key}: ${item.size} bytes`)
  })
}

// Make functions available globally in development
if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  const devWindow = window as unknown as WindowWithDevTools
  devWindow.clearChatList = clearChatList
  devWindow.clearMessageHistory = clearMessageHistory
  devWindow.clearAllChatData = clearAllChatData
  devWindow.getCacheInfo = getCacheInfo
  logger.debug('[CacheCleanup] Developer utilities available:')
  logger.debug('  - clearChatList(): Clear chat list cache')
  logger.debug('  - clearMessageHistory(): Clear message history')
  logger.debug('  - clearAllChatData(): Clear all chat data (sessions + messages)')
  logger.debug('  - getCacheInfo(): Show cache information')
}

export default CacheCleanupUtil
