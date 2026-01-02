/**
 * 文件处理辅助函数
 */

/**
 * 将文件读取为 ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 获取视频信息（时长、缩略图等）
 */
export async function getVideoInfo(file: File): Promise<{
  duration: number
  thumbnail?: Blob
  thumbnailWidth?: number
  thumbnailHeight?: number
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2) // 设置到1秒或中间位置
    }

    video.onseeked = () => {
      try {
        // 创建 canvas 来生成缩略图
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 设置缩略图尺寸（最大320px）
        const maxSize = 320
        let width = video.videoWidth
        let height = video.videoHeight

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height)

          // 转换为 Blob
          canvas.toBlob(
            (blob) => {
              const result: {
                duration: number
                thumbnail?: Blob
                thumbnailWidth?: number
                thumbnailHeight?: number
              } = {
                duration: video.duration * 1000,
                thumbnailWidth: width,
                thumbnailHeight: height
              }
              if (blob) result.thumbnail = blob
              resolve(result)
            },
            'image/jpeg',
            0.8
          )
        } else {
          reject(new Error('Failed to get canvas context'))
        }
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = () => reject(video.error)

    // 加载视频
    video.src = URL.createObjectURL(file)
  })
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
}

/**
 * 验证文件类型
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1))
    }
    return file.type === type
  })
}

/**
 * 从文件名生成安全的文件名
 */
export function generateSafeFilename(filename: string): string {
  // 移除或替换不安全的字符
  return filename
    .replace(/[^a-z0-9.\-_]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255) // 限制长度
}
