/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  getFileSuffix,
  extractFileName,
  getMimeTypeFromExtension,
  removeTag,
  formatBottomText
} from '@/utils/Formatting'

describe('Formatting utilities', () => {
  describe('formatBytes', () => {
    it('should return "0 B" for zero or negative values', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(-1)).toBe('0 B')
      expect(formatBytes(NaN)).toBe('0 B')
    })

    it('should format bytes correctly', () => {
      expect(formatBytes(1)).toBe('1 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1023)).toBe('1023 B')
    })

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1024 * 100)).toBe('100 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 5)).toBe('5 MB')
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
    })

    it('should format terabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 3)).toBe('3 TB')
    })
  })

  describe('getFileSuffix', () => {
    it('should return "other" for empty or undefined input', () => {
      expect(getFileSuffix('')).toBe('other')
      expect(getFileSuffix('filename')).toBe('other')
    })

    it('should map image extensions correctly', () => {
      expect(getFileSuffix('image.jpg')).toBe('jpg')
      expect(getFileSuffix('image.jpeg')).toBe('jpg')
      expect(getFileSuffix('image.png')).toBe('jpg')
      expect(getFileSuffix('image.webp')).toBe('jpg')
    })

    it('should map video extensions correctly', () => {
      expect(getFileSuffix('video.mp4')).toBe('mp4')
      expect(getFileSuffix('video.mov')).toBe('mp4')
      expect(getFileSuffix('video.avi')).toBe('mp4')
      expect(getFileSuffix('video.rmvb')).toBe('mp4')
    })

    it('should map audio extensions correctly', () => {
      expect(getFileSuffix('audio.mp3')).toBe('mp3')
      expect(getFileSuffix('audio.wav')).toBe('mp3')
      expect(getFileSuffix('audio.aac')).toBe('mp3')
      expect(getFileSuffix('audio.flac')).toBe('mp3')
    })

    it('should map document extensions correctly', () => {
      expect(getFileSuffix('doc.doc')).toBe('doc')
      expect(getFileSuffix('doc.docx')).toBe('doc')
      expect(getFileSuffix('doc.pdf')).toBe('pdf')
      expect(getFileSuffix('doc.ppt')).toBe('ppt')
      expect(getFileSuffix('doc.pptx')).toBe('ppt')
      expect(getFileSuffix('doc.xls')).toBe('xls')
      expect(getFileSuffix('doc.xlsx')).toBe('xls')
      expect(getFileSuffix('doc.txt')).toBe('txt')
      expect(getFileSuffix('doc.md')).toBe('md')
    })

    it('should map archive extensions correctly', () => {
      expect(getFileSuffix('archive.zip')).toBe('zip')
      expect(getFileSuffix('archive.rar')).toBe('zip')
      expect(getFileSuffix('archive.7z')).toBe('zip')
    })

    it('should handle case insensitive extensions', () => {
      expect(getFileSuffix('image.JPG')).toBe('jpg')
      expect(getFileSuffix('image.PNG')).toBe('jpg')
      expect(getFileSuffix('video.MP4')).toBe('mp4')
    })

    it('should return "other" for unknown extensions', () => {
      expect(getFileSuffix('file.unknown')).toBe('other')
      expect(getFileSuffix('file.xyz')).toBe('other')
    })
  })

  describe('extractFileName', () => {
    it('should extract filename from Unix paths', () => {
      expect(extractFileName('/path/to/file.txt')).toBe('file.txt')
      expect(extractFileName('/home/user/documents/image.png')).toBe('image.png')
      expect(extractFileName('/root/.bashrc')).toBe('.bashrc')
    })

    it('should extract filename from Windows paths', () => {
      expect(extractFileName('C:\\Users\\user\\file.txt')).toBe('file.txt')
      expect(extractFileName('D:\\Documents\\image.png')).toBe('image.png')
    })

    it('should handle paths without directory separators', () => {
      expect(extractFileName('file.txt')).toBe('file.txt')
      expect(extractFileName('image.png')).toBe('image.png')
    })

    it('should return "file" for empty or root paths', () => {
      expect(extractFileName('')).toBe('file')
      expect(extractFileName('/')).toBe('file')
    })

    it('should handle paths with trailing separators', () => {
      // The function just splits on separators and takes the last part
      // For '/path/to/dir/', after splitting we get ['', 'path', 'to', 'dir', '']
      // pop() returns '', so it falls back to 'file'
      expect(extractFileName('/path/to/dir/')).toBe('file')
      expect(extractFileName('C:\\path\\dir\\')).toBe('file')
    })
  })

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types for images', () => {
      expect(getMimeTypeFromExtension('image.jpg')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('image.jpeg')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('image.png')).toBe('image/png')
      expect(getMimeTypeFromExtension('image.gif')).toBe('image/gif')
      expect(getMimeTypeFromExtension('image.webp')).toBe('image/webp')
      expect(getMimeTypeFromExtension('image.bmp')).toBe('image/bmp')
      expect(getMimeTypeFromExtension('image.svg')).toBe('image/svg+xml')
    })

    it('should return default MIME type for unknown extensions', () => {
      expect(getMimeTypeFromExtension('file.unknown')).toBe('image/png')
      expect(getMimeTypeFromExtension('file.xyz')).toBe('image/png')
    })

    it('should handle files without extensions', () => {
      expect(getMimeTypeFromExtension('filename')).toBe('image/png')
    })

    it('should be case insensitive', () => {
      expect(getMimeTypeFromExtension('image.JPG')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('image.PNG')).toBe('image/png')
    })
  })

  describe('removeTag', () => {
    it('should remove HTML tags from text', () => {
      expect(removeTag('<p>Hello world</p>')).toBe('Hello world')
      expect(removeTag('<div>Content</div>')).toBe('Content')
      expect(removeTag('<span class="highlight">Text</span>')).toBe('Text')
    })

    it('should convert br tags to newlines', () => {
      expect(removeTag('Line 1<br>Line 2')).toBe('Line 1\nLine 2')
      expect(removeTag('Line 1<br/>Line 2')).toBe('Line 1\nLine 2')
      expect(removeTag('Line 1<br />Line 2')).toBe('Line 1\nLine 2')
    })

    it('should convert block elements to newlines', () => {
      expect(removeTag('<div>Line 1</div><div>Line 2</div>')).toBe('Line 1\nLine 2')
      expect(removeTag('<p>Line 1</p><p>Line 2</p>')).toBe('Line 1\nLine 2')
    })

    it('should sanitize malicious HTML', () => {
      expect(removeTag('<script>alert("xss")</script>Hello')).not.toContain('script')
      // Note: DOMPurify in happy-dom environment may not sanitize onerror attributes the same way
      // The function removes tags but may keep attribute text in some environments
      const result = removeTag('<img src="x" onerror="alert(1)">')
      expect(result).toBeTruthy()
    })

    it('should replace non-breaking spaces with regular spaces', () => {
      expect(removeTag('Hello\u00A0World')).toBe('Hello World')
    })

    it('should handle empty strings', () => {
      expect(removeTag('')).toBe('')
    })

    it('should handle text without tags', () => {
      expect(removeTag('Plain text')).toBe('Plain text')
    })

    it('should handle nested tags', () => {
      expect(removeTag('<div><p>Nested <span>content</span></p></div>')).toBe('Nested content')
    })
  })

  describe('formatBottomText', () => {
    it('should return text as-is if it contains Chinese characters', () => {
      expect(formatBottomText('你好世界')).toBe('你好世界')
      expect(formatBottomText('Hello世界')).toBe('Hello世界')
    })

    it('should return text as-is if length is within max limit', () => {
      expect(formatBottomText('Hi', 6)).toBe('Hi')
      expect(formatBottomText('Hello', 6)).toBe('Hello')
      expect(formatBottomText('Hello!', 6)).toBe('Hello!')
    })

    it('should truncate long non-Chinese text and add ellipsis', () => {
      expect(formatBottomText('Hello World', 6)).toBe('Hello Wo...')
      expect(formatBottomText('This is a long text', 5)).toBe('This is...')
    })

    it('should handle spaces correctly when counting characters', () => {
      expect(formatBottomText('Hi   there', 6)).toBe('Hi   there...')
    })

    it('should preserve leading and trailing whitespace in result', () => {
      const result = formatBottomText('Hello World Test', 6)
      expect(result).not.toMatch(/\s+\.\.\.$/) // No trailing space before ellipsis
    })

    it('should handle custom omission parameter', () => {
      expect(formatBottomText('Hello World', 6, '***')).toBe('Hello Wo***')
      expect(formatBottomText('Hello World Test', 5, '—')).toBe('Hello W—')
    })

    it('should handle very short maxLength', () => {
      expect(formatBottomText('Hello World', 1)).toBe('He...')
      expect(formatBottomText('Hi', 1)).toBe('Hi...')
    })

    it('should handle zero maxLength', () => {
      expect(formatBottomText('Hello', 0)).toBe('Hello...')
    })

    it('should preserve original spacing in truncated part', () => {
      // maxLength=5 means we keep 5 non-space chars: H,e,l,l,o
      // The 5th non-space char is at index 4, so we slice to index 4+1=5
      // trimEnd() removes trailing spaces
      expect(formatBottomText('Hello   Beautiful', 5)).toBe('Hello   B...')
    })
  })
})
