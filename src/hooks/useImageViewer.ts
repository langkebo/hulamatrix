import { convertFileSrc } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MsgEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat'
import { useMediaStore } from '@/stores/useMediaStore'
import { useMediaViewerStore, type MediaItem } from '@/stores/mediaViewer'
import type { FilesMeta } from '@/services/types'
import { extractFileName } from '@/utils/formatUtils'
import { getFilesMeta } from '@/utils/PathUtil'
import { logger } from '@/utils/logger'

const deduplicateList = (list: string[]) => {
  const uniqueList: string[] = []
  const seen = new Set<string>()
  list.forEach((url) => {
    if (url && !seen.has(url)) {
      seen.add(url)
      uniqueList.push(url)
    }
  })
  return uniqueList
}

/**
 * 图片查看器Hook，用于处理图片和表情包的查看功能
 */
export const useImageViewer = () => {
  const chatStore = useChatStore()
  const { createWebviewWindow } = useWindow()
  const mediaStore = useMediaStore()
  const mediaViewerStore = useMediaViewerStore()

  const ensureLocalFileExists = async (url: string) => {
    if (!url) return null
    const status = mediaStore.getFileStatus(url)
    const validatePath = async (absolutePath: string | undefined | null) => {
      if (!absolutePath) {
        return null
      }
      try {
        const [meta] = await getFilesMeta<FilesMeta>([absolutePath])
        if (meta?.exists) {
          return absolutePath
        }
        return null
      } catch (error) {
        logger.error('检查本地图片失败:', error)
        return null
      }
    }

    if (status?.downloaded && status?.total && status.downloaded >= status.total) {
      const validPath = await validatePath(status.absolutePath)
      if (validPath) {
        return validPath
      }

      mediaStore.updateFileStatus(url, {
        absolutePath: '',
        localPath: '',
        status: 'downloading'
      })
    }

    const fileName = extractFileName(url)
    if (!fileName) {
      return null
    }

    try {
      const exists = await mediaStore.checkFileExists(url, fileName)
      if (!exists) {
        return null
      }

      const refreshedStatus = mediaStore.getFileStatus(url)
      return await validatePath(refreshedStatus.absolutePath)
    } catch (error) {
      logger.error('重新检查本地图片失败:', error)
      return null
    }
  }

  const getDisplayUrl = async (url: string) => {
    const localPath = await ensureLocalFileExists(url)
    if (localPath) {
      try {
        return convertFileSrc(localPath)
      } catch (error) {
        logger.error('转换本地图片路径失败:', error)
      }
    }
    return url
  }

  const getLocalMediaPathFromChat = (url: string, includeTypes: MsgEnum[]) => {
    const messages = Object.values(chatStore.currentMessageMap || {})
    for (const msg of messages) {
      if (!includeTypes.includes(msg.message?.type)) continue
      if (msg.message.body?.url !== url) continue
      if (msg.message.body?.localPath) {
        return msg.message.body.localPath as string
      }
    }
    return null
  }

  const resolveDisplayUrl = async (url: string, includeTypes: MsgEnum[]) => {
    const localPath = getLocalMediaPathFromChat(url, includeTypes)
    if (localPath) {
      try {
        return convertFileSrc(localPath)
      } catch (error) {
        logger.error('转换本地媒体路径失败:', error)
      }
    }
    return await getDisplayUrl(url)
  }

  const downloadOriginalByIndex = (index: number) => {
    if (index < 0) {
      return
    }
    // 使用 mediaViewerStore API 导航到指定索引
    mediaViewerStore.navigateToIndex(index)
    logger.info('导航到图片索引:', index)
  }

  /**
   * 获取当前聊天中的所有图片和表情包URL
   * @param currentUrl 当前查看的URL
   * @param includeTypes 要包含的消息类型数组
   */
  const getAllMediaFromChat = (currentUrl: string, includeTypes: MsgEnum[] = [MsgEnum.IMAGE, MsgEnum.EMOJI]) => {
    const messages = [...Object.values(chatStore.currentMessageMap || {})]
    const mediaUrls: string[] = []
    let currentIndex = 0

    messages.forEach((msg) => {
      // 收集指定类型的媒体URL
      if (includeTypes.includes(msg.message?.type) && msg.message.body?.url) {
        mediaUrls.push(msg.message.body.url)
        // 找到当前媒体的索引
        if (msg.message.body.url === currentUrl) {
          currentIndex = mediaUrls.length - 1
        }
      }
    })

    return {
      list: mediaUrls,
      index: currentIndex
    }
  }

  /**
   * 打开图片查看器
   * @param url 要查看的URL
   * @param includeTypes 要包含在查看器中的消息类型
   * @param customImageList 自定义图片列表，用于聊天历史等场景
   */
  const openImageViewer = async (
    url: string,
    includeTypes: MsgEnum[] = [MsgEnum.IMAGE, MsgEnum.EMOJI],
    customImageList?: string[]
  ) => {
    if (!url) return

    try {
      let list: string[]
      let index: number

      if (customImageList && customImageList.length > 0) {
        // 使用自定义图片列表
        list = customImageList
        index = customImageList.indexOf(url)
        if (index === -1) {
          // 如果当前图片不在列表中，将其添加到列表开头
          list = [url, ...customImageList]
          index = 0
        }
      } else {
        // 使用默认逻辑从聊天中获取
        const result = getAllMediaFromChat(url, includeTypes)
        list = result.list
        index = result.index
      }

      const dedupedList = deduplicateList(list)
      const resolvedList = await Promise.all(dedupedList.map((item) => resolveDisplayUrl(item, includeTypes)))

      const targetIndex = dedupedList.indexOf(url)
      const resolvedIndex = targetIndex === -1 ? (index >= 0 ? index : 0) : targetIndex

      // 使用 mediaViewerStore API 管理状态
      const mediaItems: MediaItem[] = resolvedList.map((displayUrl, idx) => ({
        id: dedupedList[idx],
        url: displayUrl,
        type: 'image',
        currentIndex: idx,
        list: resolvedList.map((u, i) => ({ id: dedupedList[i], url: u, type: 'image' as const }))
      }))

      mediaViewerStore.showImageViewer(mediaItems, resolvedIndex)
      logger.info('准备显示图片列表，数量:', resolvedList.length)

      // 检查图片查看器窗口是否已存在
      const existingWindow = await WebviewWindow.getByLabel('imageViewer')

      if (existingWindow) {
        // 如果窗口已存在，更新图片内容并显示窗口
        await existingWindow.emit('update-image', { list: resolvedList, index: resolvedIndex })
        await existingWindow.show()
        await existingWindow.setFocus()
        return
      }

      const img = new Image()
      img.src = resolvedList[resolvedIndex] || url

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // 默认窗口尺寸（最小尺寸）
      const MIN_WINDOW_WIDTH = 630
      const MIN_WINDOW_HEIGHT = 660
      // 计算实际窗口尺寸（保留一定边距）
      const MARGIN = 100 // 窗口边距
      let windowWidth = MIN_WINDOW_WIDTH
      let windowHeight = MIN_WINDOW_HEIGHT

      // 获取屏幕尺寸
      const { width: screenWidth, height: screenHeight } = window.screen

      // 计算最大可用尺寸（考虑边距）
      const maxWidth = screenWidth - MARGIN * 2
      const maxHeight = screenHeight - MARGIN * 2

      // 保持图片比例计算窗口尺寸
      const imageRatio = img.width / img.height

      // 计算实际窗口尺寸
      if (img.width > MIN_WINDOW_WIDTH || img.height > MIN_WINDOW_HEIGHT) {
        if (imageRatio > maxWidth / maxHeight) {
          // 以宽度为基准
          windowWidth = Math.min(img.width + MARGIN, maxWidth)
          windowHeight = Math.max(windowWidth / imageRatio + MARGIN, MIN_WINDOW_HEIGHT)
        } else {
          // 以高度为基准
          windowHeight = Math.min(img.height + MARGIN, maxHeight)
          windowWidth = Math.max(windowHeight * imageRatio + MARGIN, MIN_WINDOW_WIDTH)
        }
      }

      // 创建窗口，使用计算后的尺寸
      await createWebviewWindow(
        '图片查看',
        'imageViewer',
        Math.round(windowWidth),
        Math.round(windowHeight),
        '',
        true,
        Math.round(windowWidth),
        Math.round(windowHeight)
      )
    } catch (error) {
      logger.error('打开图片查看器失败:', error)
    }
  }

  return {
    getAllMediaFromChat,
    openImageViewer,
    downloadOriginalByIndex
  }
}
