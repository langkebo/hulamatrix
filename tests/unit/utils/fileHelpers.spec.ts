/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import { formatFileSize, getFileExtension, validateFileType, generateSafeFilename } from '@/utils/fileHelpers'

describe('fileHelpers utilities', () => {
  describe('formatFileSize', () => {
    it('should return "0 Bytes" for zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should format bytes correctly', () => {
      expect(formatFileSize(1)).toBe('1 Bytes')
      expect(formatFileSize(512)).toBe('512 Bytes')
      expect(formatFileSize(1023)).toBe('1023 Bytes')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 100)).toBe('100 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 3.7)).toBe('3.7 GB')
    })

    it('should format terabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
      expect(formatFileSize(1024 * 1024 * 1024 * 1024 * 2)).toBe('2 TB')
    })
  })

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('image.jpg')).toBe('jpg')
      expect(getFileExtension('document.pdf')).toBe('pdf')
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('filename')).toBe('')
      expect(getFileExtension('')).toBe('')
    })

    it('should handle files with multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
      expect(getFileExtension('file.name.with.dots.txt')).toBe('txt')
    })

    it('should handle filenames starting with dot', () => {
      expect(getFileExtension('.gitignore')).toBe('')
      expect(getFileExtension('.env')).toBe('')
    })
  })

  describe('validateFileType', () => {
    it('should return true for exact MIME type match', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileType(file, ['image/jpeg'])).toBe(true)
    })

    it('should return true for wildcard MIME type match', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileType(file, ['image/*'])).toBe(true)
    })

    it('should return false for non-matching MIME type', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      expect(validateFileType(file, ['image/*'])).toBe(false)
    })

    it('should handle multiple allowed types', () => {
      const imageFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const videoFile = new File(['content'], 'test.mp4', { type: 'video/mp4' })

      expect(validateFileType(imageFile, ['image/*', 'video/*'])).toBe(true)
      expect(validateFileType(videoFile, ['image/*', 'video/*'])).toBe(true)
    })

    it('should return true when any type matches', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileType(file, ['video/mp4', 'image/jpeg', 'audio/mp3'])).toBe(true)
    })

    it('should return false when no types match', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      expect(validateFileType(file, ['video/mp4', 'image/jpeg'])).toBe(false)
    })

    it('should handle empty file type', () => {
      const file = new File(['content'], 'test.unknown', { type: '' })
      expect(validateFileType(file, ['image/*'])).toBe(false)
    })
  })

  describe('generateSafeFilename', () => {
    it('should keep safe characters unchanged', () => {
      expect(generateSafeFilename('test-file_123.jpg')).toBe('test-file_123.jpg')
      expect(generateSafeFilename('my_document.pdf')).toBe('my_document.pdf')
    })

    it('should replace unsafe characters with underscores', () => {
      expect(generateSafeFilename('test file.txt')).toBe('test_file.txt')
      expect(generateSafeFilename('test@file#name.txt')).toBe('test_file_name.txt')
      expect(generateSafeFilename('file:name*test?.txt')).toBe('file_name_test_.txt')
    })

    it('should collapse multiple underscores into one', () => {
      expect(generateSafeFilename('test___file.txt')).toBe('test_file.txt')
      expect(generateSafeFilename('test  file.txt')).toBe('test_file.txt')
    })

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt'
      const result = generateSafeFilename(longName)
      expect(result.length).toBeLessThanOrEqual(255)
    })

    it('should handle uppercase letters', () => {
      expect(generateSafeFilename('TestFile.TXT')).toBe('TestFile.TXT')
    })

    it('should handle special characters at start', () => {
      expect(generateSafeFilename('!@#$%test.txt')).toBe('_test.txt')
    })

    it('should preserve file extension', () => {
      expect(generateSafeFilename('my file.jpg')).toContain('.jpg')
      expect(generateSafeFilename('document (1).pdf')).toContain('.pdf')
    })

    it('should handle empty string', () => {
      expect(generateSafeFilename('')).toBe('')
    })

    it('should handle filenames with only unsafe characters', () => {
      expect(generateSafeFilename('!@#$%^&*()')).toBe('_')
    })
  })
})
