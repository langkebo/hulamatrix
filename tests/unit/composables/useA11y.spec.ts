/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import {
  useA11y,
  useButtonA11y,
  useStatusA11y,
  useDialogA11y,
  useListA11y,
  useListItemA11y,
  useTimerA11y,
  useAlertA11y
} from '@/composables/useA11y'

describe('useA11y', () => {
  describe('useA11y - base function', () => {
    it('should return default values when no options provided', () => {
      const { ariaLabel, ariaDescription, ariaLive, ariaRole, ariaAtomic, ariaAttrs } = useA11y()

      expect(ariaLabel.value).toBe('')
      expect(ariaDescription.value).toBe('')
      expect(ariaLive.value).toBe('off')
      expect(ariaRole.value).toBe('status')
      expect(ariaAtomic.value).toBe(false)
      // ariaAttrs includes all properties, with empty strings converted to undefined
      expect(ariaAttrs.value).toEqual({
        'aria-label': undefined,
        'aria-describedby': undefined,
        'aria-live': undefined,
        'aria-atomic': undefined,
        role: 'status'
      })
    })

    it('should set aria-label correctly', () => {
      const { ariaLabel, ariaAttrs } = useA11y({ label: 'Close button' })

      expect(ariaLabel.value).toBe('Close button')
      expect(ariaAttrs.value['aria-label']).toBe('Close button')
    })

    it('should set aria-description correctly', () => {
      const { ariaDescription, ariaAttrs } = useA11y({ description: 'Closes the dialog' })

      expect(ariaDescription.value).toBe('Closes the dialog')
      expect(ariaAttrs.value['aria-describedby']).toBe('Closes the dialog')
    })

    it('should set aria-live correctly', () => {
      const { ariaLive, ariaAttrs } = useA11y({ live: 'polite' })

      expect(ariaLive.value).toBe('polite')
      expect(ariaAttrs.value['aria-live']).toBe('polite')
    })

    it('should not include aria-live when set to off', () => {
      const { ariaAttrs } = useA11y({ live: 'off' })

      expect(ariaAttrs.value['aria-live']).toBeUndefined()
    })

    it('should set role correctly', () => {
      const { ariaRole, ariaAttrs } = useA11y({ role: 'button' })

      expect(ariaRole.value).toBe('button')
      expect(ariaAttrs.value.role).toBe('button')
    })

    it('should set aria-atomic correctly', () => {
      const { ariaAtomic, ariaAttrs } = useA11y({ atomic: true })

      expect(ariaAtomic.value).toBe(true)
      expect(ariaAttrs.value['aria-atomic']).toBe(true)
    })

    it('should not include aria-atomic when false', () => {
      const { ariaAttrs } = useA11y({ atomic: false })

      expect(ariaAttrs.value['aria-atomic']).toBeUndefined()
    })

    it('should combine all options correctly', () => {
      const { ariaAttrs } = useA11y({
        label: 'Submit',
        description: 'Submit the form',
        live: 'assertive',
        role: 'button',
        atomic: true
      })

      expect(ariaAttrs.value).toEqual({
        'aria-label': 'Submit',
        'aria-describedby': 'Submit the form',
        'aria-live': 'assertive',
        role: 'button',
        'aria-atomic': true
      })
    })

    it('should handle empty label', () => {
      const { ariaAttrs } = useA11y({ label: '' })

      expect(ariaAttrs.value['aria-label']).toBeUndefined()
    })

    it('should handle empty description', () => {
      const { ariaAttrs } = useA11y({ description: '' })

      expect(ariaAttrs.value['aria-describedby']).toBeUndefined()
    })
  })

  describe('useButtonA11y', () => {
    it('should create button accessibility attributes with label only', () => {
      const { ariaLabel, ariaRole, ariaAttrs } = useButtonA11y('Click me')

      expect(ariaLabel.value).toBe('Click me')
      expect(ariaRole.value).toBe('button')
      expect(ariaAttrs.value.role).toBe('button')
      expect(ariaAttrs.value['aria-label']).toBe('Click me')
    })

    it('should create button accessibility attributes with label and description', () => {
      const { ariaLabel, ariaDescription, ariaAttrs } = useButtonA11y('Submit', 'Submits the form')

      expect(ariaLabel.value).toBe('Submit')
      expect(ariaDescription.value).toBe('Submits the form')
      expect(ariaAttrs.value['aria-label']).toBe('Submit')
      expect(ariaAttrs.value['aria-describedby']).toBe('Submits the form')
      expect(ariaAttrs.value.role).toBe('button')
    })

    it('should set undefined for description when not provided', () => {
      const { ariaAttrs } = useButtonA11y('Click me')

      expect(ariaAttrs.value['aria-describedby']).toBeUndefined()
    })
  })

  describe('useStatusA11y', () => {
    it('should create status accessibility attributes with polite live region', () => {
      const { ariaLabel, ariaRole, ariaLive, ariaAtomic, ariaAttrs } = useStatusA11y('Loading content')

      expect(ariaLabel.value).toBe('Loading content')
      expect(ariaRole.value).toBe('status')
      expect(ariaLive.value).toBe('polite')
      expect(ariaAtomic.value).toBe(true)
      expect(ariaAttrs.value.role).toBe('status')
      expect(ariaAttrs.value['aria-live']).toBe('polite')
      expect(ariaAttrs.value['aria-atomic']).toBe(true)
    })

    it('should create status accessibility attributes with assertive live region', () => {
      const { ariaLive, ariaAttrs } = useStatusA11y('Error occurred', 'assertive')

      expect(ariaLive.value).toBe('assertive')
      expect(ariaAttrs.value['aria-live']).toBe('assertive')
    })
  })

  describe('useDialogA11y', () => {
    it('should create dialog accessibility attributes with label only', () => {
      const { ariaLabel, ariaRole, ariaAttrs } = useDialogA11y('Settings')

      expect(ariaLabel.value).toBe('Settings')
      expect(ariaRole.value).toBe('dialog')
      expect(ariaAttrs.value.role).toBe('dialog')
      expect(ariaAttrs.value['aria-label']).toBe('Settings')
    })

    it('should create dialog accessibility attributes with label and describedBy', () => {
      const { ariaLabel, ariaDescription, ariaAttrs } = useDialogA11y('Settings', 'settings-description')

      expect(ariaLabel.value).toBe('Settings')
      expect(ariaDescription.value).toBe('settings-description')
      expect(ariaAttrs.value['aria-label']).toBe('Settings')
      expect(ariaAttrs.value['aria-describedby']).toBe('settings-description')
      expect(ariaAttrs.value.role).toBe('dialog')
    })

    it('should set undefined for describedBy when not provided', () => {
      const { ariaAttrs } = useDialogA11y('Settings')

      expect(ariaAttrs.value['aria-describedby']).toBeUndefined()
    })
  })

  describe('useListA11y', () => {
    it('should create list accessibility attributes', () => {
      const { ariaLabel, ariaRole, ariaAttrs } = useListA11y('User list')

      expect(ariaLabel.value).toBe('User list')
      expect(ariaRole.value).toBe('list')
      expect(ariaAttrs.value.role).toBe('list')
      expect(ariaAttrs.value['aria-label']).toBe('User list')
    })
  })

  describe('useListItemA11y', () => {
    it('should create listitem accessibility attributes with label', () => {
      const { ariaLabel, ariaRole, ariaAttrs } = useListItemA11y('User 1')

      expect(ariaLabel.value).toBe('User 1')
      expect(ariaRole.value).toBe('listitem')
      expect(ariaAttrs.value.role).toBe('listitem')
      expect(ariaAttrs.value['aria-label']).toBe('User 1')
    })

    it('should create listitem accessibility attributes without label', () => {
      const { ariaLabel, ariaAttrs } = useListItemA11y()

      expect(ariaLabel.value).toBe('')
      expect(ariaAttrs.value['aria-label']).toBeUndefined()
      expect(ariaAttrs.value.role).toBe('listitem')
    })
  })

  describe('useTimerA11y', () => {
    it('should create timer accessibility attributes', () => {
      const { ariaLabel, ariaRole, ariaLive, ariaAttrs } = useTimerA11y('Countdown timer')

      expect(ariaLabel.value).toBe('Countdown timer')
      expect(ariaRole.value).toBe('timer')
      expect(ariaLive.value).toBe('polite')
      expect(ariaAttrs.value.role).toBe('timer')
      expect(ariaAttrs.value['aria-live']).toBe('polite')
    })
  })

  describe('useAlertA11y', () => {
    it('should create alert accessibility attributes', () => {
      const { ariaLabel, ariaRole, ariaLive, ariaAtomic, ariaAttrs } = useAlertA11y('Form validation failed')

      expect(ariaLabel.value).toBe('Form validation failed')
      expect(ariaRole.value).toBe('alert')
      expect(ariaLive.value).toBe('assertive')
      expect(ariaAtomic.value).toBe(true)
      expect(ariaAttrs.value.role).toBe('alert')
      expect(ariaAttrs.value['aria-live']).toBe('assertive')
      expect(ariaAttrs.value['aria-atomic']).toBe(true)
    })
  })
})
