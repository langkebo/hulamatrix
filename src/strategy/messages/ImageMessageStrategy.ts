import { logger, toError } from '@/utils/logger'

import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { MsgEnum } from '@/enums'
import { useUpload } from '@/hooks/useUpload'
import { fixFileMimeType } from '@/utils/FileType'
import { getMimeTypeFromExtension } from '@/utils/formatUtils'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isMobile } from '@/utils/PlatformConstants'
import { AppException } from '@/common/exception'
import { FILE_SIZE_LIMITS, FILE_TYPES, ERROR_MESSAGES } from '@/constants'
import {
  AbstractMessageStrategy,
  type MessageBody,
  type ReplyMessage,
  type UploadConfig,
  type QiniuUploadResult
} from '../base'
import { uploadContent } from '@/integrations/matrix/media'

// MIME类型别名
type MimeType = string

/**
 * 处理图片消息
 */
export class ImageMessageStrategyImpl extends AbstractMessageStrategy {
  // 最大上传图片大小
  private readonly MAX_UPLOAD_SIZE = FILE_SIZE_LIMITS.IMAGE_MAX_SIZE
  // 支持的图片类型 - 使用 readonly 确保类型安全
  private readonly ALLOWED_TYPES: readonly MimeType[] = FILE_TYPES.IMAGE
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.IMAGE)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  /**
   * 检查MIME类型是否为允许的图片类型
   */
  private isAllowedImageType(mimeType: string): mimeType is MimeType {
    return this.ALLOWED_TYPES.includes(mimeType as MimeType)
  }

  /**
   * 验证图片文件是否符合上传条件要求
   */
  private async validateImage(file: File): Promise<File> {
    // 先修复可能缺失或错误的MIME类型
    const fixedFile = fixFileMimeType(file)

    // 检查文件类型 - 使用类型谓词确保类型安全
    if (!this.isAllowedImageType(fixedFile.type)) {
      throw new AppException('仅支持 JPEG、PNG、WebP 格式的图片')
    }

    // 检查文件大小
    if (fixedFile.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException(ERROR_MESSAGES.FILE_TOO_LARGE, { showError: true })
    }

    return fixedFile
  }

  /**
   * 获取图片信息(宽度、高度、预览地址)
   */
  private async getImageInfo(file: File): Promise<{ width: number; height: number; previewUrl: string }> {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        previewUrl: result.previewUrl!
      }
    } catch (_error) {
      throw new AppException('图片加载失败')
    }
  }

  /**
   * 检查是否是有效的图片URL
   */
  private isImageUrl(url: string): boolean {
    // 检查是否是有效的URL
    try {
      new URL(url)
      // 检查是否以常见图片扩展名结尾
      return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
    } catch {
      return false
    }
  }

  /**
   * 获取远程图片信息(宽度、高度、大小)
   */
  private async getRemoteImageInfo(url: string): Promise<{ width: number; height: number; size: number }> {
    try {
      const result = await getImageDimensions(url, { includeSize: true })
      return {
        width: result.width,
        height: result.height,
        size: result.size || 0
      }
    } catch (_error) {
      throw new AppException('图片加载失败')
    }
  }

  /**
   * 处理图片消息
   */
  async getMsg(msgInputValue: string, replyValue?: ReplyMessage, fileList?: File[]): Promise<MessageBody> {
    // 优先处理fileList中的文件
    if (fileList && fileList.length > 0) {
      const file = fileList[0]
      if (!file) throw new AppException('文件不存在')

      // 验证图片
      await this.validateImage(file)

      // 获取图片信息（宽度、高度）和预览URL
      const { width, height, previewUrl } = await this.getImageInfo(file)

      // 将文件保存到缓存目录
      const tempPath = `temp-image-${Date.now()}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, uint8Array, { baseDir })

      return {
        type: this.msgType,
        path: tempPath, // 用于上传
        url: previewUrl, // 用于预览显示
        imageInfo: {
          width, // 原始图片宽度
          height, // 原始图片高度
          size: file.size // 原始文件大小
        },
        reply: replyValue?.content
          ? {
              content: replyValue.content,
              key: replyValue.key || replyValue.messageId
            }
          : undefined
      }
    }

    // 检查是否是图片URL
    if (this.isImageUrl(msgInputValue)) {
      try {
        // 获取远程图片信息
        const { width, height, size } = await this.getRemoteImageInfo(msgInputValue)

        return {
          type: this.msgType,
          url: msgInputValue, // 直接使用原始URL
          path: msgInputValue, // 为了保持一致性，也设置path
          imageInfo: {
            width,
            height,
            size
          },
          reply: replyValue?.content
            ? {
                content: replyValue.content,
                key: replyValue.key || replyValue.messageId
              }
            : undefined
        }
      } catch (error) {
        logger.error('处理图片URL失败:', toError(error))
        if (error instanceof AppException) {
          throw error
        }
        throw new AppException('图片预览失败')
      }
    }

    // 原有的本地图片处理逻辑（从HTML解析）
    const doc = new DOMParser().parseFromString(msgInputValue, 'text/html')
    const imgElement = doc.getElementById('temp-image')
    if (!imgElement) {
      throw new AppException('文件不存在')
    }

    const path = imgElement.getAttribute('data-path')
    if (!path) {
      throw new AppException('文件不存在')
    }

    // 标准化路径
    const normalizedPath = path.replace(/\\/g, '/')
    logger.debug('标准化路径:', normalizedPath, 'ImageMessageStrategy')

    try {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, { baseDir })

      const fileName = path.split('/').pop() || 'image.png'
      const fileType = getMimeTypeFromExtension(fileName)

      // 创建文件对象
      const originalFile = new File([new Uint8Array(fileData)], fileName, {
        type: fileType
      })

      // 验证图片
      await this.validateImage(originalFile)

      // 获取图片信息（宽度、高度）和预览URL
      const { width, height, previewUrl } = await this.getImageInfo(originalFile)

      return {
        type: this.msgType,
        path: normalizedPath, // 用于上传
        url: previewUrl, // 用于预览显示
        imageInfo: {
          width, // 原始图片宽度
          height, // 原始图片高度
          size: originalFile.size // 原始文件大小
        },
        reply: replyValue?.content
          ? {
              content: replyValue.content,
              key: replyValue.key || replyValue.messageId
            }
          : undefined
      }
    } catch (error) {
      logger.error('处理图片失败:', toError(error))
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('图片预览失败')
    }
  }

  /**
   * 上传文件到 Matrix 服务器
   */
  override async uploadFile(path: string): Promise<{ uploadUrl: string; downloadUrl: string; config?: UploadConfig }> {
    // 如果是URL，直接返回相同的URL作为下载链接
    if (this.isImageUrl(path)) {
      return {
        uploadUrl: '', // 不需要上传URL
        downloadUrl: path // 直接使用原始URL
      }
    }

    logger.debug('开始上传图片到 Matrix:', path, 'ImageMessageStrategy')

    try {
      // 读取文件内容
      const fileContent = await readFile(path, { baseDir: BaseDirectory.AppData })
      const fileName = path.split('/').pop() || 'image.jpg'

      // 使用 Matrix SDK 上传内容
      const mxcUrl = await uploadContent(new Blob([fileContent]), {
        name: fileName,
        type: 'image/jpeg' // 可以根据文件扩展名动态设置
      })

      // 返回 MXC URL 作为下载链接
      return {
        uploadUrl: '', // Matrix SDK 不需要单独的上传URL
        downloadUrl: mxcUrl // MXC URL
      }
    } catch (error) {
      logger.error('Matrix 图片上传失败:', toError(error))
      throw new AppException('图片上传失败，请重试')
    }
  }

  /**
   * 执行实际的文件上传
   * @deprecated 使用 Matrix SDK 的 uploadImage 方法
   */
  async doUpload(path: string, _uploadUrl: string, options?: UploadConfig): Promise<QiniuUploadResult | void> {
    // 如果是URL，跳过上传
    if (this.isImageUrl(path)) {
      return
    }

    try {
      // 使用新的 Matrix SDK API 上传
      const file = await fetch(path).then((r) => r.blob())
      const mxcUrl = await this.uploadHook.uploadImage(file as File, {
        onProgress: options?.onProgress as (progress: number) => void
      })

      if (!mxcUrl) {
        throw new AppException('图片上传失败')
      }

      // 返回 mxcUrl 作为下载URL
      return { qiniuUrl: mxcUrl.mxcUrl }
    } catch (error) {
      logger.error('文件上传失败:', toError(error))
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('文件上传失败，请重试')
    }
  }

  buildMessageBody(msg: MessageBody, reply?: ReplyMessage): MessageBody {
    const m = msg as {
      url?: string
      path?: string
      imageInfo?: { width: number; height: number; size: number }
      reply?: { key?: string }
      type?: MsgEnum
      [key: string]: unknown
    }
    return {
      url: m.url,
      path: m.path,
      width: m.imageInfo?.width,
      height: m.imageInfo?.height,
      size: m.imageInfo?.size,
      replyMsgId: m.reply?.key || void 0,
      reply: reply?.content
        ? {
            body: reply.content,
            id: reply.messageId,
            username: reply.senderId,
            type: m.type
          }
        : void 0
    }
  }
}
