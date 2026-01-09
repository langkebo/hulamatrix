/**
 * 文件上传 Hook (简化版)
 *
 * 基于 Matrix SDK 的媒体上传服务
 * 包装 src/integrations/matrix/media.ts 提供的上传功能
 *
 * **旧的实现** (已删除):
 * - 七牛云上传 (QINIU)
 * - 分片上传 (chunked uploads)
 * - 自定义文件哈希去重
 * - 默认上传 (DEFAULT)
 *
 * **新的实现**:
 * - 直接使用 Matrix SDK 的 uploadContent 方法
 * - 所有上传都通过 Matrix 媒体服务器
 * - 自动进度跟踪
 * - 内置缓存支持
 */

import { ref } from 'vue'
import { createEventHook } from '@vueuse/core'
import { uploadContent, uploadImage, type UploadContentOptions } from '@/integrations/matrix/media'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { UploadSceneEnum } from '@/enums'

// 重新导出 enums 中的 UploadSceneEnum 以保持兼容性
export { UploadSceneEnum } from '@/enums'

/**
 * 上传提供者（已废弃，仅保留用于兼容性）
 * @deprecated 所有上传现在都使用 Matrix 媒体服务器
 */
export enum UploadProviderEnum {
  /** Matrix 媒体服务器 */
  MATRIX = 'matrix',
  /** 默认上传方式 */
  DEFAULT = 'default',
  /** 七牛云上传（已废弃） */
  QINIU = 'qiniu'
}

/**
 * 上传选项（简化版）
 */
export interface UploadOptions {
  /** 上传提供者（已废弃，仅保留用于兼容性） */
  provider?: UploadProviderEnum
  /** 上传场景 */
  scene?: UploadSceneEnum
  /** 启用去重（已废弃，不再需要） */
  enableDeduplication?: boolean
  /** 进度回调 */
  onProgress?: (progress: number) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 文件信息类型
 */
export type FileInfoType = {
  name: string
  type: string
  size: number
  url?: string
  mxcUrl?: string
  downloadUrl?: string // 兼容旧代码
  progress?: number
  status?: 'uploading' | 'success' | 'error'
  error?: string
}

/**
 * 文件上传Hook
 */
export const useUpload = () => {
  const isUploading = ref(false)
  const progress = ref(0)
  const fileInfo = ref<FileInfoType | null>(null)

  // 事件钩子
  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()
  const onSuccess = createEventHook()
  const onError = createEventHook()

  /**
   * 上传文件
   * @param file - 要上传的文件
   * @param options - 上传选项
   * @returns mxc:// URL
   */
  const upload = async (file: Blob | File, options?: UploadOptions): Promise<string | undefined> => {
    try {
      isUploading.value = true
      progress.value = 0

      // 设置文件信息
      fileInfo.value = {
        name: (file as File).name || 'unknown',
        type: (file as File).type || 'application/octet-stream',
        size: file.size,
        status: 'uploading',
        progress: 0
      }

      // 触发开始事件
      onStart.trigger(fileInfo.value)

      logger.debug('[useUpload] Starting upload', {
        name: fileInfo.value.name,
        size: fileInfo.value.size,
        scene: options?.scene
      })

      // 准备上传选项
      const uploadOptions: UploadContentOptions = {
        name: (file as File).name,
        type: (file as File).type
      }

      // 添加进度回调
      if (options?.onProgress) {
        uploadOptions.onProgress = (loaded: number, total: number) => {
          const percent = Math.round((loaded / total) * 100)
          progress.value = percent
          if (fileInfo.value) {
            fileInfo.value.progress = percent
          }
          options.onProgress?.(percent)
        }
      }

      // 添加取消信号
      if (options?.signal) {
        uploadOptions.signal = options.signal
      }

      // 执行上传
      const mxcUrl = await uploadContent(file, uploadOptions)

      // 更新文件信息
      if (fileInfo.value) {
        fileInfo.value.mxcUrl = mxcUrl
        fileInfo.value.status = 'success'
        fileInfo.value.progress = 100
      }

      progress.value = 100

      logger.info('[useUpload] Upload completed', {
        mxc: mxcUrl,
        name: fileInfo.value?.name
      })

      // 触发成功事件
      onSuccess.trigger({ mxcUrl, fileInfo: fileInfo.value })

      // 触发变更事件（兼容旧代码）
      trigger('success')

      return mxcUrl
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[useUpload] Upload failed', error as Error)

      if (fileInfo.value) {
        fileInfo.value.status = 'error'
        fileInfo.value.error = errorMessage
      }

      msg.error(`上传失败: ${errorMessage}`)

      // 触发错误事件
      onError.trigger({ error, fileInfo: fileInfo.value })

      // 触发变更事件（兼容旧代码）
      trigger('fail')

      return undefined
    } finally {
      isUploading.value = false
    }
  }

  /**
   * 上传图片（带尺寸信息）
   * @param file - 图片文件
   * @param options - 上传选项
   * @returns mxc:// URL 和图片尺寸
   */
  const uploadImageFile = async (
    file: File,
    options?: UploadOptions
  ): Promise<{ mxcUrl: string; width?: number; height?: number } | undefined> => {
    try {
      isUploading.value = true
      progress.value = 0

      logger.debug('[useUpload] Starting image upload', {
        name: file.name,
        size: file.size,
        type: file.type
      })

      // 准备上传选项
      const uploadOptions: UploadContentOptions = {
        name: file.name,
        type: file.type
      }

      // 添加进度回调
      if (options?.onProgress) {
        uploadOptions.onProgress = (loaded: number, total: number) => {
          const percent = Math.round((loaded / total) * 100)
          progress.value = percent
          options.onProgress?.(percent)
        }
      }

      // 添加取消信号
      if (options?.signal) {
        uploadOptions.signal = options.signal
      }

      // 执行上传
      const result = await uploadImage(file, uploadOptions)

      progress.value = 100

      logger.info('[useUpload] Image upload completed', {
        mxc: result.mxcUrl,
        width: result.width,
        height: result.height
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[useUpload] Image upload failed', error as Error)
      msg.error(`图片上传失败: ${errorMessage}`)
      return undefined
    } finally {
      isUploading.value = false
    }
  }

  /**
   * 上传多个文件
   * @param files - 文件列表
   * @param options - 上传选项
   * @returns mxc:// URL 列表
   */
  const uploadMultiple = async (files: (Blob | File)[], options?: UploadOptions): Promise<string[]> => {
    const results: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      logger.debug(`[useUpload] Uploading file ${i + 1}/${files.length}`)

      const mxcUrl = await upload(file, {
        ...options,
        onProgress: (progress) => {
          // 计算总体进度
          const overallProgress = (i * 100 + progress) / files.length
          options?.onProgress?.(overallProgress)
        }
      })

      if (mxcUrl) {
        results.push(mxcUrl)
      }
    }

    return results
  }

  return {
    // 状态
    isUploading,
    progress,
    fileInfo,

    // 方法
    upload,
    uploadImage: uploadImageFile,
    uploadMultiple,

    // 事件
    onChange,
    onStart,
    onSuccess,
    onError
  }
}

/**
 * 便捷方法：上传单个文件
 */
export async function uploadFile(file: Blob | File, options?: UploadOptions): Promise<string | undefined> {
  const { upload } = useUpload()
  return await upload(file, options)
}

/**
 * 便捷方法：上传图片
 */
export async function uploadImageFile(
  file: File,
  options?: UploadOptions
): Promise<{ mxcUrl: string; width?: number; height?: number } | undefined> {
  const { uploadImage } = useUpload()
  return await uploadImage(file, options)
}
