import { Channel, invoke } from '@tauri-apps/api/core'
import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { TauriCommand, UploadSceneEnum } from '@/enums'
import { useUserStore } from '@/stores/user'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isAndroid, isMobile } from '@/utils/PlatformConstants'
import { getWasmMd5 } from '@/utils/Md5Util'
import { removeTempFile } from '@/utils/TempFileManager'

/** 文件信息类型 */
export type FileInfoType = {
  name: string
  type: string
  size: number
  suffix: string
  width?: number
  height?: number
  downloadUrl?: string
  second?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
}

/** 上传方式 */
export enum UploadProviderEnum {
  /** 默认上传方式 */
  DEFAULT = 'default',
  /** 七牛云上传 */
  QINIU = 'qiniu',
  /** MinIO 上传 */
  MINIO = 'minio'
}

/** 上传配置 */
export interface UploadOptions {
  /** 上传方式 */
  provider?: UploadProviderEnum
  /** 上传场景 */
  scene?: UploadSceneEnum
  /** 是否使用分片上传（仅对七牛云有效） */
  useChunks?: boolean
  /** 分片大小（单位：字节，默认4MB） */
  chunkSize?: number
  /** 是否启用文件去重（使用文件哈希作为文件名） */
  enableDeduplication?: boolean
}

const Max = 500 // 单位M
const MAX_FILE_SIZE = Max * 1024 * 1024 // 最大上传限制

let cryptoJS: any | null = null

const loadCryptoJS = async () => {
  if (!cryptoJS) {
    const module = await import('crypto-js')
    cryptoJS = module.default ?? module
  }
  return cryptoJS as {
    lib: { WordArray: { create: (arr: ArrayBuffer | Uint8Array) => any } }
    MD5: (wordArray: any) => { toString: () => string }
  }
}

/**
 * 文件上传Hook
 */
export const useUpload = () => {
  const userStore = useUserStore()
  const isUploading = ref(false) // 是否正在上传
  const progress = ref(0) // 进度
  const fileInfo = ref<FileInfoType | null>(null) // 文件信息

  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()

  const uploadFileWithTauriPut = async (targetUrl: string, file: File, contentType: string) => {
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const baseDirName = isMobile() ? 'AppData' : 'AppCache'
    const safeFileName = file.name.replace(/[\\/]/g, '_')
    const tempPath = `temp-upload-${Date.now()}-${safeFileName}`

    try {
      await writeFile(tempPath, file.stream(), { baseDir })

      const onProgress = new Channel<{ progressTotal: number; total: number }>()
      let lastProgress = -1
      onProgress.onmessage = ({ progressTotal, total }) => {
        const pct = total > 0 ? Math.floor((progressTotal / total) * 100) : 0
        if (pct !== lastProgress) {
          lastProgress = pct
          progress.value = pct
          trigger('progress')
        }
      }

      await invoke(TauriCommand.UPLOAD_FILE_PUT, {
        url: targetUrl,
        path: tempPath,
        baseDir: baseDirName,
        headers: { 'Content-Type': contentType },
        onProgress
      })
    } finally {
      await removeTempFile(tempPath, { baseDir, silent: true })
    }
  }

  /**
   * 计算文件的MD5哈希值
   * @param file 文件
   * @returns MD5哈希值
   */
  const calculateFileHash = async (file: File): Promise<string> => {
    const startTime = performance.now()
    try {
      console.log('开始计算MD5哈希值，文件大小:', file.size, 'bytes')
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let hash: string

      if (isAndroid()) {
        const CryptoJS = await loadCryptoJS()
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as ArrayBuffer)
        hash = CryptoJS.MD5(wordArray).toString()
      } else {
        const Md5 = await getWasmMd5()
        hash = await Md5.digest_u8(uint8Array)
      }
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      console.log(`MD5计算完成，耗时: ${duration}ms，哈希值: ${hash}`)
      return hash.toLowerCase()
    } catch (error) {
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      console.error(`计算文件哈希值失败，耗时: ${duration}ms:`, error)
      // 如果计算失败，返回时间戳作为备用方案
      return Date.now().toString()
    }
  }

  /**
   * 生成文件哈希
   * @param options 上传配置
   * @param fileObj 文件对象
   * @param fileName 文件名
   * @returns 文件哈希
   */
  const generateHashKey = async (
    options: { scene: UploadSceneEnum; enableDeduplication: boolean },
    fileObj: File,
    fileName: string
  ) => {
    let key: string

    if (options.enableDeduplication) {
      // 使用文件哈希作为文件名的一部分，实现去重
      const fileHash = await calculateFileHash(fileObj)
      const fileSuffix = fileName.split('.').pop() || ''
      // 获取当前登录用户的account
      const account = userStore.userInfo!.account
      key = `${options.scene}/${account}/${fileHash}.${fileSuffix}`
      console.log('使用文件去重模式，文件哈希:', fileHash)
    } else {
      // 使用时间戳生成唯一的文件名
      key = `${options.scene}/${Date.now()}_${fileName}`
    }
    return key
  }

  /**
   * 获取图片宽高
   */
  const getImgWH = async (file: File) => {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        tempUrl: result.previewUrl!
      }
    } catch (_error) {
      return { width: 0, height: 0, url: null }
    }
  }

  /**
   * 获取音频时长
   */
  const getAudioDuration = (file: File) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const tempUrl = URL.createObjectURL(file)
      audio.src = tempUrl
      // 计算音频的时长
      const countAudioTime = async () => {
        while (isNaN(audio.duration) || audio.duration === Infinity) {
          // 防止浏览器卡死
          await new Promise((resolve) => setTimeout(resolve, 100))
          // 随机进度条位置
          audio.currentTime = 100000 * Math.random()
        }
        // 取整
        const second = Math.round(audio.duration || 0)
        resolve({ second, tempUrl })
      }
      countAudioTime()
      audio.onerror = () => {
        reject({ second: 0, tempUrl })
      }
    })
  }

  /**
   * 解析文件
   * @param file 文件
   * @param addParams 参数
   * @returns 文件大小、文件类型、文件名、文件后缀...
   */
  const parseFile = async (file: File, addParams: Record<string, any> = {}) => {
    const { name, size, type } = file
    const suffix = name.split('.').pop()?.trim().toLowerCase() || ''
    const baseInfo = { name, size, type, suffix, ...addParams }

    // TODO：这里应该不需要进行类型判断了，可以直接返回baseInfo
    if (type.includes('image')) {
      const { width, height, tempUrl } = (await getImgWH(file)) as any
      return { ...baseInfo, width, height, tempUrl }
    }

    if (type.includes('audio')) {
      const { second, tempUrl } = (await getAudioDuration(file)) as any
      return { second, tempUrl, ...baseInfo }
    }
    // 如果是视频
    if (type.includes('video')) {
      return { ...baseInfo }
    }

    return baseInfo
  }

  /**
   * 上传文件
   * @param file 文件或文件路径
   * @param options 上传选项
   */
  const uploadFile = async (file: File | string, options?: UploadOptions) => {
    if (isUploading.value || !file) return

    let actualFile: File | null = null

    if (typeof file === 'string') {
      actualFile = await readFileAsFile(file)
    } else {
      actualFile = file
    }

    if (!actualFile) return

    const info = await parseFile(actualFile, options)

    // 限制文件大小
    if (info.size > MAX_FILE_SIZE) {
      window.$message.error(`文件大小不能超过 ${Max}MB`)
      return
    }

    fileInfo.value = { ...info }
    await onStart.trigger(fileInfo)

    const contentType = actualFile.type || 'application/octet-stream'

    isUploading.value = true
    progress.value = 0

    await uploadFileWithTauriPut('', actualFile, contentType)

    isUploading.value = false
    progress.value = 100
    trigger('success')
    return { downloadUrl: '' }
  }

  const readFileAsFile = async (path: string): Promise<File | null> => {
    try {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(path, { baseDir })
      const fileName = path.split('/').pop() || 'file'
      const mimeType = 'application/octet-stream'
      return new File([fileData], fileName, { type: mimeType })
    } catch (error) {
      console.error('读取文件失败:', error)
      return null
    }
  }

  return {
    fileInfo,
    isUploading,
    progress,
    onStart: onStart.on,
    onChange,
    uploadFile,
    parseFile,
    UploadProviderEnum,
    generateHashKey
  }
}
