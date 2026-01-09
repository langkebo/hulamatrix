/**
 * Group Call Helper Utilities
 *
 * Utility functions for GroupCallInterface component
 * Provides helper methods for displaying and formatting group call information
 */

import type { CallTypeEnum } from '@/enums'

// Re-export CallTypeEnum for convenience
export type { CallTypeEnum } from '@/enums'

/**
 * Convert string call type to CallTypeEnum
 */
export function getCallTypeEnum(callType: 'audio' | 'video'): CallTypeEnum {
  // Import dynamically to avoid circular dependency
  const { CallTypeEnum } = require('@/enums')
  return callType === 'video' ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
}

/**
 * Get CSS grid class based on participant count
 */
export function getGridClass(participantCount: number): string {
  if (participantCount <= 2) return 'grid-1x1'
  if (participantCount <= 4) return 'grid-2x2'
  if (participantCount <= 6) return 'grid-2x3'
  if (participantCount <= 9) return 'grid-3x3'
  return 'grid-auto'
}

/**
 * Format call duration from seconds to HH:MM:SS or MM:SS
 */
export function formatCallDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format message timestamp to time string (HH:MM)
 */
export function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Get participant action menu options
 * Based on whether the current user is a host
 * Returns options compatible with Naive UI Dropdown
 */
export function getParticipantActions(isHost: boolean): Array<{
  label: string
  key: string
  icon: () => string
}> {
  const actions: Array<{
    label: string
    key: string
    icon: () => string
  }> = [
    {
      label: '发送私信',
      key: 'private-message',
      icon: () => '💬'
    }
  ]

  if (isHost) {
    actions.push(
      {
        label: '静音',
        key: 'mute',
        icon: () => '🔇'
      },
      {
        label: '移除',
        key: 'remove',
        icon: () => '🚪'
      }
    )
  }

  return actions
}

/**
 * Calculate network quality type and text based on connection metrics
 * This is a placeholder - actual implementation would use real network metrics
 */
export function getNetworkQuality(
  packetLoss?: number,
  bitrate?: number
): { type: 'success' | 'warning' | 'error' | 'default'; text: string } {
  if (packetLoss !== undefined && packetLoss > 10) {
    return { type: 'error', text: '差' }
  }
  if (packetLoss !== undefined && packetLoss > 5) {
    return { type: 'warning', text: '一般' }
  }
  if (bitrate !== undefined && bitrate < 300) {
    return { type: 'warning', text: '一般' }
  }
  return { type: 'success', text: '良好' }
}

/**
 * Get initials from a name for avatar display
 */
export function getNameInitials(name?: string): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (trimmed.length <= 2) return trimmed.toUpperCase()

  const parts = trimmed.split(' ')
  if (parts.length >= 2) {
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return (first + second).toUpperCase()
    }
  }
  return trimmed.substring(0, 2).toUpperCase()
}

/**
 * Validate call ID format
 */
export function isValidCallId(callId: string): boolean {
  // Basic validation - call ID should be non-empty and reasonable length
  return typeof callId === 'string' && callId.length > 0 && callId.length <= 256
}

/**
 * Sanitize room ID for use in call contexts
 */
export function sanitizeRoomId(roomId: string): string {
  // Remove any special characters that could cause issues
  return roomId.replace(/[^a-zA-Z0-9_-]/g, '_')
}
