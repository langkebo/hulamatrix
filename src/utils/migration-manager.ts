import { architectureManager } from '@/adapters/architecture-manager'
import { adapterFactory } from '@/adapters/adapter-factory'

export type MigrationState = 'pending' | 'migrating' | 'completed' | 'rolled_back'

export class MigrationManager {
  private status = new Map<string, MigrationState>()

  async migrateFeature(feature: string): Promise<boolean> {
    this.status.set(feature, 'migrating')
    const valid = await this.validateNewImplementation(feature)
    if (!valid) {
      await this.rollback(feature)
      return false
    }
    await this.migrateData(feature)
    await this.switchImplementation(feature)
    const ok = await this.verifyMigration(feature)
    if (!ok) {
      await this.rollback(feature)
      return false
    }
    this.status.set(feature, 'completed')
    return true
  }

  async validateNewImplementation(_feature: string): Promise<boolean> {
    try {
      await adapterFactory.initialize()
      return true
    } catch {
      return false
    }
  }

  async migrateData(_feature: string): Promise<void> {}

  async switchImplementation(feature: string): Promise<void> {
    const impl = architectureManager.selectImplementation(feature)
    architectureManager.setMode(impl.mode)
  }

  async verifyMigration(_feature: string): Promise<boolean> {
    return true
  }

  async rollback(feature: string): Promise<void> {
    this.status.set(feature, 'rolled_back')
    architectureManager.setMode('hybrid')
  }

  getStatus(feature: string): MigrationState {
    return this.status.get(feature) || 'pending'
  }
}

export const migrationManager = new MigrationManager()
