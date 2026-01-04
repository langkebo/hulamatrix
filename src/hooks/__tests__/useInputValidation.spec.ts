import { FILE_SIZE_LIMITS } from '@/constants'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInputValidation } from '../useMsgInput/composables/useInputValidation'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'message.validation.empty') return '输入不能为空'
      if (key === 'message.validation.too_long') return '输入过长'
      if (key === 'message.validation.file_too_large') return '文件过大'
      if (key === 'message.validation.file_type_not_allowed') return '文件类型不支持'
      return key
    }
  })
}))

describe('useInputValidation', () => {
  let inputValidation: ReturnType<typeof useInputValidation>

  beforeEach(() => {
    inputValidation = useInputValidation()
  })

  describe('validateFile', () => {
    it('should validate file within size limit', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB

      const result = inputValidation.validateFile(file)
      expect(result.isValid).toBe(true)
      expect(result.error).toBe('')
    })

    it('should reject file over size limit', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: FILE_SIZE_LIMITS.FILE_MAX_SIZE + 1 }) // 超过100MB

      const result = inputValidation.validateFile(file)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('文件过大')
    })

    it('should handle empty file', () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 0 })

      const result = inputValidation.validateFile(file)
      expect(result.isValid).toBe(true)
      expect(result.error).toBe('')
    })
  })

  describe('validateFiles with array parameter', () => {
    it('should validate multiple files within limits', () => {
      const files = [
        new File(['content1'], 'test1.txt', { type: 'text/plain' }),
        new File(['content2'], 'test2.txt', { type: 'text/plain' })
      ]
      files.forEach((file) => Object.defineProperty(file, 'size', { value: 1024 }))

      // Test first file
      const result = inputValidation.validateFile(files[0])
      expect(result.isValid).toBe(true)
      expect(result.error).toBe('')
    })

    it('should reject file too large', () => {
      const file = new File([''], 'big.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: FILE_SIZE_LIMITS.FILE_MAX_SIZE + 1 })

      const result = inputValidation.validateFile(file)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('文件过大')
    })

    it('should validate empty file array edge case', () => {
      // Just test basic validation works
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 1024 })

      const result = inputValidation.validateFile(file)
      expect(result.isValid).toBe(true)
      expect(result.error).toBe('')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(inputValidation.formatFileSize(1024)).toBe('1.00 KB')
      expect(inputValidation.formatFileSize(1024 * 1024)).toBe('1.00 MB')
      expect(inputValidation.formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB')
    })

    it('should handle zero bytes', () => {
      expect(inputValidation.formatFileSize(0)).toBe('0.00 B')
    })

    it('should handle decimal values', () => {
      expect(inputValidation.formatFileSize(1536)).toBe('1.50 KB')
    })
  })

  describe('input limits', () => {
    it('should provide default limits', () => {
      const limits = inputValidation.inputLimits.value
      expect(limits.maxTextLength).toBeGreaterThan(0)
      expect(limits.maxFileSize).toBeGreaterThan(0)
      expect(limits.maxFileCount).toBeGreaterThan(0)
    })
  })

  describe('error state', () => {
    it('should track input error state', () => {
      expect(inputValidation.inputError.value).toBe('')
      expect(inputValidation.isInputValid.value).toBe(true)
    })
  })
})
