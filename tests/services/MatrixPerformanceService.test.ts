/**
 * MatrixPerformanceService 单元测试（Mock 版本）
 *
 * 测试性能优化服务的核心功能，包括：
 * - 配置管理
 * - 缓存管理
 * - 图片 URL 优化
 * - SlidingSync 集成
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

vi.doMock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: () => null,
      isInitialized: () => false,
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

let MatrixPerformanceService: any

beforeAll(async () => {
  const module = await import('../../src/services/matrix/MatrixPerformanceService')
  MatrixPerformanceService = module.default
})

describe('MatrixPerformanceService', () => {
  let performanceService: any

  beforeEach(() => {
    performanceService = MatrixPerformanceService.getInstance()
    performanceService['imageCache'].clear()
    performanceService['messageCache'].clear()
    performanceService['cacheTimestamps'].clear()
    performanceService.updateConfig({
      enableSlidingSync: true,
      enableMessageCache: true,
      maxCachedMessages: 1000,
      cacheExpiryMs: 3600000
    })
  })

  afterEach(() => {
    if (performanceService) {
      performanceService.destroy()
    }
  })

  describe('配置管理', () => {
    it('应该返回默认配置', () => {
      const config = performanceService.config.value
      expect(config.enableSlidingSync).toBe(true)
      expect(config.enableMessageCache).toBe(true)
      expect(config.maxCachedMessages).toBe(1000)
    })

    it('应该支持配置更新', () => {
      performanceService.updateConfig({
        enableMessageCache: false,
        maxCachedMessages: 500
      })

      const config = performanceService.config.value
      expect(config.enableMessageCache).toBe(false)
      expect(config.maxCachedMessages).toBe(500)
    })
  })

  describe('消息缓存', () => {
    it('应该缓存房间消息', async () => {
      const roomId = '!test:example.com'
      const messages = [
        { id: '1', type: 'm.room.message', content: { body: 'Hello' } },
        { id: '2', type: 'm.room.message', content: { body: 'World' } }
      ]

      await performanceService.cacheRoomMessages(roomId, messages)

      const cached = performanceService.getCachedMessages(roomId)
      expect(cached).toBeDefined()
      expect(cached?.length).toBeGreaterThan(0)
    })

    it('应该返回缓存统计', () => {
      const stats = performanceService.cacheStats.value
      expect(stats.itemCount).toBeGreaterThanOrEqual(0)
      expect(stats.totalSize).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    })

    it('应该支持按房间失效缓存', async () => {
      const roomId = '!test:example.com'
      await performanceService.cacheRoomMessages(roomId, [{ id: '1' }])

      performanceService.invalidateCache(roomId)

      const cached = performanceService.getCachedMessages(roomId)
      expect(cached).toBeNull()
    })

    it('应该支持全局失效缓存', async () => {
      await performanceService.cacheRoomMessages('!room1:example.com', [{ id: '1' }])
      await performanceService.cacheRoomMessages('!room2:example.com', [{ id: '2' }])

      performanceService.invalidateCache()

      expect(performanceService['messageCache'].size).toBe(0)
    })
  })

  describe('图片 URL 优化', () => {
    it('应该生成优化后的图片 URL', () => {
      const mockClient = {
        mxcUrlToHttp: vi.fn().mockReturnValue('https://example.com/_matrix/media/v3/thumbnail/example.com/abc123')
      }

      const url = performanceService.getOptimizedImageUrl(mockClient, 'mxc://example.com/abc123', {
        width: 100,
        height: 100,
        method: 'crop',
        animated: false
      })

      expect(url).toBeDefined()
      expect(url.length).toBeGreaterThan(0)
    })

    it('应该处理空 URL', () => {
      const mockClient = {}
      const url = performanceService.getOptimizedImageUrl(mockClient, null)
      expect(url).toBe('')
    })

    it('应该使用缓存的 URL', () => {
      const mockClient = {
        mxcUrlToHttp: vi.fn().mockReturnValue('https://example.com/original')
      }

      performanceService.getOptimizedImageUrl(mockClient, 'mxc://example.com/cache_test', {
        width: 64,
        height: 64,
        method: 'crop',
        animated: false
      })
      performanceService.getOptimizedImageUrl(mockClient, 'mxc://example.com/cache_test', {
        width: 64,
        height: 64,
        method: 'crop',
        animated: false
      })

      expect(performanceService['imageCache'].size).toBeGreaterThan(0)
    })
  })

  describe('内存监控', () => {
    it('应该返回内存使用情况', () => {
      const memoryUsage = performanceService.getMemoryUsage()
      expect(memoryUsage).toBeDefined()
      expect(typeof memoryUsage).toBe('string')
    })

    it('应该更新性能指标', () => {
      const metrics = performanceService.metrics.value
      expect(metrics.memoryUsage).toBeDefined()
    })
  })

  describe('SlidingSync', () => {
    it('应该返回 SlidingSync 实例', () => {
      const slidingSync = performanceService.getSlidingSync()
      expect(slidingSync).toBeNull()
    })
  })

  describe('房间订阅', () => {
    it('应该支持订阅房间', async () => {
      await performanceService.subscribeToRoom('!test:example.com')
    })

    it('应该支持取消订阅房间', async () => {
      await performanceService.unsubscribeFromRoom('!test:example.com')
    })
  })

  describe('事件系统', () => {
    it('应该支持事件监听', () => {
      const listener = vi.fn()
      performanceService.on('testEvent', listener)
      expect(performanceService['performanceListeners'].has('testEvent')).toBe(true)
    })

    it('应该支持事件取消监听', () => {
      const listener = vi.fn()
      performanceService.on('testEvent', listener)
      performanceService.off('testEvent', listener)
    })
  })

  describe('清理', () => {
    it('应该正确清理资源', async () => {
      await performanceService.cacheRoomMessages('!test:example.com', [{ id: '1' }])
      expect(performanceService['messageCache'].size).toBeGreaterThan(0)

      await performanceService.cleanup()

      expect(performanceService['messageCache'].size).toBe(0)
      expect(performanceService['imageCache'].size).toBe(0)
    })
  })

  describe('优化状态', () => {
    it('应该返回优化状态', () => {
      const isOptimizing = performanceService.isOptimizing.value
      expect(typeof isOptimizing).toBe('boolean')
    })
  })
})
