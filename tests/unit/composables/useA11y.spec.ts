/**
 * useA11y Composable Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { computed } from 'vue'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { useA11y, useButtonA11y, useStatusA11y, useDialogA11y } from '@/composables/useA11y'

describe('useA11y Composable', () => {
  describe('useA11y', () => {
    it('should return default aria attributes', () => {
      const { ariaLabel, ariaLive, ariaRole, ariaAttrs } = useA11y()

      expect(ariaLabel.value).toBe('')
      expect(ariaLive.value).toBe('off')
      expect(ariaRole.value).toBe('status')
      expect(ariaAttrs.value).toEqual({
        'aria-label': '',
        'aria-describedby': undefined,
        'aria-live': 'off',
        'role': 'status',
        'aria-atomic': false
      })
    })

    it('should accept custom options', () => {
      const { ariaLabel, ariaLive, ariaRole, ariaAttrs } = useA11y({
        label: 'Test Label',
        live: 'polite',
        role: 'button',
        atomic: true
      })

      expect(ariaLabel.value).toBe('Test Label')
      expect(ariaLive.value).toBe('polite')
      expect(ariaRole.value).toBe('button')
      expect(ariaAttrs.value).toEqual({
        'aria-label': 'Test Label',
        'aria-describedby': undefined,
        'aria-live': 'polite',
        'role': 'button',
        'aria-atomic': true
      })
    })

    it('should include description in ariaAttrs when provided', () => {
      const { ariaAttrs } = useA11y({
        label: 'Test Label',
        description: 'Test Description'
      })

      expect(ariaAttrs.value['aria-describedby']).toBe('Test Description')
    })
  })

  describe('useButtonA11y', () => {
    it('should set role to button', () => {
      const { ariaRole, ariaAttrs } = useButtonA11y('Click me')

      expect(ariaRole.value).toBe('button')
      expect(ariaAttrs.value).toEqual({
        'aria-label': 'Click me',
        'aria-describedby': undefined,
        'aria-live': 'off',
        'role': 'button',
        'aria-atomic': false
      })
    })

    it('should accept description', () => {
      const { ariaAttrs } = useButtonA11y('Click me', 'This is a button')

      expect(ariaAttrs.value['aria-describedby']).toBe('This is a button')
    })
  })

  describe('useStatusA11y', () => {
    it('should set role to status and live to polite by default', () => {
      const { ariaLive, ariaRole, ariaAttrs } = useStatusA11y('Loading...')

      expect(ariaLive.value).toBe('polite')
      expect(ariaRole.value).toBe('status')
      expect(ariaAttrs.value['aria-atomic']).toBe(true)
    })

    it('should accept assertive live region', () => {
      const { ariaLive, ariaAttrs } = useStatusA11y('Error!', 'assertive')

      expect(ariaLive.value).toBe('assertive')
      expect(ariaAttrs.value['aria-live']).toBe('assertive')
    })
  })

  describe('useDialogA11y', () => {
    it('should set role to dialog', () => {
      const { ariaRole, ariaAttrs } = useDialogA11y('Edit Profile')

      expect(ariaRole.value).toBe('dialog')
      expect(ariaAttrs.value['role']).toBe('dialog')
    })

    it('should include describedBy when provided', () => {
      const { ariaAttrs } = useDialogA11y('Edit Profile', 'dialog-description')

      expect(ariaAttrs.value['aria-describedby']).toBe('dialog-description')
    })
  })
})
