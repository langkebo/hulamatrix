/**
 * 媒体管理 Store
 * 统一管理文件下载、缩略图缓存和媒体查看器
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCacheStore } from './core/useCacheStore'
import { useMediaViewerStore } from './mediaViewer'
import { useNotificationStore } from './notifications'
import { useChatStore } from './chat'
import { useUserStore } from './user'
import type { MediaItem } from './mediaViewer'
import type { MessageType } from '@/services/types'

// Tauri APIs
import { appDataDir, join } from '@tauri-apps/api/path'
import { BaseDirectory, exists, writeFile } from '@tauri-apps/plugin-fs'

// Utils
import { logger } from '@/utils/logger'
import { fileService } from '@/services/file-service'
import { isMobile } from '@/utils/PlatformConstants'
import { getFilesMeta } from '@/utils/PathUtil'
import type { FilesMeta } from '@/services/types'
import { sumBy } from 'es-toolkit'
import { matrixClientService } from '@/integrations/matrix/client'

export type MediaDownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed'

export interface MediaDownloadItem {
  id: string
  url: string
  filename?: string
  mimeType?: string
  size?: number
  type: 'image' | 'video' | 'audio' | 'file'
  status: MediaDownloadStatus
  progress?: number
  localPath?: string
  error?: string
  thumbnailUrl?: string
  duration?: number // 音视频时长
  width?: number
  height?: number
  createdAt: number
  completedAt?: number
}

// 文件下载状态接口（兼容旧的 useFileDownload）
export interface FileDownloadStatus {
  url: string
  status: 'downloading' | 'completed' | 'error'
  progress?: number
  total?: number
  downloaded?: number
  absolutePath?: string
  error?: string
  localPath?: string
}

export const useMediaStore = defineStore(
  'mediaStore',
  () => {
    const cacheStore = useCacheStore()
    const mediaViewerStore = useMediaViewerStore()
    const notificationStore = useNotificationStore()
    const userStore = useUserStore()

    // 下载队列
    const downloadQueue = ref<Map<string, MediaDownloadItem>>(new Map())
    const activeDownloads = ref<Set<string>>(new Set())
    const maxConcurrentDownloads = 3

    // 文件下载状态映射（兼容旧的 useFileDownload）
    const downloadStatusMap = ref<Record<string, FileDownloadStatus>>({})

    // 生成下载ID
    const normalizeUrl = (u: string): string => {
      if (!u) return u
      if (u.startsWith('mxc://')) {
        // Get Matrix client with mxcUrlToHttp method
        const client = matrixClientService.getClient() as {
          mxcUrlToHttp?: (mxcUrl: string) => string
        } | null
        const http = client?.mxcUrlToHttp?.(u)
        return http || u
      }
      return u
    }

    const generateDownloadId = (url: string): string => {
      const u = normalizeUrl(url)
      return btoa(u).replace(/[+/=]/g, '').substring(0, 16)
    }

    // 获取媒体类型
    const getMediaType = (mimeType?: string): MediaDownloadItem['type'] => {
      if (!mimeType) return 'file'
      if (mimeType.startsWith('image/')) return 'image'
      if (mimeType.startsWith('video/')) return 'video'
      if (mimeType.startsWith('audio/')) return 'audio'
      return 'file'
    }

    // ============== 从 useFileDownload 迁移的方法 ==============

    /**
     * 获取文件下载状态（兼容旧API）
     */
    const getFileStatus = (fileUrl: string): FileDownloadStatus => {
      return (
        downloadStatusMap.value[fileUrl] || {
          url: fileUrl,
          status: 'downloading',
          progress: 0,
          total: 100
        }
      )
    }

    /**
     * 更新文件下载状态（兼容旧API）
     */
    const updateFileStatus = (fileUrl: string, status: Partial<FileDownloadStatus>) => {
      const currentStatus = getFileStatus(fileUrl)
      downloadStatusMap.value[fileUrl] = {
        ...currentStatus,
        ...status
      }
    }

    /**
     * 下载文件
     */
    const downloadFile = async (
      fileUrl: string,
      options: {
        fileName?: string
        onProgress?: (progress: { loaded: number; total: number }) => void
        signal?: AbortSignal
      } = {}
    ): Promise<string | null> => {
      if (!fileUrl) return null
      const normalizedUrl = normalizeUrl(fileUrl)

      try {
        // 更新状态为下载中
        updateFileStatus(fileUrl, {
          status: 'downloading',
          progress: 0
        })

        // 检查文件是否已存在
        const fileName = options.fileName || normalizedUrl.split('/').pop() || 'download'
        const fileExists = await checkFileExists(normalizedUrl, fileName)
        if (fileExists) {
          const localPath = getLocalPath(normalizedUrl)
          if (localPath) {
            updateFileStatus(normalizedUrl, {
              status: 'completed',
              progress: 100,
              absolutePath: localPath
            })
            return localPath
          }
        }

        const res = await fileService.downloadWithResume(normalizedUrl, undefined, 0, (p) => {
          const total = 100
          updateFileStatus(normalizedUrl, { progress: Math.round(p), total, downloaded: Math.round((p / 100) * total) })
          options.onProgress?.({ loaded: Math.round((p / 100) * total), total })
        })
        const blob = res.blob as Blob
        const buffer = await blob.arrayBuffer()
        const data = new Uint8Array(buffer)
        const absolutePath = await saveFileFromBytes(normalizedUrl, fileName, data)

        if (absolutePath) {
          updateFileStatus(normalizedUrl, {
            status: 'completed',
            progress: 100,
            absolutePath
          })
        }

        return absolutePath
      } catch (error) {
        logger.error('下载文件失败:', error)
        updateFileStatus(normalizedUrl, {
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误'
        })
        return null
      }
    }

    /**
     * 保存字节数组到文件
     */
    const saveFileFromBytes = async (fileUrl: string, fileName: string, data: Uint8Array): Promise<string | null> => {
      try {
        let absolutePath = ''

        if (!isMobile()) {
          // 桌面端：使用用户房间目录
          const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
          absolutePath = await join(resourceDirPath, fileName)
        } else {
          // 移动端：使用应用数据目录
          const appDataDirPath = await appDataDir()
          const downloadsDir = await join(appDataDirPath, 'downloads')
          absolutePath = await join(downloadsDir, fileName)
        }

        // 确保目录存在
        // removed unused dirPath

        // 写入文件
        await writeFile(absolutePath, data)

        // 更新状态
        updateFileStatus(fileUrl, {
          absolutePath: absolutePath.replace(/\\/g, '/')
        })

        logger.info('文件保存成功:', absolutePath)
        return absolutePath
      } catch (error) {
        logger.error('保存文件失败:', error)
        return null
      }
    }

    /**
     * 获取文件本地路径
     */
    const getLocalPath = (fileUrl: string, absolute: boolean = true): string | null => {
      const status = downloadStatusMap.value[fileUrl]
      if (status?.absolutePath) {
        return absolute ? status.absolutePath : status.absolutePath.split('/').pop() || null
      }
      return null
    }

    /**
     * 检查文件是否存在
     */
    const checkFileExists = async (_fileUrl: string, fileName: string): Promise<boolean> => {
      try {
        const baseDir = BaseDirectory.AppData
        const filePath = await join(await userStore.getUserRoomDir(), fileName)
        return await exists(filePath, { baseDir })
      } catch (error) {
        logger.error('检查文件是否存在失败:', error)
        return false
      }
    }

    /**
     * 清除所有下载状态
     */
    const clearDownloadStatus = () => {
      downloadStatusMap.value = {}
    }

    /**
     * 移除指定文件的下载状态
     */
    const removeFileStatus = (fileUrl: string) => {
      delete downloadStatusMap.value[fileUrl]
    }

    /**
     * 批量检查文件状态
     */
    const batchCheckFileStatus = async (fileInfos: Array<{ url: string; fileName: string }>): Promise<void> => {
      for (const fileInfo of fileInfos) {
        const exists = await checkFileExists(fileInfo.url, fileInfo.fileName)
        if (exists) {
          const localPath = getLocalPath(fileInfo.url)
          if (localPath) {
            updateFileStatus(fileInfo.url, {
              status: 'completed',
              progress: 100,
              absolutePath: localPath
            })
          }
        }
      }
    }

    /**
     * 刷新文件下载状态
     */
    const refreshFileDownloadStatus = async (options: { msgId?: string; fileUrl?: string } = {}): Promise<void> => {
      if (!options.fileUrl || !options.msgId) return

      const { msgId, fileUrl } = options
      const chatStore = useChatStore()

      try {
        // 重置状态
        updateFileStatus(fileUrl, {
          status: 'downloading',
          progress: 0
        })

        // 获取消息信息
        const message = (
          chatStore as {
            getMessage?: (msgId: string) => MessageType | undefined
          }
        ).getMessage?.(msgId)
        if (!message) return

        // 获取文件名
        let fileName = ''
        // Check if message has body with fileName or file properties
        const fileBody = message.message?.body as
          | {
              fileName?: string
              file?: { name?: string }
            }
          | undefined
        if (fileBody?.fileName) {
          fileName = fileBody.fileName
        } else if (fileBody?.file?.name) {
          fileName = fileBody.file.name
        } else {
          fileName = fileUrl.split('/').pop() || 'download'
        }

        // 检查文件是否存在
        const fileExists = await checkFileExists(fileUrl, fileName)
        if (fileExists) {
          const absolutePath = getLocalPath(fileUrl)
          if (absolutePath) {
            updateFileStatus(fileUrl, {
              status: 'completed',
              progress: 100,
              absolutePath
            })
            return
          }
        }

        // 获取本地路径
        const localPath = getLocalPath(fileUrl)
        if (!localPath) return

        // 获取文件元信息
        const result = await getFilesMeta<FilesMeta>([localPath])
        if (result && result.length > 0) {
          const fileInfo = result[0] as { size?: number } | undefined
          const total = fileInfo?.size || 0
          const downloaded = sumBy(result as Array<{ size?: number }>, (item) => item.size || 0)

          updateFileStatus(fileUrl, {
            status: downloaded >= total ? 'completed' : 'downloading',
            progress: total > 0 ? Math.round((downloaded / total) * 100) : 0,
            total,
            downloaded,
            absolutePath: localPath
          })
        }
      } catch (error) {
        logger.error('刷新文件下载状态失败:', error)
        updateFileStatus(fileUrl, {
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    // ============== 新的媒体管理方法 ==============

    /**
     * 下载媒体文件（新API，使用队列）
     */
    const downloadMedia = async (
      url: string,
      options: {
        filename?: string
        mimeType?: string
        type?: MediaDownloadItem['type']
        priority?: number
        thumbnailUrl?: string
      } = {}
    ): Promise<string> => {
      const normalizedUrl = normalizeUrl(url)
      const id = generateDownloadId(normalizedUrl)
      const type = options.type || getMediaType(options.mimeType)

      // 检查是否已在队列中
      if (downloadQueue.value.has(id)) {
        const item = downloadQueue.value.get(id)!
        if (item.status === 'completed') {
          return item.localPath || normalizedUrl
        }
        return normalizedUrl
      }

      // 创建下载项
      const item: MediaDownloadItem = {
        id,
        url: normalizedUrl,
        type,
        status: 'pending',
        createdAt: Date.now()
      }
      if (options.filename !== undefined) item.filename = options.filename
      if (options.mimeType !== undefined) item.mimeType = options.mimeType
      if (options.thumbnailUrl !== undefined) item.thumbnailUrl = options.thumbnailUrl

      // 添加到队列
      downloadQueue.value.set(id, item)

      // 处理队列
      setTimeout(processDownloadQueue, 0)

      return normalizedUrl
    }

    /**
     * 处理下载队列
     */
    const processDownloadQueue = async () => {
      if (activeDownloads.value.size >= maxConcurrentDownloads) {
        return
      }

      const pendingItems = Array.from(downloadQueue.value.values())
        .filter((item) => item.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt)

      if (pendingItems.length === 0) return

      const item = pendingItems[0]!
      activeDownloads.value.add(item.id)

      try {
        item.status = 'downloading'
        item.progress = 0

        // 使用实际的下载方法
        const dlOpts: { fileName?: string } = {}
        if (item.filename !== undefined) dlOpts.fileName = item.filename
        const res = await fileService.downloadWithResume(item.url, undefined, 0, (p) => {
          item.progress = Math.round(p)
        })
        const blob = res.blob as Blob
        const buffer = await blob.arrayBuffer()
        const data = new Uint8Array(buffer)
        const localPath = await saveFileFromBytes(
          item.url,
          item.filename || item.url.split('/').pop() || 'download',
          data
        )

        if (localPath) {
          item.status = 'completed'
          item.completedAt = Date.now()
          item.progress = 100
          item.localPath = localPath

          notificationStore.addSystemNotification(`下载完成`, `${item.filename || '文件'} 已下载完成`, 'success')
        } else {
          throw new Error('下载失败')
        }
      } catch (error) {
        item.status = 'failed'
        item.error = error instanceof Error ? error.message : '未知错误'

        notificationStore.addError('下载失败', `${item.filename || '文件'} 下载失败: ${item.error}`)
      } finally {
        activeDownloads.value.delete(item.id)
        setTimeout(processDownloadQueue, 100)
      }
    }

    /**
     * 查看图片
     */
    const viewImage = (url: string, list?: string[]) => {
      const normalizedUrl = normalizeUrl(url)
      const items: MediaItem[] = []

      const currentItem: MediaItem = {
        id: generateDownloadId(normalizedUrl),
        url: normalizedUrl,
        type: 'image'
      }
      items.push(currentItem)

      if (list && list.length > 0) {
        list.forEach((u) => {
          if (u !== url) {
            const nu = normalizeUrl(u)
            items.push({
              id: generateDownloadId(nu),
              url: nu,
              type: 'image'
            })
          }
        })
      }

      mediaViewerStore.viewMedia(currentItem, items)
    }

    /**
     * 查看视频
     */
    const viewVideo = (url: string, poster?: string) => {
      const normalizedUrl = normalizeUrl(url)
      const item: MediaItem & { poster?: string } = {
        id: generateDownloadId(normalizedUrl),
        url: normalizedUrl,
        type: 'video',
        ...(poster !== undefined && { poster })
      }

      mediaViewerStore.viewMedia(item, [item])
    }

    /**
     * 添加缩略图到缓存（兼容旧API）
     */
    const enqueueThumbnail = async (
      url: string,
      thumbnailUrl: string,
      options?: {
        width?: number
        height?: number
        quality?: number
      }
    ): Promise<void> => {
      // 使用缓存存储保存缩略图
      await cacheStore.set(thumbnailUrl, {
        url: thumbnailUrl,
        type: 'thumb',
        originalUrl: url,
        width: options?.width,
        height: options?.height,
        quality: options?.quality || 0.8
      })
    }

    // 计算属性
    const downloadingCount = computed(
      () => Array.from(downloadQueue.value.values()).filter((item) => item.status === 'downloading').length
    )

    const completedDownloads = computed(() =>
      Array.from(downloadQueue.value.values()).filter((item) => item.status === 'completed')
    )

    return {
      // 状态
      downloadQueue,
      downloadStatusMap,
      activeDownloads,
      downloadingCount,
      completedDownloads,

      // 兼容旧API的方法
      getFileStatus,
      updateFileStatus,
      downloadFile,
      saveFileFromBytes,
      getLocalPath,
      checkFileExists,
      clearDownloadStatus,
      removeFileStatus,
      batchCheckFileStatus,
      refreshFileDownloadStatus,

      // 新的媒体管理方法
      downloadMedia,
      viewImage,
      viewVideo,
      enqueueThumbnail,

      // 缓存方法（代理）
      getCache: cacheStore.get.bind(cacheStore),
      setCache: cacheStore.set.bind(cacheStore),
      removeCache: cacheStore.remove.bind(cacheStore),
      clearCache: cacheStore.clear.bind(cacheStore),

      // 媒体查看器方法（代理）
      showViewer: mediaViewerStore.showViewer.bind(mediaViewerStore),
      hideViewer: mediaViewerStore.hideViewer.bind(mediaViewerStore),
      nextMedia: mediaViewerStore.nextMedia.bind(mediaViewerStore),
      prevMedia: mediaViewerStore.prevMedia.bind(mediaViewerStore),
      zoomIn: mediaViewerStore.zoomIn.bind(mediaViewerStore),
      zoomOut: mediaViewerStore.zoomOut.bind(mediaViewerStore),
      resetZoom: mediaViewerStore.resetZoom.bind(mediaViewerStore),
      rotateLeft: mediaViewerStore.rotateLeft.bind(mediaViewerStore),
      rotateRight: mediaViewerStore.rotateRight.bind(mediaViewerStore)
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)

// 导出别名以保持向后兼容
export const useFileDownload = useMediaStore
export const useFileDownloadStore = useMediaStore
