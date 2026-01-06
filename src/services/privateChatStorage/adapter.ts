/**
 * PrivateChat Storage Adapter Interface
 * 跨平台存储抽象层
 *
 * @module services/privateChatStorage/adapter
 */

/**
 * 存储适配器接口
 * 定义跨平台存储的通用操作
 */
export interface StorageAdapter {
  /**
   * 获取单个值
   *
   * @param key - 键名
   * @returns Promise<T | null>
   */
  get<T>(key: string): Promise<T | null>

  /**
   * 设置单个值
   *
   * @param key - 键名
   * @param value - 值
   * @returns Promise<void>
   */
  set<T>(key: string, value: T): Promise<void>

  /**
   * 删除单个值
   *
   * @param key - 键名
   * @returns Promise<void>
   */
  delete(key: string): Promise<void>

  /**
   * 清空所有数据
   *
   * @returns Promise<void>
   */
  clear(): Promise<void>

  /**
   * 批量获取（按前缀）
   *
   * @param prefix - 键名前缀
   * @returns Promise<Map<string, T>>
   */
  getAll<T>(prefix: string): Promise<Map<string, T>>

  /**
   * 批量设置
   *
   * @param entries - 键值对数组
   * @returns Promise<void>
   */
  setMultiple<T>(entries: Array<[string, T]>): Promise<void>

  /**
   * 批量删除
   *
   * @param keys - 键名数组
   * @returns Promise<void>
   */
  deleteMultiple(keys: string[]): Promise<void>

  /**
   * 检查键是否存在
   *
   * @param key - 键名
   * @returns Promise<boolean>
   */
  has(key: string): Promise<boolean>

  /**
   * 获取所有键
   *
   * @param prefix - 可选的前缀过滤
   * @returns Promise<string[]>
   */
  keys(prefix?: string): Promise<string[]>

  /**
   * 获取存储大小（字节）
   *
   * @returns Promise<number>
   */
  size(): Promise<number>

  /**
   * 索引查询（仅 IndexedDB）
   *
   * @param storeName - 对象存储名称
   * @param indexName - 索引名称
   * @param value - 索引值
   * @returns Promise<T[]>
   */
  queryByIndex<T>(storeName: string, indexName: string, value: unknown): Promise<T[]>

  /**
   * 事务操作（仅 IndexedDB）
   *
   * @param stores - 对象存储名称数组
   * @param callback - 事务回调
   * @returns Promise<T>
   */
  transaction<T>(stores: string[], callback: (txn: unknown) => Promise<T>): Promise<T>

  /**
   * 关闭存储连接
   *
   * @returns Promise<void>
   */
  close(): Promise<void>
}

/**
 * 存储适配器配置选项
 */
export interface StorageAdapterOptions {
  /**
   * 数据库名称
   */
  dbName?: string

  /**
   * 数据库版本
   */
  version?: number

  /**
   * 存储键前缀
   */
  keyPrefix?: string

  /**
   * 是否启用加密
   */
  enableEncryption?: boolean

  /**
   * 错误处理回调
   */
  onError?: (error: unknown) => void
}

/**
 * 存储操作结果
 */
export interface StorageOperationResult<T = unknown> {
  /**
   * 操作是否成功
   */
  success: boolean

  /**
   * 结果数据
   */
  data?: T

  /**
   * 错误信息
   */
  error?: string

  /**
   * 操作耗时（毫秒）
   */
  duration?: number
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  /**
   * 总操作数
   */
  total: number

  /**
   * 成功数
   */
  succeeded: number

  /**
   * 失败数
   */
  failed: number

  /**
   * 失败的键
   */
  failedKeys: string[]

  /**
   * 操作耗时（毫秒）
   */
  duration: number
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  /**
   * 总条目数
   */
  entryCount: number

  /**
   * 总大小（字节）
   */
  totalSize: number

  /**
   * 按前缀分组的统计
   */
  byPrefix: Record<string, { count: number; size: number }>

  /**
   * 最后更新时间
   */
  lastUpdated: number
}

/**
 * 存储事件类型
 */
export type StorageEventType = 'get' | 'set' | 'delete' | 'clear' | 'batch' | 'error' | 'quota_exceeded'

/**
 * 存储事件数据
 */
export interface StorageEventData {
  /**
   * 事件类型
   */
  type: StorageEventType

  /**
   * 相关的键
   */
  key?: string

  /**
   * 操作前的值
   */
  oldValue?: unknown

  /**
   * 操作后的值
   */
  newValue?: unknown

  /**
   * 错误信息（仅 error 事件）
   */
  error?: unknown

  /**
   * 时间戳
   */
  timestamp: number
}

/**
 * 存储事件监听器
 */
export type StorageEventListener = (event: StorageEventData) => void

/**
 * 存储配额信息
 */
export interface StorageQuota {
  /**
   * 已使用空间（字节）
   */
  used: number

  /**
   * 总配额（字节）
   */
  total: number

  /**
   * 使用百分比
   */
  percentage: number

  /**
   * 是否接近限制（>80%）
   */
  nearLimit: boolean
}

/**
 * 存储适配器工厂函数类型
 */
export type StorageAdapterFactory = (options?: StorageAdapterOptions) => StorageAdapter

/**
 * IndexedDB 对象存储定义
 */
export interface ObjectStoreDefinition {
  /**
   * 对象存储名称
   */
  name: string

  /**
   * 主键路径
   */
  keyPath: string | string[]

  /**
   * 是否自动生成键
   */
  autoIncrement?: boolean

  /**
   * 索引定义
   */
  indexes?: Array<{
    name: string
    keyPath: string | string[]
    options?: IDBIndexParameters
  }>
}

/**
 * 数据库迁移定义
 */
export interface DatabaseMigration {
  /**
   * 目标版本号
   */
  version: number

  /**
   * 对象存储定义
   */
  stores: ObjectStoreDefinition[]

  /**
   * 升级回调
   */
  upgrade?: (db: IDBDatabase, oldVersion: number, newVersion: number) => void
}

/**
 * 事务模式
 */
export type TransactionMode = 'readonly' | 'readwrite'

/**
 * 查询条件
 */
export interface QueryCondition {
  /**
   * 索引名称
   */
  index: string

  /**
   * 比较操作符
   */
  operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'contains' | 'startsWith'

  /**
   * 比较值
   */
  value: unknown
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /**
   * 限制返回数量
   */
  limit?: number

  /**
   * 跳过数量
   */
  offset?: number

  /**
   * 排序字段
   */
  orderBy?: string

  /**
   * 排序方向
   */
  order?: 'asc' | 'desc'

  /**
   * 查询条件
   */
  where?: QueryCondition[]
}

/**
 * 游标定义
 */
export interface CursorDefinition<T = unknown> {
  /**
   * 继续迭代
   */
  continue(): void

  /**
   * 跳过指定数量
   */
  advance(count: number): void

  /**
   * 当前值
   */
  get value(): T

  /**
   * 当前键
   */
  get key(): IDBValidKey

  /**
   * 是否已完成
   */
  get done(): boolean
}
