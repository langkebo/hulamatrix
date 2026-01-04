/**
 * 功能特性开关
 * 控制功能迁移进度和实验性功能
 */

/**
 * Vite import.meta.env 类型定义
 */
interface ImportMetaEnv {
  MODE?: string
  DEV?: boolean
  PROD?: boolean
  SSR?: boolean
  VITE_APP_NAME?: string
  VITE_PC_URL?: string
  VITE_SERVICE_URL?: string
  VITE_MATRIX_ENABLED?: string
  VITE_MATRIX_SERVER_NAME?: string
  VITE_MATRIX_SERVER?: string
  VITE_MATRIX_ROOMS_ENABLED?: string
  VITE_MATRIX_MEDIA_ENABLED?: string
  VITE_MATRIX_PUSH_ENABLED?: string
  VITE_MATRIX_E2EE_ENABLED?: string
  VITE_MATRIX_RTC_ENABLED?: string
  VITE_MATRIX_ADMIN_ENABLED?: string
  VITE_SYNAPSE_FRIENDS_ENABLED?: string
  VITE_MOBILE_FEATURES_ENABLED?: string
  VITE_MATRIX_DEV_SYNC?: string
  VITE_MATRIX_ACCESS_TOKEN?: string
  VITE_MATRIX_USER_ID?: string
  VITE_GITEE_TOKEN?: string
  VITE_MIGRATE_MESSAGING?: string
  VITE_PUBLIC_ROOM_ALIASES?: string
  VITE_PUBLIC_ROOM_ALIAS?: string
  VITE_ADMIN_ACCOUNTS?: string
  VITEST?: string
  VITE_DISABLE_WEBSOCKET?: string // Phase 4: 禁用 WebSocket 环境变量
  BASE_URL?: string
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  env: ImportMetaEnv
}

interface FeatureFlag {
  enabled: boolean
  description: string
  rolloutPercentage?: number // 0-100
  dependencies?: string[]
  lastUpdated?: Date
}

// Type-safe import.meta.env access
const getImportMetaEnv = (): ImportMetaEnv => {
  return typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? (import.meta as ImportMeta).env
    : ({} as ImportMetaEnv)
}

const __ENV = getImportMetaEnv()
const __MODE: string =
  __ENV.MODE ?? (typeof process !== 'undefined' ? process.env.NODE_ENV : 'production') ?? 'production'
const __DEV: boolean = __ENV.DEV ?? __MODE === 'development'

class FeatureFlagManager {
  private static instance: FeatureFlagManager
  private flags: Map<string, FeatureFlag>
  private userId: string | null = null

  private constructor() {
    this.flags = new Map()
    this.initializeFlags()
    this.loadUserId()
  }

  public static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager()
    }
    return FeatureFlagManager.instance
  }

  /**
   * 初始化功能开关
   */
  private initializeFlags(): void {
    const defaultFlags: Record<string, FeatureFlag> = {
      // 架构迁移开关
      MIGRATE_MESSAGING: {
        enabled: String(__ENV.VITE_MIGRATE_MESSAGING) === 'true',
        description: '消息处理迁移到Matrix SDK',
        rolloutPercentage: 10
      },
      MIGRATE_FILE_MANAGEMENT: {
        enabled: false,
        description: '文件管理迁移到Matrix SDK',
        rolloutPercentage: 0
      },
      MIGRATE_RTC_CALLS: {
        enabled: false,
        description: '音视频通话迁移到MatrixRTC',
        rolloutPercentage: 0,
        dependencies: ['MIGRATE_MESSAGING']
      },

      // 架构开关
      USE_DISCOVERY_FOR_AUTH: {
        enabled: true,
        description: '认证功能使用发现机制',
        rolloutPercentage: 100
      },
      USE_HYBRID_MESSAGING: {
        enabled: false, // 改为 false，使用 Matrix-first 模式
        description: '消息使用混合模式（遗留）',
        rolloutPercentage: 0
      },
      MATRIX_FIRST_ROUTING: {
        enabled: true,
        description: '优先使用Matrix SDK路由',
        rolloutPercentage: 100
      },
      DISABLE_WEBSOCKET: {
        // Phase 4: 从环境变量读取，默认为 false
        enabled: String(__ENV.VITE_DISABLE_WEBSOCKET) === 'true',
        description: '禁用WebSocket（仅用于测试迁移）',
        rolloutPercentage: 0
      },

      // 性能优化开关
      ENABLE_CACHING: {
        enabled: true,
        description: '启用过渡期缓存',
        rolloutPercentage: 100
      },
      ENABLE_PERFORMANCE_MONITOR: {
        enabled: __DEV,
        description: '启用性能监控',
        rolloutPercentage: 100
      },

      // 实验性功能
      ENABLE_SLIDING_SYNC: {
        enabled: false,
        description: '启用滑动同步',
        rolloutPercentage: 0
      },
      ENABLE_E2EE: {
        enabled: true,
        description: '启用端到端加密',
        rolloutPercentage: 100
      },

      // 调试开关
      DEBUG_ARCHITECTURE: {
        enabled: __DEV,
        description: '架构选择调试模式',
        rolloutPercentage: 100
      },
      LOG_MIGRATION: {
        enabled: __DEV,
        description: '记录迁移日志',
        rolloutPercentage: 100
      }
    }

    Object.entries(defaultFlags).forEach(([key, flag]) => {
      this.flags.set(key, {
        ...flag,
        lastUpdated: new Date()
      })
    })
  }

  /**
   * 加载用户ID
   */
  private loadUserId(): void {
    // 从本地存储加载用户ID
    try {
      const userData = localStorage.getItem('user-auth')
      if (userData) {
        const parsed = JSON.parse(userData)
        this.userId = parsed.userId || null
      }
    } catch {}
  }

  /**
   * 检查功能是否启用
   */
  public isEnabled(featureName: string): boolean {
    const flag = this.flags.get(featureName)
    if (!flag) {
      return false
    }

    // 检查依赖
    if (flag.dependencies) {
      for (const dep of flag.dependencies) {
        if (!this.isEnabled(dep)) {
          return false
        }
      }
    }

    // 基于百分比启用
    if (flag.rolloutPercentage && flag.rolloutPercentage < 100) {
      if (!this.userId) {
        return false
      }

      const hash = this.hashUserId(this.userId + featureName)
      const percentage = (hash % 100) + 1
      return percentage <= flag.rolloutPercentage
    }

    return flag.enabled
  }

  /**
   * 获取功能信息
   */
  public getFeatureInfo(featureName: string): FeatureFlag | undefined {
    return this.flags.get(featureName)
  }

  /**
   * 获取所有功能开关
   */
  public getAllFlags(): Map<string, FeatureFlag> {
    return new Map(this.flags)
  }

  /**
   * 动态更新功能开关
   */
  public updateFlag(featureName: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(featureName)
    if (!flag) {
      return
    }

    this.flags.set(featureName, {
      ...flag,
      ...updates,
      lastUpdated: new Date()
    })
  }

  /**
   * 批量更新功能开关
   */
  public updateFlags(updates: Record<string, Partial<FeatureFlag>>): void {
    Object.entries(updates).forEach(([featureName, update]) => {
      this.updateFlag(featureName, update)
    })
  }

  /**
   * 从URL参数加载功能开关
   */
  public loadFromUrlParams(): void {
    const params = new URLSearchParams(window.location.search)

    params.forEach((value, key) => {
      if (key.startsWith('ff_')) {
        const featureName = key.substring(3).toUpperCase()
        const enabled = value === 'true' || value === '1'

        this.updateFlag(featureName, { enabled })
      }
    })
  }

  /**
   * 保存功能开关到本地存储
   */
  public saveToStorage(): void {
    try {
      const flagsData = Object.fromEntries(this.flags)
      localStorage.setItem('feature-flags', JSON.stringify(flagsData))
    } catch (_error) {}
  }

  /**
   * 从本地存储加载功能开关
   */
  public loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('feature-flags')
      if (stored) {
        const flagsData = JSON.parse(stored) as Record<string, unknown>
        Object.entries(flagsData).forEach(([key, value]: [string, unknown]) => {
          if (this.flags.has(key)) {
            const existingFlag = this.flags.get(key)
            if (!existingFlag) return

            const flagValue = value as Partial<FeatureFlag> & { lastUpdated?: string | Date }
            this.flags.set(key, {
              enabled: flagValue.enabled ?? existingFlag.enabled,
              description: flagValue.description ?? existingFlag.description,
              rolloutPercentage: flagValue.rolloutPercentage ?? existingFlag.rolloutPercentage,
              dependencies: flagValue.dependencies ?? existingFlag.dependencies,
              lastUpdated: new Date(String(flagValue.lastUpdated ?? new Date()))
            })
          }
        })
      }
    } catch (_error) {}
  }

  /**
   * 生成用户ID的哈希值
   */
  private hashUserId(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * 获取功能开关统计
   */
  public getStats(): {
    total: number
    enabled: number
    disabled: number
    inRollout: number
  } {
    let enabled = 0
    let disabled = 0
    let inRollout = 0

    this.flags.forEach((flag) => {
      if (flag.enabled) {
        enabled++
      } else {
        disabled++
      }

      if (flag.rolloutPercentage && flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        inRollout++
      }
    })

    return {
      total: this.flags.size,
      enabled,
      disabled,
      inRollout
    }
  }
}

// 导出单例实例
export const featureFlags = FeatureFlagManager.getInstance()

// 导出便捷方法
export const isFeatureEnabled = (featureName: string): boolean => featureFlags.isEnabled(featureName)
export const getFeatureInfo = (featureName: string) => featureFlags.getFeatureInfo(featureName)
