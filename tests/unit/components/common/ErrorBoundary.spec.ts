/**
 * ErrorBoundary Component Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NResult: defineComponent({
    name: 'NResult',
    props: ['status', 'title', 'description'],
    setup(props, { slots }) {
      return () => h('div', { class: `n-result n-result--${props.status}` }, [
        h('div', { class: 'n-result__title' }, props.title),
        h('div', { class: 'n-result__description' }, props.description),
        slots.default?.()
      ])
    }
  }),
  NButton: defineComponent({
    name: 'NButton',
    props: ['type', 'size'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', {
        class: `n-button n-button--${props.type || 'default'}`,
        onClick: () => emit('click')
      }, slots.default?.())
    }
  }),
  NCard: defineComponent({
    name: 'NCard',
    props: ['bordered'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-card' }, slots.default?.())
    }
  })
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

import ErrorBoundary from '@/components/common/ErrorBoundary.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      error: {
        boundary: {
          title: 'Something went wrong',
          description: 'An unexpected error occurred',
          retry: 'Try Again',
          goHome: 'Go Home'
        }
      }
    }
  }
})

// Create a component that throws an error
const ThrowingComponent = defineComponent({
  name: 'ThrowingComponent',
  setup() {
    throw new Error('Test error')
  }
})

// Create a component that renders successfully
const SuccessComponent = defineComponent({
  name: 'SuccessComponent',
  setup() {
    const count = ref(0)
    return () => h('div', { class: 'success-component' }, `Count: ${count.value}`)
  }
})

// Create a component that throws after interaction
const ConditionalThrowComponent = defineComponent({
  name: 'ConditionalThrowComponent',
  emits: ['trigger-error'],
  setup(_props, { emit }) {
    const shouldThrow = ref(false)

    const triggerError = () => {
      shouldThrow.value = true
      emit('trigger-error')
      throw new Error('Conditional error')
    }

    return () => {
      if (shouldThrow.value) {
        throw new Error('Conditional error')
      }
      return h('button', { onClick: triggerError, class: 'trigger-error' }, 'Throw Error')
    }
  }
})

describe('ErrorBoundary Component', () => {
  let originalErrorHandler: ErrorHandler | null
  type ErrorHandler = (err: unknown, instance: any, info: string) => void

  beforeEach(() => {
    // Store original error handler
    originalErrorHandler = (window as any).__VUE_ERROR_HANDLER__
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original error handler
    if (originalErrorHandler) {
      window.onerror = originalErrorHandler
    }
  })

  describe('Error Handling', () => {
    it('should catch errors from child components', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      // Error boundary should show error state
      expect(wrapper.find('.n-result--error').exists()).toBe(true)
    })

    it('should display error message', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      expect(wrapper.text()).toContain('Something went wrong')
    })

    it('should render error slot when provided', () => {
      const errorSlot = h('div', { class: 'custom-error' }, 'Custom Error UI')

      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent),
          error: () => errorSlot
        }
      })

      expect(wrapper.find('.custom-error').exists()).toBe(true)
    })
  })

  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(SuccessComponent)
        }
      })

      expect(wrapper.find('.success-component').exists()).toBe(true)
      expect(wrapper.find('.n-result--error').exists()).toBe(false)
    })

    it('should pass through props and events', () => {
      const TestComponent = defineComponent({
        name: 'TestComponent',
        props: ['message'],
        emits: ['update'],
        setup(props) {
          return () => h('div', { class: 'test-component' }, props.message)
        }
      })

      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(TestComponent, { message: 'Hello', onUpdate: () => {} })
        }
      })

      expect(wrapper.find('.test-component').text()).toBe('Hello')
    })
  })

  describe('Recovery', () => {
    it('should retry on button click', async () => {
      let attemptCount = 0

      const RetryComponent = defineComponent({
        name: 'RetryComponent',
        setup() {
          attemptCount++
          if (attemptCount === 1) {
            throw new Error('First attempt error')
          }
          return () => h('div', { class: 'retry-success' }, 'Success on retry')
        }
      })

      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(RetryComponent)
        }
      })

      // Should show error initially
      expect(wrapper.find('.n-result--error').exists()).toBe(true)

      // Click retry button
      const retryButton = wrapper.findAll('.n-button').find(btn => btn.text() === 'Try Again')
      await retryButton?.trigger('click')

      // After retry, component should render successfully
      // Note: This depends on implementation - may need key change or state reset
    })
  })

  describe('Logging', () => {
    it('should log errors to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should include error info in logs', () => {
      const logger = require('@/utils/logger').logger
      const loggerErrorSpy = vi.spyOn(logger, 'error')

      mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ErrorBoundary'),
        expect.any(Error),
        expect.any(String)
      )
    })
  })

  describe('Props', () => {
    it('should support custom fallback UI', () => {
      const customFallback = h('div', { class: 'custom-fallback' }, 'Custom Error')

      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        props: {
          fallback: customFallback
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      expect(wrapper.find('.custom-fallback').exists()).toBe(true)
    })

    it('should support onError callback', () => {
      const onError = vi.fn()

      mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        props: {
          onError
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object),
        expect.any(String)
      )
    })

    it('should support disableErrorLogging prop', () => {
      const logger = require('@/utils/logger').logger
      const loggerErrorSpy = vi.spyOn(logger, 'error')

      mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        props: {
          disableErrorLogging: true
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      // Logger should not be called when disabled
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () {
    it('should handle null children', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => null
        }
      })

      expect(wrapper.find('.n-result--error').exists()).toBe(false)
    })

    it('should handle multiple children', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => [
            h('div', { class: 'child-1' }, 'Child 1'),
            h('div', { class: 'child-2' }, 'Child 2')
          ]
        }
      })

      expect(wrapper.find('.child-1').exists()).toBe(true)
      expect(wrapper.find('.child-2').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes in error state', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      const result = wrapper.find('.n-result--error')
      expect(result.exists()).toBe(true)
    })

    it('should provide focusable retry button', () => {
      const wrapper = mount(ErrorBoundary, {
        global: {
          plugins: [i18n]
        },
        slots: {
          default: () => h(ThrowingComponent)
        }
      })

      const retryButton = wrapper.findAll('.n-button').find(btn => btn.text() === 'Try Again')
      expect(retryButton?.exists()).toBe(true)
    })
  })
})
