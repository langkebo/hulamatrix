/**
 * HTML Sanitizer - XSS 防护工具
 *
 * 提供安全的 HTML 清理功能，防止 XSS 攻击
 */

import DOMPurify from 'dompurify'

/**
 * 清理 HTML 内容，防止 XSS 攻击
 * @param html - 原始 HTML 字符串
 * @param options - 可选配置
 * @returns 清理后的安全 HTML
 */
export function sanitizeHtml(
  html: string,
  options?: {
    allowedTags?: string[]
    allowedAttributes?: Record<string, string[]>
  }
): string {
  if (!html) return ''

  return DOMPurify.sanitize(html, {
    // 默认允许的标签（基础 HTML 格式化）
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'code',
      'pre',
      'a',
      'img',
      'span',
      'div',
      'blockquote',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'b',
      'i',
      'sub',
      'sup',
      'ins',
      'del',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td'
    ],
    // 默认允许的属性
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'target',
      'rel',
      'name',
      'width',
      'height',
      'rowspan',
      'colspan',
      'align',
      'valign',
      'style',
      'data-*'
    ],
    // 禁止 data 属性（安全考虑）
    ALLOW_DATA_ATTR: false,
    // 允许自定义标签（如 mark 等）
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: null // 允许所有自定义标签
    },
    // URI 安全配置
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ...options
  })
}

/**
 * 清理并高亮搜索文本
 * @param html - 原始 HTML
 * @param highlight - 高亮关键词
 * @returns 带高亮的安全 HTML
 */
export function sanitizeHighlightHtml(html: string, highlight: string): string {
  const clean = sanitizeHtml(html)
  if (!highlight) return clean

  // 转义特殊字符，避免正则注入
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')

  // 替换为带标记的高亮
  return clean.replace(regex, '<mark>$1</mark>')
}

/**
 * 创建带权限控制的清理函数
 * @param permissions - 权限配置
 * @returns 清理函数
 */
export function createSanitizer(permissions: {
  allowStyles?: boolean
  allowClasses?: boolean
  allowDataAttrs?: boolean
  customTags?: string[]
}) {
  const ALLOWED_TAGS = permissions.customTags || []
  const ALLOWED_ATTR: string[] = []

  if (permissions.allowStyles) {
    ALLOWED_ATTR.push('style')
  }
  if (permissions.allowClasses) {
    ALLOWED_ATTR.push('class')
  }

  return (html: string) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: permissions.allowDataAttrs || false
    })
  }
}

/**
 * 验证 HTML 是否安全（不修改原字符串）
 * @param html - 待验证的 HTML
 * @returns 是否安全
 */
export function isHtmlSafe(html: string): boolean {
  const cleaned = sanitizeHtml(html)
  return cleaned === html
}

/**
 * 移除所有 HTML 标签，只保留文本内容
 * @param html - HTML 字符串
 * @returns 纯文本内容
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

/**
 * 截断 HTML 并保持标签闭合
 * @param html - HTML 字符串
 * @param maxLength - 最大长度
 * @param suffix - 后缀（默认 '...'）
 * @returns 截断后的 HTML
 */
export function truncateHtml(html: string, maxLength: number, suffix = '...'): string {
  const clean = sanitizeHtml(html)
  if (clean.length <= maxLength) return clean

  // 尝试在最近的标签边界截断
  let truncated = clean.substring(0, maxLength - suffix.length)

  // 简单处理：如果截断点在标签中间，移除不完整的标签
  const lastOpenBracket = truncated.lastIndexOf('<')
  const lastCloseBracket = truncated.lastIndexOf('>')

  if (lastOpenBracket > lastCloseBracket) {
    // 截断点在标签内部，移除不完整的标签
    truncated = truncated.substring(0, lastOpenBracket)
  }

  return truncated + suffix
}

// 预定义的清理器配置
export const SANITIZERS = {
  // 严格模式（仅基础格式）
  strict: createSanitizer({
    allowStyles: false,
    allowClasses: false,
    allowDataAttrs: false
  }),

  // 标准模式（允许样式）
  standard: createSanitizer({
    allowStyles: true,
    allowClasses: false,
    allowDataAttrs: false
  }),

  // 宽松模式（允许类名）
  loose: createSanitizer({
    allowStyles: true,
    allowClasses: true,
    allowDataAttrs: false
  })
}
