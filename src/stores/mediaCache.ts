/**
 * 统一的缓存管理 Store
 * 合并了 cacheConfig、cacheMetrics、thumbnailCache 的功能
 */
import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'

// 缓存配置类型
type CacheConfig = {
  thumbCapBytes: number
  audioCapBytes: number
  maxHistoryItems: number
  autoCleanupEnabled: boolean
}

// 缓存指标类型
type CacheMetrics = {
  thumbBytes: number
  audioBytes: number
  thumbCleanCount: number
  audioCleanCount: number
  lastCleanupTime: number
}

// 历史记录类型
type HistoryItem = {
  ts: number
  bytes: number
  type: 'thumb' | 'audio'
}

// 缓存条目类型
type CacheEntry = {
  url: string
  localPath: string
  size: number
  lastAccessed: number
  type: 'thumb' | 'audio'
}

// 默认配置
const DEFAULT_CONFIG: CacheConfig = {
  thumbCapBytes: 200 * 1024 * 1024, // 200MB
  audioCapBytes: 150 * 1024 * 1024, // 150MB
  maxHistoryItems: 100,
  autoCleanupEnabled: true
}

// 加载配置
function loadConfig(): CacheConfig {
  try {
    const raw = localStorage.getItem('CACHE_CONFIG')
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch {}
  return DEFAULT_CONFIG
}

// 保存配置
function saveConfig(config: CacheConfig) {
  try {
    localStorage.setItem('CACHE_CONFIG', JSON.stringify(config))
  } catch {}
}

// 加载指标
function loadMetrics(): CacheMetrics {
  try {
    const raw = localStorage.getItem('CACHE_METRICS')
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    thumbBytes: 0,
    audioBytes: 0,
    thumbCleanCount: 0,
    audioCleanCount: 0,
    lastCleanupTime: 0
  }
}

// 保存指标
function saveMetrics(metrics: CacheMetrics) {
  try {
    localStorage.setItem('CACHE_METRICS', JSON.stringify(metrics))
  } catch {}
}

// 加载历史记录
function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem('CACHE_HISTORY')
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

// 保存历史记录
function saveHistory(history: HistoryItem[]) {
  try {
    localStorage.setItem('CACHE_HISTORY', JSON.stringify(history))
  } catch {}
}

export const useCacheStore = defineStore('mediaCache', () => {
  // 配置
  const config = ref<CacheConfig>(loadConfig())

  // 指标
  const metrics = ref<CacheMetrics>(loadMetrics())

  // 历史记录
  const history = ref<HistoryItem[]>(loadHistory())

  // 缓存条目（内存中）
  const cacheEntries = ref<Map<string, CacheEntry>>(new Map())

  // 配置管理
  const setThumbCapBytes = (bytes: number) => {
    config.value.thumbCapBytes = bytes
    saveConfig(config.value)
  }

  const setAudioCapBytes = (bytes: number) => {
    config.value.audioCapBytes = bytes
    saveConfig(config.value)
  }

  const setAutoCleanupEnabled = (enabled: boolean) => {
    config.value.autoCleanupEnabled = enabled
    saveConfig(config.value)
  }

  // 缓存管理
  const addCacheEntry = (url: string, localPath: string, size: number, type: 'thumb' | 'audio') => {
    const entry: CacheEntry = {
      url,
      localPath,
      size,
      type,
      lastAccessed: Date.now()
    }

    cacheEntries.value.set(url, entry)

    // 更新指标
    if (type === 'thumb') {
      metrics.value.thumbBytes += size
    } else {
      metrics.value.audioBytes += size
    }

    // 添加历史记录
    history.value.push({
      ts: Date.now(),
      bytes: size,
      type
    })

    // 限制历史记录数量
    if (history.value.length > config.value.maxHistoryItems) {
      history.value = history.value.slice(-config.value.maxHistoryItems)
    }

    saveMetrics(metrics.value)
    saveHistory(history.value)

    // 自动清理
    if (config.value.autoCleanupEnabled) {
      checkAndCleanup()
    }
  }

  const getCacheEntry = (url: string): CacheEntry | null => {
    const entry = cacheEntries.value.get(url)
    if (entry) {
      entry.lastAccessed = Date.now()
      return entry
    }
    return null
  }

  const removeCacheEntry = (url: string): boolean => {
    const entry = cacheEntries.value.get(url)
    if (!entry) return false

    cacheEntries.value.delete(url)

    // 更新指标
    if (entry.type === 'thumb') {
      metrics.value.thumbBytes = Math.max(0, metrics.value.thumbBytes - entry.size)
    } else {
      metrics.value.audioBytes = Math.max(0, metrics.value.audioBytes - entry.size)
    }

    saveMetrics(metrics.value)
    return true
  }

  // 清理检查
  const checkAndCleanup = () => {
    const thumbExceeded = metrics.value.thumbBytes > config.value.thumbCapBytes
    const audioExceeded = metrics.value.audioBytes > config.value.audioCapBytes

    if (!thumbExceeded && !audioExceeded) return

    // 按最后访问时间排序
    const entries = Array.from(cacheEntries.value.values()).sort((a, b) => a.lastAccessed - b.lastAccessed)

    // 清理缩略图
    if (thumbExceeded) {
      const thumbEntries = entries.filter((e) => e.type === 'thumb')
      cleanupByType(thumbEntries, 'thumb', config.value.thumbCapBytes)
    }

    // 清理音频
    if (audioExceeded) {
      const audioEntries = entries.filter((e) => e.type === 'audio')
      cleanupByType(audioEntries, 'audio', config.value.audioCapBytes)
    }

    metrics.value.lastCleanupTime = Date.now()
    saveMetrics(metrics.value)
  }

  const cleanupByType = (entries: CacheEntry[], type: 'thumb' | 'audio', capBytes: number) => {
    let currentBytes = type === 'thumb' ? metrics.value.thumbBytes : metrics.value.audioBytes
    const entriesToRemove: CacheEntry[] = []

    for (const entry of entries) {
      if (currentBytes <= capBytes) break
      entriesToRemove.push(entry)
      currentBytes -= entry.size
    }

    // 移除条目
    entriesToRemove.forEach((entry) => {
      cacheEntries.value.delete(entry.url)
    })

    // 更新清理计数
    if (type === 'thumb') {
      metrics.value.thumbCleanCount += entriesToRemove.length
      metrics.value.thumbBytes = currentBytes
    } else {
      metrics.value.audioCleanCount += entriesToRemove.length
      metrics.value.audioBytes = currentBytes
    }
  }

  // 手动清理
  const clearCache = (type?: 'thumb' | 'audio') => {
    if (!type) {
      // 清理所有
      cacheEntries.value.clear()
      metrics.value.thumbBytes = 0
      metrics.value.audioBytes = 0
      metrics.value.thumbCleanCount++
      metrics.value.audioCleanCount++
    } else {
      // 清理指定类型
      const entriesToRemove = Array.from(cacheEntries.value.values()).filter((e) => e.type === type)

      entriesToRemove.forEach((entry) => {
        cacheEntries.value.delete(entry.url)
      })

      if (type === 'thumb') {
        metrics.value.thumbBytes = 0
        metrics.value.thumbCleanCount++
      } else {
        metrics.value.audioBytes = 0
        metrics.value.audioCleanCount++
      }
    }

    metrics.value.lastCleanupTime = Date.now()
    saveMetrics(metrics.value)
  }

  // 获取统计信息
  const getStats = () => {
    const totalEntries = cacheEntries.value.size
    const thumbEntries = Array.from(cacheEntries.value.values()).filter((e) => e.type === 'thumb').length
    const audioEntries = Array.from(cacheEntries.value.values()).filter((e) => e.type === 'audio').length

    return {
      totalEntries,
      thumbEntries,
      audioEntries,
      thumbUsagePercent: (metrics.value.thumbBytes / config.value.thumbCapBytes) * 100,
      audioUsagePercent: (metrics.value.audioBytes / config.value.audioCapBytes) * 100,
      totalCleanCount: metrics.value.thumbCleanCount + metrics.value.audioCleanCount,
      lastCleanupTime: metrics.value.lastCleanupTime
    }
  }

  // 兼容旧接口：设置与计数
  const setThumbBytes = (bytes: number) => {
    metrics.value.thumbBytes = bytes
    saveMetrics(metrics.value)
  }

  const setAudioBytes = (bytes: number) => {
    metrics.value.audioBytes = bytes
    saveMetrics(metrics.value)
  }

  const incThumbCleanCount = (n: number = 1) => {
    metrics.value.thumbCleanCount += n
    saveMetrics(metrics.value)
  }

  const incAudioCleanCount = (n: number = 1) => {
    metrics.value.audioCleanCount += n
    saveMetrics(metrics.value)
  }

  // 兼容旧接口：缓存项操作
  const setCache = (url: string, entry: { localPath?: string; url?: string; size?: number; type?: string }) => {
    if (entry && typeof entry === 'object') {
      const localPath = entry.localPath ?? entry.url ?? ''
      const size = entry.size ?? 0
      const type: 'thumb' | 'audio' = entry.type === 'audio' ? 'audio' : 'thumb'
      addCacheEntry(url, localPath, size, type)
    }
  }

  const getCache = (url: string) => getCacheEntry(url)

  const removeCache = (url: string) => removeCacheEntry(url)

  // 获取当前配置与指标（只读快照）
  const getConfig = () => ({ ...config.value })
  const getMetrics = () => ({ ...metrics.value })

  return {
    // 状态
    config: readonly(config),
    metrics: readonly(metrics),
    history: readonly(history),

    // 配置管理
    setThumbCapBytes,
    setAudioCapBytes,
    setAutoCleanupEnabled,

    // 缓存管理
    addCacheEntry,
    getCacheEntry,
    removeCacheEntry,
    checkAndCleanup,
    clearCache,
    getStats,
    getConfig,
    getMetrics,
    setThumbBytes,
    setAudioBytes,
    incThumbCleanCount,
    incAudioCleanCount,
    setCache,
    getCache,
    removeCache
  }
})
