import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getPushRules,
  setPushRuleEnabled,
  createPushRule,
  deletePushRule,
  muteRoom,
  unmuteRoom,
  muteUser,
  unmuteUser,
  setKeywordHighlight,
  getNotificationPolicy,
  applyNotificationPolicy,
  setQuietHours,
  type PushRule,
  type PushRuleAction,
  type PushRuleCondition,
  type NotificationPolicy
} from '@/integrations/matrix/pusher'
import { flags } from '@/utils/envFlags'
import { logger, toError } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'

export interface PushRuleSettings {
  globalEnabled: boolean
  messageSound: boolean
  desktopNotifications: boolean
  mobileNotifications: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  highlightMentions: boolean
  highlightKeywords: boolean
  showPreviews: boolean
}

export interface RuleTemplate {
  id: string
  name: string
  description: string
  kind: 'override' | 'content' | 'room' | 'sender' | 'underride'
  actions: PushRuleAction[]
  conditions?: PushRuleCondition[]
  enabled: boolean
  category: string
  pattern?: string
}

export interface PushAnalytics {
  totalRules: number
  activeRules: number
  mutedRooms: number
  mutedUsers: number
  keywordHighlights: number
  notificationCount: number
  lastNotificationTime: number
  averageNotificationsPerDay: number
}

export const usePushRulesStore = defineStore('pushRules', () => {
  // 状态
  const rules = ref<{ global: PushRule[]; device: PushRule[] }>({ global: [], device: [] })
  const policy = ref<NotificationPolicy | null>(null)
  const settings = ref<PushRuleSettings>({
    globalEnabled: true,
    messageSound: true,
    desktopNotifications: true,
    mobileNotifications: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    highlightMentions: true,
    highlightKeywords: true,
    showPreviews: true
  })

  const analytics = ref<PushAnalytics | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ruleTemplates = ref<RuleTemplate[]>([])

  // 计算属性
  const globalRules = computed(() => rules.value.global)
  const deviceRules = computed(() => rules.value.device)
  const activeRules = computed(() => {
    return [...rules.value.global, ...rules.value.device].filter((rule) => rule.enabled)
  })
  const mutedRooms = computed(() => {
    return rules.value.global.filter((rule) => rule.kind === 'room' && rule.enabled)
  })
  const mutedUsers = computed(() => {
    return rules.value.global.filter((rule) => rule.kind === 'sender' && rule.enabled)
  })
  const keywordRules = computed(() => {
    return rules.value.global.filter((rule) => rule.kind === 'content' && rule.enabled)
  })

  // 方法
  const loadPushRules = async () => {
    if (!flags.matrixPushRulesEnabled || !flags.matrixEnabled) return

    loading.value = true
    error.value = null

    try {
      rules.value = await getPushRules()
      updateAnalytics()
    } catch (err) {
      logger.error('Failed to load push rules:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  const loadNotificationPolicy = async () => {
    if (!flags.matrixPushRulesEnabled) return

    try {
      policy.value = await getNotificationPolicy()
    } catch (err) {
      logger.error('Failed to load notification policy:', toError(err))
    }
  }

  const saveNotificationPolicy = async (newPolicy: NotificationPolicy) => {
    if (!flags.matrixPushRulesEnabled) return false

    loading.value = true

    try {
      await applyNotificationPolicy(newPolicy)
      policy.value = newPolicy
      await loadPushRules() // 重新加载规则
      return true
    } catch (err) {
      logger.error('Failed to save notification policy:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    } finally {
      loading.value = false
    }
  }

  const enableRule = async (scope: 'global' | 'device', kind: PushRule['kind'], ruleId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await setPushRuleEnabled(scope, kind, ruleId, true)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to enable rule:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const disableRule = async (scope: 'global' | 'device', kind: PushRule['kind'], ruleId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await setPushRuleEnabled(scope, kind, ruleId, false)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to disable rule:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const addRule = async (
    scope: 'global' | 'device' = 'global',
    kind: PushRule['kind'],
    ruleId: string,
    actions: PushRuleAction[],
    pattern?: string,
    conditions?: PushRuleCondition[]
  ) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await createPushRule(scope, kind, ruleId, actions, pattern, conditions)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to add rule:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const removeRule = async (scope: 'global' | 'device' = 'global', kind: PushRule['kind'], ruleId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await deletePushRule(scope, kind, ruleId)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to remove rule:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  // 房间静音
  const muteRoomNotifications = async (roomId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await muteRoom(roomId)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to mute room:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const unmuteRoomNotifications = async (roomId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await unmuteRoom(roomId)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to unmute room:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const toggleRoomMute = async (roomId: string) => {
    const isMuted = mutedRooms.value.some((rule) => rule.rule_id === roomId)
    return isMuted ? unmuteRoomNotifications(roomId) : muteRoomNotifications(roomId)
  }

  // 用户静音
  const muteUserNotifications = async (userId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await muteUser(userId)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to mute user:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const unmuteUserNotifications = async (userId: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await unmuteUser(userId)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to unmute user:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const toggleUserMute = async (userId: string) => {
    const isMuted = mutedUsers.value.some((rule) => rule.rule_id === userId)
    return isMuted ? unmuteUserNotifications(userId) : muteUserNotifications(userId)
  }

  // 关键词高亮
  const setKeywordsHighlight = async (keywords: string[]) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      await setKeywordHighlight(keywords)
      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to set keyword highlights:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  // 静默时间
  const setQuietHoursSettings = async (enabled: boolean, start: string, end: string) => {
    if (!flags.matrixPushRulesEnabled) return false

    try {
      if (enabled) {
        await setQuietHours(start, end)
      } else {
        // 移除静默时间规则
        await deletePushRule('global', 'override', 'quiet_hours')
      }

      settings.value.quietHoursEnabled = enabled
      settings.value.quietHoursStart = start
      settings.value.quietHoursEnd = end

      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to set quiet hours:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  // 设置管理
  const updateSettings = (newSettings: Partial<PushRuleSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
  }

  const resetSettings = () => {
    settings.value = {
      globalEnabled: true,
      messageSound: true,
      desktopNotifications: true,
      mobileNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      highlightMentions: true,
      highlightKeywords: true,
      showPreviews: true
    }
  }

  // 规则模板管理
  const initializeRuleTemplates = () => {
    ruleTemplates.value = [
      {
        id: 'mention_highlight',
        name: '@提及高亮',
        description: '当有人@你时高亮通知',
        kind: 'content',
        actions: [{ set_tweak: 'highlight' }, { set_tweak: 'sound', value: 'default' }],
        conditions: [
          {
            kind: 'event_match',
            key: 'content.body',
            pattern: '@room'
          }
        ],
        enabled: true,
        category: '基础'
      },
      {
        id: 'urgent_keywords',
        name: '紧急关键词',
        description: '包含紧急、重要等关键词时提醒',
        kind: 'content',
        actions: [{ set_tweak: 'highlight' }, { set_tweak: 'sound', value: 'urgent' }],
        enabled: false,
        category: '高级'
      },
      {
        id: 'room_priority',
        name: '重要房间',
        description: '重要房间的消息总是通知',
        kind: 'room',
        actions: ['notify', { set_tweak: 'sound', value: 'default' }, { set_tweak: 'highlight' }],
        enabled: false,
        category: '房间'
      },
      {
        id: 'user_ignore',
        name: '忽略用户',
        description: '忽略特定用户的消息',
        kind: 'sender',
        actions: ['dont_notify'],
        enabled: false,
        category: '用户'
      },
      {
        id: 'work_hours',
        name: '工作时间静音',
        description: '工作时间之外静音通知',
        kind: 'override',
        actions: ['dont_notify'],
        conditions: [
          {
            kind: 'time',
            start: '18:00',
            end: '09:00'
          }
        ],
        enabled: false,
        category: '时间'
      }
    ]
  }

  const applyTemplate = async (templateId: string, targetId?: string, customPattern?: string) => {
    const template = ruleTemplates.value.find((t) => t.id === templateId)
    if (!template) return false

    const ruleId = targetId || template.id
    const pattern = customPattern || template.pattern || ''

    try {
      await createPushRule('global', template.kind, ruleId, template.actions, pattern, template.conditions)

      if (!template.enabled) {
        await setPushRuleEnabled('global', template.kind, ruleId, false)
      }

      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to apply template:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  // 分析统计
  const updateAnalytics = () => {
    analytics.value = {
      totalRules: rules.value.global.length + rules.value.device.length,
      activeRules: activeRules.value.length,
      mutedRooms: mutedRooms.value.length,
      mutedUsers: mutedUsers.value.length,
      keywordHighlights: keywordRules.value.length,
      notificationCount: 0, // 这里需要从通知系统中获取
      lastNotificationTime: 0,
      averageNotificationsPerDay: 0
    }
  }

  // 导出导入
  const exportRules = () => {
    return {
      rules: rules.value,
      policy: policy.value,
      settings: settings.value,
      templates: ruleTemplates.value,
      exportTime: new Date().toISOString()
    }
  }

  const importRules = async (data: {
    rules?: { global?: Partial<PushRule>[]; device?: Partial<PushRule>[] }
    policy?: NotificationPolicy
    settings?: Partial<PushRuleSettings>
  }) => {
    if (!data.rules || !flags.matrixPushRulesEnabled) return false

    try {
      // 导入规则
      for (const rule of data.rules.global || []) {
        const kind = rule.kind ?? 'override'
        const ruleId = rule.rule_id ?? ''
        if (!ruleId) continue // 跳过没有 rule_id 的规则
        await createPushRule('global', kind, ruleId, rule.actions ?? [], rule.pattern, rule.conditions)
        if (rule.enabled !== undefined) {
          await setPushRuleEnabled('global', kind, ruleId, rule.enabled)
        }
      }

      // 导入策略
      if (data.policy) {
        await applyNotificationPolicy(data.policy)
      }

      // 导入设置
      if (data.settings) {
        settings.value = { ...settings.value, ...data.settings }
      }

      await loadPushRules()
      return true
    } catch (err) {
      logger.error('Failed to import rules:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  // 自动同步状态
  const autoSyncEnabled = ref(true)
  const syncStatus = ref<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const lastSyncTime = ref<number | null>(null)
  const syncError = ref<string | null>(null)

  /**
   * 启用自动同步
   * 监听 Matrix SDK 的 accountData 事件，自动同步服务器规则变更
   */
  const enableAutoSync = () => {
    if (!flags.matrixPushRulesEnabled || !flags.matrixEnabled) return

    try {
      const client = matrixClientService.getClient() as unknown as {
        on?: (event: string, handler: (...args: unknown[]) => void) => void
      }

      if (!client?.on) {
        logger.warn('[PushRulesStore] Client does not support event listeners')
        return
      }

      // 监听 accountData 事件（推送规则变更会触发此事件）
      client.on('accountData', (...args: unknown[]) => {
        if (!autoSyncEnabled.value) return

        const event = args[0] as { type?: string; content?: Record<string, unknown> } | undefined
        if (!event) return

        // 检查是否是推送规则相关的 account data 变更
        if (event.type === 'm.push_rules' || event.type === 'org.matrix.msc3927.push_rules') {
          logger.info('[PushRulesStore] Push rules changed on server, syncing...')
          syncPushRules()
        }
      })

      // 监听 sync 事件以获取完整的账户数据更新
      client.on('sync', (...args: unknown[]) => {
        if (!autoSyncEnabled.value) return

        const syncState = args[0] as string | undefined
        if (syncState !== 'PREPARED') return

        // 在同步完成后检查是否有推送规则更新
        loadPushRules().catch((err) => {
          logger.warn('[PushRulesStore] Failed to sync push rules:', err)
        })
      })

      logger.info('[PushRulesStore] Auto-sync enabled')
    } catch (error) {
      logger.error('[PushRulesStore] Failed to enable auto-sync:', error)
    }
  }

  /**
   * 禁用自动同步
   */
  const disableAutoSync = () => {
    autoSyncEnabled.value = false
    logger.info('[PushRulesStore] Auto-sync disabled')
  }

  /**
   * 同步推送规则（从服务器拉取最新规则）
   */
  const syncPushRules = async (): Promise<boolean> => {
    if (!flags.matrixPushRulesEnabled || !flags.matrixEnabled) {
      logger.warn('[PushRulesStore] Push rules are disabled')
      return false
    }

    syncStatus.value = 'syncing'
    syncError.value = null

    try {
      logger.info('[PushRulesStore] Syncing push rules from server...')

      // 从服务器加载最新的推送规则
      await loadPushRules()
      await loadNotificationPolicy()

      lastSyncTime.value = Date.now()
      syncStatus.value = 'success'

      logger.info('[PushRulesStore] Push rules synced successfully', {
        timestamp: lastSyncTime.value
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      syncError.value = errorMessage
      syncStatus.value = 'error'

      logger.error('[PushRulesStore] Failed to sync push rules:', error)

      return false
    }
  }

  /**
   * 手动触发同步
   */
  const manualSync = async (): Promise<boolean> => {
    logger.info('[PushRulesStore] Manual sync triggered')
    return await syncPushRules()
  }

  // 初始化
  const initialize = async () => {
    if (flags.matrixPushRulesEnabled && flags.matrixEnabled) {
      await loadPushRules()
      await loadNotificationPolicy()
      initializeRuleTemplates()
      updateAnalytics()

      // 启用自动同步
      enableAutoSync()
    }
  }

  // 重置状态
  const reset = () => {
    rules.value = { global: [], device: [] }
    policy.value = null
    settings.value = {
      globalEnabled: true,
      messageSound: true,
      desktopNotifications: true,
      mobileNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      highlightMentions: true,
      highlightKeywords: true,
      showPreviews: true
    }
    analytics.value = null
    loading.value = false
    error.value = null
  }

  return {
    // 状态
    globalRules,
    deviceRules,
    activeRules,
    mutedRooms,
    mutedUsers,
    keywordRules,
    policy: computed(() => policy.value),
    settings: computed(() => settings.value),
    analytics: computed(() => analytics.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    ruleTemplates: computed(() => ruleTemplates.value),

    // 自动同步状态
    autoSyncEnabled: computed(() => autoSyncEnabled.value),
    syncStatus: computed(() => syncStatus.value),
    lastSyncTime: computed(() => lastSyncTime.value),
    syncError: computed(() => syncError.value),

    // 方法
    loadPushRules,
    loadNotificationPolicy,
    saveNotificationPolicy,
    enableRule,
    disableRule,
    addRule,
    removeRule,
    muteRoomNotifications,
    unmuteRoomNotifications,
    toggleRoomMute,
    muteUserNotifications,
    unmuteUserNotifications,
    toggleUserMute,
    setKeywordsHighlight,
    setQuietHoursSettings,
    updateSettings,
    resetSettings,
    initializeRuleTemplates,
    applyTemplate,
    updateAnalytics,
    exportRules,
    importRules,
    initialize,
    reset,

    // 自动同步方法
    enableAutoSync,
    disableAutoSync,
    syncPushRules,
    manualSync
  }
})
