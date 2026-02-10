/**
 * Unified API Service
 * Replaces ImRequestUtils with properly typed, service-based APIs
 */

export { default as AuthApi } from './AuthApi'
export { default as FriendsApi } from './FriendsApi'
export { default as GroupsApi } from './GroupsApi'
export { default as MessagesApi } from './MessagesApi'
export { default as UserApi } from './UserApi'
export { default as SystemConfigApi } from './SystemConfigApi'

// Re-export all types from types.ts
export type * from './types'
