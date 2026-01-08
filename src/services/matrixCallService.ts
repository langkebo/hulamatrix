/**
 * Matrix VoIP Call Service
 * This file has been refactored into modules for better maintainability.
 *
 * The service is now split into:
 * - src/services/matrix/call/types.ts - Type definitions and MatrixCall class
 * - src/services/matrix/call/call-manager.ts - Core call lifecycle and WebRTC
 * - src/services/matrix/call/media-controls.ts - Audio/video controls
 * - src/services/matrix/call/recording.ts - Call recording
 * - src/services/matrix/call/dtmf.ts - DTMF tone sending
 * - src/services/matrix/call/events.ts - Event management
 * - src/services/matrix/call/index.ts - Main orchestrator
 *
 * This file exports the main service for backward compatibility.
 */

// Re-export everything from the new modular structure
export * from './matrix/call/index'
