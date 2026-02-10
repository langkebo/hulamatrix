import MatrixClientService from './matrix/MatrixClientService'
import { getMatrixConfig } from '@/config/matrix'
import { isTauri } from '@tauri-apps/api/core'

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

interface RustWebSocketClient {
  initConnect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  getState(): ConnectionState
  sendMessage(type: string, data: any): Promise<void>
  setupBusinessMessageListeners(): void
}

const isTauriContext = () => isTauri()

const matrixWebSocketClient: RustWebSocketClient = {
  async initConnect(): Promise<void> {
    console.log('[webSocketRust] Initializing Matrix connection...')

    if (!isTauriContext()) {
      console.log('[webSocketRust] Browser environment - Matrix SDK initialization skipped')
      return
    }

    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      console.log('[webSocketRust] No Matrix client found, initializing...')
      const config = getMatrixConfig()
      if (!config.baseUrl) {
        console.error('[webSocketRust] No homeserver URL configured')
        return
      }
      const newClient = await clientService.createClient(config)
      if (!newClient) {
        console.log('[webSocketRust] Matrix client creation skipped in browser environment')
        return
      }
      await clientService.initCrypto()
    }

    await clientService.startClient()
    console.log('[webSocketRust] Matrix connection initialized')
  },

  async disconnect(): Promise<void> {
    console.log('[webSocketRust] Disconnecting Matrix connection...')
    const clientService = MatrixClientService.getInstance()
    await clientService.stopClient()
    console.log('[webSocketRust] Matrix connection disconnected')
  },

  isConnected(): boolean {
    const clientService = MatrixClientService.getInstance()
    return clientService.isConnected()
  },

  getState(): ConnectionState {
    const clientService = MatrixClientService.getInstance()
    const syncState = clientService.getSyncState()
    switch (syncState) {
      case 'PREPARED':
      case 'SYNCING':
        return ConnectionState.CONNECTED
      case 'INIT':
        return ConnectionState.DISCONNECTED
      case 'ERROR':
        return ConnectionState.ERROR
      default:
        return ConnectionState.DISCONNECTED
    }
  },

  async sendMessage(type: string, data: any): Promise<void> {
    console.log('[webSocketRust] sendMessage called:', type, data)
  },

  setupBusinessMessageListeners(): void {
    console.log('[webSocketRust] setupBusinessMessageListeners called')
  }
}

export default matrixWebSocketClient
