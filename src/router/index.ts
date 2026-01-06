import { logger, toError } from '@/utils/logger'

import { invoke } from '@tauri-apps/api/core'
import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw
} from 'vue-router'
import type { Router } from 'vue-router'

// 移除直接导入，全部改为懒加载以优化 Bundle size
// import FriendsList from '@/views/homeWindow/FriendsList.vue'
// import SearchDetails from '@/views/homeWindow/SearchDetails.vue'

import { flags } from '@/utils/envFlags'
import { TauriCommand } from '@/enums'

/**! 创建窗口后再跳转页面就会导致样式没有生效所以不能使用懒加载路由的方式，有些页面需要快速响应的就不需要懒加载 */
const { BASE_URL } = import.meta.env

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const uaMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

// Tauri window interface for platform detection
interface TauriWindow extends Window {
  TAURI_ENV_PLATFORM?: string
}

let envPlatform = ''
try {
  envPlatform = isTauri && typeof window !== 'undefined' ? (window as TauriWindow).TAURI_ENV_PLATFORM || '' : ''
} catch {}

const isMobile =
  uaMobile ||
  envPlatform === 'ios' ||
  envPlatform === 'android' ||
  (typeof location !== 'undefined' && location.pathname.startsWith('/mobile'))

// 移动端路由配置 - 使用直接导入避免懒加载问题
const getMobileRoutes = (): Array<RouteRecordRaw> => {
  if (!flags.mobileFeaturesEnabled) return []
  return [
    {
      path: '/',
      name: 'mobileRoot',
      redirect: '/mobile/login'
    },
    {
      path: '/mobile/login',
      name: 'mobileLogin',
      component: () => import('#/login.vue')
    },
    {
      path: '/mobile/MobileForgetPassword',
      name: 'mobileForgetPassword',
      component: () => import('#/views/MobileForgetPassword.vue')
    },
    {
      path: '/mobile/splashscreen',
      name: 'splashscreen',
      component: () => import('#/views/Splashscreen.vue')
    },
    {
      path: '/mobile/serviceAgreement',
      name: 'mobileServiceAgreement',
      component: () => import('#/views/MobileServiceAgreement.vue')
    },
    {
      path: '/mobile/privacyAgreement',
      name: 'mobilePrivacyAgreement',
      component: () => import('#/views/MobilePrivacyAgreement.vue')
    },
    {
      path: '/mobile/syncData',
      name: 'mobileSyncData',
      component: () => import('#/views/SyncData.vue')
    },
    {
      path: '/mobile/chatRoom',
      name: 'mobileChatRoom',
      component: () => import('#/layout/chat/ChatRoomLayout.vue'),
      children: [
        {
          path: '',
          name: 'mobileChatRoomDefault',
          redirect: '/mobile/chatRoom/chatMain'
        },
        {
          path: 'chatMain/:uid?', // 可选传入，如果传入uid就表示房间属于好友的私聊房间
          name: 'mobileChatMain',
          component: () => import('#/views/chat/MobileChatMain.vue'),
          props: true,
          meta: { keepAlive: true }
        },
        {
          path: 'setting',
          name: 'mobileChatSetting',
          component: () => import('#/views/chat/ChatSetting.vue')
        },
        {
          path: 'searchContent',
          name: 'mobileSearchChatContent',
          component: () => import('#/views/chat/SearchChatContent.vue')
        },
        {
          path: 'mediaViewer',
          name: 'mobileMediaViewer',
          component: () => import('#/views/chat/MediaViewer.vue')
        },

        {
          path: 'notice',
          name: 'mobileChatNotice',
          component: () => import('#/views/chat/notice/NoticeList.vue'),
          children: [
            {
              path: '',
              name: 'mobileChatNoticeList',
              component: () => import('#/views/chat/notice/NoticeList.vue')
            },
            {
              path: 'add',
              name: 'mobileChatNoticeAdd',
              component: () => import('#/views/chat/notice/NoticeEdit.vue')
            },
            {
              path: 'edit/:id',
              name: 'mobileChatNoticeEdit',
              component: () => import('#/views/chat/notice/NoticeEdit.vue')
            },
            {
              path: 'detail/:id',
              name: 'mobileChatNoticeDetail',
              component: () => import('#/views/chat/notice/NoticeDetail.vue')
            }
          ]
        }
      ]
    },
    {
      path: '/mobile/home',
      name: 'mobileHome',
      component: () => import('#/layout/index.vue'),
      children: [
        {
          path: '',
          name: 'mobileHomeDefault',
          redirect: '/mobile/message'
        },
        {
          path: '/mobile/message',
          name: 'mobileMessage',
          component: () => import('#/views/message/index.vue')
        },
        {
          path: '/mobile/rooms',
          name: 'mobileRooms',
          component: () => import('#/views/rooms/index.vue')
        },
        {
          path: '/mobile/rooms/manage',
          name: 'mobileRoomsManage',
          component: () => import('#/views/rooms/Manage.vue')
        },
        {
          path: '/mobile/spaces',
          name: 'mobileSpaces',
          component: () => import('#/views/spaces/Index.vue')
        },
        {
          path: '/mobile/my',
          name: 'mobileMy',
          component: () => import('#/views/profile/index.vue')
        }
      ]
    },
    {
      path: '/mobile/mobileMy',
      name: 'mobileMyLayout',
      component: () => import('#/layout/profile/MyLayout.vue'),
      children: [
        {
          path: '',
          name: 'mobileMyDefault',
          redirect: '/mobile/mobileMy/editProfile'
        },
        {
          path: 'editProfile',
          name: 'mobileEditProfile',
          component: () => import('#/views/profile/EditProfile.vue')
        },
        {
          path: 'myMessages',
          name: 'mobileMyMessages',
          component: () => import('#/views/profile/MyMessages.vue')
        },
        {
          path: 'editBio',
          name: 'mobileEditBio',
          component: () => import('#/views/profile/EditBio.vue')
        },
        {
          path: 'editBirthday',
          name: 'mobileEditBirthday',
          component: () => import('#/views/profile/EditBirthday.vue')
        },
        // REMOVED: publishCommunity route - Moments/Feed feature removed (custom backend no longer supported)
        {
          path: 'settings',
          name: 'MobileSettings',
          component: () => import('#/views/profile/MobileSettings.vue')
        },
        {
          path: 'settings/cache',
          name: 'MobileSettingsCache',
          component: () => import('@/views/moreWindow/settings/ManageStore.vue')
        },
        {
          path: 'scanQRCode',
          name: 'mobileQRCode',
          component: () => import('#/views/profile/MobileQRCode.vue')
        },
        {
          path: 'share',
          name: 'mobileShare',
          component: () => import('#/views/profile/Share.vue')
        },
        {
          path: 'SimpleBio',
          name: 'mobileSimpleBio',
          component: () => import('#/views/profile/SimpleBio.vue')
        },

        {
          path: 'myAlbum',
          name: 'mobileMyAlbum',
          component: () => import('#/views/profile/MyAlbum.vue')
        },
        {
          path: 'mediaCache',
          name: 'mobileMediaCache',
          component: () => import('#/views/media/MediaCache.vue')
        }
      ]
    },
    // Mobile Settings Module - Independent settings pages
    {
      path: '/mobile/settings',
      name: 'mobileSettings',
      component: () => import('#/views/settings/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/profile',
      name: 'mobileSettingsProfile',
      component: () => import('#/views/settings/profile/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/sessions',
      name: 'mobileSettingsSessions',
      component: () => import('#/views/settings/sessions/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/notification',
      name: 'mobileSettingsNotification',
      component: () => import('#/views/settings/notification/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/appearance',
      name: 'mobileSettingsAppearance',
      component: () => import('#/views/settings/appearance/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/privacy',
      name: 'mobileSettingsPrivacy',
      component: () => import('#/views/settings/privacy/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/privacy/manage',
      name: 'mobileSettingsPrivacyManage',
      component: () => import('#/views/settings/privacy/manage.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/keyboard',
      name: 'mobileSettingsKeyboard',
      component: () => import('#/views/settings/keyboard/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/audio',
      name: 'mobileSettingsAudio',
      component: () => import('#/views/settings/audio/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/labs',
      name: 'mobileSettingsLabs',
      component: () => import('#/views/settings/labs/index.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/feedback',
      name: 'mobileSettingsFeedback',
      component: () => import('#/views/settings/Feedback.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/settings/biometric',
      name: 'mobileSettingsBiometric',
      component: () => import('#/components/profile/BiometricSettings.vue'),
      meta: { keepAlive: false }
    },
    {
      path: '/mobile/mobileFriends',
      name: 'mobileFriendsLayout',
      component: () => import('#/layout/friends/FriendsLayout.vue'),
      children: [
        {
          path: '',
          name: 'mobileFriendsDefault',
          redirect: '/mobile/mobileFriends/addFriends'
        },
        {
          path: 'addFriends',
          name: 'mobileAddFriends',
          component: () => import('#/views/friends/AddFriends.vue')
        },
        {
          path: 'startGroupChat',
          name: 'mobileStartGroupChat',
          component: () => import('#/views/friends/StartGroupChat.vue')
        },
        {
          path: 'confirmAddFriend',
          name: 'mobileConfirmAddFriend',
          component: () => import('#/views/friends/ConfirmAddFriend.vue')
        },
        {
          path: 'confirmAddGroup',
          name: 'mobileConfirmAddGroup',
          component: () => import('#/views/friends/ConfirmAddGroup.vue')
        },
        {
          path: 'friendInfo/:uid',
          name: 'mobileFriendInfo',
          component: () => import('#/views/friends/FriendInfo.vue')
        }
      ]
    },
    {
      path: '/mobile/confirmQRLogin/:ip/:expireTime/:deviceType/:locPlace/:qrId',
      name: 'mobileConfirmQRLogin',
      component: () => import('#/views/ConfirmQRLogin.vue'),
      props: true
    },
    {
      path: '/mobile/myQRCode',
      name: 'mobileMyQRCode',
      component: () => import('#/views/MyQRCode.vue')
    },
    {
      path: '/mobile/rtcCall',
      name: 'rtcCall',
      component: () => import('#/views/rtcCall/index.vue')
    },
    {
      path: '/mobile/rooms/search',
      name: 'mobileRoomsSearch',
      component: () => import('#/views/rooms/SearchMobile.vue')
    },
    // E2EE (End-to-End Encryption) routes for mobile
    {
      path: '/mobile/e2ee/devices',
      name: 'mobileE2EEDevices',
      component: () => import('#/views/e2ee/MobileDevices.vue')
    },
    {
      path: '/mobile/e2ee/backup',
      name: 'mobileE2EEBackup',
      component: () => import('#/views/e2ee/MobileKeyBackup.vue')
    },
    // Private Chat (私密聊天) routes for mobile
    {
      path: '/mobile/private-chat',
      name: 'mobilePrivateChat',
      component: () => import('#/views/private-chat/MobilePrivateChatView.vue')
    }
  ]
}

// 桌面端路由配置
const getDesktopRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/home',
    name: 'home',
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: '/message',
        name: 'message',
        component: () => import('@/views/homeWindow/message/index.vue')
      },
      {
        path: '/friendsList',
        name: 'friendsList',
        component: () => import('@/views/homeWindow/FriendsList.vue')
      },
      {
        path: '/searchDetails',
        name: 'searchDetails',
        component: () => import('@/views/homeWindow/SearchDetails.vue')
      },
      {
        path: '/rooms/manage',
        name: 'roomsManage',
        component: () => import('@/views/rooms/Manage.vue')
      },
      {
        path: '/spaces',
        name: 'spacesIndex',
        component: () => import('@/views/spaces/Index.vue')
      },
      {
        path: '/rooms/search',
        name: 'roomsSearch',
        component: () => import('@/views/rooms/Search.vue')
      },
      {
        path: '/e2ee/devices',
        name: 'e2eeDevices',
        component: () => import('@/views/e2ee/Devices.vue')
      },
      {
        path: '/e2ee/verify',
        name: 'e2eeVerify',
        component: () => import('@/views/e2ee/VerificationWizard.vue')
      },
      {
        path: '/e2ee/backup',
        name: 'e2eeBackup',
        component: () => import('@/views/e2ee/BackupRecovery.vue')
      }
    ]
  },

  {
    path: '/fileManager',
    name: 'fileManager',
    component: () => import('@/views/fileManagerWindow/index.vue')
  },
  {
    path: '/onlineStatus',
    name: 'onlineStatus',
    component: () => import('@/views/onlineStatusWindow/index.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/aboutWindow/index.vue')
  },
  {
    path: '/alone',
    name: 'alone',
    component: () => import('@/views/homeWindow/message/Alone.vue')
  },
  {
    path: '/sharedScreen',
    name: 'sharedScreen',
    component: () => import('@/views/homeWindow/SharedScreen.vue')
  },
  {
    path: '/modal-invite',
    name: 'modal-invite',
    component: () => import('@/views/modalWindow/index.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/moreWindow/settings/SettingsPanel.vue'),
    children: [
      // Legacy settings routes
      {
        path: 'general',
        name: 'general',
        component: () => import('@/views/moreWindow/settings/General.vue')
      },
      {
        path: 'loginSetting',
        name: 'loginSetting',
        component: () => import('@/views/moreWindow/settings/LoginSetting.vue')
      },
      {
        path: 'notification',
        name: 'notification',
        component: () => import('@/views/moreWindow/settings/Notification.vue')
      },
      {
        path: 'versatile',
        name: 'versatile',
        component: () => import('@/views/moreWindow/settings/Versatile.vue')
      },
      {
        path: 'manageStore',
        name: 'manageStore',
        component: () => import('@/views/moreWindow/settings/ManageStore.vue')
      },
      {
        path: 'shortcut',
        name: 'shortcut',
        component: () => import('@/views/moreWindow/settings/Shortcut.vue')
      },
      // New settings routes with lazy loading
      // 新设置路由在 moreWindow/settings 目录
      {
        path: 'profile',
        name: 'settingsProfile',
        component: () => import('@/views/moreWindow/settings/Profile.vue')
      },
      {
        path: 'sessions',
        name: 'settingsSessions',
        component: () => import('@/views/moreWindow/settings/Sessions.vue')
      },
      {
        path: 'appearance',
        name: 'settingsAppearance',
        component: () => import('@/views/moreWindow/settings/Appearance.vue')
      },
      {
        path: 'keyboard',
        name: 'settingsKeyboard',
        component: () => import('@/views/moreWindow/settings/Keyboard.vue')
      },
      {
        path: 'labs',
        name: 'settingsLabs',
        component: () => import('@/views/moreWindow/settings/Labs.vue')
      },
      {
        path: 'privacy/manage',
        name: 'settingsPrivacyManage',
        component: () => import('@/views/moreWindow/settings/PrivacyManage.vue')
      },
      {
        path: 'privacy',
        name: 'settingsPrivacy',
        component: () => import('@/views/moreWindow/settings/Privacy.vue')
      },
      {
        path: 'voiceAudio',
        name: 'settingsVoiceAudio',
        component: () => import('@/views/moreWindow/settings/VoiceAudio.vue')
      },
      {
        path: 'feedback',
        name: 'settingsFeedback',
        component: () => import('@/views/moreWindow/settings/Feedback.vue')
      },
      {
        path: 'e2ee',
        name: 'settingsE2EE',
        component: () => import('@/views/moreWindow/settings/E2EE.vue')
      }
    ]
  },
  {
    path: '/announList/:roomId/:type',
    name: 'announList',
    component: () => import('@/views/announWindow/index.vue')
  },
  {
    path: '/previewFile',
    name: 'previewFile',
    component: () => import('@/views/previewFileWindow/index.vue')
  },
  {
    path: '/chat-history',
    name: 'chat-history',
    component: () => import('@/views/chatHistory/index.vue')
  },
  {
    path: '/rtcCall',
    name: 'rtcCall',
    component: () => import('@/views/callWindow/index.vue')
  },
  // 添加聊天记录窗口路由
  {
    path: '/multiMsg',
    name: 'multiMsg',
    component: () => import('@/views/multiMsgWindow/index.vue')
  },
  {
    path: '/searchFriend',
    name: 'searchFriend',
    component: () => import('@/views/friendWindow/SearchFriend.vue')
  },
  {
    path: '/addFriendVerify',
    name: 'addFriendVerify',
    component: () => import('@/views/friendWindow/AddFriendVerify.vue')
  },
  {
    path: '/addGroupVerify',
    name: 'addGroupVerify',
    component: () => import('@/views/friendWindow/AddGroupVerify.vue')
  }
]

// 通用路由配置（所有平台都需要）
const getCommonRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/',
    name: 'root',
    redirect: isMobile ? '/mobile/login' : '/login'
  },
  {
    path: '/manageGroupMember',
    name: 'manageGroupMember',
    component: () => import('@/views/ManageGroupMember.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminLayout.vue')
  },
  {
    path: '/admin/health',
    name: 'adminHealth',
    component: () => import('@/components/diagnostics/ServerHealthCheck.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notfound',
    redirect: isMobile ? '/mobile/login' : '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/loginWindow/Login.vue')
  },
  {
    path: '/splashscreen',
    name: 'splashscreen',
    component: () => import('#/views/Splashscreen.vue')
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/registerWindow/index.vue')
  },
  {
    path: '/forgetPassword',
    name: 'forgetPassword',
    component: () => import('@/views/forgetPasswordWindow/index.vue')
  },
  {
    path: '/qrCode',
    name: 'qrCode',
    component: () => import('@/views/loginWindow/QRCode.vue')
  },
  {
    path: '/sso/callback',
    name: 'ssoCallback',
    component: () => import('@/views/loginWindow/SsoCallback.vue')
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('@/views/loginWindow/Network.vue')
  },
  {
    path: '/tray',
    name: 'tray',
    component: () => import('@/views/Tray.vue')
  },
  {
    path: '/notify',
    name: 'notify',
    component: () => import('@/views/Notify.vue')
  },
  {
    path: '/update',
    name: 'update',
    component: () => import('@/views/Update.vue')
  },
  {
    path: '/checkupdate',
    name: 'checkupdate',
    component: () => import('@/views/CheckUpdate.vue')
  },
  {
    path: '/capture',
    name: 'capture',
    component: () => import('@/views/Capture.vue')
  },
  {
    path: '/imageViewer',
    name: 'imageViewer',
    component: () => import('@/views/imageViewerWindow/index.vue')
  },
  {
    path: '/videoViewer',
    name: 'videoViewer',
    component: () => import('@/views/videoViewerWindow/index.vue')
  },
  {
    path: '/modal-serviceAgreement',
    name: 'modal-serviceAgreement',
    component: () => import('@/views/agreementWindow/Server.vue')
  },
  {
    path: '/modal-privacyAgreement',
    name: 'modal-privacyAgreement',
    component: () => import('@/views/agreementWindow/Privacy.vue')
  },
  {
    path: '/modal-remoteLogin',
    name: 'modal-remoteLogin',
    component: () => import('@/views/loginWindow/RemoteLoginModal.vue')
  }
]

// 创建所有路由（通用路由 + 平台特定路由）
const getAllRoutes = (): Array<RouteRecordRaw> => {
  const commonRoutes = getCommonRoutes()
  return [...commonRoutes, ...getMobileRoutes(), ...getDesktopRoutes()]
}

// 创建路由
const router = createRouter({
  history: createWebHistory(BASE_URL),
  routes: getAllRoutes()
}) as Router

// 在创建路由后，添加全局前置守卫
// 为解决 "已声明'to'，但从未读取其值" 的问题，将 to 参数改为下划线开头表示该参数不会被使用
router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  // ==================== 公开页面白名单 ====================
  const publicPages = new Set([
    '/login',
    '/register',
    '/forgetPassword',
    '/splashscreen',
    '/qrCode',
    '/tray',
    '/about',
    '/onlineStatus',
    '/capture',
    '/network',
    '/notify',
    '/update',
    '/checkupdate',
    '/modal-serviceAgreement',
    '/modal-privacyAgreement',
    '/modal-remoteLogin',
    '/mobile/login',
    '/mobile/splashscreen',
    '/mobile/MobileForgetPassword',
    '/mobile/serviceAgreement',
    '/mobile/privacyAgreement'
  ])

  // 公开页面直接放行
  if (publicPages.has(to.path)) {
    return next()
  }

  // ==================== 桌面端认证检查 ====================
  if (!isMobile) {
    // 导入应用状态 store (延迟导入以避免循环依赖)
    const { useAppStateStore } = await import('@/stores/appState')
    const appStateStore = useAppStateStore()

    // 应用初始化中或登录中，允许继续 (会显示加载状态)
    if (appStateStore.isInitializing || appStateStore.isLoggingIn) {
      logger.debug('[守卫] 桌面端应用初始化或登录中')
      return next()
    }

    // 未登录且不是登录页 → 跳转登录页
    if (appStateStore.needsLogin) {
      logger.warn('[守卫] 桌面端未登录，跳转到登录页')
      return next('/login')
    }

    // 应用未就绪且不是登录页 → 等待应用就绪
    if (!appStateStore.isReady && to.path !== '/login') {
      logger.warn('[守卫] 桌面端应用未就绪，显示加载状态')
      return next()
    }

    // 已登录但访问登录页 → 跳转首页
    if (appStateStore.isFullyLoggedIn && to.path === '/login') {
      logger.debug('[守卫] 桌面端已登录，跳转到首页')
      return next('/home')
    }

    logger.debug('[守卫] 桌面端认证通过，继续导航')
    return next()
  }

  // ==================== 移动端认证检查 (原有逻辑) ====================
  try {
    const isLoginPage = to.path === '/mobile/login'
    const isSplashPage = to.path === '/mobile/splashscreen'
    const isForgetPage = to.path === '/mobile/MobileForgetPassword'
    const isAgreementPage = to.path === '/mobile/serviceAgreement' || to.path === '/mobile/privacyAgreement'
    const loginInProgress = typeof localStorage !== 'undefined' && localStorage.getItem('LOGIN_IN_PROGRESS') === '1'

    // 闪屏页白名单：不论登录状态都允许进入
    if (isSplashPage || isForgetPage || isAgreementPage) {
      return next()
    }

    if (!isTauri) {
      return next()
    }
    let tokens = await invoke<{ token: string | null; refreshToken: string | null }>(
      TauriCommand.GET_USER_TOKENS
    ).catch((): { token: string | null; refreshToken: string | null } => ({ token: null, refreshToken: null }))
    let isLoggedIn = !!(tokens && tokens.token && tokens.refreshToken)
    if (!isLoggedIn && loginInProgress) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 150))
        tokens = await invoke<{ token: string | null; refreshToken: string | null }>(
          TauriCommand.GET_USER_TOKENS
        ).catch((): { token: string | null; refreshToken: string | null } => ({ token: null, refreshToken: null }))
        isLoggedIn = !!(tokens && tokens.token && tokens.refreshToken)
        if (isLoggedIn) break
      }
    }
    logger.debug('[守卫] token状态:', { isLoggedIn, loginInProgress, component: 'index' })

    // 未登录且不是登录页 → 跳转登录
    if (!isLoggedIn && !isLoginPage) {
      logger.warn('[守卫] 未登录，强制跳转到 /mobile/login:', { component: 'index' })
      return next('/mobile/login')
    }

    return next()
  } catch (error) {
    logger.error('[守卫] 获取token错误:', { error: toError(error), component: 'index' })
    // 出错时也跳转登录页（避免死循环）
    if (to.path !== '/mobile/login') {
      logger.warn('[守卫] 出错，强制跳转到 /mobile/login:', { component: 'index' })
      return next('/mobile/login')
    }
    // logger.debug('[守卫] 出错但目标是登录页，直接放行', undefined, 'index')
    return next()
  }
})

export default router
