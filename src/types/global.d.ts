export interface IndexedDBCryptoStore {
  new (
    db: IDBFactory,
    storeName: string
  ): {
    deleteAll(): Promise<void>
    getBobKey(key: string): Promise<Uint8Array | null>
    setBobKey(key: string, value: Uint8Array): Promise<void>
    getCount(): Promise<number>
  }
}

export type TauriInvoke = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>

export interface TauriMessageAPI {
  error(msg: string): void
  warning(msg: string): void
  success(msg: string): void
  info(msg: string): void
}

export interface TauriCoreAPI {
  invoke: TauriInvoke
}

export interface TauriAPI {
  core: TauriCoreAPI
}

export interface TauriInternals {
  invoke: TauriInvoke
  convertFileSrc: (filePath: string, protocol?: string) => string
}

declare global {
  interface Window {
    IndexedDBCryptoStore?: {
      new (db: IDBFactory, storeName: string): IndexedDBCryptoStore
    }
    __TAURI__?: TauriAPI
    __TAURI_INTERNALS__?: TauriInternals
    __TAURI_INVOKE__?: TauriInvoke
    $message: TauriMessageAPI
  }
}
