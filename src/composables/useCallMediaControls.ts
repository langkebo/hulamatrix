import { ref, type Ref } from 'vue'
import type { MediaStream, MediaStreamTrack } from '@/types/rtc'
import { logger } from '@/utils/logger'

interface UseCallMediaControlsOptions {
  localStream: Ref<MediaStream | null>
}

interface UseCallMediaControlsReturn {
  // States
  isMuted: Ref<boolean>
  isCameraOff: Ref<boolean>
  isScreenSharing: Ref<boolean>
  isTogglingScreenShare: Ref<boolean>

  // Actions
  toggleMute: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  stopScreenShare: () => Promise<void>

  // Helpers
  getAudioTrack: () => MediaStreamTrack | null
  getVideoTrack: () => MediaStreamTrack | null
}

/**
 * Composable for managing media controls in a call
 * Handles microphone, camera, and screen sharing
 */
export function useCallMediaControls(options: UseCallMediaControlsOptions): UseCallMediaControlsReturn {
  const { localStream } = options

  // States
  const isMuted = ref(false)
  const isCameraOff = ref(false)
  const isScreenSharing = ref(false)
  const isTogglingScreenShare = ref(false)

  /**
   * Get the audio track from the local stream
   */
  const getAudioTrack = (): MediaStreamTrack | null => {
    if (!localStream.value) return null
    return localStream.value.getAudioTracks().find((track: MediaStreamTrack) => track.kind === 'audio') || null
  }

  /**
   * Get the video track from the local stream
   */
  const getVideoTrack = (): MediaStreamTrack | null => {
    if (!localStream.value) return null
    return localStream.value.getVideoTracks().find((track: MediaStreamTrack) => track.kind === 'video') || null
  }

  /**
   * Toggle microphone mute state
   */
  const toggleMute = async () => {
    try {
      const audioTrack = getAudioTrack()
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        isMuted.value = !audioTrack.enabled
        logger.info('[useCallMediaControls] Microphone toggled:', isMuted.value ? 'muted' : 'unmuted')
      } else {
        logger.warn('[useCallMediaControls] No audio track found')
      }
    } catch (error) {
      logger.error('[useCallMediaControls] Failed to toggle microphone:', error)
    }
  }

  /**
   * Toggle camera on/off state
   */
  const toggleCamera = async () => {
    try {
      const videoTrack = getVideoTrack()
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        isCameraOff.value = !videoTrack.enabled
        logger.info('[useCallMediaControls] Camera toggled:', isCameraOff.value ? 'off' : 'on')
      } else {
        logger.warn('[useCallMediaControls] No video track found')
      }
    } catch (error) {
      logger.error('[useCallMediaControls] Failed to toggle camera:', error)
    }
  }

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = async () => {
    if (isTogglingScreenShare.value) {
      return
    }

    isTogglingScreenShare.value = true

    try {
      if (isScreenSharing.value) {
        await stopScreenShare()
      } else {
        // Start screen share logic would be handled by the caller
        // This composable just manages the state
        isScreenSharing.value = true
        logger.info('[useCallMediaControls] Screen sharing started')
      }
    } catch (error) {
      logger.error('[useCallMediaControls] Failed to toggle screen share:', error)
    } finally {
      isTogglingScreenShare.value = false
    }
  }

  /**
   * Stop screen sharing
   */
  const stopScreenShare = async () => {
    try {
      // Stop screen share logic would be handled by the caller
      isScreenSharing.value = false
      logger.info('[useCallMediaControls] Screen sharing stopped')
    } catch (error) {
      logger.error('[useCallMediaControls] Failed to stop screen share:', error)
    }
  }

  return {
    // States
    isMuted,
    isCameraOff,
    isScreenSharing,
    isTogglingScreenShare,

    // Actions
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    stopScreenShare,

    // Helpers
    getAudioTrack,
    getVideoTrack
  }
}
