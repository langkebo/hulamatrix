/**
 * General Formatting Utilities
 *
 * Shared formatting and display utility functions used across multiple components
 * Extracted from various components to improve code reusability
 */

/**
 * Format file size from bytes to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format timestamp to locale string
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale code (default: 'zh-CN')
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number, locale: string = 'zh-CN'): string {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format timestamp to short time string (HH:MM)
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale code (default: 'zh-CN')
 * @returns Formatted time string
 */
export function formatTime(timestamp: number, locale: string = 'zh-CN'): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format duration from seconds to HH:MM:SS or MM:SS
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get initials from a name for avatar display
 * @param name - Display name or user ID
 * @param maxLength - Maximum number of characters (default: 2)
 * @returns Uppercase initials
 */
export function getNameInitials(name: string, maxLength: number = 2): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (trimmed.length <= maxLength) return trimmed.toUpperCase()

  const parts = trimmed.split(' ')
  if (parts.length >= 2) {
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return (first + second).toUpperCase().substring(0, maxLength)
    }
  }
  return trimmed.substring(0, maxLength).toUpperCase()
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}

/**
 * Format number with thousand separators
 * @param num - Number to format
 * @param locale - Locale code (default: 'zh-CN')
 * @returns Formatted number string
 */
export function formatNumber(num: number, locale: string = 'zh-CN'): string {
  return num.toLocaleString(locale)
}

/**
 * Format percentage
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale code (default: 'zh-CN')
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number, locale: string = 'zh-CN'): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (years > 0) return rtf.format(-years, 'year')
  if (months > 0) return rtf.format(-months, 'month')
  if (days > 0) return rtf.format(-days, 'day')
  if (hours > 0) return rtf.format(-hours, 'hour')
  if (minutes > 0) return rtf.format(-minutes, 'minute')
  return rtf.format(-seconds, 'second')
}

/**
 * Format chat message markdown text
 * @param text - Selected text
 * @param command - Format command ('bold', 'italic', 'underline', etc.)
 * @returns Formatted text with markdown syntax
 */
export function formatMarkdownText(text: string, command: string): string {
  switch (command) {
    case 'bold':
      return `**${text}**`
    case 'italic':
      return `*${text}*`
    case 'underline':
      return `__${text}__`
    case 'strikethrough':
      return `~~${text}~~`
    case 'code':
      return `\`${text}\``
    case 'link':
      return `[${text}](url)`
    default:
      return text
  }
}

/**
 * Sanitize HTML string (basic XSS prevention)
 * @param html - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  const temp = document.createElement('div')
  temp.textContent = html
  return temp.innerHTML
}

/**
 * Escape special regex characters
 * @param string - String to escape
 * @returns Escaped string safe for regex
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns True if valid URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Get file extension from filename
 * @param filename - File name or path
 * @returns File extension (without dot)
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : ''
}

/**
 * Check if file is an image
 * @param filename - File name or path
 * @returns True if file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const ext = getFileExtension(filename)
  return imageExtensions.includes(ext)
}

/**
 * Check if file is a video
 * @param filename - File name or path
 * @returns True if file is a video
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']
  const ext = getFileExtension(filename)
  return videoExtensions.includes(ext)
}

/**
 * Check if file is an audio file
 * @param filename - File name or path
 * @returns True if file is an audio file
 */
export function isAudioFile(filename: string): boolean {
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
  const ext = getFileExtension(filename)
  return audioExtensions.includes(ext)
}
