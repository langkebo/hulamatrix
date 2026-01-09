/**
 * Validate 工具函数测试
 * 测试字符串验证相关的工具函数
 */

import { describe, it, expect } from 'vitest'
import { validateSpecialChar, validateAlphaNumeric } from '@/utils/Validate'

describe('Validate Utils', () => {
  describe('validateSpecialChar', () => {
    it('should detect special characters correctly', () => {
      expect(validateSpecialChar('hello@world')).toBe(true)
      expect(validateSpecialChar('password123!')).toBe(true)
      expect(validateSpecialChar('test#value')).toBe(true)
      expect(validateSpecialChar('string$money')).toBe(true)
      expect(validateSpecialChar('function%test')).toBe(true)
      expect(validateSpecialChar('data&info')).toBe(true)
      expect(validateSpecialChar('value*important')).toBe(true)
      expect(validateSpecialChar('calc^power')).toBe(true)
      expect(validateSpecialChar('test_case')).toBe(true)
      expect(validateSpecialChar('value-add')).toBe(true)
      expect(validateSpecialChar('file~backup')).toBe(true)
    })

    it('should return false for strings without special characters', () => {
      expect(validateSpecialChar('helloworld')).toBe(false)
      expect(validateSpecialChar('password123')).toBe(false)
      expect(validateSpecialChar('TestString')).toBe(false)
      expect(validateSpecialChar('')).toBe(false)
    })

    it('should work with custom pattern', () => {
      const customPattern = /[0-9]/
      expect(validateSpecialChar('abc123def', customPattern)).toBe(true)
      expect(validateSpecialChar('abcdef', customPattern)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateSpecialChar(' ')).toBe(false)
      expect(validateSpecialChar(null as any)).toBe(false)
      expect(validateSpecialChar(undefined as any)).toBe(false)
    })
  })

  describe('validateAlphaNumeric', () => {
    it('should return true for strings with both letters and numbers', () => {
      expect(validateAlphaNumeric('test123')).toBe(true)
      expect(validateAlphaNumeric('ABC123')).toBe(true)
      expect(validateAlphaNumeric('123abc')).toBe(true)
      expect(validateAlphaNumeric('a1b2c3')).toBe(true)
      expect(validateAlphaNumeric('Test123User')).toBe(true)
      expect(validateAlphaNumeric('user2024')).toBe(true)
    })

    it('should return false for strings with only letters', () => {
      expect(validateAlphaNumeric('helloworld')).toBe(false)
      expect(validateAlphaNumeric('TestString')).toBe(false)
      expect(validateAlphaNumeric('abcdef')).toBe(false)
      expect(validateAlphaNumeric('ABCDEF')).toBe(false)
    })

    it('should return false for strings with only numbers', () => {
      expect(validateAlphaNumeric('123456')).toBe(false)
      expect(validateAlphaNumeric('987654')).toBe(false)
      expect(validateAlphaNumeric('000')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateAlphaNumeric('')).toBe(false)
      expect(validateAlphaNumeric('a')).toBe(false)
      expect(validateAlphaNumeric('1')).toBe(false)
      expect(validateAlphaNumeric('!@#')).toBe(false)
    })

    it('should work with mixed case', () => {
      expect(validateAlphaNumeric('AbC123')).toBe(true)
      expect(validateAlphaNumeric('TeSt123')).toBe(true)
      expect(validateAlphaNumeric('UsEr456')).toBe(true)
    })

    it('should handle strings with spaces', () => {
      expect(validateAlphaNumeric('test 123')).toBe(true)
      expect(validateAlphaNumeric(' hello 123 ')).toBe(true)
      expect(validateAlphaNumeric('test123 ')).toBe(true)
      expect(validateAlphaNumeric(' 123test')).toBe(true)
    })
  })
})
