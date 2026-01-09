/**
 * Chat Store - Refactored
 *
 * This file has been refactored into a modular architecture for better maintainability.
 * All functionality is now organized into focused modules under ./chat/
 *
 * Architecture:
 * - types.ts - Type definitions and interfaces
 * - session-state.ts - Session list, session map, CRUD operations
 * - message-state.ts - Message map, loading, pagination
 * - unread-state.ts - Unread count tracking and persistence
 * - recall-state.ts - Message recall/cancel functionality
 * - thread-state.ts - Thread/message relation handling
 * - worker-manager.ts - Background worker management
 * - index.ts - Main orchestrator
 *
 * @module ChatStore
 */

// Re-export everything from the new modular structure
export * from './chat/index'
