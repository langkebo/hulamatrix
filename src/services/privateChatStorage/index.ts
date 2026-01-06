/**
 * PrivateChat Storage Module
 * 存储模块导出索引
 *
 * @module services/privateChatStorage
 */

// 适配器接口和类型
export type {
  StorageAdapter,
  StorageAdapterOptions,
  StorageOperationResult,
  BatchOperationResult,
  StorageStats,
  StorageEventType,
  StorageEventData,
  StorageEventListener,
  StorageQuota,
  StorageAdapterFactory,
  ObjectStoreDefinition,
  DatabaseMigration,
  TransactionMode,
  QueryCondition,
  QueryOptions,
  CursorDefinition
} from './adapter'

// IndexedDB 适配器
export { IndexedDBAdapter, createIndexedDBAdapter } from './indexedDBAdapter'
export type { IndexedDBAdapterOptions } from './indexedDBAdapter'

// 存储加密
export {
  StorageEncryption,
  createStorageEncryption,
  createRandomStorageEncryption
} from './encryption'
export type {
  EncryptedKeyData,
  KEKMetadata,
  EncryptionResult,
  DecryptionParams
} from './encryption'

// 同步管理
export {
  StorageSyncManager,
  createStorageSyncManager,
  SyncStrategy
} from './sync'
export type {
  SyncResult,
  SyncOptions,
  SyncState,
  SyncEventType,
  SyncEventData,
  SyncEventListener
} from './sync'

// 配额管理
export {
  StorageQuotaManager,
  createStorageQuotaManager
} from './quota'
export type {
  StorageUsage,
  CleanupResult,
  CleanupPolicy,
  StorageStatistics
} from './quota'
