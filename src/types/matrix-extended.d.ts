import { CallEvent } from 'matrix-js-sdk'

export const CallType = {
  Voice: 'voice' as const,
  Video: 'video' as const
}

export type CallTypeValue = typeof CallType.Voice | typeof CallType.Video

export const CallState = {
  Fledgling: 'fledgling' as const,
  InviteSent: 'invite_sent' as const,
  WaitLocalMedia: 'wait_local_media' as const,
  CreateOffer: 'create_offer' as const,
  CreateAnswer: 'create_answer' as const,
  Connecting: 'connecting' as const,
  Connected: 'connected' as const,
  Ringing: 'ringing' as const,
  Ended: 'ended' as const
}

export type CallStateValue =
  | typeof CallState.Fledgling
  | typeof CallState.InviteSent
  | typeof CallState.WaitLocalMedia
  | typeof CallState.CreateOffer
  | typeof CallState.CreateAnswer
  | typeof CallState.Connecting
  | typeof CallState.Connected
  | typeof CallState.Ringing
  | typeof CallState.Ended

export const CallErrorCode = {
  UserHangup: 'user_hangup' as const,
  NoUserMedia: 'no_user_media' as const,
  UnknownDevices: 'unknown_devices' as const,
  LocalOfferFailed: 'local_offer_failed' as const,
  SendInvite: 'send_invite' as const,
  CreateAnswer: 'create_answer' as const,
  CreateOffer: 'create_offer' as const,
  SendAnswer: 'send_answer' as const,
  SetRemoteDescription: 'set_remote_description' as const,
  SetLocalDescription: 'set_local_description' as const,
  AnsweredElsewhere: 'answered_elsewhere' as const,
  IceFailed: 'ice_failed' as const,
  InviteTimeout: 'invite_timeout' as const,
  Replaced: 'replaced' as const,
  SignallingFailed: 'signalling_timeout' as const,
  UserBusy: 'user_busy' as const,
  Transferred: 'transferred' as const,
  NewSession: 'new_session' as const
}

export type CallErrorCodeValue =
  | typeof CallErrorCode.UserHangup
  | typeof CallErrorCode.NoUserMedia
  | typeof CallErrorCode.UnknownDevices
  | typeof CallErrorCode.LocalOfferFailed
  | typeof CallErrorCode.SendInvite
  | typeof CallErrorCode.CreateAnswer
  | typeof CallErrorCode.CreateOffer
  | typeof CallErrorCode.SendAnswer
  | typeof CallErrorCode.SetRemoteDescription
  | typeof CallErrorCode.SetLocalDescription
  | typeof CallErrorCode.AnsweredElsewhere
  | typeof CallErrorCode.IceFailed
  | typeof CallErrorCode.InviteTimeout
  | typeof CallErrorCode.Replaced
  | typeof CallErrorCode.SignallingFailed
  | typeof CallErrorCode.UserBusy
  | typeof CallErrorCode.Transferred
  | typeof CallErrorCode.NewSession

export const SDPStreamMetadataPurpose = {
  Usermedia: 'm.usermedia' as const,
  Screenshare: 'm.screenshare' as const
}

export type SDPStreamMetadataPurposeValue =
  | typeof SDPStreamMetadataPurpose.Usermedia
  | typeof SDPStreamMetadataPurpose.Screenshare

export const RoomType = {
  Direct: 'direct' as const,
  Public: 'public' as const,
  Private: 'private' as const,
  Space: 'space' as const
}

export type RoomTypeValue =
  | typeof RoomType.Direct
  | typeof RoomType.Public
  | typeof RoomType.Private
  | typeof RoomType.Space

export interface CallFeed {
  stream: MediaStream
  purpose: SDPStreamMetadataPurposeValue
  isLocal(): boolean
  isAudioMuted(): boolean
  isVideoMuted(): boolean
}

export interface MatrixCallEventHandlers {
  [CallEvent.State]: (state: CallStateValue, oldState: CallStateValue) => void
  [CallEvent.Hangup]: () => void
  [CallEvent.Replaced]: () => void
  [CallEvent.Error]: (error: Error) => void
  [CallEvent.FeedsChanged]: (feeds: CallFeed[]) => void
}

export interface SpaceChild {
  roomId: string
  name: string
  avatarUrl?: string
  type: RoomTypeValue
  isPublic: boolean
  memberCount: number
  children?: SpaceChild[]
}

export interface SpaceInfo {
  spaceId: string
  name: string
  avatarUrl?: string
  topic?: string
  description?: string
  isPublic: boolean
  allowedGuestAccess?: boolean
  joinRule?: string
  children: SpaceChild[]
  parentIds: string[]
}

export interface HierarchicalRoom {
  roomId: string
  name: string
  avatarUrl?: string
  type: RoomTypeValue
  isPublic: boolean
  isJoined: boolean
  children: HierarchicalRoom[]
  depth: number
  via?: string[]
}

export interface CryptoKeyBackupInfo {
  version: string
  algorithm: string
  authData: Record<string, unknown>
  recoveryKey?: string
}

export interface CrossSigningInfo {
  userId: string
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
  trustedBy?: string[]
}

export interface PushRule {
  ruleId: string
  enabled: boolean
  pattern?: string
  conditions?: Record<string, unknown>[]
  actions: string[]
}

export interface PushRules {
  global: {
    override: PushRule[]
    room: PushRule[]
    sender: PushRule[]
    content: PushRule[]
    underride: PushRule[]
  }
}

export interface PrivacySettings {
  readReceiptsEnabled: boolean
  typingNotificationsEnabled: boolean
  presenceEnabled: boolean
  linkPreviewsEnabled: boolean
}
