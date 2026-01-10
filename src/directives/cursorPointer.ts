/**
 * v-cursor-pointer Directive
 *
 * 自动为可点击元素添加 cursor-pointer 样式
 * 基于 UI/UX 最佳实践，确保用户能识别可交互元素
 *
 * **Usage:**
 * ```vue
 * <!-- 自动添加 cursor-pointer -->
 * <div v-cursor-pointer @click="handleClick">点击我</div>
 *
 * <!-- 条件添加 -->
 * <div v-cursor-pointer="isClickable">条件可点击</div>
 * ```
 *
 * **UX Guideline:**
 * - 所有可点击元素必须有视觉反馈 (cursor: pointer)
 * - hover 状态应提供明确的视觉变化
 * - 不应仅依赖 hover 进行重要交互（移动设备）
 */

import type { Directive, DirectiveBinding } from 'vue'

const cursorPointerDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const shouldAdd = binding.value === undefined ? true : binding.value

    if (shouldAdd) {
      el.style.cursor = 'pointer'
      el.setAttribute('role', 'button')

      // 添加可访问性属性
      if (!el.getAttribute('tabindex')) {
        el.setAttribute('tabindex', '0')
      }
    }
  },

  updated(el: HTMLElement, binding: DirectiveBinding) {
    const shouldAdd = binding.value === undefined ? true : binding.value

    if (shouldAdd) {
      el.style.cursor = 'pointer'
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '0')
    } else {
      el.style.cursor = ''
      el.removeAttribute('role')
      el.removeAttribute('tabindex')
    }
  },

  unmounted(el: HTMLElement) {
    el.style.cursor = ''
    el.removeAttribute('role')
    el.removeAttribute('tabindex')
  }
}

export default cursorPointerDirective
