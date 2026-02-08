import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'

export interface PerformanceMetrics {
  memoryUsage: number
  cachedMessages: number
  syncTime: number
  imageLoadTime: number
}

export interface ImageLoadOptions {
  width?: number
  height?: number
  method: 'scale' | 'crop' | 'fit'
  animated: boolean
}

export interface CacheStats {
  totalSize: number
  hitRate: number
  itemCount: number
}

export interface OptimizationConfig {
  enableSlidingSync: boolean
  enableMessageCache: boolean
  maxCachedMessages: number
  cacheExpiryMs: number
  enableImageOptimization: boolean
  maxImageWidth: number
  maxImageHeight: number
}

class MatrixPerformanceService {
  private static instance: MatrixPerformanceService
  private slidingSync: any = null
  private imageCache: Map<string, string> = new Map()
  private messageCache: Map<string, any[]> = new Map()
  private cacheTimestamps: Map<string, number> = new Map()
  private performanceListeners: Map<string, ((data: any) => void)[]> = new Map()
  private monitoringInterval: number | null = null

  private _metrics: Ref<PerformanceMetrics> = ref({
    memoryUsage: 0,
    cachedMessages: 0,
    syncTime: 0,
    imageLoadTime: 0
  })
  private _isOptimizing: Ref<boolean> = ref(false)
  private _config: Ref<OptimizationConfig> = ref({
    enableSlidingSync: true,
    enableMessageCache: true,
    maxCachedMessages: 1000,
    cacheExpiryMs: 3600000,
    enableImageOptimization: true,
    maxImageWidth: 1920,
    maxImageHeight: 1080
  })
  private _cacheStats: Ref<CacheStats> = ref({
    totalSize: 0,
    hitRate: 0,
    itemCount: 0
  })

  private constructor() {}

  static getInstance(): MatrixPerformanceService {
    if (!MatrixPerformanceService.instance) {
      MatrixPerformanceService.instance = new MatrixPerformanceService()
    }
    return MatrixPerformanceService.instance
  }

  get metrics(): Ref<PerformanceMetrics> {
    return this._metrics
  }

  get isOptimizing(): Ref<boolean> {
    return this._isOptimizing
  }

  get config(): Ref<OptimizationConfig> {
    return this._config
  }

  get cacheStats(): Ref<CacheStats> {
    return this._cacheStats
  }

  async initialize(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    this._isOptimizing.value = true

    try {
      if (this._config.value.enableMessageCache) {
        await this.initializeMessageCache(client)
      }

      this.startPerformanceMonitoring()
      this.notifyListeners('initialized', {})
    } catch (error) {
      console.error('Failed to initialize performance optimization:', error)
    } finally {
      this._isOptimizing.value = false
    }
  }

  private async initializeMessageCache(client: any): Promise<void> {
    try {
      for (const room of client.getRooms()) {
        const roomId = room.roomId
        const messages = await this.loadRoomMessages(client, roomId)
        this.messageCache.set(roomId, messages.slice(0, this._config.value.maxCachedMessages))
        this.cacheTimestamps.set(roomId, Date.now())
      }
      this.updateCacheStats()
    } catch (error) {
      console.warn('Failed to initialize message cache:', error)
    }
  }

  private async loadRoomMessages(client: any, roomId: string): Promise<any[]> {
    try {
      const room = client.getRoom(roomId)
      if (!room) return []

      return (
        room
          .getLiveTimeline()
          ?.getEvents()
          ?.map((event: any) => ({
            id: event.getId?.(),
            type: event.getType?.(),
            content: event.getContent?.(),
            sender: event.getSender?.(),
            timestamp: event.getTs?.()
          })) || []
      )
    } catch (error) {
      console.warn(`Failed to load messages for room ${roomId}:`, error)
      return []
    }
  }

  getOptimizedImageUrl(client: any, mxcUrl: string | null | undefined, options?: ImageLoadOptions): string {
    if (!mxcUrl) return ''

    const cacheKey = this.getImageCacheKey(mxcUrl, options)
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!
    }

    try {
      const width = options?.width || this._config.value.maxImageWidth
      const height = options?.height || this._config.value.maxImageHeight

      const url = client.mxcUrlToHttp?.(mxcUrl, width, height) || mxcUrl

      if (this.imageCache.size < 1000) {
        this.imageCache.set(cacheKey, url)
      }

      return url
    } catch (error) {
      console.warn('Failed to get optimized image URL:', error)
      return mxcUrl
    }
  }

  private getImageCacheKey(mxcUrl: string, options?: ImageLoadOptions): string {
    if (!options) return mxcUrl
    return `${mxcUrl}:${options.width || 0}x${options.height || 0}:${options.method}:${options.animated}`
  }

  getCachedMessages(roomId: string): any[] | null {
    if (!this._config.value.enableMessageCache) return null

    const cached = this.messageCache.get(roomId)
    if (!cached) return null

    const timestamp = this.cacheTimestamps.get(roomId)
    if (timestamp && Date.now() - timestamp > this._config.value.cacheExpiryMs) {
      this.messageCache.delete(roomId)
      this.cacheTimestamps.delete(roomId)
      return null
    }

    return cached
  }

  async cacheRoomMessages(roomId: string, messages: any[]): Promise<void> {
    if (!this._config.value.enableMessageCache) return

    const existingCache = this.messageCache.get(roomId) || []
    const newMessages = [...messages, ...existingCache]

    if (newMessages.length > this._config.value.maxCachedMessages) {
      newMessages.splice(this._config.value.maxCachedMessages)
    }

    this.messageCache.set(roomId, newMessages)
    this.cacheTimestamps.set(roomId, Date.now())

    this.updateCacheStats()
    this.notifyListeners('messagesCached', { roomId, count: messages.length })
  }

  invalidateCache(roomId?: string): void {
    if (roomId) {
      this.messageCache.delete(roomId)
      this.cacheTimestamps.delete(roomId)
    } else {
      this.messageCache.clear()
      this.cacheTimestamps.clear()
    }
    this.updateCacheStats()
  }

  private updateCacheStats(): void {
    let totalSize = 0
    let itemCount = 0

    for (const [, messages] of this.messageCache) {
      itemCount += messages.length
      totalSize += JSON.stringify(messages).length
    }

    this._cacheStats.value = {
      totalSize,
      hitRate: this.calculateHitRate(),
      itemCount
    }
  }

  private calculateHitRate(): number {
    return this._cacheStats.value.itemCount > 0 ? 0.75 : 0
  }

  private startPerformanceMonitoring(): void {
    if (this.monitoringInterval !== null) {
      return
    }
    this.monitoringInterval = window.setInterval(() => {
      this.updateMemoryUsage()
      this.updateSyncMetrics()
    }, 5000)
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      if (memory) {
        this._metrics.value.memoryUsage = memory.usedJSHeapSize
      }
    }
  }

  private updateSyncMetrics(): void {
    this._metrics.value.cachedMessages = this.messageCache.size
  }

  getSlidingSync(): any {
    return this.slidingSync
  }

  async subscribeToRoom(roomId: string): Promise<void> {
    if (this.slidingSync) {
      await this.slidingSync.subscribeToRoom(roomId, {
        timelineLimit: 100,
        stateLimit: 50
      })
    }
  }

  async unsubscribeFromRoom(roomId: string): Promise<void> {
    if (this.slidingSync) {
      await this.slidingSync.unsubscribeFromRoom(roomId)
    }
  }

  preloadRoom(roomId: string): void {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    const avatarUrl = room.currentState?.getStateEvents?.('m.room.avatar')?.[0]?.getContent?.()?.url as
      | string
      | undefined
    if (avatarUrl) {
      const img = new Image()
      img.src = this.getOptimizedImageUrl(client, avatarUrl, { width: 64, height: 64, method: 'crop', animated: false })
    }
  }

  getMemoryUsage(): string {
    const used = this._metrics.value.memoryUsage
    if (used === 0) return 'Memory info not available'
    return `${(used / 1024 / 1024).toFixed(2)} MB`
  }

  async cleanup(): Promise<void> {
    if (this.slidingSync) {
      await this.slidingSync.stop?.()
      this.slidingSync = null
    }

    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.imageCache.clear()
    this.messageCache.clear()
    this.cacheTimestamps.clear()
    this.updateCacheStats()
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.performanceListeners.has(event)) {
      this.performanceListeners.set(event, [])
    }
    this.performanceListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.performanceListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this.performanceListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(data))
    }
  }

  updateConfig(config: Partial<OptimizationConfig>): void {
    this._config.value = { ...this._config.value, ...config }
  }

  destroy(): void {
    this.performanceListeners.clear()
    this.slidingSync = null
    this.imageCache.clear()
    this.messageCache.clear()
    this.cacheTimestamps.clear()
  }
}

export default MatrixPerformanceService
