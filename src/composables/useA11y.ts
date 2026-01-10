import { computed, type ComputedRef } from 'vue'

export interface A11yOptions {
  label?: string
  description?: string
  live?: 'polite' | 'assertive' | 'off'
  role?: string
  atomic?: boolean
}

export interface A11yAttrs {
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-live'?: string
  role?: string
  'aria-atomic'?: boolean
}

export interface A11yReturn {
  ariaLabel: ComputedRef<string>
  ariaDescription: ComputedRef<string>
  ariaLive: ComputedRef<'polite' | 'assertive' | 'off'>
  ariaRole: ComputedRef<string>
  ariaAtomic: ComputedRef<boolean>
  ariaAttrs: ComputedRef<A11yAttrs>
}

/**
 * Accessibility composable for generating ARIA attributes
 *
 * @example
 * ```ts
 * const { ariaAttrs } = useA11y({
 *   label: 'Close dialog',
 *   role: 'button',
 *   live: 'polite'
 * })
 * ```
 */
export function useA11y(options: A11yOptions = {}): A11yReturn {
  const ariaLabel = computed(() => options.label || '')
  const ariaDescription = computed(() => options.description || '')
  const ariaLive = computed(() => options.live || 'off')
  const ariaRole = computed(() => options.role || 'status')
  const ariaAtomic = computed(() => options.atomic || false)

  // Generate complete ARIA attributes object
  const ariaAttrs = computed<A11yAttrs>(() => ({
    'aria-label': ariaLabel.value || undefined,
    'aria-describedby': ariaDescription.value || undefined,
    'aria-live': ariaLive.value === 'off' ? undefined : ariaLive.value,
    role: ariaRole.value || undefined,
    'aria-atomic': ariaAtomic.value || undefined
  }))

  return {
    ariaLabel,
    ariaDescription,
    ariaLive,
    ariaRole,
    ariaAtomic,
    ariaAttrs
  }
}

/**
 * Shortcut composable for button accessibility
 */
export function useButtonA11y(label: string, description?: string) {
  return useA11y({
    label,
    description,
    role: 'button'
  })
}

/**
 * Shortcut composable for status accessibility with live regions
 */
export function useStatusA11y(label: string, live: 'polite' | 'assertive' = 'polite') {
  return useA11y({
    label,
    live,
    role: 'status',
    atomic: true
  })
}

/**
 * Shortcut composable for dialog accessibility
 */
export function useDialogA11y(label: string, describedBy?: string) {
  return useA11y({
    label,
    description: describedBy,
    role: 'dialog'
  })
}

/**
 * Shortcut composable for list accessibility
 */
export function useListA11y(label: string) {
  return useA11y({
    label,
    role: 'list'
  })
}

/**
 * Shortcut composable for listitem accessibility
 */
export function useListItemA11y(label?: string) {
  return useA11y({
    label,
    role: 'listitem'
  })
}

/**
 * Shortcut composable for timer accessibility
 */
export function useTimerA11y(label: string) {
  return useA11y({
    label,
    role: 'timer',
    live: 'polite'
  })
}

/**
 * Shortcut composable for alert/alertdialog accessibility
 */
export function useAlertA11y(label: string) {
  return useA11y({
    label,
    role: 'alert',
    live: 'assertive',
    atomic: true
  })
}
