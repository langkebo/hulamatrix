import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import { StoresEnum } from '@/enums'
// 兼容旧的子模块，若不存在则使用空桩
const useCacheConfigStore = () => ({ setThumbCapBytes: (_v: number) => {}, setAudioCapBytes: (_v: number) => {} })
const useCacheMetricsStore = () => ({
  setThumbBytes: (_v: number) => {},
  setAudioBytes: (_v: number) => {},
  incThumbCleanCount: (_n = 1) => {},
  incAudioCleanCount: (_n = 1) => {}
})
import { logger } from '@/utils/logger'

// 合并 cached.ts + cacheConfig.ts + cacheMetrics.ts + thumbnailCache.ts
export interface CacheConfig {
  maxSize: number // MB
  maxAge: number // 天数
  compressionEnabled: boolean
  encryptionEnabled: boolean
}

export interface CacheMetrics {
  totalSize: number
  itemCount: number
  hitRate: number
  lastCleanup: number
}

/** 缓存项 */
export interface CacheItem {
  value: unknown
  timestamp: number
  ttl: number
  compress: boolean
}

export const useCacheStore = defineStore(StoresEnum.CACHE, () => {
  const cfg = useCacheConfigStore()
  const met = useCacheMetricsStore()
  // 缓存配置
  const config = ref<CacheConfig>({
    maxSize: 500, // 500MB
    maxAge: 30, // 30天
    compressionEnabled: true,
    encryptionEnabled: false
  })

  // 缓存指标
  const metrics = ref<CacheMetrics>({
    totalSize: 0,
    itemCount: 0,
    hitRate: 0,
    lastCleanup: Date.now()
  })

  // 缓存存储
  const cacheStorage = ref<Map<string, CacheItem>>(new Map())
  const thumbnailCache = ref<Map<string, string>>(new Map())

  // 配置管理
  const updateConfig = (newConfig: Partial<CacheConfig>) => {
    config.value = { ...config.value, ...newConfig }
    saveConfig()
  }

  // 缓存操作
  const set = (key: string, value: unknown, options?: { ttl?: number; compress?: boolean }) => {
    const item: CacheItem = {
      value,
      timestamp: Date.now(),
      ttl: options?.ttl || config.value.maxAge * 24 * 60 * 60 * 1000,
      compress: options?.compress ?? config.value.compressionEnabled
    }

    // 检查缓存大小限制
    if (getCacheSize() + getItemSize(item) > config.value.maxSize * 1024 * 1024) {
      cleanupOldest()
    }

    cacheStorage.value.set(key, item)
    updateMetrics()
  }

  const get = (key: string) => {
    const item = cacheStorage.value.get(key)

    if (!item) {
      updateMetrics(false)
      return null
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      cacheStorage.value.delete(key)
      updateMetrics(false)
      return null
    }

    updateMetrics(true)
    return item.value
  }

  const remove = (key: string) => {
    const removed = cacheStorage.value.delete(key)
    if (removed) {
      updateMetrics()
    }
    return removed
  }

  const clear = () => {
    cacheStorage.value.clear()
    thumbnailCache.value.clear()
    resetMetrics()
  }

  // 缩略图缓存
  const setThumbnail = (key: string, dataUrl: string) => {
    thumbnailCache.value.set(key, dataUrl)
  }

  const getThumbnail = (key: string) => {
    return thumbnailCache.value.get(key) || null
  }

  // 缓存清理
  const cleanupExpired = () => {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, item] of cacheStorage.value.entries()) {
      if (now - item.timestamp > item.ttl) {
        cacheStorage.value.delete(key)
        cleanedCount++
      }
    }

    for (const [key, dataUrl] of thumbnailCache.value.entries()) {
      // 简单的缩略图过期策略
      if (dataUrl.length > 100000) {
        // 大于100KB的认为是大图
        thumbnailCache.value.delete(key)
        cleanedCount++
      }
    }

    metrics.value.lastCleanup = now
    updateMetrics()

    return cleanedCount
  }

  const cleanupOldest = () => {
    const items = Array.from(cacheStorage.value.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)

    // 删除最旧的20%
    const deleteCount = Math.ceil(items.length * 0.2)
    for (let i = 0; i < deleteCount; i++) {
      const key = items[i]?.[0]
      if (key) {
        cacheStorage.value.delete(key)
      }
    }
  }

  // 工具函数
  const getCacheSize = () => {
    let size = 0
    for (const item of cacheStorage.value.values()) {
      size += getItemSize(item)
    }
    return size
  }

  const getItemSize = (item: CacheItem) => {
    return JSON.stringify(item).length * 2 // 简单估算
  }

  const updateMetrics = (hit?: boolean) => {
    metrics.value.totalSize = getCacheSize()
    metrics.value.itemCount = cacheStorage.value.size + thumbnailCache.value.size

    if (hit !== undefined) {
      const totalRequests = metrics.value.itemCount + (hit ? 1 : 0)
      const hits = hit
        ? metrics.value.hitRate * metrics.value.itemCount + 1
        : metrics.value.hitRate * metrics.value.itemCount
      metrics.value.hitRate = totalRequests > 0 ? hits / totalRequests : 0
    }
  }

  const resetMetrics = () => {
    metrics.value = {
      totalSize: 0,
      itemCount: 0,
      hitRate: 0,
      lastCleanup: Date.now()
    }
  }

  const saveConfig = () => {
    localStorage.setItem('cache-config', JSON.stringify(config.value))
  }

  const loadConfig = () => {
    const saved = localStorage.getItem('cache-config')
    if (saved) {
      try {
        config.value = { ...config.value, ...JSON.parse(saved) }
      } catch (e) {
        logger.warn('Failed to load cache config:', e)
      }
    }
  }

  // 初始化
  loadConfig()

  const setThumbBytes = (v: number) => met.setThumbBytes(v)
  const setAudioBytes = (v: number) => met.setAudioBytes(v)
  const incThumbCleanCount = (n = 1) => met.incThumbCleanCount(n)
  const incAudioCleanCount = (n = 1) => met.incAudioCleanCount(n)
  const setThumbCapBytes = (v: number) => cfg.setThumbCapBytes(v)
  const setAudioCapBytes = (v: number) => cfg.setAudioCapBytes(v)

  return {
    // 状态
    config: readonly(config),
    metrics: readonly(metrics),
    cfg,
    met,

    // 配置管理
    updateConfig,

    // 缓存操作
    set,
    get,
    remove,

    // 缩略图缓存
    setThumbnail,
    getThumbnail,

    // 缓存管理
    cleanupExpired,
    clear,
    setThumbBytes,
    setAudioBytes,
    incThumbCleanCount,
    incAudioCleanCount,
    setThumbCapBytes,
    setAudioCapBytes
  }
})
