import { ref, watchEffect, onMounted, onUnmounted } from 'vue'
import { info } from '@tauri-apps/plugin-log'
import { useTimeoutFn } from '@vueuse/core'
import { MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import router from '@/router'
import type { UserInfoType } from '@/services/types'
import { useGroupStore } from '@/stores/group'
import { useLoginHistoriesStore } from '@/stores/loginHistory'
// 迁移: useMenuTopStore → useMenuTopStoreCompat (兼容层)
import { useMenuTopStoreCompat as useMenuTopStore } from '@/stores/compatibility'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { useUserStatusStore } from '@/stores/userStatus'
import { userProfileService } from '@/services/userProfileService'

import { msg } from '@/utils/SafeUI'
import { storeToRefs } from 'pinia'
import { logger } from '@/utils/logger'

// Type definitions for Mitt events
interface ToSendMsgEvent {
  url: string
}

export const leftHook = () => {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const logInfo = (...args: unknown[]) => {
    if (isTauri) {
      try {
        const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        info(msg)
      } catch {}
    } else {
      const msgStr = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      logger.info(msgStr)
    }
  }
  const prefers = matchMedia('(prefers-color-scheme: dark)')
  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const { menuTop } = storeToRefs(useMenuTopStore())
  const loginHistoriesStore = useLoginHistoriesStore()
  const userStore = useUserStore()
  const { themes } = settingStore
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)
  const activeUrl = ref<string>(menuTop.value?.[0]?.url || 'message')
  const settingShow = ref(false)
  const shrinkStatus = ref(false)
  const groupStore = useGroupStore()
  /** 是否展示个人信息浮窗 */
  const infoShow = ref(false)
  /** 是否显示上半部分操作栏中的提示 */
  const tipShow = ref(true)
  const themeColor = ref(themes.content === ThemeEnum.DARK ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)')
  /** 已打开窗口的列表 */
  const openWindowsList = ref(new Set())
  /** 编辑资料弹窗 */
  const editInfo = ref<{
    show: boolean
    content: Partial<UserInfoType>
  }>({
    show: false,
    content: {}
  })

  /* =================================== 方法 =============================================== */

  /** 跟随系统主题模式切换主题 */
  const followOS = () => {
    themeColor.value = prefers.matches ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)'
  }

  watchEffect(() => {
    /** 判断是否是跟随系统主题 */
    if (themes.pattern === ThemeEnum.OS) {
      followOS()
      prefers.addEventListener('change', followOS)
    } else {
      prefers.removeEventListener('change', followOS)
    }
  })

  /** 更新缓存里面的用户信息 */
  const updateCurrentUserCache = (key: 'name' | 'avatar', value: string) => {
    const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
    if (currentUser) {
      currentUser[key] = value // 更新缓存里面的用户信息
    }
  }

  /** 保存用户信息 */
  const saveEditInfo = async (localUserInfo: Partial<UserInfoType>) => {
    if (!localUserInfo.name || localUserInfo.name.trim() === '') {
      msg.error?.('昵称不能为空')
      return
    }
    if (localUserInfo.modifyNameChance === 0) {
      msg.error?.('改名次数不足')
      return
    }
    try {
      await userProfileService.setDisplayName(localUserInfo.name!)
      // 更新本地缓存的用户信息
      userStore.userInfo!.name = localUserInfo.name!
      loginHistoriesStore.updateLoginHistory(<UserInfoType>userStore.userInfo) // 更新登录历史记录
      updateCurrentUserCache('name', localUserInfo.name!) // 更新缓存里面的用户信息
      if (!editInfo.value.content.modifyNameChance) return
      editInfo.value.content.modifyNameChance -= 1
      msg.success?.('保存成功')
    } catch (error) {
      logger.error('[leftHook] Failed to save user info:', error)
      msg.error?.('保存失败，请重试')
    }
  }

  /* 打开并且创建modal */
  const handleEditing = () => {
    // 使用 mitt 事件来触发编辑弹窗，避免直接传递响应式数据
    // 组件内部通过 watch 或 store 获取最新数据，确保响应式正常
    useMitt.emit(MittEnum.OPEN_EDIT_INFO, {
      timestamp: Date.now() // 添加时间戳确保事件能被触发
    })
  }

  /**
   * 侧边栏部分跳转窗口路由事件
   * @param url 跳转的路由
   * @param title 创建窗口时的标题
   * @param size 窗口的大小
   * @param window 窗口参数
   *
   * 导航策略：
   * - 核心功能（message, friendsList, settings, about等）始终使用路由导航
   * - 工具功能（fileManager等）可以使用窗口
   */
  const pageJumps = (
    url: string,
    title?: string,
    size?: { width: number; height: number; minWidth?: number },
    window?: { resizable: boolean }
  ) => {
    // ✅ 核心功能列表 - 始终在主窗口内使用路由导航
    const CORE_FEATURES = [
      'message',
      'friendsList',
      'settings',
      'about',
      'rooms/manage',
      'rooms/search',
      'spaces',
      'synapse/friends',
      'searchDetails',
      'e2ee/devices',
      'e2ee/verify',
      'e2ee/backup'
    ]

    // ✅ 核心功能始终使用路由导航（在主窗口内切换）
    if (CORE_FEATURES.includes(url)) {
      logInfo(`路由导航到: /${url}`)
      activeUrl.value = url
      router.push(`/${url}`)
      return
    }

    // ⚠️ 工具功能可以创建独立窗口（如文件管理器）
    if (window && isTauri) {
      useTimeoutFn(async () => {
        logInfo(`打开工具窗口: ${title}`)
        const webview = await createWebviewWindow(
          title!,
          url,
          <number>size?.width,
          <number>size?.height,
          '',
          window?.resizable,
          <number>size?.minWidth
        )
        openWindowsList.value.add(url)
        if (webview) {
          const unlisten = await webview.onCloseRequested(() => {
            openWindowsList.value.delete(url)
            if (unlisten) unlisten()
          })
        }
      }, 300)
    } else {
      activeUrl.value = url
      router.push(`/${url}`)
    }
  }

  /**
   * 打开内容对应窗口
   * @param title 窗口的标题
   * @param label 窗口的标识
   * @param w 窗口的宽度
   * @param h 窗口的高度
   * */
  const openContent = (title: string, label: string, w = 840, h = 600) => {
    useTimeoutFn(async () => {
      if (isTauri) {
        await createWebviewWindow(title, label, w, h)
      } else {
        router.push(`/${label}`)
      }
    }, 300)
    infoShow.value = false
  }

  const closeMenu = (event: Event) => {
    const target = event.target as Element
    if (target && !target.matches('.setting-item, .more, .more *')) {
      settingShow.value = false
    }
  }

  onMounted(async () => {
    /** 页面加载的时候默认显示消息列表 */
    pageJumps(activeUrl.value)
    window.addEventListener('click', closeMenu, true)

    useMitt.on(MittEnum.SHRINK_WINDOW, (event: unknown) => {
      shrinkStatus.value = event as boolean
    })
    useMitt.on(MittEnum.CLOSE_INFO_SHOW, () => {
      infoShow.value = false
    })
    useMitt.on(MittEnum.TO_SEND_MSG, (event: unknown) => {
      const msgEvent = event as ToSendMsgEvent
      activeUrl.value = msgEvent.url
    })
  })

  onUnmounted(() => {
    window.removeEventListener('click', closeMenu, true)
  })

  return {
    currentState,
    activeUrl,
    settingShow,
    shrinkStatus,
    infoShow,
    tipShow,
    themeColor,
    openWindowsList,
    editInfo,
    handleEditing,
    pageJumps,
    openContent,
    saveEditInfo,
    updateCurrentUserCache,
    followOS
  }
}
