// Vue 文件类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/App.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Mobile 路径别名 (#/* -> src/mobile/*) 类型声明
declare module '#/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '#/*/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '#/*/*/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '#/*/*/*/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// src/layout 路径别名类型声明
declare module '@/layout/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/layout/*/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// vue-cropper 类型声明
declare module 'vue-cropper' {
  import { DefineComponent } from 'vue'

  export interface CropperData {
    x: number
    y: number
    width: number
    height: number
  }

  export interface CropperOptions {
    info: boolean
    size: boolean
    outputSize: number
    outputType: string
    scale: boolean
    full: boolean
    canMove: boolean
    canMoveBox: boolean
    original: boolean
    autoCrop: boolean
    autoCropWidth: number
    autoCropHeight: number
    fixedBox: boolean
    fixed: boolean
    fixedNumber: number[]
    centerBox: boolean
    infoTrue: boolean
    high: boolean
    max: number
    enlarge: number
    mode: string
  }

  const VueCropper: DefineComponent<
    {
      img: string
      outputSize?: number
      outputType?: string
      info?: boolean
      full?: boolean
      canMove?: boolean
      canMoveBox?: boolean
      original?: boolean
      autoCrop?: boolean
      autoCropWidth?: number
      autoCropHeight?: number
      fixedBox?: boolean
      fixed?: boolean
      fixedNumber?: number[]
      centerBox?: boolean
      infoTrue?: boolean
      mode?: string
      max?: number
      enlarge?: number
    },
    {
      startCrop: () => void
      stopCrop: () => void
      clearCrop: () => void
      rotateLeft: () => void
      rotateRight: () => void
      refresh: () => void
      realTime: (data: CropperData) => void
      cropMoving: (data: CropperData) => void
      cropImage: (type?: string) => string
      getCropAxis: () => { x1: number; y1: number; x2: number; y2: number }
      getCropData: (type?: string) => CropperData
    },
    unknown,
    {},
    {}
  >

  export default VueCropper
}

// tlbs-map-vue 类型声明
declare module 'tlbs-map-vue' {
  import { DefineComponent } from 'vue'

  export interface MapOptions {
    center?: [number, number]
    zoom?: number
    mapType?: string
  }

  const TlbsMap: DefineComponent<
    {
      center?: [number, number]
      zoom?: number
      width?: string | number
      height?: string | number
      mapType?: string
      apiKey?: string
    },
    {
      load: () => Promise<void>
      destroy: () => void
      setCenter: (center: [number, number]) => void
      setZoom: (zoom: number) => void
    },
    unknown,
    {},
    {}
  >

  export default TlbsMap
}

// 其他可能缺失的模块声明
declare module 'hula-emojis' {
  export const emojis: Record<string, string>
  export function getEmoji(code: string): string
  export function getAllEmojis(): Record<string, string>
}

declare module 'digest-wasm' {
  export const Md5: {
    digest_u8: (data: Uint8Array) => Promise<string>
  }
}

declare module 'stream-markdown' {
  import { DefineComponent } from 'vue'

  export default DefineComponent<{
    content: string
    theme?: string
    breaks?: boolean
    linkify?: boolean
    typographer?: boolean
  }>
}

// Matrix integration module declarations
declare module '@/integrations/matrix/client' {
  import type { IMatrixClientService, MatrixLoginResponse } from '@/types/matrix'

  export type MatrixCredentials = {
    baseUrl: string
    accessToken?: string
    refreshToken?: string
    userId?: string
    deviceId?: string
    homeserver?: string
  }

  export class MatrixClientService implements IMatrixClientService {
    getClient(): Record<string, unknown> | null
    initialize(credentials: MatrixCredentials): Promise<void>
    stopClient(): Promise<void>
    startClient(options?: { initialSyncLimit?: number; pollTimeout?: number }): Promise<void>
    setBaseUrl(url: string): void
    getBaseUrl(): string | null
    loginWithPassword(username: string, password: string): Promise<MatrixLoginResponse>
    registerWithPassword(username: string, password: string): Promise<MatrixLoginResponse>
    // Backward compatibility aliases
    start(options?: { initialSyncLimit?: number; pollTimeout?: number }): Promise<void>
    stop(): Promise<void>
    getSyncState(): string
    isClientInitialized(): boolean
    // Message methods
    sendTextMessage(roomId: string, text: string, relatesTo?: { eventId: string }): Promise<string>
    sendMediaMessage(
      roomId: string,
      file: File | Blob,
      filename: string,
      mimeType: string,
      relatesTo?: { eventId: string }
    ): Promise<string>
    sendReadReceipt(roomId: string, eventId: string): Promise<void>
    // Account settings methods
    setAccountSetting(key: string, value: unknown, level?: 'account' | 'device' | 'defaults'): Promise<void>
    getAccountSetting<T = unknown>(key: string): Promise<T | undefined>
    getAllAccountSettings(): Promise<Record<string, unknown>>
    rollbackAccountSettings(): Promise<boolean>
    // Crypto
    getCrypto(): unknown
    // Settings history
    lastSettingsSnapshot: Record<string, unknown>
    // Test helper
    setTestClient(client: Record<string, unknown> | null): void
  }
  
  export const matrixClientService: MatrixClientService
  export const initializeMatrixBridges: () => void
}

declare module '@/integrations/matrix/spaces' {
  export const Space: Record<string, unknown>
  export const SpaceMember: Record<string, unknown>
  export const SpaceSettings: Record<string, unknown>
  export class MatrixSpacesManager {
    constructor(client: Record<string, unknown>)
  }
  export const createMatrixSpacesManager: (client: Record<string, unknown>) => Record<string, unknown>
  export const Room: Record<string, unknown>
}

declare module '@/utils/logger' {
  export const logger: {
    debug: (message: string, data?: unknown, context?: string) => void
    info: (message: string, data?: unknown, context?: string) => void
    warn: (message: string, data?: unknown, context?: string) => void
    error: (message: string, data?: unknown, context?: string) => void
  }
}
