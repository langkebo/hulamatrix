import { ref } from 'vue'
import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import { fetch } from '@tauri-apps/plugin-http'
import { createEventHook } from '@vueuse/core'
import { UploadSceneEnum } from '@/enums'
import { useConfigStore } from '@/stores/config'
import { useUserStore } from '@/stores/user'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { isAndroid, isMobile } from '@/utils/PlatformConstants'
import { getWasmMd5 } from '@/utils/Md5Util'
import { useTimerManager } from '@/composables/useTimerManager'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

/** CryptoJS WordArray 类型 */
interface WordArray {
  words: number[]
  sigBytes: number
}

/** CryptoJS 库类型 */
interface CryptoJSStatic {
  lib: {
    WordArray: {
      create: (arr: ArrayBuffer | Uint8Array) => WordArray
    }
  }
  MD5: (wordArray: WordArray) => { toString: () => string }
}

/** 七牛云配置类型 */
interface QiniuConfig {
  token: string
  domain: string
  storagePrefix: string
  region?: string
}

/** 分片上传结果类型 */
interface ChunkUploadResult {
  key?: string
  domain?: string
  downloadUrl?: string
  error?: string
}

/** 图片解析结果 */
interface ImageParseResult {
  width: number
  height: number
  tempUrl?: string
}

/** 音频解析结果 */
interface AudioParseResult {
  second: number
  tempUrl?: string
}

/** 文件解析参数 */
interface ParseFileParams {
  width?: number
  height?: number
  tempUrl?: string
  second?: number
  [key: string]: unknown
}

/** 上传配置扩展 */
interface UploadOptionsExtended extends UploadOptions {
  token?: string
  domain?: string
  storagePrefix?: string
  region?: string
  enableDeduplication?: boolean
  downloadUrl?: string
}

/** 获取上传下载URL返回配置 */
interface UploadResponseConfig {
  token?: string
  domain?: string
  storagePrefix?: string
  region?: string
  provider?: UploadProviderEnum
  scene?: UploadSceneEnum
}

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
  /** Matrix 媒体服务器（推荐） */
  MATRIX = 'matrix',
  /** 默认上传方式（已废弃，请使用 MATRIX） */
  DEFAULT = 'default',
  /** 七牛云上传（已废弃，请使用 MATRIX） */
  QINIU = 'qiniu'
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
  /** 上传进度回调函数 */
  onProgress?: (progress: number) => void
}

/** 分片上传进度信息 */
interface ChunkProgressInfo {
  uploadedChunks: number
  totalChunks: number
  currentChunkProgress: number
}

const Max = 100 // 单位M
const MAX_FILE_SIZE = Max * 1024 * 1024 // 最大上传限制
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024 // 默认分片大小：4MB
const QINIU_CHUNK_SIZE = 4 * 1024 * 1024 // 七牛云分片大小：4MB
const CHUNK_THRESHOLD = 4 * 1024 * 1024 // 4MB，超过此大小的文件将使用分片上传

let cryptoJS: CryptoJSStatic | null = null

const loadCryptoJS = async () => {
  if (!cryptoJS) {
    const module = await import('crypto-js')
    cryptoJS = (module.default ?? module) as unknown as CryptoJSStatic
  }
  return cryptoJS
}

/**
 * 文件上传Hook
 */
export const useUpload = () => {
  // 获取configStore配置中的ossDomain
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const isUploading = ref(false) // 是否正在上传
  const progress = ref(0) // 进度
  const fileInfo = ref<FileInfoType | null>(null) // 文件信息
  // 默认使用 Matrix 媒体服务器
  const currentProvider = ref<UploadProviderEnum>(UploadProviderEnum.MATRIX)

  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()

  /**
   * 计算文件的MD5哈希值
   * @param file 文件
   * @returns MD5哈希值
   */
  const calculateFileHash = async (file: File): Promise<string> => {
    const startTime = performance.now()
    try {
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

      return hash.toLowerCase()
    } catch (error) {
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      logger.error(`计算文件哈希值失败，耗时: ${duration}ms:`, error as Error)
      return Date.now().toString()
    }
  }

  /**
   * 根据文件名获取文件类型
   * @param fileName 文件名
   */
  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase()

    // 对于图片类型，使用统一的 getMimeTypeFromExtension 函数
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(extension || '')) {
      return getMimeTypeFromExtension(fileName)
    }

    // 其他文件类型
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'mp3':
        return 'audio/mp3'
      default:
        return 'application/octet-stream' // 默认类型
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
      logger.debug('使用文件去重模式，文件哈希:', fileHash)
    } else {
      // 使用时间戳生成唯一的文件名
      key = `${options.scene}/${Date.now()}_${fileName}`
    }
    return key
  }

  /**
   * 上传文件到默认存储 - 支持分片上传
   * @param url 上传链接
   * @param file 文件
   */
  // const uploadToDefault = async (url: string, file: File) => {
  //   isUploading.value = true

  //   try {
  //     if (file.size > CHUNK_THRESHOLD) {
  //       await uploadToDefaultWithChunks(url, file)
  //     } else {
  //       // 将File对象转换为ArrayBuffer
  //       const arrayBuffer = await file.arrayBuffer()

  //       const response = await fetch(url, {
  //         method: 'PUT',
  //         headers: {
  //           'Content-Type': file.type
  //         },
  //         body: arrayBuffer,
  //         duplex: 'half'
  //       } as RequestInit)

  //       isUploading.value = false

  //       if (response.ok) {
  //         trigger('success')
  //       } else {
  //         trigger('fail')
  //       }
  //     }
  //   } catch (error) {
  //     isUploading.value = false
  //     logger.error('Upload failed:', error)
  //     trigger('fail')
  //   }
  // }

  /**
   * 分片上传到默认存储
   * @param url 上传链接
   * @param file 文件
   */
  const uploadToDefaultWithChunks = async (url: string, file: File) => {
    progress.value = 0
    const chunkSize = DEFAULT_CHUNK_SIZE
    const totalSize = file.size
    const totalChunks = Math.ceil(totalSize / chunkSize)

    logger.debug('开始默认存储分片上传:', {
      fileName: file.name,
      fileSize: totalSize,
      chunkSize,
      totalChunks
    })

    try {
      // 创建一个临时的上传会话ID
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, totalSize)
        const chunk = file.slice(start, end)
        const chunkArrayBuffer = await chunk.arrayBuffer()

        // 为每个分片添加必要的头信息
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'X-Chunk-Index': i.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Upload-Id': uploadId,
          'X-File-Name': file.name,
          'X-File-Size': totalSize.toString()
        }

        // 如果是最后一个分片，添加完成标记
        if (i === totalChunks - 1) {
          headers['X-Last-Chunk'] = 'true'
        }

        const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: chunkArrayBuffer,
          duplex: 'half'
        } as RequestInit)

        if (!response.ok) {
          throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败: ${response.statusText}`)
        }

        // 更新进度
        progress.value = Math.floor(((i + 1) / totalChunks) * 100)
        trigger('progress') // 触发进度事件
      }

      isUploading.value = false
      progress.value = 100
      trigger('success')
    } catch (error) {
      isUploading.value = false
      logger.error('默认存储分片上传失败:', error)
      throw error
    }
  }

  /**
   * 上传文件到七牛云
   * @deprecated 请使用 Matrix 媒体服务器 (UploadProviderEnum.MATRIX)
   * @param file 文件
   * @param qiniuConfig 七牛云配置
   * @param enableDeduplication 是否启用文件去重
   */
  const uploadToQiniu = async (
    file: File,
    scene: UploadSceneEnum,
    qiniuConfig: { token: string; domain: string; storagePrefix: string; region?: string },
    enableDeduplication: boolean = true
  ) => {
    isUploading.value = true
    progress.value = 0

    try {
      // 创建FormData对象
      const formData = new FormData()

      // 生成文件名
      const key = await generateHashKey({ scene, enableDeduplication }, file, file.name)

      // 添加七牛云上传所需参数
      formData.append('token', qiniuConfig.token)
      formData.append('key', key)
      formData.append('file', file)

      // 使用fetch API进行上传
      const response = await fetch(qiniuConfig.domain, {
        method: 'POST',
        body: formData
      })

      isUploading.value = false

      if (response.ok) {
        const result = await response.json()
        const downloadUrl = `${configStore.config.qiNiu.ossDomain}/${result.key || key}`
        trigger('success')
        return { downloadUrl, key }
      } else {
        trigger('fail')
        return { error: 'Upload failed' }
      }
    } catch (error) {
      isUploading.value = false
      logger.error('Qiniu upload failed:', error)
      return { error: 'Upload failed' }
    }
  }

  /**
   * 将文件分片并上传到七牛云
   * @param file 文件
   * @param qiniuConfig 七牛云配置
   * @param chunkSize 分片大小（字节）
   * @param inner 是否内部调用
   */
  const uploadToQiniuWithChunks = async (
    file: File,
    qiniuConfig: { token: string; domain: string; storagePrefix: string; region?: string },
    chunkSize: number = QINIU_CHUNK_SIZE,
    inner?: boolean
  ) => {
    isUploading.value = true
    progress.value = 0

    try {
      // 生成唯一的文件名
      const key = `${qiniuConfig.storagePrefix}/${Date.now()}_${file.name}`

      // 计算分片数量
      const totalSize = file.size
      const totalChunks = Math.ceil(totalSize / chunkSize)

      // 创建进度跟踪对象
      const progressInfo: ChunkProgressInfo = {
        uploadedChunks: 0,
        totalChunks,
        currentChunkProgress: 0
      }

      logger.debug('开始七牛云分片上传:', {
        fileName: file.name,
        fileSize: totalSize,
        chunkSize,
        totalChunks,
        token: qiniuConfig.token.substring(0, 10) + '...',
        domain: qiniuConfig.domain
      })

      // 使用七牛云的分片上传API v2 - 创建上传块
      const contexts: string[] = []

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, totalSize)
        const chunkData = await file.slice(start, end).arrayBuffer()
        const currentChunkSize = end - start

        // 创建块
        const blockResponse = await fetch(`${qiniuConfig.domain}/mkblk/${currentChunkSize}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `UpToken ${qiniuConfig.token}`
          },
          body: chunkData
        })

        if (!blockResponse.ok) {
          const errorText = await blockResponse.text()
          logger.error(`上传分片 ${i + 1}/${totalChunks} 失败:`, {
            status: blockResponse.status,
            statusText: blockResponse.statusText,
            errorText
          })
          throw new Error(`上传分片 ${i + 1}/${totalChunks} 失败: ${blockResponse.statusText}`)
        }

        const blockResult = await blockResponse.json()
        contexts.push(blockResult.ctx)
        progressInfo.uploadedChunks++

        progress.value = Math.floor((progressInfo.uploadedChunks / progressInfo.totalChunks) * 100)

        logger.debug(`上传分片 ${progressInfo.uploadedChunks}/${progressInfo.totalChunks} 成功:`, {
          ctx: blockResult.ctx.substring(0, 10) + '...',
          progress: progress.value + '%'
        })
      }

      // 完成上传 - 合并所有块
      const completeResponse = await fetch(`${qiniuConfig.domain}/mkfile/${totalSize}/key/${btoa(key)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `UpToken ${qiniuConfig.token}`
        },
        body: contexts.join(',')
      })

      if (!completeResponse.ok) {
        throw new Error(`完成分片上传失败: ${completeResponse.statusText}`)
      }

      const completeResult = await completeResponse.json()
      logger.debug('完成分片上传:', completeResult)

      isUploading.value = false
      progress.value = 100

      if (inner) return { key, domain: qiniuConfig.domain }

      const downloadUrl = `${qiniuConfig.domain}/${completeResult.key || key}`
      trigger('success')
      return { downloadUrl, key }
    } catch (error) {
      isUploading.value = false
      if (!inner) {
        trigger('fail')
      }
      logger.error('七牛云分片上传失败:', error)
      return { error: 'Upload failed' }
    }
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
        const timerManager = useTimerManager()
        while (isNaN(audio.duration) || audio.duration === Infinity) {
          // 防止浏览器卡死
          await new Promise<void>((resolve) => {
            timerManager.setTimer(() => resolve(), 100)
          })
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
  const parseFile = async (file: File, addParams: ParseFileParams = {}): Promise<FileInfoType> => {
    const { name, size, type } = file
    const suffix = name.split('.').pop()?.trim().toLowerCase() || ''
    const baseInfo: FileInfoType = { name, size, type, suffix }

    // 根据文件类型解析特定信息
    // 图片需要宽高信息，音频需要时长信息，这些都需要异步解析
    if (type.includes('image')) {
      const { width, height, tempUrl } = (await getImgWH(file)) as ImageParseResult
      const result: FileInfoType = { ...baseInfo, width, height }
      if (tempUrl !== undefined) result.downloadUrl = tempUrl
      return result
    }

    if (type.includes('audio')) {
      const { second, tempUrl } = (await getAudioDuration(file)) as AudioParseResult
      const result: FileInfoType = { ...baseInfo, second }
      if (tempUrl !== undefined) result.downloadUrl = tempUrl
      return result
    }
    // 如果是视频
    if (type.includes('video')) {
      return { ...baseInfo }
    }

    return { ...baseInfo, ...addParams }
  }

  /**
   * 上传文件
   * @param file 文件
   * @param options 上传选项
   */
  const uploadFile = async (file: File, options?: UploadOptions): Promise<unknown> => {
    if (isUploading.value || !file) return undefined

    // 设置当前上传方式
    if (options?.provider) {
      currentProvider.value = options.provider
    }

    const info = await parseFile(file, options as ParseFileParams)

    // 限制文件大小
    if (info.size > MAX_FILE_SIZE) {
      msg.error(`文件大小不能超过 ${Max}MB`)
      return undefined
    }

    // 根据上传方式选择不同的上传逻辑
    if (currentProvider.value === UploadProviderEnum.MATRIX || currentProvider.value === UploadProviderEnum.DEFAULT) {
      try {
        // 使用 Matrix 媒体服务器上传
        const { uploadContent } = await import('@/integrations/matrix/media')
        fileInfo.value = { ...info }
        await onStart.trigger(fileInfo)

        const mxcUrl = await uploadContent(file, {
          name: file.name,
          type: file.type,
          onProgress: (loaded) => {
            progress.value = Math.round((loaded / file.size) * 100)
          }
        })

        // 转换 mxc:// URL 为 HTTP URL
        const { mxcToHttp } = await import('@/integrations/matrix/mxc')
        const downloadUrl = mxcToHttp(mxcUrl)

        fileInfo.value = { ...info, downloadUrl }
        progress.value = 100
        trigger('success')
        return { mxcUrl, downloadUrl }
      } catch (error) {
        logger.error('Matrix upload failed:', error)
        await trigger('fail')
        return undefined
      }
    }

    if (currentProvider.value === UploadProviderEnum.QINIU) {
      // 警告：七牛云已废弃
      logger.warn('[DEPRECATED] 七牛云上传已废弃，请使用 Matrix 媒体服务器')

      try {
        // 获取七牛云token
        const qiniuConfig = (await requestWithFallback({ url: 'get_qiniu_token' })) as QiniuConfig
        fileInfo.value = { ...info }
        await onStart.trigger(fileInfo)

        // 判断是否使用分片上传
        if (file.size > CHUNK_THRESHOLD) {
          const result = (await uploadToQiniuWithChunks(file, qiniuConfig, QINIU_CHUNK_SIZE)) as ChunkUploadResult
          if (result && result.downloadUrl) {
            fileInfo.value = { ...info, downloadUrl: result.downloadUrl }
          }
          return result
        } else {
          const result = await uploadToQiniu(
            file,
            options?.scene || UploadSceneEnum.CHAT,
            qiniuConfig,
            options?.enableDeduplication || true
          )
          if (result && result.downloadUrl) {
            fileInfo.value = { ...info, downloadUrl: result.downloadUrl }
          }
          return result
        }
      } catch (error) {
        logger.error('获取七牛云token失败:', error)
        await trigger('fail')
        return undefined
      }
    }

    // 未知上传方式
    logger.error(`未知的上传方式: ${currentProvider.value}`)
    return undefined
  }

  /**
   * 获取上传和下载URL
   * 如果是默认上传方式，获取上传和下载URL，执行上传
   * 如果是七牛云上传方式，获取七牛云token，不执行上传
   * @param path 文件路径
   * @param options 上传选项
   */
  const getUploadAndDownloadUrl = async (
    _path: string,
    options?: UploadOptions
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: UploadResponseConfig }> => {
    // 设置当前上传方式
    if (options?.provider) {
      currentProvider.value = options.provider
    }

    // Matrix 媒体服务器 - 不需要预先获取 URL，直接在 upload 时处理
    if (currentProvider.value === UploadProviderEnum.MATRIX || currentProvider.value === UploadProviderEnum.DEFAULT) {
      return {
        uploadUrl: UploadProviderEnum.MATRIX,
        downloadUrl: '',
        config: {
          provider: UploadProviderEnum.MATRIX,
          scene: options?.scene ?? UploadSceneEnum.CHAT
        }
      }
    }

    // 七牛云上传方式（已废弃）
    if (currentProvider.value === UploadProviderEnum.QINIU) {
      logger.warn('[DEPRECATED] 七牛云上传已废弃，请使用 Matrix 媒体服务器')
      try {
        // 获取七牛云token
        const qiniuConfig = (await requestWithFallback({ url: 'get_qiniu_token' })) as QiniuConfig

        // 对于七牛云，我们不需要预先获取上传URL，而是直接返回一个标记
        const result: { uploadUrl: string; downloadUrl: string; config: UploadResponseConfig } = {
          uploadUrl: UploadProviderEnum.QINIU, // 标记为七牛云上传
          downloadUrl: qiniuConfig.domain, // 下载URL会在实际上传后生成
          config: {
            provider: options?.provider ?? UploadProviderEnum.DEFAULT,
            scene: options?.scene ?? UploadSceneEnum.CHAT
          }
        }
        return result
      } catch (_error) {
        throw new Error('获取七牛云token失败，请重试')
      }
    }
    return {
      uploadUrl: '',
      downloadUrl: '',
      config: {
        provider: options?.provider ?? UploadProviderEnum.MATRIX,
        scene: options?.scene ?? UploadSceneEnum.CHAT
      }
    }
  }

  /**
   * 执行实际的文件上传
   * @param path 文件路径
   * @param uploadUrl 上传URL
   * @param options 上传选项
   */
  const doUpload = async (
    path: string,
    uploadUrl: string,
    options?: UploadOptionsExtended
  ): Promise<{ qiniuUrl: string } | string> => {
    // 如果是七牛云上传
    if (uploadUrl === UploadProviderEnum.QINIU && options) {
      // 如果没有提供七牛云配置，尝试获取
      if (!options.domain || !options.token) {
        try {
          logger.debug('获取七牛云配置...', undefined, 'useUpload')
          const qiniuConfig = (await requestWithFallback({ url: 'get_qiniu_token' })) as QiniuConfig
          if (qiniuConfig.domain !== undefined) options.domain = qiniuConfig.domain
          if (qiniuConfig.token !== undefined) options.token = qiniuConfig.token
          if (qiniuConfig.storagePrefix !== undefined) options.storagePrefix = qiniuConfig.storagePrefix
          if (qiniuConfig.region !== undefined) options.region = qiniuConfig.region
        } catch (error) {
          logger.error('七牛云上传配置不完整，缺少 domain 或 token', error)
        }
      }

      try {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
        const file = await readFile(path, { baseDir })

        // 创建File对象
        const fileName = extractFileName(path)
        const fileObj = new File([new Uint8Array(file)], fileName, {
          type: getFileType(fileName)
        })

        isUploading.value = true
        progress.value = 0

        logger.debug('七牛云上传开始:', {
          token: options.token,
          domain: options.domain,
          scene: options.scene,
          storagePrefix: options.storagePrefix,
          fileName,
          fileSize: file.length,
          enableDeduplication: options.enableDeduplication
        })

        // 判断是否使用分片上传
        if (file.length > CHUNK_THRESHOLD) {
          // 执行分片上传
          const chunkSize = QINIU_CHUNK_SIZE
          const totalSize = file.length
          const totalChunks = Math.ceil(totalSize / chunkSize)

          // 创建进度跟踪对象
          const progressInfo: ChunkProgressInfo = {
            uploadedChunks: 0,
            totalChunks,
            currentChunkProgress: 0
          }

          // 生成文件名和key
          const key = await generateHashKey(
            { scene: options.scene ?? UploadSceneEnum.CHAT, enableDeduplication: options.enableDeduplication ?? true },
            fileObj,
            fileName
          )

          logger.debug('开始七牛云分片上传:', {
            fileName,
            fileSize: totalSize,
            chunkSize,
            totalChunks,
            key
          })

          // 使用七牛云的分片上传API v2 - 创建上传块
          const contexts: string[] = []

          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize
            const end = Math.min(start + chunkSize, totalSize)
            const chunkData = file.slice(start, end)
            const currentChunkSize = end - start

            // 创建块
            const blockResponse = await fetch(`${options.domain}/mkblk/${currentChunkSize}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `UpToken ${options.token}`
              },
              body: chunkData
            })

            if (!blockResponse.ok) {
              const errorText = await blockResponse.text()
              logger.error(`上传分片 ${i + 1}/${totalChunks} 失败:`, {
                status: blockResponse.status,
                statusText: blockResponse.statusText,
                errorText
              })
              throw new Error(`上传分片 ${i + 1}/${totalChunks} 失败: ${blockResponse.statusText}`)
            }

            const blockResult = await blockResponse.json()
            contexts.push(blockResult.ctx)
            progressInfo.uploadedChunks++

            progress.value = Math.floor((progressInfo.uploadedChunks / progressInfo.totalChunks) * 100)
            trigger('progress') // 触发进度事件

            // 触发上传进度更新事件
            trigger('upload-progress', {
              ctx: blockResult.ctx.substring(0, 10) + '...',
              progress: progress.value + '%'
            })
          }

          // 完成上传 - 合并所有块
          const encodedKey = btoa(key)
          const completeResponse = await fetch(`${options.domain}/mkfile/${totalSize}/key/${encodedKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
              Authorization: `UpToken ${options.token}`
            },
            body: contexts.join(',')
          })

          if (!completeResponse.ok) {
            const errorText = await completeResponse.text()
            logger.error('完成分片上传失败:', {
              status: completeResponse.status,
              statusText: completeResponse.statusText,
              errorText
            })
            throw new Error(`完成分片上传失败: ${completeResponse.statusText}`)
          }

          const completeResult = await completeResponse.json()
          logger.debug('完成分片上传:', completeResult)
          logger.debug('原始key:', key)
          logger.debug('响应key:', completeResult.key)

          isUploading.value = false
          progress.value = 100

          const qiniuUrl = `${configStore.config.qiNiu.ossDomain}/${completeResult.key || key}`
          trigger('success')
          return qiniuUrl
        } else {
          // 使用普通上传方式
          // 创建FormData对象
          const formData = new FormData()

          // 生成文件名和key
          const key = await generateHashKey(
            { scene: options.scene ?? UploadSceneEnum.CHAT, enableDeduplication: options.enableDeduplication ?? true },
            fileObj,
            fileName
          )

          formData.append('token', options.token ?? '')
          formData.append('key', key)
          formData.append('file', fileObj)

          // 使用fetch API进行上传
          const response = await fetch(options.domain ?? '', {
            headers: {
              Host: options.storagePrefix
            },
            method: 'POST',
            body: formData
          } as RequestInit)

          isUploading.value = false
          progress.value = 100

          logger.debug('七牛云上传响应:', {
            status: response.status,
            statusText: response.statusText
          })

          if (response.ok) {
            const result = await response.json()
            logger.debug('七牛云上传成功:', result)
            const qiniuUrl = `${configStore.config.qiNiu.ossDomain}/${result.key}`
            trigger('success')
            return qiniuUrl
          } else {
            const errorText = await response.text()
            logger.error('七牛云上传失败:', {
              status: response.status,
              statusText: response.statusText,
              errorText
            })
            trigger('fail')
            throw new Error(`上传失败: ${response.statusText}`)
          }
        }
      } catch (error) {
        isUploading.value = false
        trigger('fail')
        logger.error('七牛云上传失败:', error)
        throw new Error('文件上传失败，请重试')
      }
    } else {
      // 使用默认上传方式
      logger.debug('执行文件上传:', path)
      try {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
        const file = await readFile(path, { baseDir })

        // 添加文件大小检查
        if (file.length > MAX_FILE_SIZE) {
          throw new Error(`文件大小不能超过${Max}MB`)
        }

        isUploading.value = true
        progress.value = 0

        if (file.length > CHUNK_THRESHOLD) {
          // 分块上传：将大文件分割成多个块进行上传
          //
          // 测试说明：
          // - 本地上传流程需要测试以下场景：
          //   1. 大文件上传（> CHUNK_THRESHOLD）- 测试分块逻辑
          //   2. 网络中断恢复 - 测试断点续传
          //   3. 并发上传 - 测试多个文件同时上传
          //   4. 取消上传 - 测试上传取消和清理
          //
          // 已知问题：
          // - Uint8Array 转 File 可能会影响文件元数据
          // - 需要确保 uploadUrl 支持分块上传（断点续传）
          const fileObj = new File([new Uint8Array(file)], __filename, { type: 'application/octet-stream' })
          await uploadToDefaultWithChunks(uploadUrl, fileObj)
        } else {
          const response = await fetch(uploadUrl, {
            headers: { 'Content-Type': 'application/octet-stream' },
            method: 'PUT',
            body: file,
            duplex: 'half'
          } as RequestInit)

          isUploading.value = false
          progress.value = 100

          if (!response.ok) {
            trigger('fail')
            throw new Error(`上传失败: ${response.statusText}`)
          }

          logger.debug('文件上传成功', undefined, 'useUpload')
          trigger('success')
        }

        // 返回下载URL
        return options?.downloadUrl ?? ''
      } catch (error) {
        isUploading.value = false
        trigger('fail')
        logger.error('文件上传失败:', error)
        throw new Error('文件上传失败，请重试')
      }
    }
  }

  /**
   * 上传缩略图文件
   * @param thumbnailFile 缩略图文件
   * @param options 上传选项
   * @returns 上传结果
   */
  const uploadThumbnail = async (
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: UploadResponseConfig }> => {
    // 使用现有的 uploadFile 方法来处理缩略图上传，默认使用 Matrix
    const uploadOptions: UploadOptions = {
      provider: options?.provider || UploadProviderEnum.MATRIX,
      scene: UploadSceneEnum.CHAT,
      enableDeduplication: true
    }

    try {
      const result = await uploadFile(thumbnailFile, uploadOptions)

      // 处理 Matrix 上传结果
      const uploadResult: { uploadUrl: string; downloadUrl: string; config?: UploadResponseConfig } = {
        uploadUrl: (result as { mxcUrl?: string })?.mxcUrl || '',
        downloadUrl: (result as { downloadUrl?: string })?.downloadUrl || '',
        config: {
          provider: uploadOptions.provider ?? UploadProviderEnum.MATRIX,
          scene: uploadOptions.scene
        }
      }
      return uploadResult
    } catch (error) {
      logger.error('缩略图上传失败:', error)
      throw new Error('缩略图上传失败')
    }
  }

  /**
   * 执行缩略图上传
   * @param thumbnailFile 缩略图文件
   * @param uploadUrl 上传URL
   * @param options 上传选项
   * @returns 上传结果
   */
  const doUploadThumbnail = async (
    thumbnailFile: File,
    uploadUrl: string,
    options?: UploadOptionsExtended
  ): Promise<{ downloadUrl: string }> => {
    // 创建临时文件路径用于上传
    const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

    try {
      // 将File对象转换为ArrayBuffer，然后写入临时文件
      const arrayBuffer = await thumbnailFile.arrayBuffer()
      new Uint8Array(arrayBuffer) // uint8Array created but not used directly

      // 使用现有的 doUpload 方法来处理缩略图上传
      const result = await doUpload(tempPath, uploadUrl, options)

      if (typeof result === 'string') {
        return { downloadUrl: result }
      }

      // 如果 doUpload 返回其他类型，抛出错误
      throw new Error('缩略图上传失败: 无效的返回类型')
    } catch (error) {
      logger.error('缩略图上传执行失败:', error)
      throw new Error('缩略图上传执行失败')
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
    uploadToQiniu,
    getUploadAndDownloadUrl,
    doUpload,
    uploadThumbnail,
    doUploadThumbnail,
    UploadProviderEnum,
    generateHashKey
  }
}
