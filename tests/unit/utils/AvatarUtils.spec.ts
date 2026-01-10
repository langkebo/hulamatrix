/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import { AvatarUtils } from '@/utils/AvatarUtils'

describe('AvatarUtils', () => {
  describe('isDefaultAvatar', () => {
    it('should return true for default avatar 001', () => {
      expect(AvatarUtils.isDefaultAvatar('001')).toBe(true)
    })

    it('should return true for default avatar 010', () => {
      expect(AvatarUtils.isDefaultAvatar('010')).toBe(true)
    })

    it('should return true for default avatar 022', () => {
      expect(AvatarUtils.isDefaultAvatar('022')).toBe(true)
    })

    it('should return true for default avatar 015', () => {
      expect(AvatarUtils.isDefaultAvatar('015')).toBe(true)
    })

    it('should return false for empty string', () => {
      expect(AvatarUtils.isDefaultAvatar('')).toBe(false)
    })

    it('should return false for avatar 000 (below range)', () => {
      expect(AvatarUtils.isDefaultAvatar('000')).toBe(false)
    })

    it('should return false for avatar 023 (above range)', () => {
      expect(AvatarUtils.isDefaultAvatar('023')).toBe(false)
    })

    it('should return false for avatar 100 (above range)', () => {
      expect(AvatarUtils.isDefaultAvatar('100')).toBe(false)
    })

    it('should return false for strings that are not numbers', () => {
      expect(AvatarUtils.isDefaultAvatar('abc')).toBe(false)
    })

    it('should return false for strings with length not equal to 3', () => {
      expect(AvatarUtils.isDefaultAvatar('01')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('0001')).toBe(false)
    })

    it('should return false for strings with mixed characters starting with letter', () => {
      expect(AvatarUtils.isDefaultAvatar('a01')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('xyz')).toBe(false)
    })

    it('should parse numeric prefix correctly (01a becomes 1)', () => {
      // Note: parseInt('01a', 10) = 1, which is in default range
      // But '01a' has length 3 and is valid
      expect(AvatarUtils.isDefaultAvatar('01a')).toBe(true)
      // '015b' has length 4, so it fails the length check first
      expect(AvatarUtils.isDefaultAvatar('015b')).toBe(false)
    })

    it('should return false for null', () => {
      expect(AvatarUtils.isDefaultAvatar(null as any)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(AvatarUtils.isDefaultAvatar(undefined as any)).toBe(false)
    })

    it('should return false for numeric 1', () => {
      expect(AvatarUtils.isDefaultAvatar(1 as any)).toBe(false)
    })

    it('should handle edge case of exactly 001', () => {
      expect(AvatarUtils.isDefaultAvatar('001')).toBe(true)
    })

    it('should handle edge case of exactly 022', () => {
      expect(AvatarUtils.isDefaultAvatar('022')).toBe(true)
    })
  })

  describe('getAvatarUrl', () => {
    it('should return default avatar URL for empty string', () => {
      expect(AvatarUtils.getAvatarUrl('')).toBe('/logoD.png')
    })

    it('should return default avatar URL for null', () => {
      expect(AvatarUtils.getAvatarUrl(null as any)).toBe('/logoD.png')
    })

    it('should return default avatar URL for undefined', () => {
      expect(AvatarUtils.getAvatarUrl(undefined as any)).toBe('/logoD.png')
    })

    it('should return correct URL for default avatar 001', () => {
      expect(AvatarUtils.getAvatarUrl('001')).toBe('/avatar/001.webp')
    })

    it('should return correct URL for default avatar 022', () => {
      expect(AvatarUtils.getAvatarUrl('022')).toBe('/avatar/022.webp')
    })

    it('should return correct URL for default avatar 015', () => {
      expect(AvatarUtils.getAvatarUrl('015')).toBe('/avatar/015.webp')
    })

    it('should trim whitespace from avatar string', () => {
      expect(AvatarUtils.getAvatarUrl('  010  ')).toBe('/avatar/010.webp')
    })

    it('should return the same URL for valid HTTP URLs', () => {
      expect(AvatarUtils.getAvatarUrl('http://example.com/avatar.jpg')).toBe('http://example.com/avatar.jpg')
    })

    it('should return the same URL for valid HTTPS URLs', () => {
      expect(AvatarUtils.getAvatarUrl('https://example.com/avatar.jpg')).toBe('https://example.com/avatar.jpg')
    })

    it('should return default URL for URLs with invalid protocol', () => {
      expect(AvatarUtils.getAvatarUrl('ftp://example.com/avatar.jpg')).toBe('/logoD.png')
    })

    it('should return custom avatar URL for valid filename patterns', () => {
      expect(AvatarUtils.getAvatarUrl('custom-avatar')).toBe('/avatar/custom-avatar.webp')
    })

    it('should return custom avatar URL with underscores', () => {
      expect(AvatarUtils.getAvatarUrl('my_avatar_123')).toBe('/avatar/my_avatar_123.webp')
    })

    it('should return custom avatar URL with hyphens', () => {
      expect(AvatarUtils.getAvatarUrl('my-avatar-456')).toBe('/avatar/my-avatar-456.webp')
    })

    it('should return default URL for invalid filename patterns', () => {
      expect(AvatarUtils.getAvatarUrl('avatar with spaces')).toBe('/logoD.png')
    })

    it('should return default URL for filename with special characters', () => {
      expect(AvatarUtils.getAvatarUrl('avatar@123')).toBe('/logoD.png')
    })

    it('should return default URL for filename starting with dot', () => {
      expect(AvatarUtils.getAvatarUrl('.hidden')).toBe('/logoD.png')
    })

    it('should return default URL for empty filename after trim', () => {
      expect(AvatarUtils.getAvatarUrl('   ')).toBe('/logoD.png')
    })

    it('should handle numeric strings outside default range', () => {
      expect(AvatarUtils.getAvatarUrl('100')).toBe('/avatar/100.webp')
    })

    it('should handle numeric strings below default range', () => {
      expect(AvatarUtils.getAvatarUrl('000')).toBe('/avatar/000.webp')
    })

    it('should handle single character filename', () => {
      expect(AvatarUtils.getAvatarUrl('a')).toBe('/avatar/a.webp')
    })

    it('should handle all lowercase filename', () => {
      expect(AvatarUtils.getAvatarUrl('avatar123')).toBe('/avatar/avatar123.webp')
    })

    it('should handle all uppercase filename', () => {
      expect(AvatarUtils.getAvatarUrl('AVATAR123')).toBe('/avatar/AVATAR123.webp')
    })

    it('should handle mixed case filename', () => {
      expect(AvatarUtils.getAvatarUrl('MyAvatar123')).toBe('/avatar/MyAvatar123.webp')
    })
  })
})
