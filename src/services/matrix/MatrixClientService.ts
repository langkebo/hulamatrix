import { createClient, ClientEvent, type MatrixClient, IndexedDBStore, type ICreateClientOpts } from 'matrix-js-sdk'
import { isTauri } from '@tauri-apps/api/core'
import IndexedDBWorker from '@/workers/indexeddb.worker?worker'
import { getMatrixConfig, setMatrixConfig, clearMatrixConfig } from '@/config/matrix'
import type { MatrixConfig, SyncState } from '@/types/matrix'
import type { IndexedDBCryptoStore } from '@/types/global'

const isTauriContext = () => isTauri()

interface ExtendedMatrixClient extends MatrixClient {
  getFriendSystemManager?(): unknown
}

function createCryptoStore(): (new (db: IDBFactory, storeName: string) => IndexedDBCryptoStore) | undefined {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return undefined
  }
  const storeClass = window.IndexedDBCryptoStore
  return storeClass
}

class MatrixClientService {
  private static instance: MatrixClientService
  private client: MatrixClient | null = null
  private syncState: SyncState = 'INIT'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  private constructor() {}

  static getInstance(): MatrixClientService {
    if (!MatrixClientService.instance) {
      MatrixClientService.instance = new MatrixClientService()
    }
    return MatrixClientService.instance
  }

  async createClient(config?: Partial<MatrixConfig>): Promise<MatrixClient | null> {
    const matrixConfig = { ...getMatrixConfig(), ...config }

    if (!matrixConfig.baseUrl) {
      throw new Error('Matrix homeserver URL is required')
    }

    if (!isTauriContext()) {
      console.warn('[MatrixClientService] Running in browser environment - Matrix SDK initialization skipped')
      return null
    }

    // Initialize worker factory for IndexedDB
    const workerFactory = () => new IndexedDBWorker()

    const clientOptions: ICreateClientOpts = {
      baseUrl: matrixConfig.baseUrl,
      accessToken: matrixConfig.accessToken,
      userId: matrixConfig.userId,
      deviceId: matrixConfig.deviceId
    }

    const storeClass = createCryptoStore()
    if (storeClass && typeof window !== 'undefined' && window.indexedDB) {
      ;(clientOptions as any).cryptoStore = new storeClass(window.indexedDB, 'matrix-js-sdk:crypto')
    }

    // Use IndexedDBStore with worker support
    if (typeof window !== 'undefined' && window.indexedDB) {
      clientOptions.store = new IndexedDBStore({
        indexedDB: window.indexedDB,
        localStorage: window.localStorage,
        dbName: 'matrix-js-sdk:riot-web-sync',
        workerFactory
      })
    }

    this.client = createClient(clientOptions)

    this.setupEventListeners()

    return this.client
  }

  async initCrypto(): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.client.initRustCrypto()
    } catch (error) {
      console.error('Failed to initialize crypto:', error)
      throw error
    }
  }

  async startClient(options?: { initialSyncLimit?: number; useSlidingSync?: boolean }): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    const config = getMatrixConfig()

    // Enable Sliding Sync if requested or configured
    // TODO: Update Sliding Sync implementation to match latest SDK. Currently disabled due to API mismatch (SlidingSync constructor args).
    const useSlidingSync = options?.useSlidingSync ?? false

    try {
      if (useSlidingSync) {
        // const slidingSync = new SlidingSync(config.baseUrl!)
        // const slidingSyncSdk = new SlidingSyncSdk(slidingSync, this.client)
        // await this.client.slidingSync(slidingSyncSdk)
        console.warn('Sliding Sync is currently disabled/unimplemented')
      } else {
        const syncOptions = {
          initialSyncLimit: options?.initialSyncLimit || config.initialSyncLimit || 20
        }
        await this.client.startClient(syncOptions)
      }

      this.syncState = 'SYNCING'
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('Failed to start client:', error)
      this.syncState = 'ERROR'
      throw error
    }
  }

  async stopClient(): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      this.client.stopClient()
      this.syncState = 'STOPPED'
    } catch (error) {
      console.error('Failed to stop client:', error)
    }
  }

  async destroyClient(): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      await this.stopClient()
      this.client.removeAllListeners()
      this.client = null
      this.syncState = 'INIT'
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('Failed to destroy client:', error)
    }
  }

  getClient(): MatrixClient | null {
    return this.client
  }

  getFriendSystemManager(): unknown {
    if (!this.client) {
      return null
    }

    const extendedClient = this.client as ExtendedMatrixClient
    return extendedClient.getFriendSystemManager?.()
  }

  getSyncState(): SyncState {
    return this.syncState
  }

  setSyncState(state: SyncState): void {
    this.syncState = state
  }

  isConnected(): boolean {
    return this.syncState === 'SYNCING' || this.syncState === 'PREPARED'
  }

  private setupEventListeners(): void {
    if (!this.client) {
      return
    }

    this.client.on(ClientEvent.Sync, (state, prevState, _res) => {
      if (import.meta.env.DEV) {
        console.log('Sync state changed:', prevState, '->', state)
      }

      if (state === 'PREPARED') {
        this.syncState = 'PREPARED'
        this.reconnectAttempts = 0
      } else if (state === 'SYNCING') {
        this.syncState = 'SYNCING'
      } else if (state === 'ERROR') {
        this.syncState = 'ERROR'
        this.handleSyncError()
      } else if (state === 'STOPPED') {
        this.syncState = 'STOPPED'
      }
    })

    this.client.on(ClientEvent.SyncUnexpectedError, (error) => {
      if (import.meta.env.DEV) {
        console.error('Sync error:', error)
      }
      this.syncState = 'ERROR'
      this.handleSyncError()
    })

    this.client.on(ClientEvent.AccountData, (_event, _lastEvent) => {
      if (import.meta.env.DEV) {
        console.log('Account data events received')
      }
    })

    this.client.on(ClientEvent.ToDeviceEvent, (_event) => {
      if (import.meta.env.DEV) {
        console.log('ToDevice event received')
      }
    })

    this.client.on(ClientEvent.Event, (_event) => {
      if (import.meta.env.DEV) {
        console.log('Global event received')
      }
    })
  }

  private async handleSyncError(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1)

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(async () => {
      try {
        if (this.client) {
          await this.client.startClient()
        }
      } catch (error) {
        console.error('Reconnection failed:', error)
      }
    }, delay)
  }

  async saveSession(): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    const accessToken = this.client.getAccessToken()
    const userId = this.client.getUserId()
    const deviceId = this.client.getDeviceId()

    if (accessToken && userId && deviceId) {
      setMatrixConfig({
        accessToken,
        userId,
        deviceId
      })
    }
  }

  async restoreSession(): Promise<boolean> {
    const config = getMatrixConfig()

    if (!config.accessToken || !config.userId || !config.deviceId) {
      return false
    }

    try {
      await this.createClient(config)
      await this.initCrypto()
      await this.startClient()
      return true
    } catch (error) {
      console.error('Failed to restore session:', error)
      clearMatrixConfig()
      return false
    }
  }

  async clearSession(): Promise<void> {
    await this.destroyClient()
    clearMatrixConfig()
  }
}

export default MatrixClientService
