import { FILE_SIZE_LIMITS } from '@/constants'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useInputValidation() {
  const { t } = useI18n()

  // 输入验证状态
  const inputError = ref('')
  const isInputValid = ref(true)

  // 获取输入限制
  const inputLimits = computed(() => ({
    maxTextLength: 10000, // 默认最大文本长度
    maxFileSize: FILE_SIZE_LIMITS.FILE_MAX_SIZE, // 默认 100MB
    maxFileCount: 9 // 默认最多9个文件
  }))

  /**
   * 验证文本输入
   */
  const validateTextInput = (text: string): { isValid: boolean; error: string } => {
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        error: t('message.validation.empty')
      }
    }

    if (text.length > inputLimits.value.maxTextLength) {
      return {
        isValid: false,
        error: t('message.validation.too_long', {
          max: inputLimits.value.maxTextLength
        })
      }
    }

    return {
      isValid: true,
      error: ''
    }
  }

  /**
   * 验证文件
   */
  const validateFile = (file: File): { isValid: boolean; error: string } => {
    // 检查文件大小
    if (file.size > inputLimits.value.maxFileSize) {
      return {
        isValid: false,
        error: t('message.validation.file_too_large', {
          name: file.name,
          size: formatFileSize(inputLimits.value.maxFileSize)
        })
      }
    }

    // 检查文件类型 - 允许所有常见文件类型
    const allowedTypes: string[] = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'svg', // 图片
      'mp4',
      'avi',
      'mkv',
      'mov',
      'wmv', // 视频
      'mp3',
      'wav',
      'flac',
      'aac', // 音频
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx', // 文档
      'txt',
      'md',
      'json',
      'xml', // 文本
      'zip',
      'rar',
      '7z',
      'tar',
      'gz', // 压缩包
      'js',
      'ts',
      'html',
      'css',
      'py',
      'java' // 代码
    ]
    if (allowedTypes.length > 0) {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
      if (!allowedTypes.includes(fileExt)) {
        return {
          isValid: false,
          error: t('message.validation.file_type_not_allowed', {
            name: file.name
          })
        }
      }
    }

    return {
      isValid: true,
      error: ''
    }
  }

  /**
   * 验证文件列表
   */
  const validateFileList = (files: File[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    // 检查文件数量
    if (files.length > inputLimits.value.maxFileCount) {
      errors.push(
        t('message.validation.too_many_files', {
          max: inputLimits.value.maxFileCount
        })
      )
    }

    // 检查每个文件
    files.forEach((file) => {
      const validation = validateFile(file)
      if (!validation.isValid) {
        errors.push(validation.error)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 实时验证输入
   */
  const validateInput = (text: string, files?: File[]): boolean => {
    // 验证文本
    const textValidation = validateTextInput(text)
    if (!textValidation.isValid) {
      inputError.value = textValidation.error
      isInputValid.value = false
      return false
    }

    // 验证文件（如果有）
    if (files && files.length > 0) {
      const fileValidation = validateFileList(files)
      if (!fileValidation.isValid) {
        inputError.value = fileValidation.errors.join('; ')
        isInputValid.value = false
        return false
      }
    }

    inputError.value = ''
    isInputValid.value = true
    return true
  }

  /**
   * 清除验证状态
   */
  const clearValidation = () => {
    inputError.value = ''
    isInputValid.value = true
  }

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  return {
    // 状态
    inputError,
    isInputValid,
    inputLimits,

    // 方法
    validateTextInput,
    validateFile,
    validateFileList,
    validateInput,
    clearValidation,
    formatFileSize
  }
}
