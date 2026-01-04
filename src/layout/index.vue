<template>
  <div id="layout" class="relative flex min-w-310px h-full" :style="{ background: 'var(--right-theme-bg)' }">
    <div class="flex flex-1 min-h-0">
      <!-- 使用keep-alive包裹异步组件 -->
      <keep-alive>
        <AsyncLeft />
      </keep-alive>
      <keep-alive>
        <AsyncCenter />
      </keep-alive>
      <keep-alive>
        <AsyncRight v-if="shouldShowRight" />
      </keep-alive>
    </div>
    <div
      v-if="overlayVisible"
      class="absolute inset-0 z-10 flex items-center justify-center"
      :style="{ background: 'var(--right-theme-bg)' }">
      <LoadingSpinner :percentage="loadingPercentage" :loading-text="loadingText" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent, nextTick, onBeforeMount, onMounted, onUnmounted } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useLogin } from '@/hooks/useLogin'
import { useMitt } from '@/hooks/useMitt'
import { useGlobalStore } from '@/stores/global'
import { isMobile, isWindows } from '@/utils/PlatformConstants'
import { MittEnum, MsgEnum, NotificationTypeEnum } from '@/enums'
import { clearListener, initListener, readCountQueue } from '@/utils/ReadCountQueue'
import { emitTo, listen } from '@tauri-apps/api/event'
import { UserAttentionType } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { MessageType } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useChatStore } from '@/stores/chat'
import { useFileStore } from '@/stores/file'
import { useUserStore } from '@/stores/user'
import { useSettingStore } from '@/stores/setting'
import { useInitialSyncStore } from '@/stores/initialSync'
import { useRoute } from 'vue-router'
import { audioManager } from '@/utils/AudioManager'
import { useOverlayController } from '@/hooks/useOverlayController'
import { receiveWebSocketMessage } from '@/services/unifiedMessageReceiver'
import { logger } from '@/utils/logger'
import { initializeNotifications } from '@/services/notificationService'

const route = useRoute()
const userStore = useUserStore()
const chatStore = useChatStore()
const fileStore = useFileStore()
const settingStore = useSettingStore()
// 负责记录哪些账号已经完成过首次同步的全局 store，避免多账号串数据
const initialSyncStore = useInitialSyncStore()
const userUid = computed(() => userStore.userInfo?.uid ?? '')
const hasCachedSessions = computed(() => chatStore.sessionList.length > 0)
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// WebWindowLike interface for cross-platform compatibility
interface WebWindowLike {
  label: string
  listen?: (_event: string, _handler: (...args: unknown[]) => void) => UnlistenFn | Promise<UnlistenFn>
}

const appWindow = isTauri
  ? WebviewWindow.getCurrent()
  : ({ label: 'web', listen: async () => () => {} } as WebWindowLike)

const loadingPercentage = ref(10)
const loadingText = ref('正在加载应用...')
const { resetLoginState, logout, init } = useLogin()
// 是否需要阻塞首屏并做初始化同步
const requiresInitialSync = ref(true)
const shouldBlockInitialRender = computed(() => requiresInitialSync.value && !hasCachedSessions.value)
const { overlayVisible, markAsyncLoaded } = useOverlayController({
  isInitialSync: shouldBlockInitialRender,
  progress: loadingPercentage,
  asyncTotal: 3,
  minDisplayMs: 600
})

let initPromise: Promise<void> | null = null
// 只有首次登录需要延迟异步组件的加载，后续重新登录直接渲染
const maybeDelayForInitialRender = async () => {
  if (!shouldBlockInitialRender.value) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 600))
}

// 根据当前 uid 判断是否需要阻塞首屏并重新同步（依赖持久化的初始化完成名单）
const syncInitialSyncState = () => {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  if (!isTauri) {
    requiresInitialSync.value = false
    return
  }
  if (!userUid.value || typeof window === 'undefined') {
    requiresInitialSync.value = true
    return
  }
  requiresInitialSync.value = !initialSyncStore.isSynced(userUid.value)
}

watch(
  () => userUid.value,
  () => {
    syncInitialSyncState()
  },
  { immediate: true }
)

// 初始化同步成功后标记当前 uid，后续启动直接走增量
const markInitialSyncCompleted = () => {
  if (!userUid.value || typeof window === 'undefined') {
    requiresInitialSync.value = false
    return
  }
  initialSyncStore.markSynced(userUid.value)
  requiresInitialSync.value = false
}

const runInitWithMode = (block: boolean) => {
  // 共同的初始化流程
  const p = init({ isInitialSync: block }).then(() => {
    markInitialSyncCompleted()
  })

  if (block) {
    // 首次完整同步：阻塞并抛出错误
    return p.catch((error) => {
      logger.error('[layout] 首次同步数据失败:', error)
      throw error
    })
  } else {
    // 增量同步：后台执行，错误只打日志
    p.catch((error) => {
      logger.error('[layout] 增量数据同步失败:', error)
    })
    return p
  }
}

// 确保初始化流程只触发一次
const ensureInitStarted = (blockInit: boolean) => {
  if (!initPromise) {
    initPromise = runInitWithMode(blockInit)
  }
  return initPromise
}

// 修改异步组件的加载配置
const AsyncLeft = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted(blockInit)
    await maybeDelayForInitialRender()
    loadingText.value = '正在加载左侧面板...'
    const comp = await import('./left/index.vue')
    loadingPercentage.value = 33
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()
    return comp
  }
})

const AsyncCenter = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted(blockInit)
    await import('./left/index.vue')
    loadingText.value = '正在加载数据中...'
    const comp = await import('./center/index.vue')
    loadingPercentage.value = 66
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()
    return comp
  }
})

const AsyncRight = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted(blockInit)
    await maybeDelayForInitialRender()
    await import('./center/index.vue')
    loadingText.value = '正在加载右侧面板...'
    const comp = await import('./right/index.vue')
    loadingPercentage.value = 100
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()

    // 在组件加载完成后，使用nextTick等待DOM更新
    nextTick(() => {
      // 发送事件通知聊天框组件滚动到底部
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    })

    return comp
  }
})

const globalStore = useGlobalStore()
import { useFriendsStore } from '@/stores/friends'
const friendsStore = useFriendsStore()
const shrinkStatus = ref(false)
const shouldShowRight = computed(() => {
  const p = route.path
  const isManage = p.includes('/rooms/manage') || p.includes('/settings') || p.includes('/manage')
  // In standard layout mode, always show right panel (except on management routes)
  const isStandardLayout = settingStore.chat.layoutMode === 'standard'
  if (isStandardLayout) {
    return !isManage
  }
  return !isManage && !shrinkStatus.value
})

// 导入Web Worker
const timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

// 添加错误处理
timerWorker.onerror = (error) => {
  logger.error('[Worker Error]', error)
}

// 监听 Worker 消息
timerWorker.onmessage = (e) => {
  const { type } = e.data
  if (type === 'timeout') {
    // Timer event - currently unused after auto-update removal
  }
}

watch(
  () => appWindow.label === 'home',
  (newValue) => {
    if (newValue) {
      // 初始化监听器
      initListener()
      // 读取消息队列
      readCountQueue()
    }
  },
  { immediate: true }
)

// 监听shrinkStatus的变化
watch(shrinkStatus, (newValue) => {
  if (!newValue) {
    // 当shrinkStatus为false时，等待组件渲染完成后滚动到底部
    nextTick(() => {
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    })
  }
})

/**
 * event默认如果没有传递值就为true，所以shrinkStatus的值为false就会发生值的变化
 * 因为shrinkStatus的值为false，所以v-if="!shrinkStatus" 否则right组件刚开始渲染的时候不会显示
 * */
useMitt.on(MittEnum.SHRINK_WINDOW, (event: boolean) => {
  shrinkStatus.value = event
})

// 播放消息音效
const playMessageSound = async () => {
  // 检查是否开启了消息提示音
  if (!settingStore.notification?.messageSound) {
    return
  }

  try {
    const audio = new Audio('/sound/message.mp3')
    await audioManager.play(audio, 'message-notification')
  } catch (error) {
    logger.warn('播放消息音效失败:', error)
  }
}

/**
 * 从消息中提取文件信息并添加到 file store
 */
const addFileToStore = (data: MessageType) => {
  const { message } = data
  const { type, body, roomId, id } = message

  // 只处理图片和视频类型
  if (type !== MsgEnum.IMAGE && type !== MsgEnum.VIDEO) {
    return
  }

  // 提取文件信息
  const fileUrl = body.url
  if (!fileUrl) {
    return
  }

  // 从 URL 中提取文件名
  let fileName = ''
  try {
    const urlObj = new URL(fileUrl)
    const pathname = urlObj.pathname
    fileName = pathname.substring(pathname.lastIndexOf('/') + 1)
  } catch (e) {
    // 如果不是有效的 URL，直接使用消息 ID 作为文件名
    fileName = `${id}.${type === MsgEnum.IMAGE ? 'jpg' : 'mp4'}`
  }

  // 从文件名中提取后缀
  const suffix = fileName.includes('.')
    ? fileName.substring(fileName.lastIndexOf('.') + 1)
    : type === MsgEnum.IMAGE
      ? 'jpg'
      : 'mp4'

  // 确定 MIME 类型
  let mimeType = ''
  if (type === MsgEnum.IMAGE) {
    mimeType = `image/${suffix === 'jpg' ? 'jpeg' : suffix}`
  } else if (type === MsgEnum.VIDEO) {
    mimeType = `video/${suffix}`
  }

  // 添加到 file store
  fileStore.addFile({
    id,
    roomId,
    fileName,
    type: type === MsgEnum.IMAGE ? 'image' : 'video',
    url: fileUrl,
    suffix,
    mimeType
  })
}

useMitt.on(WsResponseMessageType.RECEIVE_MESSAGE, async (data: MessageType) => {
  // 使用统一消息接收服务处理消息
  const result = await receiveWebSocketMessage(data)

  // 如果消息是重复的，直接返回
  if (result.wasDuplicate) {
    return
  }

  // 处理失败，记录错误
  if (!result.success) {
    logger.error('[MessageFlow] Message processing failed:', { error: result.error })
    return
  }

  // 消息处理成功后的后续操作
  // 如果是图片或视频消息，添加到 file store（移动端和PC端都需要）
  // 使用平台适配器判断是否需要缓存
  const msgType = data.message?.type || (data as { msg_type?: string }).msg_type
  const isImageVideo = msgType && ['image', 'm.image', 'video', 'm.video'].includes(String(msgType))

  if (isImageVideo) {
    // 移动端需要缓存以便在文件管理器中查看
    // PC端也缓存以便保持一致性
    addFileToStore(data)
  }

  const currentUid = userUid.value
  // 不是自己发的消息才通知
  if (!currentUid || data.fromUser.uid !== currentUid) {
    // 获取该消息的会话信息
    const session = chatStore.sessionList.find((s) => s.roomId === data.message.roomId)

    // 只有非免打扰的会话才发送通知和触发图标闪烁
    if (session && session.muteNotification !== NotificationTypeEnum.NOT_DISTURB) {
      // 检查 home 窗口状态
      const home = isTauri ? await WebviewWindow.getByLabel('home') : null
      let shouldPlaySound = false

      if (home) {
        try {
          const isVisible = await home.isVisible()
          const isMinimized = await home.isMinimized()
          const isFocused = await home.isFocused()

          // 如果窗口不可见、被最小化或未聚焦，则播放音效
          shouldPlaySound = !isVisible || isMinimized || !isFocused

          // 在Windows系统下，如果窗口最小化或未聚焦时请求用户注意
          if (isWindows() && (isMinimized || !isFocused)) {
            await home.requestUserAttention(UserAttentionType.Critical)
          }
        } catch (error) {
          logger.warn('检查窗口状态失败:', error)
          // 如果检查失败，默认播放音效
          shouldPlaySound = true
        }
      } else {
        // 如果找不到 home 窗口，播放音效
        shouldPlaySound = true
      }

      // 播放消息音效
      if (shouldPlaySound) {
        await playMessageSound()
      }
      // session.unreadCount++
      // 在windows系统下才发送通知
      if (isWindows()) {
        globalStore.setTipVisible(true)
      }

      if (isTauri && WebviewWindow.getCurrent().label === 'home') {
        await emitTo('notify', 'notify_content', data)
      }
    }
  }

  globalStore.updateGlobalUnreadCount()
})

if (isTauri) {
  listen('relogin', async () => {
    info('收到重新登录事件')
    await resetLoginState()
    await logout()
  })
}

onBeforeMount(async () => {
  await friendsStore.refreshAll()
})

// 根据路由自动控制右侧面板显隐（在管理类页面中隐藏右侧，以腾出空间）
watch(
  () => route.path,
  () => {
    // 通过 shouldShowRight 计算控制右侧显隐，无需直接修改 shrinkStatus
  },
  { immediate: true }
)

onMounted(async () => {
  // 初始化统一通知服务
  await initializeNotifications()

  // Phase 1 Migration: 检查是否禁用WebSocket
  const websocketDisabled = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true'

  // 监听home窗口被聚焦的事件，当窗口被聚焦时自动关闭状态栏通知
  if (!isTauri) return
  const homeWindow = await WebviewWindow.getByLabel('home')
  if (homeWindow) {
    // WebSocket 已废弃，统一使用 Matrix SDK 处理消息
    logger.info('Using Matrix SDK for message handling (WebSocket removed)')

    // 监听窗口聚焦事件，聚焦时停止tray闪烁
    if (isWindows()) {
      homeWindow.listen('tauri://focus', async () => {
        globalStore.setTipVisible(false)
        try {
          await emitTo('tray', 'home_focus', {})
          await emitTo('notify', 'home_focus', {})
        } catch (error) {
          logger.warn('[layout] 向其他窗口广播聚焦事件失败:', error)
        }
      })

      homeWindow.listen('tauri://blur', async () => {
        try {
          await emitTo('tray', 'home_blur', {})
          await emitTo('notify', 'home_blur', {})
        } catch (error) {
          logger.warn('[layout] 向其他窗口广播失焦事件失败:', error)
        }
      })
    }
    // 居中
    await homeWindow.center()
    await homeWindow.show()
  }
})

onUnmounted(() => {
  clearListener()
  // 清除Web Worker计时器
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: 'checkUpdate'
  })
  timerWorker.terminate()
})
</script>
const isRoomsManage = computed(() => route.path === '/rooms/manage')
