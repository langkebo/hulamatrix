/**
 * Vue 安全 HTML 指令
 *
 * 提供 v-safe-html 指令，自动清理 HTML 内容
 */

import type { Directive } from 'vue'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

/**
 * v-safe-html 指令
 *
 * 用法：
 * <div v-safe-html="htmlContent"></div>
 *
 * 等价于：
 * <div v-html="sanitizeHtml(htmlContent)"></div>
 */
export const vSafeHtml: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.innerHTML = sanitizeHtml(binding.value)
  },
  updated(el, binding) {
    // 只有值变化时才更新
    if (el.innerHTML !== sanitizeHtml(binding.value)) {
      el.innerHTML = sanitizeHtml(binding.value)
    }
  }
}

/**
 * v-safe-html-highlight 指令（带高亮）
 *
 * 用法：
 * <div v-safe-html-highlight="content" :highlight="keyword"></div>
 */
export const vSafeHtmlHighlight: Directive<HTMLElement> = {
  mounted(el, binding) {
    const html = binding.value as string
    const _highlight = (binding as unknown as { highlight?: string }).highlight || ''

    // 这里简化处理，实际应从 modifiers 或其他地方获取高亮关键词
    el.innerHTML = sanitizeHtml(html)
  },
  updated(el, binding) {
    el.innerHTML = sanitizeHtml(binding.value as string)
  }
}

export default {
  safeHtml: vSafeHtml,
  safeHtmlHighlight: vSafeHtmlHighlight
}
