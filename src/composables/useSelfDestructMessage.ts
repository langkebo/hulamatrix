/**
 * 自毁消息组合式函数
 * 用于检测和管理自毁消息的倒计时显示
 *
 * Requirements 7.2: THE UI SHALL display countdown timer for self-destruct messages
 * Requirements 7.5: THE UI SHALL show "message expired" placeholder after destruction
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export interface SelfDestructInfo {
  expiresAt: number // 过期时间戳 (ms)
  timeout: number // 超时时间 (ms)
  willSelfDestruct: boolean // 是否会自毁
  // Legacy fields for backward compatibility
  destroyAfter?: number // 销毁时间（秒）- deprecated
  createdAt?: number // 创建时间戳 - deprecated
}

export interface UseSelfDestructMessageOptions {
  messageId: string
  roomId: string
  eventId?: string
  messageBody?: MessageBodyContent
  onDestroy?: (messageId: string) => void
  onWarning?: (messageId: string, remainingTime: number) => void
}

// Type for message body content with self-destruct properties
interface MessageBodyContent {
  'im.hula.self_destruct'?: SelfDestructNewFormat
  'com.hula.self_destruct'?: SelfDestructLegacyFormat
  [key: string]: unknown
}

interface SelfDestructNewFormat {
  expires_at: number
  timeout: number
  [key: string]: unknown
}

interface SelfDestructLegacyFormat {
  will_self_destruct: boolean
  destroy_after?: number
  created_at?: number
  [key: string]: unknown
}

export function useSelfDestructMessage(options: UseSelfDestructMessageOptions) {
  const { t } = useI18n()

  // 响应式状态
  const remainingTime = ref(0)
  const isDestroying = ref(false)
  const isWarningState = ref(false)
  const isDestroyed = ref(false)
  const intervalId = ref<ReturnType<typeof setInterval> | null>(null)

  // 警告时间阈值（10秒）
  const WARNING_TIME = 10000

  /**
   * 检查消息是否为自毁消息
   * Supports both new (im.hula.self_destruct) and legacy (com.hula.self_destruct) formats
   */
  const isSelfDestructMessage = computed(() => {
    const body = options.messageBody
    if (!body) return false

    // Check new format first (im.hula.self_destruct)
    const newFormat = body['im.hula.self_destruct']
    if (newFormat?.expires_at && newFormat?.timeout) {
      return true
    }

    // Check legacy format (com.hula.self_destruct)
    const legacyFormat = body['com.hula.self_destruct']
    return legacyFormat?.will_self_destruct === true
  })

  /**
   * 获取自毁消息信息
   * Normalizes both new and legacy formats
   */
  const selfDestructInfo = computed((): SelfDestructInfo | null => {
    if (!isSelfDestructMessage.value) return null

    const body = options.messageBody
    if (!body) return null

    // Check new format first (im.hula.self_destruct)
    const newFormat = body['im.hula.self_destruct']
    if (newFormat?.expires_at && newFormat?.timeout) {
      return {
        expiresAt: newFormat.expires_at,
        timeout: newFormat.timeout,
        willSelfDestruct: true
      }
    }

    // Fallback to legacy format (com.hula.self_destruct)
    const legacyFormat = body['com.hula.self_destruct']
    if (legacyFormat) {
      const destroyAfter = legacyFormat.destroy_after || 300 // 默认5分钟
      const createdAt = legacyFormat.created_at || Date.now()
      return {
        expiresAt: createdAt + destroyAfter * 1000,
        timeout: destroyAfter * 1000,
        willSelfDestruct: true,
        // Include legacy fields for backward compatibility
        destroyAfter,
        createdAt
      }
    }

    return null
  })

  /**
   * 获取存储中的剩余时间
   */
  const getStoredRemainingTime = (): number => {
    try {
      const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}')
      const key = `${options.roomId}_${options.eventId || options.messageId}`
      const timer = timers[key]

      if (timer && timer.destroyTime) {
        return Math.max(0, timer.destroyTime - Date.now())
      }

      // If no stored timer, calculate from message metadata
      if (selfDestructInfo.value) {
        return Math.max(0, selfDestructInfo.value.expiresAt - Date.now())
      }
    } catch {
      // 忽略解析错误
    }

    return 0
  }

  /**
   * 格式化剩余时间显示
   * Requirements 7.2: THE UI SHALL display countdown timer for self-destruct messages
   */
  const formatRemainingTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000)

    if (seconds < 60) {
      return `${seconds}${t('message.selfDestruct.countdown.seconds')}`
    }

    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      if (remainingSeconds > 0) {
        return `${minutes}${t('message.selfDestruct.countdown.minutes')}${remainingSeconds}${t('message.selfDestruct.countdown.seconds')}`
      }
      return `${minutes}${t('message.selfDestruct.countdown.minutes')}`
    }

    const hours = Math.floor(seconds / 3600)
    const remainingMinutes = Math.floor((seconds % 3600) / 60)
    if (remainingMinutes > 0) {
      return `${hours}${t('message.selfDestruct.countdown.hours')}${remainingMinutes}${t('message.selfDestruct.countdown.minutes')}`
    }
    return `${hours}${t('message.selfDestruct.countdown.hours')}`
  }

  /**
   * 格式化的剩余时间字符串
   */
  const formattedRemainingTime = computed(() => {
    return formatRemainingTime(remainingTime.value)
  })

  /**
   * 倒计时进度百分比 (0-100)
   */
  const countdownProgress = computed(() => {
    if (!selfDestructInfo.value) return 100

    const totalTime = selfDestructInfo.value.timeout
    return Math.max(0, Math.min(100, (remainingTime.value / totalTime) * 100))
  })

  /**
   * 倒计时颜色 (根据剩余时间变化)
   */
  const countdownColor = computed(() => {
    const progress = countdownProgress.value
    if (progress > 30) return 'var(--hula-brand-primary)' // 绿色
    if (progress > 10) return 'var(--hula-brand-primary)' // 黄色
    return 'var(--hula-brand-primary)' // 红色
  })

  /**
   * 开始倒计时
   * Requirements 7.2: THE UI SHALL display countdown timer for self-destruct messages
   */
  const startCountdown = () => {
    if (intervalId.value || !isSelfDestructMessage.value) return

    // 初始化剩余时间
    remainingTime.value = getStoredRemainingTime()

    if (remainingTime.value <= 0) {
      handleDestroy()
      return
    }

    intervalId.value = setInterval(() => {
      remainingTime.value = getStoredRemainingTime()

      // 检查是否进入警告状态
      if (remainingTime.value <= WARNING_TIME && !isWarningState.value) {
        isWarningState.value = true
        options.onWarning?.(options.messageId, remainingTime.value)
      }

      // 开始自毁动画（最后3秒）
      if (remainingTime.value <= 3000 && remainingTime.value > 0 && !isDestroying.value) {
        isDestroying.value = true
      }

      // 触发自毁
      if (remainingTime.value <= 0) {
        handleDestroy()
      }
    }, 1000)
  }

  /**
   * 停止倒计时
   */
  const stopCountdown = () => {
    if (intervalId.value) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }
  }

  /**
   * 处理消息销毁
   * Requirements 7.5: THE UI SHALL show "message expired" placeholder after destruction
   */
  const handleDestroy = () => {
    stopCountdown()
    isDestroyed.value = true
    options.onDestroy?.(options.messageId)
  }

  /**
   * 监听消息销毁事件
   * Requirements 7.5: THE UI SHALL show "message expired" placeholder after destruction
   */
  const handleSelfDestructEvent = (event: CustomEvent) => {
    const { roomId, eventId } = event.detail
    if (roomId === options.roomId && (eventId === options.eventId || eventId === options.messageId)) {
      handleDestroy()
    }
  }

  // 生命周期
  onMounted(() => {
    if (isSelfDestructMessage.value) {
      startCountdown()

      // 监听全局销毁事件
      window.addEventListener('message-self-destructed', handleSelfDestructEvent as EventListener)
    }
  })

  onUnmounted(() => {
    stopCountdown()
    window.removeEventListener('message-self-destructed', handleSelfDestructEvent as EventListener)
  })

  // 监听消息体变化
  watch(
    () => options.messageBody,
    () => {
      if (isSelfDestructMessage.value && !intervalId.value) {
        startCountdown()
      }
    },
    { deep: true }
  )

  return {
    // 状态
    isSelfDestructMessage,
    selfDestructInfo,
    remainingTime,
    isDestroying,
    isWarningState,
    isDestroyed,

    // 计算属性
    formattedRemainingTime,
    countdownProgress,
    countdownColor,

    // 方法
    startCountdown,
    stopCountdown,
    formatRemainingTime
  }
}
