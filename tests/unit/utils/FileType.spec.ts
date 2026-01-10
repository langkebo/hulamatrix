/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import {
  getFileExtension,
  getVideoMimeType,
  getAudioMimeType,
  getImageMimeType,
  fixFileMimeType,
  getMessageTypeByFile,
  isVideoUrl,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS
} from '@/utils/FileType'
import { MsgEnum } from '@/enums'

describe('FileType utilities', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('image.jpg')).toBe('jpg')
      expect(getFileExtension('document.pdf')).toBe('pdf')
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('filename')).toBe('')
      expect(getFileExtension('filename.')).toBe('')
      expect(getFileExtension('')).toBe('')
    })

    it('should convert extension to lowercase', () => {
      expect(getFileExtension('image.JPG')).toBe('jpg')
      expect(getFileExtension('image.PNG')).toBe('png')
      expect(getFileExtension('video.MP4')).toBe('mp4')
    })

    it('should handle filenames with multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
      expect(getFileExtension('file.name.with.dots.txt')).toBe('txt')
    })
  })

  describe('SUPPORTED_VIDEO_EXTENSIONS', () => {
    it('should contain expected video extensions', () => {
      expect(SUPPORTED_VIDEO_EXTENSIONS).toContain('mp4')
      expect(SUPPORTED_VIDEO_EXTENSIONS).toContain('mov')
      expect(SUPPORTED_VIDEO_EXTENSIONS).toContain('avi')
    })

    it('should be a readonly array', () => {
      expect(Array.isArray(SUPPORTED_VIDEO_EXTENSIONS)).toBe(true)
    })
  })

  describe('SUPPORTED_AUDIO_EXTENSIONS', () => {
    it('should contain expected audio extensions', () => {
      expect(SUPPORTED_AUDIO_EXTENSIONS).toContain('mp3')
      expect(SUPPORTED_AUDIO_EXTENSIONS).toContain('wav')
      expect(SUPPORTED_AUDIO_EXTENSIONS).toContain('m4a')
    })
  })

  describe('SUPPORTED_IMAGE_EXTENSIONS', () => {
    it('should contain expected image extensions', () => {
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('jpg')
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('png')
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('gif')
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('svg')
    })
  })

  describe('getVideoMimeType', () => {
    it('should return correct MIME types for video files', () => {
      expect(getVideoMimeType('video.mp4')).toBe('video/mp4')
      expect(getVideoMimeType('video.mov')).toBe('video/quicktime')
      expect(getVideoMimeType('video.avi')).toBe('video/x-msvideo')
      expect(getVideoMimeType('video.wmv')).toBe('video/x-ms-wmv')
      expect(getVideoMimeType('video.mkv')).toBe('video/x-matroska')
      expect(getVideoMimeType('video.flv')).toBe('video/x-flv')
      expect(getVideoMimeType('video.webm')).toBe('video/webm')
      expect(getVideoMimeType('video.m4v')).toBe('video/mp4')
    })

    it('should return default MIME type for unknown video extensions', () => {
      expect(getVideoMimeType('video.unknown')).toBe('video/mp4')
      expect(getVideoMimeType('video.xyz')).toBe('video/mp4')
    })

    it('should handle empty filename', () => {
      expect(getVideoMimeType('')).toBe('video/mp4')
    })
  })

  describe('getAudioMimeType', () => {
    it('should return correct MIME types for audio files', () => {
      expect(getAudioMimeType('audio.mp3')).toBe('audio/mpeg')
      expect(getAudioMimeType('audio.wav')).toBe('audio/wav')
      expect(getAudioMimeType('audio.m4a')).toBe('audio/mp4')
      expect(getAudioMimeType('audio.aac')).toBe('audio/aac')
      expect(getAudioMimeType('audio.ogg')).toBe('audio/ogg')
      expect(getAudioMimeType('audio.flac')).toBe('audio/flac')
    })

    it('should return default MIME type for unknown audio extensions', () => {
      expect(getAudioMimeType('audio.unknown')).toBe('audio/mpeg')
      expect(getAudioMimeType('audio.xyz')).toBe('audio/mpeg')
    })

    it('should handle empty filename', () => {
      expect(getAudioMimeType('')).toBe('audio/mpeg')
    })
  })

  describe('getImageMimeType', () => {
    it('should return correct MIME types for image files', () => {
      expect(getImageMimeType('image.jpg')).toBe('image/jpeg')
      expect(getImageMimeType('image.jpeg')).toBe('image/jpeg')
      expect(getImageMimeType('image.png')).toBe('image/png')
      expect(getImageMimeType('image.gif')).toBe('image/gif')
      expect(getImageMimeType('image.webp')).toBe('image/webp')
      expect(getImageMimeType('image.bmp')).toBe('image/bmp')
      expect(getImageMimeType('image.svg')).toBe('image/svg+xml')
    })

    it('should return default MIME type for unknown image extensions', () => {
      expect(getImageMimeType('image.unknown')).toBe('image/jpeg')
      expect(getImageMimeType('image.xyz')).toBe('image/jpeg')
    })

    it('should handle empty filename', () => {
      expect(getImageMimeType('')).toBe('image/jpeg')
    })
  })

  describe('fixFileMimeType', () => {
    it('should return original file if it already has correct MIME type', () => {
      const file = new File(['content'], 'video.mp4', { type: 'video/mp4' })
      const result = fixFileMimeType(file)
      expect(result).toBe(file)
    })

    it('should fix MIME type for video files', () => {
      const file = new File(['content'], 'video.mp4', { type: '' })
      const result = fixFileMimeType(file)
      expect(result.type).toBe('video/mp4')
    })

    it('should fix MIME type for audio files', () => {
      const file = new File(['content'], 'audio.mp3', { type: '' })
      const result = fixFileMimeType(file)
      expect(result.type).toBe('audio/mpeg')
    })

    it('should fix MIME type for image files', () => {
      const file = new File(['content'], 'image.png', { type: '' })
      const result = fixFileMimeType(file)
      expect(result.type).toBe('image/png')
    })

    it('should preserve file name and lastModified', () => {
      const file = new File(['content'], 'video.mp4', { type: '', lastModified: 123456 })
      const result = fixFileMimeType(file)
      expect(result.name).toBe('video.mp4')
      expect(result.lastModified).toBe(123456)
    })

    it('should return original file for non-media files', () => {
      const file = new File(['content'], 'document.txt', { type: 'text/plain' })
      const result = fixFileMimeType(file)
      expect(result).toBe(file)
    })

    it('should handle files with unsupported extensions', () => {
      const file = new File(['content'], 'file.unknown', { type: '' })
      const result = fixFileMimeType(file)
      expect(result).toBe(file)
    })
  })

  describe('getMessageTypeByFile', () => {
    it('should return VIDEO for video files', () => {
      const file = new File(['content'], 'video.mp4', { type: 'video/mp4' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.VIDEO)
    })

    it('should return VOICE for audio files', () => {
      const file = new File(['content'], 'audio.mp3', { type: 'audio/mpeg' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.VOICE)
    })

    it('should return IMAGE for image files (non-SVG)', () => {
      const file = new File(['content'], 'image.png', { type: 'image/png' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.IMAGE)
    })

    it('should return FILE for SVG files', () => {
      const file = new File(['content'], 'image.svg', { type: 'image/svg+xml' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.FILE)
    })

    it('should return FILE for non-media files', () => {
      const file = new File(['content'], 'document.txt', { type: 'text/plain' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.FILE)
    })

    it('should return FILE for files with unknown type', () => {
      const file = new File(['content'], 'file.unknown', { type: '' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.FILE)
    })

    it('should detect video by extension when MIME type is missing', () => {
      const file = new File(['content'], 'video.mp4', { type: '' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.VIDEO)
    })

    it('should detect audio by extension when MIME type is missing', () => {
      const file = new File(['content'], 'audio.mp3', { type: '' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.VOICE)
    })

    it('should detect image by extension when MIME type is missing', () => {
      const file = new File(['content'], 'image.jpg', { type: '' })
      expect(getMessageTypeByFile(file)).toBe(MsgEnum.IMAGE)
    })
  })

  describe('isVideoUrl', () => {
    it('should return true for valid video URLs', () => {
      expect(isVideoUrl('https://example.com/video.mp4')).toBe(true)
      expect(isVideoUrl('https://example.com/video.mov')).toBe(true)
      expect(isVideoUrl('https://example.com/video.avi')).toBe(true)
    })

    it('should return false for non-video URLs', () => {
      expect(isVideoUrl('https://example.com/image.png')).toBe(false)
      expect(isVideoUrl('https://example.com/audio.mp3')).toBe(false)
      expect(isVideoUrl('https://example.com/document.pdf')).toBe(false)
    })

    it('should return false for invalid URLs', () => {
      expect(isVideoUrl('not a url')).toBe(false)
      expect(isVideoUrl('')).toBe(false)
      expect(isVideoUrl('://example.com')).toBe(false)
    })

    it('should be case insensitive for file extensions', () => {
      expect(isVideoUrl('https://example.com/video.MP4')).toBe(true)
      expect(isVideoUrl('https://example.com/video.MOV')).toBe(true)
    })
  })
})
