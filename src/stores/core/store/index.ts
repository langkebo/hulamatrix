/**
 * Core Store - Main Orchestrator
 *
 * This file creates and exports the main application store that combines
 * all the state managers into a unified interface.
 */

import { AuthStateManager } from '../auth-state'
import { RoomStateManager } from '../room-state'
import { SearchStateManager } from '../search-state'
import { MediaStateManager } from '../media-state'
import { NotificationStateManager } from '../notification-state'
import { CallStateManager } from '../call-state'
import { CacheStateManager } from '../cache-state'
import { SettingsStateManager } from '../settings-state'

// Create singleton instances of state managers
const authState = new AuthStateManager()
const roomState = new RoomStateManager(
  () => authState.client.value,
  () => authState.auth.value.userId
)
const searchState = new SearchStateManager(
  () => authState.client.value,
  () => authState.users.value,
  () => roomState.rooms.value
)
const mediaState = new MediaStateManager(() => authState.client.value)
const notificationState = new NotificationStateManager()
const callState = new CallStateManager(() => authState.client.value)
const cacheState = new CacheStateManager()
const settingsState = new SettingsStateManager()

/**
 * Main application store composable
 * Provides access to all state managers
 */
export function useAppStore() {
  return {
    auth: authState,
    room: roomState,
    search: searchState,
    media: mediaState,
    notification: notificationState,
    call: callState,
    cache: cacheState,
    settings: settingsState
  }
}

// Export types for TypeScript users
export type { AuthStateManager, RoomStateManager, SearchStateManager } from '../auth-state'
export type { MediaStateManager } from '../media-state'
export type { NotificationStateManager } from '../notification-state'
export type { CallStateManager } from '../call-state'
export type { CacheStateManager } from '../cache-state'
export type { SettingsStateManager } from '../settings-state'

// Re-export all types from types.ts
export * from '../types'
