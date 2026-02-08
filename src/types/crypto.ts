export interface KeyBackupInfo {
  version: string
  algorithm: string
  authData: {
    private_key_salt: string
    private_key_iterations: number
    iv: string
    mac: string
  }
  count: number
  etag: string
  uploads: number
}

export interface KeyBackupVersion {
  version: string
  algorithm: string
  authData: {
    private_key_salt: string
    private_key_iterations: number
    iv: string
    mac: string
  }
  count: number
  etag: string
  uploads: number
}

export interface RecoveryKey {
  key: string
  algorithm: string
}

export interface CrossSigningInfo {
  master_key: {
    user_id: string
    usage: string[]
    keys: Record<string, string>
    signatures: Record<string, Record<string, string>>
  }
  self_signing_key: {
    user_id: string
    usage: string[]
    keys: Record<string, string>
    signatures: Record<string, Record<string, string>>
  }
  user_signing_key: {
    user_id: string
    usage: string[]
    keys: Record<string, string>
    signatures: Record<string, Record<string, string>>
  }
}

export type CrossSigningStatus = 'not_setup' | 'incomplete' | 'complete' | 'cross_signing_off'

export interface EncryptionSettings {
  enabled: boolean
  verifiedDevices: number
  unverifiedDevices: number
  blacklistedUnverifiedDevices: number
}

export interface DeviceVerificationInfo {
  deviceId: string
  userId: string
  verified: boolean
  blocked: boolean
  keyInfo?: {
    ed25519: string
    curve25519: string
  }
}
