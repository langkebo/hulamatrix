import MatrixClientService from './MatrixClientService'
import { type MatrixClient } from '@/lib/matrix-sdk'

interface BackupStatus {
  enabled: boolean
  hasBackup: boolean
  backupInfo: KeyBackupInfo | null
  backupVersion: string | null
}

interface RestoreProgress {
  loaded: number
  total: number
  stage: string
}

interface KeyBackupInfo {
  version?: string
  algorithm: string
  auth_data?: Record<string, unknown>
  count?: number
  etag?: string
}

interface BackupTrustInfo {
  trusted: boolean
}

interface ImportProgressData {
  stage: string
  progress?: number
  total?: number
}

class MatrixKeyBackupService {
  private static instance: MatrixKeyBackupService

  static getInstance(): MatrixKeyBackupService {
    if (!MatrixKeyBackupService.instance) {
      MatrixKeyBackupService.instance = new MatrixKeyBackupService()
    }
    return MatrixKeyBackupService.instance
  }

  private getClient(): MatrixClient | null {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  private getCrypto(): ReturnType<MatrixClient['getCrypto']> | null {
    const client = this.getClient()
    return client?.getCrypto() ?? null
  }

  async isBackupEnabled(): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] isBackupEnabled called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      const version = await crypto.getActiveSessionBackupVersion()
      return version !== null && version !== undefined
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to check backup status:', error)
      }
      return false
    }
  }

  async hasBackup(): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] hasBackup called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      return backupInfo !== null && backupInfo !== undefined
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to check backup:', error)
      }
      return false
    }
  }

  async enableBackup(): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] enableBackup called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      await crypto.resetKeyBackup()
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to enable backup:', error)
      }
      return false
    }
  }

  async disableBackup(): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] disableBackup called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (backupInfo?.version) {
        await crypto.deleteKeyBackupVersion(backupInfo.version)
      }

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to disable backup:', error)
      }
      return false
    }
  }

  async createBackup(_password: string): Promise<{ backupId: string; key: string } | null> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] createBackup called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return null
      }

      await crypto.resetKeyBackup()

      const backupInfo = await crypto.getKeyBackupInfo()
      if (backupInfo?.version) {
        return {
          backupId: String(backupInfo.version),
          key: '[stored-in-secret-storage]'
        }
      }

      return null
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to create backup:', error)
      }
      return null
    }
  }

  async getBackupInfo(): Promise<KeyBackupInfo | null> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] getBackupInfo called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return null
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        return null
      }

      return {
        version: backupInfo.version,
        algorithm: backupInfo.algorithm,
        auth_data: backupInfo.auth_data as unknown as Record<string, unknown> | undefined,
        count: backupInfo.count,
        etag: backupInfo.etag
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to get backup info:', error)
      }
      return null
    }
  }

  async getBackupStatus(): Promise<BackupStatus> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] getBackupStatus called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return {
          enabled: false,
          hasBackup: false,
          backupInfo: null,
          backupVersion: null
        }
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      const version = await crypto.getActiveSessionBackupVersion()

      return {
        enabled: version !== null && version !== undefined,
        hasBackup: backupInfo !== null && backupInfo !== undefined,
        backupInfo: backupInfo
          ? {
              version: backupInfo.version,
              algorithm: backupInfo.algorithm,
              auth_data: backupInfo.auth_data as unknown as Record<string, unknown> | undefined,
              count: backupInfo.count,
              etag: backupInfo.etag
            }
          : null,
        backupVersion: version ?? null
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to get backup status:', error)
      }
      return {
        enabled: false,
        hasBackup: false,
        backupInfo: null,
        backupVersion: null
      }
    }
  }

  async restoreBackup(
    backupData?: {
      version?: string
      password?: string
    },
    progressCallback?: (progress: RestoreProgress) => void
  ): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] restoreBackup called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      const restoreOptions: {
        version?: string
        progressCallback?: (progress: ImportProgressData) => void
      } = {}

      if (backupData?.version) {
        restoreOptions.version = backupData.version
      }

      if (progressCallback) {
        restoreOptions.progressCallback = (progress) => {
          progressCallback({
            loaded: progress.progress ?? 0,
            total: progress.total ?? 0,
            stage: progress.stage
          })
        }
      }

      await crypto.restoreKeyBackup(restoreOptions)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to restore backup:', error)
      }
      return false
    }
  }

  async restoreBackupWithPassphrase(
    passphrase: string,
    progressCallback?: (progress: RestoreProgress) => void
  ): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] restoreBackupWithPassphrase called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return false
      }

      const restoreOptions: {
        progressCallback?: (progress: ImportProgressData) => void
      } = {}

      if (progressCallback) {
        restoreOptions.progressCallback = (progress) => {
          progressCallback({
            loaded: progress.progress ?? 0,
            total: progress.total ?? 0,
            stage: progress.stage
          })
        }
      }

      await crypto.restoreKeyBackupWithPassphrase(passphrase, restoreOptions)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to restore backup with passphrase:', error)
      }
      return false
    }
  }

  async deleteBackup(): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] deleteBackup called')
    }

    return this.disableBackup()
  }

  async checkBackupTrust(): Promise<BackupTrustInfo | null> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] checkBackupTrust called')
    }

    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return null
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        return null
      }

      const trustInfo = await crypto.isKeyBackupTrusted(backupInfo)
      return {
        trusted: trustInfo.trusted
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to check backup trust:', error)
      }
      return null
    }
  }

  async getBackupKeysCount(): Promise<{ total: number; uploaded: number }> {
    if (import.meta.env.DEV) {
      console.log('[MatrixKeyBackupService] getBackupKeysCount called')
    }

    try {
      const backupInfo = await this.getBackupInfo()
      if (backupInfo) {
        return {
          total: backupInfo.count || 0,
          uploaded: backupInfo.count || 0
        }
      }
      return { total: 0, uploaded: 0 }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixKeyBackupService] Failed to get backup keys count:', error)
      }
      return { total: 0, uploaded: 0 }
    }
  }
}

export default MatrixKeyBackupService
export type { BackupStatus, RestoreProgress, KeyBackupInfo, BackupTrustInfo }
