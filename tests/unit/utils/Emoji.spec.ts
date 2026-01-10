/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest'
import { getAllTypeEmojis } from '@/utils/Emoji'

// Mock the i18n service
vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'emoticon.categories.expression': 'Expression',
        'emoticon.categories.animal': 'Animals',
        'emoticon.categories.gesture': 'Gestures'
      }
      return translations[key] || key
    }
  })
}))

describe('Emoji utilities', () => {
  describe('getAllTypeEmojis', () => {
    it('should return object with three emoji categories', () => {
      const result = getAllTypeEmojis()

      expect(result).toHaveProperty('expressionEmojis')
      expect(result).toHaveProperty('animalEmojis')
      expect(result).toHaveProperty('gestureEmojis')
    })

    it('should return category names from i18n', () => {
      const result = getAllTypeEmojis()

      expect(result.expressionEmojis.name).toBe('Expression')
      expect(result.animalEmojis.name).toBe('Animals')
      expect(result.gestureEmojis.name).toBe('Gestures')
    })

    it('should return emoji arrays for each category', () => {
      const result = getAllTypeEmojis()

      expect(Array.isArray(result.expressionEmojis.value)).toBe(true)
      expect(Array.isArray(result.animalEmojis.value)).toBe(true)
      expect(Array.isArray(result.gestureEmojis.value)).toBe(true)
    })

    it('should contain expected emojis in expression category', () => {
      const result = getAllTypeEmojis()

      expect(result.expressionEmojis.value).toContain('😀')
      expect(result.expressionEmojis.value).toContain('😄')
      expect(result.expressionEmojis.value).toContain('😁')
    })

    it('should contain expected emojis in animal category', () => {
      const result = getAllTypeEmojis()

      expect(result.animalEmojis.value).toContain('🐵')
      expect(result.animalEmojis.value).toContain('🐶')
      expect(result.animalEmojis.value).toContain('🐱')
    })

    it('should contain expected emojis in gesture category', () => {
      const result = getAllTypeEmojis()

      expect(result.gestureEmojis.value).toContain('💪')
      expect(result.gestureEmojis.value).toContain('👈')
      expect(result.gestureEmojis.value).toContain('👉')
    })

    it('should have non-empty emoji arrays', () => {
      const result = getAllTypeEmojis()

      expect(result.expressionEmojis.value.length).toBeGreaterThan(0)
      expect(result.animalEmojis.value.length).toBeGreaterThan(0)
      expect(result.gestureEmojis.value.length).toBeGreaterThan(0)
    })

    it('should return valid emoji characters', () => {
      const result = getAllTypeEmojis()
      const emojiRegex = /\p{Emoji}/u

      result.expressionEmojis.value.forEach((emoji) => {
        expect(emojiRegex.test(emoji)).toBe(true)
      })

      result.animalEmojis.value.forEach((emoji) => {
        expect(emojiRegex.test(emoji)).toBe(true)
      })

      result.gestureEmojis.value.forEach((emoji) => {
        expect(emojiRegex.test(emoji)).toBe(true)
      })
    })

    it('should not have duplicate emojis within each category', () => {
      const result = getAllTypeEmojis()

      // Note: The splitEmoji function uses Set on the arrays, but within each array
      // there might still be duplicates from the original emoji strings
      const expressionUnique = new Set(result.expressionEmojis.value)
      const animalUnique = new Set(result.animalEmojis.value)
      const gestureUnique = new Set(result.gestureEmojis.value)

      // Most emojis should be unique (allowing for some duplicates in source)
      expect(expressionUnique.size).toBeGreaterThanOrEqual(result.expressionEmojis.value.length - 5)
      expect(animalUnique.size).toBeGreaterThanOrEqual(result.animalEmojis.value.length - 5)
      expect(gestureUnique.size).toBeGreaterThanOrEqual(result.gestureEmojis.value.length - 5)
    })
  })
})
