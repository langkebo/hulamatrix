import { save } from '@tauri-apps/plugin-dialog'
import type { useDownload } from '@/hooks/useDownload'

import { msg } from '@/utils/SafeUI'
import { extractFileName } from './Formatting'
import { logger, toError } from '@/utils/logger'

const VIDEO_FILE_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'] as const

type DownloadFileFn = ReturnType<typeof useDownload>['downloadFile']

export type SaveAttachmentOptions = {
  url?: string
  downloadFile: DownloadFileFn
  defaultFileName?: string
  filters?: Array<{ name: string; extensions: string[] }>
  successMessage?: string
  errorMessage?: string
}

const normalizeSavePath = (path: string) => path.replace(/\\/g, '/')

const saveAttachmentAs = async ({
  url,
  downloadFile,
  defaultFileName,
  filters,
  successMessage,
  errorMessage
}: SaveAttachmentOptions) => {
  if (!url) {
    msg.error('未找到下载链接')
    return
  }

  const filename = defaultFileName || extractFileName(url)

  try {
    const dialogOpts: { defaultPath: string; filters?: Array<{ name: string; extensions: string[] }> } = {
      defaultPath: filename
    }
    if (filters) dialogOpts.filters = filters
    const savePath = await save(dialogOpts)

    if (!savePath) return

    const normalizedPath = normalizeSavePath(savePath)
    await downloadFile(url, normalizedPath)

    if (successMessage) {
      msg.success(successMessage)
    }
  } catch (error) {
    logger.error(errorMessage || '保存文件失败:', toError(error))
    if (errorMessage) {
      msg.error(errorMessage)
    }
  }
}

export const saveVideoAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    filters: options.filters || [
      {
        name: 'Video',
        extensions: [...VIDEO_FILE_EXTENSIONS]
      }
    ],
    successMessage: options.successMessage || '视频保存成功',
    errorMessage: options.errorMessage || '保存视频失败',
    ...options
  })
}

export const saveFileAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    successMessage: options.successMessage || '文件下载成功',
    errorMessage: options.errorMessage || '保存文件失败',
    ...options
  })
}
