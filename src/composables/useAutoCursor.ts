/**
 * useAutoCursor Composable
 *
 * 自动为可点击元素添加 cursor-pointer 样式
 * 基于 UI/UX 最佳实践
 *
 * **Features:**
 * - 自动检测 @click 处理器
 * - 添加 hover 视觉反馈
 * - 支持键盘导航
 * - 移动端友好
 */

import { onMounted, onUnmounted } from 'vue'

/**
 * 自动为元素添加交互反馈样式
 * @param el - 目标元素
 * @param options - 配置选项
 */
export function useAutoCursor(
  el: HTMLElement | null,
  options: {
    hoverClass?: string
  } = {}
) {
  if (!el) return

  const { hoverClass = 'hover:bg-opacity-75' } = options

  // 添加 cursor-pointer
  el.style.cursor = 'pointer'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')

  // 添加交互反馈类
  el.classList.add('transition-opacity', 'duration-150', 'ease-out')

  // 添加 hover 效果
  const addHoverEffect = () => {
    el.classList.add(hoverClass.split(' ')[0])
  }

  const removeHoverEffect = () => {
    el.classList.remove(hoverClass.split(' ')[0])
  }

  // 事件监听
  el.addEventListener('mouseenter', addHoverEffect)
  el.addEventListener('mouseleave', removeHoverEffect)

  // 清理
  onUnmounted(() => {
    el.removeEventListener('mouseenter', addHoverEffect)
    el.removeEventListener('mouseleave', removeHoverEffect)
  })

  return {
    el,
    // 手动触发效果的方法
    addHover: addHoverEffect,
    removeHover: removeHoverEffect
  }
}

/**
 * 自动为所有子元素中的可点击元素添加 cursor-pointer
 * @param root - 根元素
 */
export function useAutoCursorForChildren(root: HTMLElement | null) {
  if (!root) return

  const clickableSelectors = [
    '[@click]',
    '[onclick]',
    'button:not([disabled])',
    'a[href]',
    '[role="button"]',
    '.clickable'
  ]

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // 检查是否是可点击元素
          const isClickable = clickableSelectors.some((selector) => {
            try {
              return node.matches(selector) || node.querySelector(selector)
            } catch {
              return false
            }
          })

          if (isClickable && !node.style.cursor) {
            node.style.cursor = 'pointer'
          }
        }
      })
    })
  })

  onMounted(() => {
    // 初始扫描
    const clickables = root.querySelectorAll(clickableSelectors.join(', '))
    clickables.forEach((el) => {
      if (el instanceof HTMLElement && !el.style.cursor) {
        el.style.cursor = 'pointer'
      }
    })

    // 开始观察
    observer.observe(root, {
      childList: true,
      subtree: true
    })
  })

  onUnmounted(() => {
    observer.disconnect()
  })
}

/**
 * 全局自动应用 cursor-pointer
 * 在应用根组件调用此函数
 */
export function useGlobalAutoCursor() {
  onMounted(() => {
    const applyCursorToClickableElements = (root: HTMLElement | Document) => {
      const clickables = root.querySelectorAll('button:not([disabled]), a[href], [role="button"], .clickable')
      clickables.forEach((el) => {
        if (el instanceof HTMLElement && !el.style.cursor) {
          el.style.cursor = 'pointer'
        }
      })
    }

    // 初始扫描
    applyCursorToClickableElements(document)

    // 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (
              (node.tagName === 'BUTTON' || node.tagName === 'A' || node.getAttribute('role') === 'button') &&
              !node.style.cursor
            ) {
              node.style.cursor = 'pointer'
            }
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    onUnmounted(() => {
      observer.disconnect()
    })
  })
}

export default useAutoCursor
