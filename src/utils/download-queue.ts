/**
 * 附件下载队列管理器
 * 实现下载优先级、并发控制和失败重试
 */

/** Download progress callback type */
export type DownloadProgressCallback = (loaded: number, total: number) => void

/** Download success callback type */
export type DownloadSuccessCallback = (blob: Blob) => void

/** Download error callback type */
export type DownloadErrorCallback = (error: Error) => void

/** Download options for XHR */
export interface DownloadOptions {
  /** Abort signal for cancellation */
  signal: AbortSignal
  /** Request timeout in milliseconds */
  timeout: number
  /** Progress callback */
  onProgress?: DownloadProgressCallback | undefined
}

export interface DownloadTask {
  id: string
  url: string
  filename?: string
  priority: DownloadPriority
  retryCount?: number
  maxRetries?: number
  timeout?: number
  onProgress?: DownloadProgressCallback
  onSuccess?: DownloadSuccessCallback
  onError?: DownloadErrorCallback
}

export enum DownloadPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

export interface DownloadQueueOptions {
  /** 最大并发下载数 */
  maxConcurrent?: number
  /** 默认超时时间，毫秒 */
  defaultTimeout?: number
  /** 默认最大重试次数 */
  defaultMaxRetries?: number
  /** 重试延迟，毫秒 */
  retryDelay?: number
  /** 指数退避因子 */
  backoffFactor?: number
}

export class DownloadQueue {
  private queue: DownloadTask[] = []
  private running = new Map<string, AbortController>()
  private completed = new Map<string, Blob>()
  private failed = new Map<string, Error>()
  private options: Required<DownloadQueueOptions>
  private isProcessing = false
  private paused = false

  constructor(options: DownloadQueueOptions = {}) {
    this.options = {
      maxConcurrent: 3,
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
      retryDelay: 1000,
      backoffFactor: 2,
      ...options
    }
  }

  /** 添加下载任务 */
  add(task: Omit<DownloadTask, 'retryCount'>) {
    const fullTask: DownloadTask = {
      retryCount: 0,
      maxRetries: this.options.defaultMaxRetries,
      timeout: this.options.defaultTimeout,
      ...task
    }

    // 按优先级插入队列
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i]
      const pri = item?.priority ?? DownloadPriority.LOW
      if (pri < fullTask.priority) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, fullTask)

    // 开始处理队列
    this.processQueue()
  }

  /** 处理下载队列 */
  private async processQueue() {
    if (this.isProcessing || this.paused) return

    this.isProcessing = true

    while (this.queue.length > 0 && this.running.size < this.options.maxConcurrent && !this.paused) {
      const task = this.queue.shift()!
      this.executeTask(task)
    }

    this.isProcessing = false
  }

  /** 执行下载任务 */
  private async executeTask(task: DownloadTask) {
    const controller = new AbortController()
    this.running.set(task.id, controller)

    try {
      const opts: DownloadOptions = {
        signal: controller.signal,
        timeout: task.timeout ?? this.options.defaultTimeout,
        onProgress: task.onProgress
      }
      const blob = await this.download(task.url, opts)

      // 成功完成
      this.completed.set(task.id, blob)
      task.onSuccess?.(blob)

      // 清理
      this.running.delete(task.id)

      // 继续处理队列
      this.processQueue()
    } catch (error) {
      this.running.delete(task.id)

      if (error instanceof Error) {
        // 检查是否应该重试
        if (task.retryCount! < task.maxRetries! && !controller.signal.aborted) {
          task.retryCount!++

          // 计算重试延迟
          const delay = this.options.retryDelay * this.options.backoffFactor ** (task.retryCount! - 1)

          // 延迟后重试
          setTimeout(() => {
            this.add(task)
          }, delay)
        } else {
          // 失败
          this.failed.set(task.id, error)
          task.onError?.(error)
        }
      }
    }
  }

  /** 执行实际的下载 */
  private async download(url: string, options: DownloadOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // 设置超时
      const timeoutId = setTimeout(() => {
        xhr.abort()
        reject(new Error('Download timeout'))
      }, options.timeout)

      // 监听进度
      if (options.onProgress) {
        xhr.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            options.onProgress!(e.loaded, e.total)
          }
        })
      }

      // 监听完成
      xhr.addEventListener('load', () => {
        clearTimeout(timeoutId)
        if (xhr.status === 200) {
          resolve(xhr.response)
        } else {
          reject(new Error(`Download failed: ${xhr.statusText}`))
        }
      })

      // 监听错误
      xhr.addEventListener('error', () => {
        clearTimeout(timeoutId)
        reject(new Error('Network error'))
      })

      // 监听取消
      options.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId)
        xhr.abort()
        reject(new Error('Download aborted'))
      })

      // 配置请求
      xhr.open('GET', url)
      xhr.responseType = 'blob'

      // 发送请求
      xhr.send()
    })
  }

  /** 取消下载任务 */
  cancel(taskId: string) {
    // 取消正在运行的下载
    const controller = this.running.get(taskId)
    if (controller) {
      controller.abort()
      this.running.delete(taskId)
    }

    // 从队列中移除
    this.queue = this.queue.filter((task) => task.id !== taskId)
  }

  /** 取消所有下载 */
  cancelAll() {
    // 取消正在运行的下载
    this.running.forEach((controller) => {
      controller.abort()
    })
    this.running.clear()

    // 清空队列
    this.queue = []
  }

  /** 暂停下载队列 */
  pause() {
    this.paused = true
  }

  /** 恢复下载队列 */
  resume() {
    this.paused = false
    this.processQueue()
  }

  /** 获取下载状态 */
  getStatus() {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size,
      paused: this.paused
    }
  }

  /** 获取已完成的下载 */
  getCompleted(taskId: string): Blob | undefined {
    return this.completed.get(taskId)
  }

  /** 获取失败的错误 */
  getError(taskId: string): Error | undefined {
    return this.failed.get(taskId)
  }

  /** 清理缓存 */
  clearCache() {
    this.completed.clear()
    this.failed.clear()
  }

  /** 重试失败的下载 */
  retryFailed() {
    const failedTasks: DownloadTask[] = []

    this.failed.forEach((_error, taskId) => {
      // 从失败列表中找到对应任务的原始信息
      const originalTask = this.queue.find((t) => t.id === taskId)
      if (originalTask) {
        failedTasks.push(originalTask)
      }
    })

    // 清空失败列表
    this.failed.clear()

    // 重新添加到队列
    failedTasks.forEach((task) => {
      task.retryCount = 0
      this.add(task)
    })
  }
}

/** 文件下载缓存 */
export class DownloadCache {
  private cache = new Map<
    string,
    {
      blob: Blob
      timestamp: number
      expires: number
    }
  >()
  private maxSize: number
  private defaultTTL: number

  constructor(maxSize = 100, defaultTTL = 24 * 60 * 60 * 1000) {
    // 24小时
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  /** 添加到缓存 */
  set(key: string, blob: Blob, ttl?: number) {
    // 清理过期缓存
    this.cleanup()

    // 如果缓存已满，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      blob,
      timestamp: Date.now(),
      expires: Date.now() + (ttl || this.defaultTTL)
    })
  }

  /** 从缓存获取 */
  get(key: string): Blob | null {
    const item = this.cache.get(key)
    if (!item) return null

    // 检查是否过期
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    // 更新访问时间（LRU）
    const { blob, expires } = item
    this.cache.set(key, {
      blob,
      timestamp: Date.now(),
      expires
    })

    return blob
  }

  /** 检查是否存在 */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /** 删除缓存 */
  delete(key: string) {
    return this.cache.delete(key)
  }

  /** 清理过期缓存 */
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }

  /** 清空缓存 */
  clear() {
    this.cache.clear()
  }

  /** 获取缓存大小 */
  size() {
    return this.cache.size
  }

  /** 获取缓存统计 */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.calculateMemoryUsage()
    }
  }

  /** 计算内存使用量 */
  private calculateMemoryUsage(): number {
    let total = 0
    for (const { blob } of this.cache.values()) {
      total += blob.size
    }
    return total
  }
}

/** 导出工厂函数 */
export function createDownloadQueue(options?: DownloadQueueOptions) {
  return new DownloadQueue(options)
}

export function createDownloadCache(maxSize?: number, ttl?: number) {
  return new DownloadCache(maxSize, ttl)
}
