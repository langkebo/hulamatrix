import DOMPurify from 'dompurify'

/**
 * 安全地解析 HTML 字符串
 */
export function parseHtmlSafely(html: string): DocumentFragment {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 's', 'br', 'span', 'img'],
    ALLOWED_ATTR: ['class', 'src', 'alt', 'data-type', 'data-uid']
  })

  const template = document.createElement('template')
  template.innerHTML = sanitized
  return template.content
}

/**
 * 触发粘贴事件
 */
export function triggerPasteEvent(_element: HTMLElement, _data: DataTransfer) {
  const event = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: _data
  })

  _element.dispatchEvent(event)
}

/**
 * 去除 HTML 标签，仅保留纯文本
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = DOMPurify.sanitize(html)
  return tmp.textContent || tmp.innerText || ''
}
