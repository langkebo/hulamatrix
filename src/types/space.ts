export interface SpaceInfo {
  roomId: string
  name: string
  topic?: string
  avatar?: string
  canonicalAlias?: string
  memberCount: number
  isPublic: boolean
  isDirect?: boolean
  parentId?: string
  children?: SpaceInfo[]
  lastActive?: number
  createdAt?: number
}

export interface SpaceCreateParams {
  name: string
  topic?: string
  isPublic?: boolean
  inviteUsers?: string[]
  avatar?: string
}

export interface SpaceHierarchyNode {
  roomId: string
  name: string
  avatar?: string
  topic?: string
  type: 'space' | 'room'
  memberCount: number
  isPublic: boolean
  parentId?: string
  depth?: number
  children?: SpaceHierarchyNode[]
  canJoin?: boolean
  canInvite?: boolean
  suggested?: boolean
}

export interface SpaceMemberInfo {
  userId: string
  displayName?: string
  avatarUrl?: string
  role: 'owner' | 'admin' | 'member'
  membership?: string
  joinedAt?: number
}

export interface SpaceRoomInfo {
  roomId: string
  name: string
  avatar?: string
  topic?: string
  memberCount: number
  addedAt?: number
  isCanonical?: boolean
}

export interface SpaceNotificationSettings {
  roomId: string
  enabled: boolean
  level: 'all' | 'mentions' | 'none'
  soundEnabled: boolean
  keywords: string[]
  ignoreUsers: string[]
}
