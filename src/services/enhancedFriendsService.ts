/**
 * Enhanced Friends Service - Refactored
 *
 * This file has been refactored into a modular architecture for better maintainability.
 * All functionality is now organized into focused modules under ./friends/
 *
 * Architecture:
 * - types.ts - Type definitions
 * - presence.ts - Presence tracking and caching
 * - ignored-users.ts - Ignore/unignore functionality
 * - friend-list.ts - Friend list operations
 * - friend-requests.ts - Friend request management
 * - friend-management.ts - Friend CRUD operations
 * - categories.ts - Category management
 * - index.ts - Main orchestrator
 *
 * @module EnhancedFriendsService
 */

// Re-export everything from the new modular structure
export * from './friends/index'
