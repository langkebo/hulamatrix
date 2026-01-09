import { ref, type Ref, onUnmounted } from 'vue'
import { logger } from '@/utils/logger'

interface UseCallStateOptions {
  autoStart?: boolean
}

interface UseCallStateReturn {
  // States
  callState: Ref<'calling' | 'connected' | 'ended'>
  callDuration: Ref<number>
  isConnected: Ref<boolean>

  // Actions
  startCall: () => void
  endCall: () => void
  resetState: () => void

  // Helpers
  formatDuration: (seconds: number) => string
}

/**
 * Composable for managing call state and duration
 * Handles call lifecycle and duration tracking
 */
export function useCallState(options: UseCallStateOptions = {}): UseCallStateReturn {
  const { autoStart = false } = options

  // States
  const callState = ref<'calling' | 'connected' | 'ended'>('calling')
  const callDuration = ref(0)
  const isConnected = ref(false)

  let durationTimer: ReturnType<typeof setInterval> | null = null
  let startTime: number | null = null

  /**
   * Format duration in seconds to HH:MM:SS or MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Start the call duration timer
   */
  const startCallTimer = () => {
    if (durationTimer) {
      return
    }

    startTime = Date.now()
    durationTimer = setInterval(() => {
      if (startTime) {
        callDuration.value = Math.floor((Date.now() - startTime) / 1000)
      }
    }, 1000)

    logger.info('[useCallState] Call timer started')
  }

  /**
   * Stop the call duration timer
   */
  const stopCallTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
      startTime = null
      logger.info('[useCallState] Call timer stopped')
    }
  }

  /**
   * Start the call
   */
  const startCall = () => {
    callState.value = 'connected'
    isConnected.value = true
    startCallTimer()
    logger.info('[useCallState] Call started')
  }

  /**
   * End the call
   */
  const endCall = () => {
    callState.value = 'ended'
    isConnected.value = false
    stopCallTimer()
    logger.info('[useCallState] Call ended')
  }

  /**
   * Reset call state to initial values
   */
  const resetState = () => {
    callState.value = 'calling'
    callDuration.value = 0
    isConnected.value = false
    stopCallTimer()
    logger.info('[useCallState] Call state reset')
  }

  // Auto-start if configured
  if (autoStart) {
    startCall()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopCallTimer()
  })

  return {
    // States
    callState,
    callDuration,
    isConnected,

    // Actions
    startCall,
    endCall,
    resetState,

    // Helpers
    formatDuration
  }
}
