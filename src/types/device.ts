export interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenIp?: string
  lastSeenTs?: number
  verified: boolean
  isCurrentDevice: boolean
}

export interface DeviceList {
  devices: DeviceInfo[]
  currentDeviceId: string
}

export interface DeviceUpdateParams {
  deviceId: string
  displayName: string
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

export interface DeviceDisplayInfo {
  id: string
  name: string
  type: DeviceType
  lastActive: string
  isCurrent: boolean
  verified: boolean
}
