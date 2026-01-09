/**
 * Core Store - Re-export from Modular Architecture
 *
 * This file now re-exports from the refactored modular structure.
 * The original implementation has been split into:
 * - types.ts - Type definitions
 * - auth-state.ts - Authentication and user management
 * - room-state.ts - Room and chat management
 * - media-state.ts - File upload/download
 * - search-state.ts - Search functionality
 * - notification-state.ts - Notifications and rules
 * - call-state.ts - RTC calls
 * - cache-state.ts - Cache management with LRU
 * - settings-state.ts - App settings and UI
 * - store/index.ts - Main orchestrator
 */

// Re-export everything from the new modular structure
export * from './store/index'

// Re-export useAppStore as default export for backward compatibility
export { useAppStore } from './store/index'
