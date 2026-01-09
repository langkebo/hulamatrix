/**
 * Matrix Batch Upload Service
 * Handles bulk file uploads with progress tracking and error handling
 *
 * @module services/matrixBatchUploadService
 */

import { logger } from '@/utils/logger'
import { uploadContent } from './upload'

/**
 * 单个文件上传状态
 */
export interface UploadStatus {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'
  progress: number
  mxcUrl?: string
  error?: Error
}

/**
 * 批量上传进度信息
 */
export interface BatchUploadProgress {
  total: number
  completed: number
  failed: number
  uploading: number
  pending: number
  percentage: number
}

/**
 * 批量上传结果
 */
export interface BatchUploadResult {
  successful: Map<File, string>
  failed: Map<File, Error>
  cancelled: Set<File>
  total: number
  duration: number
}

/**
 * 批量上传配置选项
 */
export interface BatchUploadOptions {
  /** 最大并发上传数 */
  maxConcurrency?: number
  /** 单个文件超时时间（毫秒） */
  timeout?: number
  /** 进度回调 */
  onProgress?: (progress: BatchUploadProgress) => void
  /** 单个文件进度回调 */
  onFileProgress?: (file: File, progress: number) => void
  /** 上传完成回调 */
  onComplete?: (result: BatchUploadResult) => void
  /** 是否在失败时继续 */
  continueOnError?: boolean
}

/**
 * 上传任务信息
 */
interface UploadTask {
  file: File
  abortController: AbortController
  timeoutId?: ReturnType<typeof setTimeout>
}

/**
 * Matrix Batch Upload Service
 * 提供批量文件上传功能
 */
export class MatrixBatchUploadService {
  private static instance: MatrixBatchUploadService

  // 当前上传任务
  private activeUploads: Map<string, UploadTask> = new Map()

  // 上传状态
  private uploadStatus: Map<File, UploadStatus> = new Map()

  private constructor() {}

  static getInstance(): MatrixBatchUploadService {
    if (!MatrixBatchUploadService.instance) {
      MatrixBatchUploadService.instance = new MatrixBatchUploadService()
    }
    return MatrixBatchUploadService.instance
  }

  /**
   * 批量上传文件
   */
  async uploadMultipleFiles(files: File[], options: BatchUploadOptions = {}): Promise<BatchUploadResult> {
    const startTime = Date.now()

    // 默认选项
    const opts: Required<BatchUploadOptions> = {
      maxConcurrency: 3,
      timeout: 30000, // 30秒
      onProgress: options.onProgress || (() => {}),
      onFileProgress: options.onFileProgress || (() => {}),
      onComplete: options.onComplete || (() => {}),
      continueOnError: options.continueOnError ?? true
    }

    // 初始化上传状态
    files.forEach((file) => {
      this.uploadStatus.set(file, {
        file,
        status: 'pending',
        progress: 0
      })
    })

    const successful = new Map<File, string>()
    const failed = new Map<File, Error>()
    const cancelled = new Set<File>()

    // 创建上传队列
    const queue = [...files]
    const active: Set<Promise<void>> = new Set()

    const processNext = async (): Promise<void> => {
      // 如果队列为空，返回
      if (queue.length === 0) return

      // 取出下一个文件
      const file = queue.shift()!
      const taskId = `${file.name}_${file.size}_${Date.now()}`

      // 创建上传任务
      const abortController = new AbortController()
      const task: UploadTask = { file, abortController }
      this.activeUploads.set(taskId, task)

      // 更新状态
      const status = this.uploadStatus.get(file)!
      status.status = 'uploading'
      this.reportProgress(opts)

      const uploadPromise = this.uploadFile(file, abortController.signal, opts.timeout)
        .then((mxcUrl) => {
          // 上传成功
          status.status = 'success'
          status.progress = 100
          status.mxcUrl = mxcUrl
          successful.set(file, mxcUrl)

          logger.debug('[BatchUploadService] File uploaded successfully', {
            fileName: file.name,
            mxcUrl
          })
        })
        .catch((error) => {
          // 检查是否被取消
          if (abortController.signal.aborted) {
            status.status = 'cancelled'
            cancelled.add(file)
            return
          }

          // 上传失败
          status.status = 'error'
          status.error = error as Error
          failed.set(file, error as Error)

          logger.error('[BatchUploadService] File upload failed', {
            fileName: file.name,
            error
          })

          // 如果不继续处理错误，清空队列
          if (!opts.continueOnError) {
            queue.length = 0
            this.cancelAll()
          }
        })
        .finally(() => {
          // 清理任务
          this.activeUploads.delete(taskId)
          active.delete(uploadPromise)

          // 更新进度
          this.reportProgress(opts)
        })

      active.add(uploadPromise)

      // 如果还有文件且并发数未达上限，继续处理
      if (queue.length > 0 && active.size < opts.maxConcurrency) {
        await processNext()
      }

      return uploadPromise
    }

    // 启动并发上传
    const workers = Array.from({ length: Math.min(opts.maxConcurrency, files.length) }, () => processNext())

    // 等待所有上传完成
    await Promise.all(workers)

    const duration = Date.now() - startTime
    const result: BatchUploadResult = {
      successful,
      failed,
      cancelled,
      total: files.length,
      duration
    }

    logger.info('[BatchUploadService] Batch upload completed', {
      total: files.length,
      successful: successful.size,
      failed: failed.size,
      cancelled: cancelled.size,
      duration
    })

    // 清理状态
    files.forEach((file) => this.uploadStatus.delete(file))

    // 调用完成回调
    opts.onComplete(result)

    return result
  }

  /**
   * 上传单个文件
   */
  private async uploadFile(file: File, signal: AbortSignal, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // 超时处理
      const timeoutId = setTimeout(() => {
        reject(new Error(`Upload timeout for ${file.name}`))
      }, timeout)

      // 上传文件
      uploadContent(file, {
        name: file.name,
        type: file.type,
        signal,
        onProgress: (loaded) => {
          const progress = Math.round((loaded / file.size) * 100)
          const status = this.uploadStatus.get(file)
          if (status) {
            status.progress = progress
          }
        }
      })
        .then((mxcUrl) => {
          clearTimeout(timeoutId)
          resolve(mxcUrl)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * 报告进度
   */
  private reportProgress(options: Required<BatchUploadOptions>): void {
    const statuses = Array.from(this.uploadStatus.values())

    const progress: BatchUploadProgress = {
      total: statuses.length,
      completed: statuses.filter((s) => s.status === 'success').length,
      failed: statuses.filter((s) => s.status === 'error').length,
      uploading: statuses.filter((s) => s.status === 'uploading').length,
      pending: statuses.filter((s) => s.status === 'pending').length,
      percentage: 0
    }

    // 计算总进度百分比
    if (progress.total > 0) {
      const totalProgress = statuses.reduce((sum, s) => sum + s.progress, 0)
      progress.percentage = Math.round(totalProgress / progress.total)
    }

    options.onProgress(progress)

    // 报告单个文件进度
    statuses.forEach((status) => {
      if (status.status === 'uploading') {
        options.onFileProgress(status.file, status.progress)
      }
    })
  }

  /**
   * 取消所有上传
   */
  cancelAll(): void {
    this.activeUploads.forEach((task) => {
      task.abortController.abort()
    })
    this.activeUploads.clear()

    logger.info('[BatchUploadService] All uploads cancelled')
  }

  /**
   * 取消特定文件的上传
   */
  cancelFile(file: File): boolean {
    for (const [taskId, task] of this.activeUploads.entries()) {
      if (task.file === file) {
        task.abortController.abort()
        this.activeUploads.delete(taskId)

        logger.debug('[BatchUploadService] File upload cancelled', {
          fileName: file.name
        })

        return true
      }
    }
    return false
  }

  /**
   * 获取上传状态
   */
  getUploadStatus(file: File): UploadStatus | undefined {
    return this.uploadStatus.get(file)
  }

  /**
   * 获取所有上传状态
   */
  getAllUploadStatuses(): UploadStatus[] {
    return Array.from(this.uploadStatus.values())
  }

  /**
   * 检查是否有活动上传
   */
  hasActiveUploads(): boolean {
    return this.activeUploads.size > 0
  }

  /**
   * 获取活动上传数量
   */
  getActiveUploadCount(): number {
    return this.activeUploads.size
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.cancelAll()
    this.uploadStatus.clear()
    logger.info('[BatchUploadService] Disposed')
  }
}

// 导出单例实例
export const matrixBatchUploadService = MatrixBatchUploadService.getInstance()

// 导出便捷函数
export async function uploadMultipleFiles(files: File[], options?: BatchUploadOptions): Promise<BatchUploadResult> {
  return matrixBatchUploadService.uploadMultipleFiles(files, options)
}

export function cancelAllUploads(): void {
  matrixBatchUploadService.cancelAll()
}

export function cancelFileUpload(file: File): boolean {
  return matrixBatchUploadService.cancelFile(file)
}

export function getUploadStatus(file: File): UploadStatus | undefined {
  return matrixBatchUploadService.getUploadStatus(file)
}
