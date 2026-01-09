import { matrixClientService } from './client'
import { flags } from '@/utils/envFlags'
import { logger } from '@/utils/logger'

export type HttpPusherConfig = {
  url: string
  app_id: string
  pushkey: string
  app_display_name?: string
  device_display_name?: string
  lang?: string
  profile_tag?: string
  format?: 'event_id_only' | 'full'
}

export type PushRuleAction =
  | { set_tweak: 'highlight' }
  | { set_tweak: 'sound'; value?: string }
  | { set_tweak: 'display'; value?: string }
  | 'dont_notify'
  | 'notify'
  | Record<string, unknown>

export type PushRuleCondition = {
  kind: string
  key?: string
  pattern?: string
  [key: string]: unknown
}

export type PushRule = {
  rule_id: string
  scope: 'global' | 'device'
  kind: 'override' | 'content' | 'room' | 'sender' | 'underride'
  actions: PushRuleAction[]
  pattern?: string
  conditions?: PushRuleCondition[]
  enabled: boolean
  default?: boolean
}

export type NotificationPolicy = {
  keywords: string[]
  userBlacklist: string[]
  roomBlacklist: string[]
  roomWhitelist: string[]
  enableAll: boolean
  enableHighlights: boolean
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

/**
 * 设置HTTP推送器
 */
export async function setHttpPusher(cfg: HttpPusherConfig) {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')
  const base = (client.baseUrl as string | undefined)?.replace(/\/$/, '') || ''
  const body = {
    pushkey: cfg.pushkey,
    kind: 'http',
    app_id: cfg.app_id,
    app_display_name: cfg.app_display_name || 'HuLa',
    device_display_name: cfg.device_display_name || 'HuLa Device',
    lang: cfg.lang || 'zh-CN',
    profile_tag: cfg.profile_tag || undefined,
    data: { url: cfg.url, format: cfg.format || 'full' },
    append: true
  }
  const res = await fetch(`${base}/_matrix/client/v3/pushers/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`setPusher failed: ${res.status}`)
  return await res.json().catch(() => ({}))
}

/**
 * 获取推送规则
 */
export async function getPushRules(): Promise<{ global: PushRule[]; device: PushRule[] }> {
  const client = matrixClientService.getClient()
  if (!client) return { global: [], device: [] }

  try {
    const rulesResponse = await (client.getPushRules as (() => Promise<Record<string, unknown>>) | undefined)?.()
    if (!rulesResponse) {
      return { global: [], device: [] }
    }

    const globalRules = parseRules((rulesResponse.global || {}) as Record<string, unknown>)
    const deviceRules = parseRules((rulesResponse.device || {}) as Record<string, unknown>)

    return { global: globalRules, device: deviceRules }
  } catch (error) {
    logger.error('Failed to get push rules:', error)
    return { global: [], device: [] }
  }
}

/**
 * 设置推送规则启用状态
 */
export async function setPushRuleEnabled(
  scope: 'global' | 'device' = 'global',
  kind: PushRule['kind'],
  ruleId: string,
  enabled: boolean
): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  try {
    const setPushRuleEnabledFn = client.setPushRuleEnabled as
      | ((scope: string, kind: string, ruleId: string, enabled: boolean) => Promise<void>)
      | undefined
    await setPushRuleEnabledFn?.(scope, kind, ruleId, enabled)
  } catch (error) {
    logger.error('Failed to set push rule enabled:', error)
    throw error
  }
}

/**
 * 创建推送规则
 */
export async function createPushRule(
  scope: 'global' | 'device' = 'global',
  kind: PushRule['kind'],
  ruleId: string,
  actions: PushRuleAction[],
  pattern?: string,
  conditions?: PushRuleCondition[]
): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  try {
    const ruleData = {
      actions,
      pattern,
      conditions
    }

    const addPushRuleFn = client.addPushRule as
      | ((scope: string, kind: string, ruleId: string, ruleData: Record<string, unknown>) => Promise<void>)
      | undefined
    await addPushRuleFn?.(scope, kind, ruleId, ruleData)
  } catch (error) {
    logger.error('Failed to create push rule:', error)
    throw error
  }
}

/**
 * 删除推送规则
 */
export async function deletePushRule(
  scope: 'global' | 'device' = 'global',
  kind: PushRule['kind'],
  ruleId: string
): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  try {
    const deletePushRuleFn = client.deletePushRule as
      | ((scope: string, kind: string, ruleId: string) => Promise<void>)
      | undefined
    await deletePushRuleFn?.(scope, kind, ruleId)
  } catch (error) {
    logger.error('Failed to delete push rule:', error)
    throw error
  }
}

/**
 * 屏蔽房间通知
 */
export async function muteRoom(roomId: string): Promise<void> {
  try {
    await createPushRule('global', 'room', roomId, ['dont_notify'])
  } catch (error) {
    logger.error('Failed to mute room:', error)
    throw error
  }
}

/**
 * 取消屏蔽房间通知
 */
export async function unmuteRoom(roomId: string): Promise<void> {
  try {
    await deletePushRule('global', 'room', roomId)
  } catch (error) {
    logger.error('Failed to unmute room:', error)
    throw error
  }
}

/**
 * 屏蔽用户通知
 */
export async function muteUser(userId: string): Promise<void> {
  try {
    await createPushRule('global', 'sender', userId, ['dont_notify'])
  } catch (error) {
    logger.error('Failed to mute user:', error)
    throw error
  }
}

/**
 * 取消屏蔽用户通知
 */
export async function unmuteUser(userId: string): Promise<void> {
  try {
    await deletePushRule('global', 'sender', userId)
  } catch (error) {
    logger.error('Failed to unmute user:', error)
    throw error
  }
}

/**
 * 设置关键词高亮规则
 */
export async function setKeywordHighlight(
  keywords: string[],
  opts?: { highlight?: boolean; sound?: boolean }
): Promise<void> {
  try {
    // 清除现有的关键词规则
    await clearKeywordRules()

    // 为每个关键词创建规则
    for (const keyword of keywords) {
      const highlight = opts?.highlight !== false
      const sound = opts?.sound !== false
      const actions: PushRuleAction[] = []
      if (highlight) actions.push({ set_tweak: 'highlight' })
      if (sound) actions.push({ set_tweak: 'sound', value: 'default' })
      await createPushRule(
        'global',
        'content',
        `keyword_${keyword}`,
        actions.length ? actions : [{ set_tweak: 'highlight' }],
        keyword
      )
    }
  } catch (error) {
    logger.error('Failed to set keyword highlights:', error)
    throw error
  }
}

/**
 * 获取通知策略
 */
export async function getNotificationPolicy(): Promise<NotificationPolicy> {
  try {
    const { global } = await getPushRules()

    const policy: NotificationPolicy = {
      keywords: [],
      userBlacklist: [],
      roomBlacklist: [],
      roomWhitelist: [],
      enableAll: true,
      enableHighlights: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    }

    // 解析现有规则
    global.forEach((rule) => {
      if (rule.kind === 'content' && rule.pattern && rule.rule_id.startsWith('keyword_')) {
        policy.keywords.push(rule.pattern)
      } else if (rule.kind === 'sender') {
        policy.userBlacklist.push(rule.rule_id)
      } else if (rule.kind === 'room') {
        if (rule.actions.includes('dont_notify')) {
          policy.roomBlacklist.push(rule.rule_id)
        } else {
          policy.roomWhitelist.push(rule.rule_id)
        }
      } else if (rule.kind === 'override' && rule.rule_id === 'quiet_hours' && rule.actions.includes('dont_notify')) {
        policy.quietHours.enabled = true
        // 如需解析时间条件，可在条件中查找自定义结构
      }
    })

    return policy
  } catch (error) {
    logger.error('Failed to get notification policy:', error)
    return getDefaultNotificationPolicy()
  }
}

/**
 * 应用通知策略
 */
export async function applyNotificationPolicy(policy: NotificationPolicy): Promise<void> {
  try {
    // 清除现有规则
    await clearAllCustomRules()

    // 应用关键词规则
    if (policy.keywords.length > 0) {
      await setKeywordHighlight(policy.keywords)
    }

    // 应用用户屏蔽规则
    for (const userId of policy.userBlacklist) {
      await muteUser(userId)
    }

    // 应用房间规则
    for (const roomId of policy.roomBlacklist) {
      await muteRoom(roomId)
    }

    // 设置静默时间
    if (policy.quietHours.enabled) {
      await setQuietHours(policy.quietHours.start, policy.quietHours.end)
    }
  } catch (error) {
    logger.error('Failed to apply notification policy:', error)
    throw error
  }
}

/**
 * 设置静默时间
 */
export async function setQuietHours(start: string, end: string): Promise<void> {
  try {
    const conditions = [
      {
        kind: 'time',
        start,
        end
      }
    ]

    await createPushRule('global', 'override', 'quiet_hours', ['dont_notify'], undefined, conditions)
  } catch (error) {
    logger.error('Failed to set quiet hours:', error)
    throw error
  }
}

/**
 * 清除静默时间规则
 */
export async function clearQuietHours(): Promise<void> {
  try {
    await deletePushRule('global', 'override', 'quiet_hours')
  } catch (error) {
    logger.error('Failed to clear quiet hours:', error)
    // 允许静默失败不中断流程
  }
}
/**
 * 解析推送规则
 */
function parseRules(rulesData: Record<string, unknown>): PushRule[] {
  const rules: PushRule[] = []

  const kinds: PushRule['kind'][] = ['override', 'content', 'room', 'sender', 'underride']

  kinds.forEach((kind) => {
    const kindRules = (rulesData[kind] as Record<string, unknown>[]) || []
    kindRules.forEach((ruleData: Record<string, unknown>) => {
      rules.push({
        rule_id: ruleData.rule_id as string,
        scope: 'global', // 默认为global，实际使用时会传入
        kind,
        actions: (ruleData.actions as PushRuleAction[]) || [],
        pattern: ruleData.pattern as string | undefined,
        conditions: ruleData.conditions as PushRuleCondition[] | undefined,
        enabled: ruleData.enabled !== false,
        default: (ruleData.default as boolean) || false
      })
    })
  })

  return rules
}

/**
 * 清除所有自定义规则
 */
async function clearAllCustomRules(): Promise<void> {
  const { global } = await getPushRules()

  for (const rule of global) {
    if (!rule.default) {
      try {
        await deletePushRule('global', rule.kind, rule.rule_id)
      } catch (error) {
        logger.warn(`Failed to delete rule ${rule.rule_id}:`, error)
      }
    }
  }
}

/**
 * 清除关键词规则
 */
async function clearKeywordRules(): Promise<void> {
  const { global } = await getPushRules()

  for (const rule of global) {
    if (rule.kind === 'content' && rule.rule_id.startsWith('keyword_')) {
      try {
        await deletePushRule('global', rule.kind, rule.rule_id)
      } catch (error) {
        logger.warn(`Failed to delete keyword rule ${rule.rule_id}:`, error)
      }
    }
  }
}

/**
 * 获取默认通知策略
 */
function getDefaultNotificationPolicy(): NotificationPolicy {
  return {
    keywords: [],
    userBlacklist: [],
    roomBlacklist: [],
    roomWhitelist: [],
    enableAll: true,
    enableHighlights: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  }
}

/**
 * 设置推送器配置（如果启用推送功能）
 */
export async function setupPusherIfEnabled(): Promise<void> {
  if (!flags.matrixPushEnabled) {
    logger.info('[Pusher] Push notifications are disabled, skipping setup')
    return
  }

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[Pusher] Matrix client not available')
      return
    }

    // 检查是否已配置推送器
    const getPushersMethod = client.getPushers as
      | (() => Promise<{ pushers: { pushkey: string; kind?: string }[] }>)
      | undefined
    if (!getPushersMethod) {
      logger.warn('[Pusher] getPushers method not available')
      return
    }

    const pushersResult = await getPushersMethod()
    const pushers = pushersResult.pushers || []

    // 检查是否已有 HTTP pusher
    const hasHttpPusher = pushers.some((p) => p.kind === 'http' || p.kind === 'http')

    if (hasHttpPusher) {
      logger.info('[Pusher] HTTP pusher already configured')
      return
    }

    // 获取设备推送令牌（如果支持）
    const pushToken = await getDevicePushToken()
    if (!pushToken) {
      logger.info('[Pusher] No push token available, skipping setup')
      return
    }

    // 获取当前设备信息
    const getDeviceIdMethod = client.getDeviceId as (() => string) | undefined
    const getUserIdMethod = client.getUserId as (() => string) | undefined

    const deviceId = getDeviceIdMethod?.() || ''
    const userId = getUserIdMethod?.() || ''

    if (!deviceId || !userId) {
      logger.warn('[Pusher] Unable to get device or user ID')
      return
    }

    // 构建推送器配置
    const pusherConfig: HttpPusherConfig = {
      // 使用 Matrix 推送网关或自定义推送网关
      url: import.meta.env.VITE_MATRIX_PUSH_GATEWAY || 'https://cjystx.top/_matrix/push/v1/notify',
      app_id: getPlatformAppId(),
      pushkey: pushToken,
      app_display_name: 'HuLa Matrix',
      device_display_name: `HuLa - ${getDeviceDisplayName()}`,
      lang: 'zh-CN',
      format: 'event_id_only'
    }

    // 设置推送器
    await setHttpPusher(pusherConfig)

    // 配置推送规则
    await setupDefaultPushRules()

    logger.info('[Pusher] Pusher setup completed', {
      appId: pusherConfig.app_id,
      deviceDisplayName: pusherConfig.device_display_name
    })
  } catch (error) {
    logger.error('[Pusher] Failed to setup pusher:', error)
  }
}

/**
 * 获取设备推送令牌
 * 根据平台获取 FCM/APNS 令牌
 */
async function getDevicePushToken(): Promise<string | null> {
  const platform = import.meta.env.TAURI_ENV_PLATFORM || ''

  // 移动端平台
  if (platform === 'android' || platform === 'ios') {
    try {
      // 尝试从 Tauri 插件获取推送令牌
      if (typeof window !== 'undefined' && (window as { __TAURI__?: unknown }).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core')
        const token = await invoke<string>('get_push_token')
        return token
      }
    } catch (error) {
      logger.warn('[Pusher] Failed to get mobile push token:', error)
    }
  }

  // 桌面端 - 检查是否支持浏览器推送
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      // 检查是否已有订阅
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // 将 PushSubscription 转换为 VAPID 密钥
        const rawKey = subscription.getKey('p256dh')
        const rawAuth = subscription.getKey('auth')

        if (rawKey && rawAuth) {
          const key = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
          const auth = btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
          return JSON.stringify({
            endpoint: subscription.endpoint,
            keys: { p256dh: key, auth }
          })
        }
      }
    } catch (error) {
      logger.warn('[Pusher] Failed to get web push subscription:', error)
    }
  }

  return null
}

/**
 * 获取平台应用 ID
 */
function getPlatformAppId(): string {
  const platform = import.meta.env.TAURI_ENV_PLATFORM || ''

  switch (platform) {
    case 'android':
      return 'com.hula.matrix.android'
    case 'ios':
      return 'com.hula.matrix.ios'
    case 'windows':
      return 'com.hula.matrix.windows'
    case 'darwin':
      return 'com.hula.matrix.macos'
    case 'linux':
      return 'com.hula.matrix.linux'
    default:
      return 'com.hula.matrix.web'
  }
}

/**
 * 获取设备显示名称
 */
function getDeviceDisplayName(): string {
  const platform = import.meta.env.TAURI_ENV_PLATFORM || 'unknown'

  const userAgent = navigator.userAgent
  let osName = 'Unknown'

  if (userAgent.includes('Windows')) osName = 'Windows'
  else if (userAgent.includes('Mac')) osName = 'macOS'
  else if (userAgent.includes('Linux')) osName = 'Linux'
  else if (userAgent.includes('Android')) osName = 'Android'
  else if (userAgent.includes('iOS')) osName = 'iOS'

  return `${osName} - ${platform}`
}

/**
 * 设置默认推送规则
 */
async function setupDefaultPushRules(): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) return

  try {
    // 设置默认的推送规则
    const setPushRuleActionsMethod = client.setPushRuleActions as
      | ((scope: string, kind: string, ruleId: string, actions: PushRuleAction[], enable?: boolean) => Promise<void>)
      | undefined

    if (!setPushRuleActionsMethod) {
      logger.warn('[Pusher] setPushRuleActions method not available')
      return
    }

    // 1. 启用所有消息的推送（带声音）
    await setPushRuleActionsMethod(
      'global',
      'override',
      '.m.rule.master',
      ['notify', { set_tweak: 'sound', value: 'default' }],
      true
    )

    // 2. 禁用 @room 通知的默认行为
    await setPushRuleActionsMethod('global', 'override', '.m.rule.suppress_notices', ['dont_notify'], true)

    // 3. 为提及设置特殊通知
    await setPushRuleActionsMethod(
      'global',
      'content',
      '.m.rule.contains_user_name',
      ['notify', { set_tweak: 'sound', value: 'default' }, { set_tweak: 'highlight' }],
      true
    )

    logger.info('[Pusher] Default push rules configured')
  } catch (error) {
    logger.error('[Pusher] Failed to setup default push rules:', error)
  }
}

/**
 * 移除推送器
 */
export async function removePusher(pushkey: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  const base = (client.baseUrl as string | undefined)?.replace(/\/$/, '') || ''

  const res = await fetch(`${base}/_matrix/client/v3/pushers/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pushkey,
      kind: null,
      app_id: '',
      data: {}
    })
  })

  if (!res.ok) throw new Error(`removePusher failed: ${res.status}`)
  logger.info('[Pusher] Pusher removed:', { pushkey })
}
