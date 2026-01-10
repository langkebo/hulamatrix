/**
 * MessageStatusIndicator Component Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h, computed } from 'vue'

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
  NPopover: defineComponent({
    name: 'NPopover',
    props: ['trigger', 'placement'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-popover' }, [
        h('div', { class: 'n-popover__trigger' }, slots.trigger?.()),
        h('div', { class: 'n-popover__content' }, slots.default?.())
      ])
    }
  })
}))

// Mock icons
vi.mock('@vicons/ionicons5', () => ({
  LoadingOutline: defineComponent({ name: 'LoadingOutline' }),
  CheckmarkOutline: defineComponent({ name: 'CheckmarkOutline' }),
  DoneAllOutline: defineComponent({ name: 'DoneAllOutline' }),
  AlertCircleOutline: defineComponent({ name: 'AlertCircleOutline' })
}))

import MessageStatusIndicator from '@/components/common/MessageStatusIndicator.vue'

describe('MessageStatusIndicator Component', () => {
  describe('Rendering', () => {
    it('should render sending state with spinning icon', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'sending'
        }
      })

      expect(wrapper.find('.message-status-indicator').exists()).toBe(true)
      expect(wrapper.find('.spin').exists()).toBe(true)
    })

    it('should render sent state with checkmark icon', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'sent'
        }
      })

      expect(wrapper.find('.message-status-indicator').exists()).toBe(true)
      expect(wrapper.html()).toContain('CheckmarkOutline')
    })

    it('should render delivered state with double checkmark', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'delivered'
        }
      })

      expect(wrapper.html()).toContain('DoneAllOutline')
      expect(wrapper.find('.status-read').exists()).toBe(false)
    })

    it('should render read state with colored double checkmark', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'read'
        }
      })

      expect(wrapper.find('.status-read').exists()).toBe(true)
      expect(wrapper.html()).toContain('DoneAllOutline')
    })

    it('should render failed state with error icon and popover', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: true
        }
      })

      expect(wrapper.find('.status-error').exists()).toBe(true)
      expect(wrapper.html()).toContain('AlertCircleOutline')
      expect(wrapper.find('.n-popover').exists()).toBe(true)
    })
  })

  describe('ARIA Attributes', () => {
    it('should have correct aria-label for each status', () => {
      const statuses = [
        { status: 'sending', label: '发送中' },
        { status: 'sent', label: '已发送' },
        { status: 'delivered', label: '已送达' },
        { status: 'read', label: '已读' },
        { status: 'failed', label: '发送失败' }
      ]

      statuses.forEach(({ status, label }) => {
        const wrapper = mount(MessageStatusIndicator, {
          props: { status: status as any }
        })

        expect(wrapper.find('[aria-label]').attributes('aria-label')).toContain(label)
      })
    })

    it('should include readBy users in aria-label', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'read',
          readBy: ['@alice:example.com', '@bob:example.com']
        }
      })

      const ariaLabel = wrapper.find('[aria-label]').attributes('aria-label')
      expect(ariaLabel).toContain('@alice:example.com')
      expect(ariaLabel).toContain('@bob:example.com')
    })

    it('should have role="status" when not clickable', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'sent',
          clickable: false
        }
      })

      expect(wrapper.find('.message-status-indicator').attributes('role')).toBe('status')
    })

    it('should have role="button" when clickable', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: true
        }
      })

      expect(wrapper.find('.message-status-indicator').attributes('role')).toBe('button')
      expect(wrapper.find('.message-status-indicator').attributes('tabindex')).toBe('0')
    })
  })

  describe('Interactions', () => {
    it('should emit retry event when clicking failed status', async () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: true
        }
      })

      await wrapper.find('.message-status-indicator').trigger('click')

      expect(wrapper.emitted('retry')).toBeTruthy()
      expect(wrapper.emitted('retry')?.length).toBe(1)
    })

    it('should emit retry event on Enter key press', async () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: true
        }
      })

      await wrapper.find('.message-status-indicator').trigger('keydown.enter')

      expect(wrapper.emitted('retry')).toBeTruthy()
    })

    it('should not emit retry when status is not failed', async () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'sent',
          clickable: true
        }
      })

      await wrapper.find('.message-status-indicator').trigger('click')

      expect(wrapper.emitted('retry')).toBeFalsy()
    })

    it('should not emit retry when clickable is false', async () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: false
        }
      })

      await wrapper.find('.message-status-indicator').trigger('click')

      expect(wrapper.emitted('retry')).toBeFalsy()
    })
  })

  describe('CSS Classes', () => {
    it('should apply status-clickable class when clickable', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'failed',
          clickable: true
        }
      })

      expect(wrapper.find('.status-clickable').exists()).toBe(true)
    })

    it('should apply individual status classes', () => {
      const wrapper = mount(MessageStatusIndicator, {
        props: {
          status: 'read'
        }
      })

      expect(wrapper.find('.status-read').exists()).toBe(true)
    })
  })
})
