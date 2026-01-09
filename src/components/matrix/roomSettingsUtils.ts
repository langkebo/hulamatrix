/**
 * Room Settings Helper Utilities
 *
 * Utility functions for RoomSettings component
 * Provides helper methods for displaying room and member information
 */

/**
 * Get human-readable description for join rule
 */
export function getJoinRuleDescription(rule: string): string {
  const descriptions: Record<string, string> = {
    public: '任何人都可以加入房间',
    invite: '只有被邀请的用户才能加入',
    knock: '用户可以申请加入，需要管理员批准',
    restricted: '只有特定用户可以加入'
  }
  return descriptions[rule] || ''
}

/**
 * Get human-readable description for guest access
 */
export function getGuestAccessDescription(access: string): string {
  const descriptions: Record<string, string> = {
    can_join: '访客可以加入房间',
    forbidden: '禁止访客访问'
  }
  return descriptions[access] || ''
}

/**
 * Get human-readable description for history visibility
 */
export function getHistoryVisibilityDescription(visibility: string): string {
  const descriptions: Record<string, string> = {
    world_readable: '任何人都可以查看历史消息',
    shared: '成员可以查看加入前的历史消息',
    invited: '受邀者可以查看历史消息',
    joined: '只能查看加入后的历史消息'
  }
  return descriptions[visibility] || ''
}

/**
 * Get member initials for avatar display
 */
export function getMemberInitials(displayName: string, userId: string): string {
  const name = displayName || userId
  if (!name) return '?'
  const names = name.split(' ')
  if (names.length >= 2) {
    const first = names[0]
    const second = names[1]
    if (first && second) {
      const firstChar = first[0]
      const secondChar = second[0]
      if (firstChar !== undefined && secondChar !== undefined) {
        return firstChar + secondChar
      }
    }
  }
  return name.substring(0, 2).toUpperCase()
}

/**
 * Get human-readable text for membership status
 */
export function getMembershipText(membership: string): string {
  const texts: Record<string, string> = {
    join: '已加入',
    invite: '已邀请',
    leave: '已离开',
    ban: '已封禁',
    knock: '申请中'
  }
  return texts[membership] || membership
}

/**
 * Get tag type for membership status
 */
export function getMembershipTagType(membership: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const types: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    join: 'success',
    invite: 'info',
    leave: 'default',
    ban: 'error',
    knock: 'warning'
  }
  return types[membership] || 'default'
}

/**
 * Get role name for power level
 */
export function getPowerLevelRole(powerLevel: number): string {
  if (powerLevel >= 100) return '房主'
  if (powerLevel >= 50) return '管理员'
  if (powerLevel >= 10) return '版主'
  return '成员'
}

/**
 * Get formatted event type display name
 */
export function getEventTypeDisplayName(eventType: string): string {
  const typeMap: Record<string, string> = {
    'm.room.message': '消息',
    'm.room.member': '成员变化',
    'm.room.name': '房间名称',
    'm.room.topic': '房间主题',
    'm.room.avatar': '房间头像',
    'm.room.power_levels': '权限等级',
    'm.room.join_rules': '加入规则',
    'm.room.guest_access': '访客访问',
    'm.room.history_visibility': '历史记录可见性',
    'm.room.encrypted': '加密设置',
    'm.reaction': '反应',
    'm.redaction': '撤回',
    'm.typing': '正在输入'
  }
  return typeMap[eventType] || eventType
}

/**
 * Format user ID for display
 */
export function formatUserId(userId: string): string {
  // Extract username from Matrix ID (@username:server.com)
  const match = userId.match(/^@([^:]+):/)
  return match ? match[1] : userId
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format time to HH:MM format
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
