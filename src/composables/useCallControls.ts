/**
 * useCallControls - Shared WebRTC call controls composable
 *
 * This composable extracts common call control logic that can be shared
 * between desktop and mobile call interface components.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate RTC components
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useWebRtc } from '@/hooks/useWebRtc'
import { CallTypeEnum } from '@/enums'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import type { MediaStream } from '@/types/rtc'

export interface CallControlsOptions {
  roomId: string
  remoteUserId: string
  callType: 'audio' | 'video'
  isInitiator: boolean
}

export interface CallControlsResult {
  // State
  callState: Ref<'calling' | 'connected' | 'ended'>
  callDuration: Ref<number>
  localStream: Ref<MediaStream | null>
  remoteStream: Ref<MediaStream | null>

  // Device states
  isMuted: Ref<boolean>
  isCameraOff: Ref<boolean>
  isSpeakerOn: Ref<boolean>
  isLocalVideoHidden: Ref<boolean>

  // WebRTC instance
  rtc: ReturnType<typeof useWebRtc>

  // Computed
  callStatusText: Ref<string>
  formattedDuration: Ref<string>

  // Call control methods
  startCall: () => Promise<void>
  endCall: () => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => Promise<void>

  // Media control methods
  toggleMicrophone: () => void
  toggleCamera: () => void
  toggleSpeaker: (videoRef?: Ref<HTMLVideoElement | undefined>) => void
  toggleLocalVideo: () => void
  switchCamera: () => Promise<void>

  // Timer methods
  startCallTimer: () => void
  stopCallTimer: () => void

  // Utilities
  formatCallDuration: (seconds: number) => string
  getCallStatusText: () => string
}

/**
 * Composable for shared call control logic
 */
export function useCallControls(options: CallControlsOptions): CallControlsResult {
  const message = msg

  // WebRTC hook
  const rtc = useWebRtc(
    options.roomId,
    options.remoteUserId,
    options.callType === 'audio' ? CallTypeEnum.AUDIO : CallTypeEnum.VIDEO,
    !options.isInitiator
  )

  // State
  const callState = ref<'calling' | 'connected' | 'ended'>('calling')
  const callDuration = ref(0)
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)

  // Device states
  const isMuted = ref(false)
  const isCameraOff = ref(false)
  const isSpeakerOn = ref(true)
  const isLocalVideoHidden = ref(false)

  // Timer
  let callTimer: NodeJS.Timeout | null = null

  // Computed
  const callStatusText = computed(() => getCallStatusText())
  const formattedDuration = computed(() => formatCallDuration(callDuration.value))

  /**
   * Get call status text
   */
  const getCallStatusText = (): string => {
    switch (callState.value) {
      case 'calling':
        return '正在呼叫...'
      case 'connected':
        return '通话中'
      case 'ended':
        return '已结束'
      default:
        return '未知状态'
    }
  }

  /**
   * Format call duration
   */
  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }

  /**
   * Start a call
   */
  const startCall = async (): Promise<void> => {
    try {
      // Get local media stream
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: options.callType === 'video' ? { facingMode: 'user' } : false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)

      // Start WebRTC call
      if (options.isInitiator) {
        await rtc.startCall(options.roomId, options.callType === 'audio' ? CallTypeEnum.AUDIO : CallTypeEnum.VIDEO, [
          options.remoteUserId
        ])
      }

      callState.value = 'connected'
      startCallTimer()
    } catch (error) {
      logger.error('[useCallControls] Failed to start call:', error)
      message.error('无法启动通话')
      await endCall()
    }
  }

  /**
   * End a call
   */
  const endCall = async (): Promise<void> => {
    try {
      // Stop local stream
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
        localStream.value = null
      }

      // End WebRTC call
      await rtc.handleCallResponse(2)

      callState.value = 'ended'
      stopCallTimer()
    } catch (error) {
      logger.error('[useCallControls] Failed to end call:', error)
    }
  }

  /**
   * Accept an incoming call
   */
  const acceptCall = async (): Promise<void> => {
    try {
      // Get local media stream
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: options.callType === 'video' ? { facingMode: 'user' } : false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)

      // Answer the call
      await rtc.handleCallResponse(1)

      callState.value = 'connected'
      startCallTimer()
    } catch (error) {
      logger.error('[useCallControls] Failed to accept call:', error)
      message.error('无法接听通话')
      await endCall()
    }
  }

  /**
   * Reject an incoming call
   */
  const rejectCall = async (): Promise<void> => {
    try {
      await rtc.handleCallResponse(2)
      callState.value = 'ended'
    } catch (error) {
      logger.error('[useCallControls] Failed to reject call:', error)
    }
  }

  /**
   * Toggle microphone
   */
  const toggleMicrophone = (): void => {
    if (localStream.value) {
      const audioTracks = localStream.value.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !isMuted.value
      })
      isMuted.value = !isMuted.value
    }
  }

  /**
   * Toggle camera
   */
  const toggleCamera = (): void => {
    if (localStream.value) {
      const videoTracks = localStream.value.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !isCameraOff.value
      })
      isCameraOff.value = !isCameraOff.value
    }
  }

  /**
   * Toggle speaker
   */
  const toggleSpeaker = (videoRef?: Ref<HTMLVideoElement | undefined>): void => {
    if (videoRef?.value) {
      videoRef.value.muted = isSpeakerOn.value
      isSpeakerOn.value = !isSpeakerOn.value
    }
  }

  /**
   * Toggle local video visibility
   */
  const toggleLocalVideo = (): void => {
    isLocalVideoHidden.value = !isLocalVideoHidden.value
  }

  /**
   * Switch camera (front/back)
   */
  const switchCamera = async (): Promise<void> => {
    try {
      if (localStream.value) {
        const videoTracks = localStream.value.getVideoTracks()
        if (videoTracks.length > 0) {
          const track = videoTracks[0]
          const constraints = typeof track.getConstraints === 'function' ? track.getConstraints() : {}

          // Switch between front and back camera
          const newConstraints = {
            ...constraints,
            facingMode: constraints.facingMode === 'user' ? 'environment' : 'user'
          }

          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: localStream.value.getAudioTracks().length > 0,
            video: newConstraints
          })

          // Replace stream
          localStream.value = newStream

          // Stop old track
          videoTracks.forEach((track) => track.stop())
        }
      }
    } catch (error) {
      logger.error('[useCallControls] Failed to switch camera:', error)
      message.error('切换摄像头失败')
    }
  }

  /**
   * Start call timer
   */
  const startCallTimer = (): void => {
    callTimer = setInterval(() => {
      callDuration.value++
    }, 1000)
  }

  /**
   * Stop call timer
   */
  const stopCallTimer = (): void => {
    if (callTimer) {
      clearInterval(callTimer)
      callTimer = null
    }
  }

  // Sync remote stream from rtc
  watch(
    rtc.remoteStream,
    (stream) => {
      remoteStream.value = stream
    },
    { immediate: true }
  )

  return {
    // State
    callState,
    callDuration,
    localStream,
    remoteStream,

    // Device states
    isMuted,
    isCameraOff,
    isSpeakerOn,
    isLocalVideoHidden,

    // WebRTC instance
    rtc,

    // Computed
    callStatusText,
    formattedDuration,

    // Call control methods
    startCall,
    endCall,
    acceptCall,
    rejectCall,

    // Media control methods
    toggleMicrophone,
    toggleCamera,
    toggleSpeaker,
    toggleLocalVideo,
    switchCamera,

    // Timer methods
    startCallTimer,
    stopCallTimer,

    // Utilities
    formatCallDuration,
    getCallStatusText
  }
}

/**
 * Helper function to get default media constraints for call type
 */
export function getMediaConstraints(
  callType: 'audio' | 'video',
  facingMode?: 'user' | 'environment'
): MediaStreamConstraints {
  return {
    audio: true,
    video: callType === 'video' ? { facingMode: facingMode || 'user' } : false
  }
}
