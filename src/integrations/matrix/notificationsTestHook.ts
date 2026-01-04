import { useSettingStore } from '@/stores/setting'
import { audioManager } from '@/utils/AudioManager'
import { computeNotificationPolicy } from '@/utils/notificationPolicy'

import { msg } from '@/utils/SafeUI'

export function setupTestNotificationsHook() {
  const settingStore = useSettingStore()
  let lastSoundAt = 0
  const SOUND_WINDOW_MS = 800

  const notify = (title: string, body: string, silent?: boolean) => {
    try {
      window.$notification?.create?.({ title, content: body, duration: 3000 })
    } catch {
      msg.info?.(`${title}: ${body}`)
    }
    try {
      const allowSound = settingStore.notification?.messageSound === true
      const now = Date.now()
      if (allowSound && !silent && now - lastSoundAt > SOUND_WINDOW_MS) {
        const windowWithAudio = window as typeof window & { Audio?: typeof Audio }
        const audio = new windowWithAudio.Audio('/sound/message.mp3')
        void audioManager.play(audio, 'message-sound')
        lastSoundAt = now
      }
    } catch {}
  }

  const queue: Array<{ title: string; body: string; silent?: boolean }> = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const enqueue = (n: { title: string; body: string; silent?: boolean }) => {
    queue.push(n)
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      const count = queue.length
      const last = queue[count - 1] ?? { title: '新消息', body: '[消息]' }
      const title = count > 1 ? `有 ${count} 条新消息` : (last.title ?? '新消息')
      const body = count > 1 ? `来自 ${count} 个事件` : (last.body ?? '[消息]')
      const allSilent = queue.every((q) => q.silent)
      notify(title || '新消息', body || '[消息]', allSilent)
      queue.length = 0
    }, 300)
  }

  // 只在开发模式下添加测试通知监听器
  if (import.meta.env?.DEV) {
    const testNotifyHandler = (e: Event) => {
      const d = (e as CustomEvent)?.detail || {}
      const policy = computeNotificationPolicy({
        session: d.session,
        isForeground: !!d.isForeground,
        isActiveChat: !!d.isActiveChat
      })
      if (policy.skip) return
      enqueue({ title: d.title || '新消息', body: d.body || '[消息]', silent: policy.silent })
    }

    window.addEventListener('TEST_NOTIFY', testNotifyHandler)

    // 导出清理函数
    const windowWithCleanup = window as typeof window & { __testNotifyCleanup?: () => void }
    windowWithCleanup.__testNotifyCleanup = () => {
      window.removeEventListener('TEST_NOTIFY', testNotifyHandler)
    }
  }
}
