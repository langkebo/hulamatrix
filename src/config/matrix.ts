export interface MatrixConfig {
  baseUrl: string
  accessToken?: string
  userId?: string
  deviceId?: string
  syncTimeout?: number
  initialSyncLimit?: number
}

export const getMatrixConfig = (): MatrixConfig => {
  return {
    baseUrl: localStorage.getItem('matrix_homeserver_url') || 'https://matrix.cjystx.top',
    accessToken: localStorage.getItem('matrix_access_token') || undefined,
    userId: localStorage.getItem('matrix_user_id') || undefined,
    deviceId: localStorage.getItem('matrix_device_id') || undefined,
    syncTimeout: 30000,
    initialSyncLimit: 20
  }
}

export const setMatrixConfig = (config: Partial<MatrixConfig>): void => {
  if (config.baseUrl) {
    localStorage.setItem('matrix_homeserver_url', config.baseUrl)
  }
  if (config.accessToken) {
    localStorage.setItem('matrix_access_token', config.accessToken)
  }
  if (config.userId) {
    localStorage.setItem('matrix_user_id', config.userId)
  }
  if (config.deviceId) {
    localStorage.setItem('matrix_device_id', config.deviceId)
  }
}

export const clearMatrixConfig = (): void => {
  localStorage.removeItem('matrix_homeserver_url')
  localStorage.removeItem('matrix_access_token')
  localStorage.removeItem('matrix_user_id')
  localStorage.removeItem('matrix_device_id')
}
