import type { App } from 'vue'
import { matrixClientService } from './client'

export const MatrixClientManagerKey = Symbol('MatrixClientManagerKey')

export class MatrixClientManager {
  initialize(credentials: { baseUrl: string; accessToken?: string; refreshToken?: string; userId?: string }) {
    // The initialize method expects these exact properties, so we pass credentials directly
    return matrixClientService.initialize(credentials)
  }
  getClient() {
    return matrixClientService.getClient()
  }
  startClient(options?: { initialSyncLimit?: number; pollTimeout?: number }) {
    return matrixClientService.startClient(options)
  }
  stopClient() {
    return matrixClientService.stopClient()
  }
}

export function provideMatrixClientManager(app: App) {
  const mgr = new MatrixClientManager()
  app.provide(MatrixClientManagerKey, mgr)
  return mgr
}
