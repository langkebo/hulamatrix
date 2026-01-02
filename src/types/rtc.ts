// Re-export WebRTC types for easier importing
export type MediaStream = globalThis.MediaStream
export type MediaStreamTrack = globalThis.MediaStreamTrack
export type RTCPeerConnection = globalThis.RTCPeerConnection
export type RTCSessionDescription = globalThis.RTCSessionDescription
export type RTCIceCandidate = globalThis.RTCIceCandidate
export type RTCDataChannel = globalThis.RTCDataChannel
export type RTCTrackEvent = globalThis.RTCTrackEvent
export type RTCStatsReport = globalThis.RTCStatsReport
export type MediaStreamConstraints = globalThis.MediaStreamConstraints
export type MediaTrackConstraints = globalThis.MediaTrackConstraints
export type MediaTrackCapabilities = globalThis.MediaTrackCapabilities
export type MediaTrackSettings = globalThis.MediaTrackSettings

// WebRTC event types
export interface RTCCallEvent {
  type: string
  data: Record<string, unknown> | { offer?: { sdp?: string }; answer?: { sdp?: string } }
}

// Call state types
export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'hold' | 'ended' | 'failed'
export type CallType = 'audio' | 'video' | 'screen'
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor'

// Participant state
export type ParticipantState = 'connecting' | 'connected' | 'disconnected' | 'muted' | 'video-off'

// WebRTC configuration
export interface RTCConfiguration {
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
  bundlePolicy?: RTCBundlePolicy
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
  iceCandidatePoolSize?: number
}
