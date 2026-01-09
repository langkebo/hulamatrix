/**
 * 消息已读计数队列模块
 * 用于批量获取消息的已读状态，通过队列和定时器机制优化请求频率
 *
 * @migration 从旧 WebSocket API 迁移到 Matrix Receipts API
 *
 * **旧的实现** (已废弃):
 * - 使用 WebSocket API (get_msg_read_count)
 * - 轮询方式获取已读状态
 * - 无法中断请求
 *
 * **新的实现**:
 * - 使用 Matrix Receipts API (m.read receipt)
 * - 事件驱动方式监听已读状态变化
 * - 实时更新，无需轮询
 *
 * **Matrix Receipts API 参考**:
 * - m.read receipt: 标记消息为已读
 * - room.getReceiptsForEvent(): 获取消息的所有已读回执
 * - Room.receipt 事件: 监听已读回执变化
 */

import { logger, toError } from '@/utils/logger'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMitt } from '@/hooks/useMitt'
import type { MsgReadUnReadCountType } from '@/services/types'
import { matrixReceiptsService } from '@/integrations/matrix/receipts'

// 类型定义
type ReadCountQueue = Set<string> // 改为存储事件 ID (Matrix 使用 eventId)
type ReadCountRequest = Promise<Map<string, MsgReadUnReadCountType[]>>

// 常量定义
const INTERVAL_DELAY = 10000 // 轮询间隔时间：10秒

// 状态变量
const queue: ReadCountQueue = new Set<string>() // 待处理的事件 ID 队列
let timerWorker: Worker | null = null // Web Worker定时器
let request: ReadCountRequest | null = null // 当前正在进行的请求
let isTimerActive = false // 标记定时器是否活跃
const roomEventCache = new Map<string, string>() // msgId -> eventId 映射缓存

// 事件类型定义
interface ReadCountTaskEvent {
  msgId: string // 消息 ID (旧的数字 ID)
  eventId?: string // 事件 ID (Matrix eventId)
  roomId?: string // 房间 ID
}

/**
 * 添加消息到已读计数队列
 * @param msgId 消息 ID (旧系统)
 * @param eventId 事件 ID (Matrix，可选)
 * @param roomId 房间 ID (Matrix，可选)
 */
const onAddReadCountTask = ({ msgId, eventId, roomId }: ReadCountTaskEvent) => {
  if (!msgId) return

  // 优先使用 eventId (Matrix 系统)
  const key = eventId || msgId

  queue.add(key)

  // 缓存 msgId -> eventId 和 roomId 映射
  if (eventId && roomId) {
    roomEventCache.set(msgId, roomId)
  }
}

/**
 * 从已读计数队列中移除消息
 * @param msgId 消息 ID
 */
const onRemoveReadCountTask = ({ msgId }: ReadCountTaskEvent) => {
  if (!msgId) return

  // 尝试移除
  queue.delete(msgId)

  // 清理缓存
  roomEventCache.delete(msgId)
}

/**
 * 检查用户是否可以发送已读计数请求
 * 返回布尔值表示是否可以发送请求
 */
const checkUserAuthentication = (): boolean => {
  // 1. 检查当前是否在登录窗口
  const currentWindow = WebviewWindow.getCurrent()
  if (currentWindow.label === 'login') {
    return false
  }
  return true
}

/**
 * 执行消息已读计数查询任务
 * 1. 检查队列是否为空
 * 2. 检查用户是否可以发送请求
 * 3. 使用 Matrix Receipts API 获取已读状态
 * 4. 处理响应数据并发送事件
 */
const task = async () => {
  try {
    // 队列为空则不发起请求
    if (queue.size === 0) return

    // 检查用户是否可以发送请求
    const canSendRequest = checkUserAuthentication()
    if (!canSendRequest) {
      logger.debug('[ReadCountQueue] 用户未登录或在登录窗口，跳过消息已读计数请求')
      // 在登录窗口时，清空队列并停止定时器
      clearQueue()
      return
    }

    // 发起新的批量查询请求
    // 使用 Matrix Receipts API 获取已读状态
    const results = new Map<string, MsgReadUnReadCountType[]>()

    // 按 roomId 分组
    const roomGroups = new Map<string, string[]>()
    for (const msgId of queue) {
      const roomId = roomEventCache.get(msgId)
      if (roomId) {
        if (!roomGroups.has(roomId)) {
          roomGroups.set(roomId, [])
        }
        roomGroups.get(roomId)!.push(msgId)
      }
    }

    // 为每个房间获取已读统计
    for (const [roomId, msgIds] of roomGroups.entries()) {
      try {
        // 使用 Matrix Receipts API 批量获取
        const statsMap = matrixReceiptsService.getBatchMessageReadStats(roomId, msgIds)

        // 转换为旧格式
        const countList: MsgReadUnReadCountType[] = []
        for (const [eventId, stats] of statsMap.entries()) {
          countList.push({
            msgId: eventId, // Matrix 使用 eventId
            readCount: stats.count,
            unReadCount: null, // Matrix 不提供未读数，设为 null
            readBy: stats.readBy.map((r) => ({
              userId: r.userId,
              displayName: r.displayName,
              avatarUrl: r.avatarUrl
            }))
          } as MsgReadUnReadCountType)
        }

        results.set(roomId, countList)
      } catch (error) {
        logger.error('[ReadCountQueue] 获取房间已读状态失败:', { roomId, error })
      }
    }

    // 发送已读计数更新事件
    for (const [roomId, countList] of results.entries()) {
      useMitt.emit('onGetReadCount', new Map(countList.map((item) => [item.msgId, item])))
    }

    logger.debug('[ReadCountQueue] 已读计数查询完成', {
      total: queue.size,
      rooms: roomGroups.size
    })
  } catch (error) {
    logger.error('[ReadCountQueue] 无法获取消息读取计数:', toError(error))
  } finally {
    request = null // 清理请求引用
  }
}

/**
 * 初始化消息已读计数监听器
 * 注册添加和移除消息的事件处理函数
 */
export const initListener = () => {
  useMitt.on('onAddReadCountTask', onAddReadCountTask)
  useMitt.on('onRemoveReadCountTask', onRemoveReadCountTask)
  clearQueue()

  // 初始化 Matrix Receipts 服务
  matrixReceiptsService.initialize().catch((error) => {
    logger.warn('[ReadCountQueue] Matrix Receipts 初始化失败，已读计数功能可能不可用:', error)
  })
}

/**
 * 清理消息已读计数监听器
 * 移除事件监听并停止定时器
 */
export const clearListener = () => {
  useMitt.off('onAddReadCountTask', onAddReadCountTask)
  useMitt.off('onRemoveReadCountTask', onRemoveReadCountTask)
  request = null
  stopTimer()
  // 终止Worker
  terminateWorker()
}

/**
 * 停止轮询定时器
 */
const stopTimer = () => {
  if (timerWorker && isTimerActive) {
    // 发送消息给worker停止定时器
    timerWorker.postMessage({
      type: 'clearTimer',
      msgId: 'readCountQueue' // 使用固定字符串作为定时器ID
    })
    isTimerActive = false
  }
}

/**
 * 清空消息队列
 * 清空队列并停止定时器
 */
export const clearQueue = () => {
  queue.clear()
  roomEventCache.clear()
  stopTimer()
}

/**
 * 初始化Web Worker
 */
const initWorker = () => {
  if (!timerWorker) {
    timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

    // 监听Worker消息
    timerWorker.onmessage = (e) => {
      const { type, msgId } = e.data

      // 当timer.worker.ts发送timeout消息时，执行task任务
      if (type === 'timeout' && msgId === 'readCountQueue') {
        void task()
        // 重新启动定时器
        startTimer()
      }
    }

    // 添加错误处理
    timerWorker.onerror = (error) => {
      logger.error('[ReadCountQueue Worker Error]', toError(error))
      isTimerActive = false
    }
  }
}

/**
 * 启动定时器
 */
const startTimer = () => {
  if (!timerWorker) {
    initWorker()
  }

  // 清除可能存在的旧定时器
  stopTimer()

  // 确保timerWorker已初始化
  if (timerWorker) {
    // 启动新的定时器
    timerWorker.postMessage({
      type: 'startTimer',
      msgId: 'readCountQueue', // 使用固定字符串作为定时器ID
      duration: INTERVAL_DELAY // 使用相同的轮询间隔时间
    })

    isTimerActive = true
  } else {
    logger.error('[ReadCountQueue] 无法初始化Web Worker定时器')
  }
}

/**
 * 终止Worker
 */
const terminateWorker = () => {
  if (timerWorker) {
    stopTimer()
    timerWorker.terminate()
    timerWorker = null
  }
}

/**
 * 启动消息已读计数队列
 * 1. 立即执行一次查询任务
 * 2. 启动定时轮询
 */
export const readCountQueue = () => {
  // 初始化Worker
  initWorker()

  // 立即执行一次任务
  void task()

  // 启动定时器
  startTimer()
}
