/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import { validateSpecialChar, validateAlphaNumeric } from '@/utils/Validate'

describe('Validate utilities', () => {
  describe('validateSpecialChar', () => {
    it('should return true for strings with special characters', () => {
      expect(validateSpecialChar('hello!')).toBe(true)
      expect(validateSpecialChar('test@')).toBe(true)
      expect(validateSpecialChar('pass#word')).toBe(true)
      expect(validateSpecialChar('a$b')).toBe(true)
      expect(validateSpecialChar('test%')).toBe(true)
      expect(validateSpecialChar('value&')).toBe(true)
      expect(validateSpecialChar('test*')).toBe(true)
      expect(validateSpecialChar('^start')).toBe(true)
      expect(validateSpecialChar('end()')).toBe(true)
      expect(validateSpecialChar('un_der_score')).toBe(true)
      expect(validateSpecialChar('mid-dash')).toBe(true)
      expect(validateSpecialChar('til~de')).toBe(true)
      expect(validateSpecialChar('plus+')).toBe(true)
      expect(validateSpecialChar('e=qual')).toBe(true)
    })

    it('should return false for strings without special characters', () => {
      expect(validateSpecialChar('hello')).toBe(false)
      expect(validateSpecialChar('HelloWorld')).toBe(false)
      expect(validateSpecialChar('123456')).toBe(false)
      expect(validateSpecialChar('')).toBe(false)
      expect(validateSpecialChar('   ')).toBe(false)
    })

    it('should work with custom patterns', () => {
      const customPattern = /[0-9]/
      expect(validateSpecialChar('abc123', customPattern)).toBe(true)
      expect(validateSpecialChar('abcdef', customPattern)).toBe(false)
    })

    it('should handle strings with Chinese characters (¥)', () => {
      expect(validateSpecialChar('price¥')).toBe(true)
      expect(validateSpecialChar('money100')).toBe(false)
    })
  })

  describe('validateAlphaNumeric', () => {
    it('should return true for strings with both letters and numbers', () => {
      expect(validateAlphaNumeric('abc123')).toBe(true)
      expect(validateAlphaNumeric('ABC123')).toBe(true)
      expect(validateAlphaNumeric('a1b2c3')).toBe(true)
      expect(validateAlphaNumeric('User123')).toBe(true)
      expect(validateAlphaNumeric('test2024')).toBe(true)
      expect(validateAlphaNumeric('Pass007')).toBe(true)
    })

    it('should return false for strings with only letters', () => {
      expect(validateAlphaNumeric('abcdef')).toBe(false)
      expect(validateAlphaNumeric('ABCDEF')).toBe(false)
      expect(validateAlphaNumeric('aBcDeF')).toBe(false)
      expect(validateAlphaNumeric('')).toBe(false)
    })

    it('should return false for strings with only numbers', () => {
      expect(validateAlphaNumeric('123456')).toBe(false)
      expect(validateAlphaNumeric('007')).toBe(false)
      expect(validateAlphaNumeric('2024')).toBe(false)
    })

    it('should return false for strings with special characters', () => {
      expect(validateAlphaNumeric('abc123!')).toBe(true)
      expect(validateAlphaNumeric('test@123')).toBe(true)
      expect(validateAlphaNumeric('user_123')).toBe(true)
      expect(validateAlphaNumeric('test-123')).toBe(true)
    })

    it('should handle edge cases', () => {
      expect(validateAlphaNumeric('a1')).toBe(true)
      expect(validateAlphaNumeric('A1')).toBe(true)
      expect(validateAlphaNumeric('a')).toBe(false)
      expect(validateAlphaNumeric('1')).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(validateAlphaNumeric('abc 123')).toBe(true)
      expect(validateAlphaNumeric('   ')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(validateAlphaNumeric('ABC123')).toBe(true)
      expect(validateAlphaNumeric('abc123')).toBe(true)
      expect(validateAlphaNumeric('AbC123')).toBe(true)
    })
  })
})
