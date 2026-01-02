import { ref } from 'vue'
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { isMobile } from '@/utils/PlatformConstants'
import type { EncryptedFile } from '@/integrations/matrix/mediaCrypto'
import { fileService } from '@/services/file-service'
import { logger } from '@/utils/logger'

/**
 * 文件下载 Hook（支持认证媒体与超时控制）
 * @returns 下载状态与下载方法
 */
export const useDownload = () => {
  const process = ref(0)
  const isDownloading = ref(false)
  const { on: onLoaded, trigger } = createEventHook()

  /**
   * 下载文件到本地路径
   * @param url 资源地址
   * @param savePath 保存相对路径（基于 BaseDirectory）
   * @param baseDir Tauri 基础目录（移动端默认 AppData，桌面默认 AppCache）
   * @param opts 选项：`authenticated` 是否附带授权；`timeoutMs` 超时毫秒
   */
  const downloadFile = async (
    url: string,
    savePath: string,
    baseDir: BaseDirectory = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache,
    opts?: { authenticated?: boolean; timeoutMs?: number; encrypted?: EncryptedFile }
  ) => {
    try {
      isDownloading.value = true
      process.value = 0

      // 确保目录存在
      const dirPath = savePath.substring(0, savePath.lastIndexOf('/'))
      if (dirPath) {
        const dirExists = await exists(dirPath, { baseDir })
        if (!dirExists) {
          await mkdir(dirPath, { baseDir, recursive: true })
        }
      }

      let output: Uint8Array
      if (opts?.encrypted) {
        const res = await fileService.downloadWithResumeAndDecrypt(url, opts.encrypted, 0, (p) => {
          process.value = Math.floor(p)
        })
        output = res.data
      } else {
        const result = await fileService.downloadWithResume(url, undefined, 0, (p) => {
          process.value = Math.floor(p)
        })
        const blob = result.blob as Blob
        const buffer = await blob.arrayBuffer()
        output = new Uint8Array(buffer)
      }
      await writeFile(savePath, output, { baseDir })
      trigger('success')
    } catch (error) {
      logger.error('Download failed', error, 'useDownload')
      trigger('fail')
      throw error
    } finally {
      isDownloading.value = false
      process.value = 0
    }
  }

  return {
    onLoaded,
    downloadFile,
    process,
    isDownloading
  }
}
