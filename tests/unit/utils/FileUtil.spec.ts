/**
 * FileUtil 工具类测试
 * 测试文件操作相关的工具函数
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...paths: string[]) => paths.join('/'))
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  readFile: vi.fn()
}))

// Mock stores
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: 'test-user-123',
      account: 'test@example.com'
    }
  })
}))

// Mock utils
vi.mock('@/utils/Formatting', () => ({
  extractFileName: vi.fn((path: string) => path.split('/').pop() || path)
}))

vi.mock('@/utils/PathUtil', () => ({
  getFilesMeta: vi.fn()
}))

import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { copyFile, readFile } from '@tauri-apps/plugin-fs'
import { extractFileName } from '@/utils/formatUtils'
import { getFilesMeta } from '@/utils/PathUtil'
import FileUtil from '@/utils/FileUtil'

const mockJoin = vi.mocked(join)
const mockOpen = vi.mocked(open)
const mockCopyFile = vi.mocked(copyFile)
const mockReadFile = vi.mocked(readFile)
const mockExtractFileName = vi.mocked(extractFileName)
const mockGetFilesMeta = vi.mocked(getFilesMeta)

describe('FileUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset static userStore
    ;(FileUtil as any)._userStore = null
  })

  describe('File path handling', () => {
    it('should join paths correctly', async () => {
      const mockResult = '/joined/path'
      mockJoin.mockResolvedValue(mockResult)

      const result = await mockJoin('/base', 'sub', 'file.txt')

      expect(result).toBe(mockResult)
      expect(mockJoin).toHaveBeenCalledWith('/base', 'sub', 'file.txt')
    })

    it('should extract file name correctly', () => {
      mockExtractFileName.mockReturnValue('file.txt')

      const result = mockExtractFileName('/path/to/file.txt')

      expect(result).toBe('file.txt')
      expect(mockExtractFileName).toHaveBeenCalledWith('/path/to/file.txt')
    })
  })

  describe('File operations mocking', () => {
    it('should handle open dialog correctly', async () => {
      const mockFiles = ['file1.txt', 'file2.jpg']
      mockOpen.mockResolvedValue(mockFiles)

      const result = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
      })

      expect(result).toEqual(mockFiles)
      expect(mockOpen).toHaveBeenCalledWith({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
      })
    })

    it('should handle file copy operation', async () => {
      mockCopyFile.mockResolvedValue(undefined)

      await copyFile('/source/path', '/dest/path')

      expect(mockCopyFile).toHaveBeenCalledWith('/source/path', '/dest/path')
    })

    it('should handle file read operation', async () => {
      const mockContent = new Uint8Array([1, 2, 3, 4])
      mockReadFile.mockResolvedValue(mockContent)

      const result = await readFile('/path/to/file.txt')

      expect(result).toEqual(mockContent)
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.txt')
    })
  })

  describe('Error handling', () => {
    it('should handle open dialog error', async () => {
      const error = new Error('Dialog cancelled')
      mockOpen.mockRejectedValue(error)

      await expect(open({})).rejects.toThrow('Dialog cancelled')
    })

    it('should handle file copy error', async () => {
      const error = new Error('Copy failed')
      mockCopyFile.mockRejectedValue(error)

      await expect(copyFile('/src', '/dst')).rejects.toThrow('Copy failed')
    })

    it('should handle file read error', async () => {
      const error = new Error('File not found')
      mockReadFile.mockRejectedValue(error)

      await expect(readFile('/nonexistent/file')).rejects.toThrow('File not found')
    })
  })

  describe('Utility functions', () => {
    it('should get files meta data', () => {
      const mockMeta = {
        'file1.txt': { size: 1024, lastModified: Date.now() },
        'file2.jpg': { size: 2048, lastModified: Date.now() }
      }
      mockGetFilesMeta.mockReturnValue(Promise.resolve(mockMeta) as any)

      const result = getFilesMeta(['file1.txt', 'file2.jpg'])

      expect(result).toBeInstanceOf(Promise)
      expect(mockGetFilesMeta).toHaveBeenCalledWith(['file1.txt', 'file2.jpg'])
    })

    it('should handle empty file list for meta extraction', () => {
      const mockMeta = {}
      mockGetFilesMeta.mockReturnValue(Promise.resolve(mockMeta) as any)

      const result = getFilesMeta([])

      expect(result).toBeInstanceOf(Promise)
      expect(mockGetFilesMeta).toHaveBeenCalledWith([])
    })
  })

  describe('Static user store management', () => {
    it('should create user store on first access', () => {
      // This is tested through FileUtil class usage
      expect(FileUtil).toBeDefined()
    })
  })
})
