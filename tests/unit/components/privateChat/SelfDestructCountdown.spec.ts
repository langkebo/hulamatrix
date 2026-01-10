/**
 * SelfDestructCountdown Component Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NIcon: defineComponent({
    name: 'NIcon',
    props: ['size', 'component'],
    setup(props, { slots }) {
      return () => h('span', {
        class: `n-icon n-icon--${props.component?.name || 'default'}`,
        style: { fontSize: `${props.size}px` }
      }, slots.default?.())
    }
  }),
  NProgress: defineComponent({
    name: 'NProgress',
    props: ['type', 'percentage', 'indicatorPlacement', 'height', 'showIndicator'],
    setup(props) {
      return () => h('div', {
        class: 'n-progress',
        'aria-valuenow': props.percentage,
        role: 'progressbar'
      })
    }
  })
}))

// Mock icons
vi.mock('@vicons/ionicons5', () => ({
  TimeOutline: defineComponent({ name: 'TimeOutline' }),
  WarningOutline: defineComponent({ name: 'WarningOutline' })
}))

import SelfDestructCountdown from '@/components/privateChat/SelfDestructCountdown.vue'

describe('SelfDestructCountdown Component', () => {
  let wrapper: VueWrapper
  let vi: any

  beforeEach(() => {
    vi = vi
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('should render countdown with initial time', () => {
      const destructTime = new Date(Date.now() + 30000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      expect(wrapper.find('.countdown-container').exists()).toBe(true)
      expect(wrapper.find('[role="timer"]').exists()).toBe(true)
    })

    it('should show urgent warning when time is low', () => {
      // Set destruct time to 5 seconds from now
      const destructTime = new Date(Date.now() + 5000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      expect(wrapper.find('.countdown-urgent').exists()).toBe(true)
    })

    it('should display remaining seconds', () => {
      const destructTime = new Date(Date.now() + 10000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      const text = wrapper.text()
      expect(text).toMatch(/\d+/)
    })
  })

  describe('Timer Functionality', () => {
    it('should update countdown every second', async () => {
      const destructTime = new Date(Date.now() + 5000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      const initialText = wrapper.find('.countdown-text').text()

      // Advance time by 1 second
      vi.advanceTimersByTime(1000)
      await wrapper.vm.$nextTick()

      const newText = wrapper.find('.countdown-text').text()
      expect(newText).not.toBe(initialText)
    })

    it('should emit destruct event when countdown reaches zero', async () => {
      const destructTime = new Date(Date.now() + 100).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      // Advance time past destruct time
      vi.advanceTimersByTime(200)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('destruct')).toBeTruthy()
    })

    it('should clear timer on component unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      const destructTime = new Date(Date.now() + 30000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      wrapper.unmount()

      // Timer should be cleared on unmount
      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Props', () => {
    it('should support custom size', () => {
      const destructTime = new Date(Date.now() + 30000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime,
          size: 32
        }
      })

      const progress = wrapper.find('.countdown-progress')
      expect(progress.attributes('stroke-width')).toBeDefined()
    })

    it('should support custom color', () => {
      const destructTime = new Date(Date.now() + 30000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime,
          color: '#FF0000'
        }
      })

      expect(wrapper.html()).toContain('#FF0000')
    })
  })

  describe('Accessibility', () => {
    it('should have role="timer"', () => {
      const destructTime = new Date(Date.now() + 30000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      expect(wrapper.find('[role="timer"]').exists()).toBe(true)
    })

    it('should have aria-label with remaining time', () => {
      const destructTime = new Date(Date.now() + 10000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      const ariaLabel = wrapper.find('[role="timer"]').attributes('aria-label')
      expect(ariaLabel).toContain('秒')
      expect(ariaLabel).toContain('后自动删除')
    })

    it('should have aria-live="polite" when time is low', () => {
      const destructTime = new Date(Date.now() + 5000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      const ariaLive = wrapper.find('[role="timer"]').attributes('aria-live')
      expect(ariaLive).toBe('polite')
    })
  })

  describe('Edge Cases', () => {
    it('should handle already expired messages', () => {
      const destructTime = new Date(Date.now() - 1000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      expect(wrapper.vm.remainingSeconds).toBe(0)
    })

    it('should handle very long time periods', () => {
      const destructTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

      wrapper = mount(SelfDestructCountdown, {
        props: {
          destructAt: destructTime
        }
      })

      expect(wrapper.vm.remainingSeconds).toBeGreaterThan(0)
    })
  })
})
