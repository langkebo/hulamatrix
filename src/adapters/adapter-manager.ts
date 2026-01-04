/**
 * Adapter Manager - Stub for Phase 4 Migration
 * This was used for dual-protocol management, now deprecated
 */

import type { ServiceAdapter } from './service-adapter'

export interface AdapterConfig {
  enabled: boolean
  priority: number
}

export interface Adapter extends ServiceAdapter {
  name: string
  type: string
  protocol: string
  initialize?: () => Promise<void>
}

export interface AdapterInfo {
  adapter: Adapter
  ready: boolean
}

// Internal adapter registry
const registeredAdapters: Adapter[] = []

export const adapterManager = {
  getAdapter(_type: string, _name: string): Adapter | null {
    // Phase 4 Migration: Return Matrix adapter with priority
    const found = registeredAdapters.find((a) => a.name === _name && a.type === _type)
    if (found) return found
    // Return default Matrix adapter
    return {
      name: _name,
      type: _type,
      protocol: 'matrix',
      priority: 100,
      isReady: async () => true
    } as Adapter
  },
  async getBestAdapter(_type: string): Promise<Adapter | null> {
    // Phase 4 Migration: Always return Matrix adapter
    const adapters = registeredAdapters.filter((a) => a.type === _type)
    if (adapters.length > 0) {
      // Return highest priority adapter
      return adapters.sort((a, b) => b.priority - a.priority)[0]
    }
    return {
      name: `matrix-${_type}`,
      type: _type,
      protocol: 'matrix',
      priority: 100,
      isReady: async () => true
    } as Adapter
  },
  listAdapters(_type?: string): AdapterInfo[] {
    // Phase 4 Migration: Return list of registered adapters (optionally filtered by type)
    const adapters = _type ? registeredAdapters.filter((a) => a.type === _type) : registeredAdapters
    return adapters.map((a) => ({
      adapter: a,
      ready: true // Matrix adapters are always ready
    }))
  },
  registerAdapter(_type: string, _name: string, _adapter: ServiceAdapter, _config: AdapterConfig): void {
    // Phase 4 Migration: Register adapter with config
    const adapter: Adapter = {
      ..._adapter,
      name: _name,
      type: _type,
      protocol: _name.includes('matrix') ? 'matrix' : 'websocket',
      priority: _config.priority
    } as Adapter
    registeredAdapters.push(adapter)
  },
  async cleanup() {
    // No-op
    registeredAdapters.length = 0
  }
}
