<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" proxy />

    <!--  手动登录样式  -->
    <n-flex vertical :size="25" v-if="uiState === 'manual'">
      <!-- 头像 -->
      <n-flex justify="center" class="w-full pt-35px" data-tauri-drag-region>
        <n-avatar
          class="welcome size-80px rounded-50% border-(2px solid #fff) dark:border-(2px solid var(--hula-brand-primary))"
          :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : '#fff'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="AvatarUtils.getAvatarUrl(info.avatar)" />
      </n-flex>

      <!-- 登录菜单 -->
      <n-flex class="ma text-center h-full w-260px" vertical :size="16">
        <n-input
          :class="{ 'pl-16px': loginHistories.length > 0 }"
          size="large"
          v-model:value="info.account"
          type="text"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = t('login.input.account.placeholder')"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #suffix>
            <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-var(--hula-brand-primary) dark:color-var(--hula-brand-primary) cursor-pointer">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-var(--hula-brand-primary) dark:color-var(--hula-brand-primary) cursor-pointer">
                <use href="#up"></use>
              </svg>
            </n-flex>
          </template>
        </n-input>

        <!-- 账号选择框-->
        <div
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-dropdown account-box absolute w-260px max-h-140px bg-var(--hula-brand-primary)98 dark:bg-var(--hula-brand-primary)98 backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border">
          <n-scrollbar class="account-scrollbar" trigger="none">
            <n-flex
              vertical
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px cursor-pointer hover:bg-var(--hula-brand-primary)20 dark:hover:bg-var(--hula-brand-primary)30 hover:rounded-6px">
              <div class="flex-between-center">
                <n-avatar :src="AvatarUtils.getAvatarUrl(item.avatar)" color="#fff" class="size-28px rounded-50%" />
                <p class="text-14px color-var(--hula-brand-primary) dark:color-var(--hula-brand-primary)">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px dark:color-var(--hula-brand-primary)">
                  <use href="#close"></use>
                </svg>
              </div>
            </n-flex>
          </n-scrollbar>
        </div>

        <n-input
          class="pl-16px"
          maxlength="16"
          minlength="6"
          size="large"
          show-password-on="click"
          v-model:value="info.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = t('login.input.pass.placeholder')"
          clearable />

        <!-- 账户状态提示 -->
        <n-flex
          v-if="accountCheckStatus.checking || accountCheckStatus.reason"
          :size="8"
          align="center"
          justify="center"
          class="text-12px px-8px py-4px rounded-4px"
          :class="{
            'bg-brand! dark:bg-brand!': accountCheckStatus.suggestedAction === 'login' || accountCheckStatus.suggestedAction === 'register',
            'bg-gray-100! dark:bg-gray-800!':
              !accountCheckStatus.suggestedAction || accountCheckStatus.suggestedAction === 'none'
          }">
          <n-spin v-if="accountCheckStatus.checking" :size="12" />
          <span
            v-if="accountCheckStatus.reason"
            :class="{
              'text-brand!': accountCheckStatus.suggestedAction === 'login' || accountCheckStatus.suggestedAction === 'register',
              'text-gray-600! dark:text-gray-400!': !accountCheckStatus.suggestedAction || accountCheckStatus.suggestedAction === 'none'
            }">
            {{ accountCheckStatus.reason }}
          </span>
          <n-button
            v-if="accountCheckStatus.suggestedAction === 'register'"
            text
            size="tiny"
            class="text-brand! ml-4px"
            @click="createWebviewWindow('注册', 'register', 600, 600)">
            去注册
          </n-button>
        </n-flex>

        <!-- 协议 -->
        <n-flex align="center" justify="center" :size="6">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-var(--hula-brand-primary) cursor-default lh-14px agreement">
            <span>{{ t('login.term.checkout.text1') }}</span>
            <span class="text-brand cursor-pointer" @click.stop="openServiceAgreement">
              {{ t('login.term.checkout.text2') }}
            </span>
            <span>{{ t('login.term.checkout.text3') }}</span>
            <span class="text-brand cursor-pointer" @click.stop="openPrivacyAgreement">
              {{ t('login.term.checkout.text4') }}
            </span>
          </div>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          class="gradient-button w-full mt-8px mb-50px login-button-manual"
          @click="normalLogin('PC', true, false)">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 自动登录样式 -->
    <n-flex v-else-if="uiState === 'auto'" vertical :size="29" data-tauri-drag-region>
      <n-flex justify="center" class="mt-15px">
        <img src="/hula.png" class="w-140px h-60px" alt="" />
      </n-flex>
      <n-flex :size="30" vertical>
        <!-- 头像 -->
        <n-flex justify="center">
          <n-avatar
            round
            :size="110"
            :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : '#fff'"
            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" />
        </n-flex>

        <n-flex justify="center">
          <n-ellipsis class="user-name-ellipsis text-(18px [--chat-text-color])">
            {{ userStore.userInfo?.name || '' }}
          </n-ellipsis>
        </n-flex>
      </n-flex>

      <n-flex justify="center">
        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          class="gradient-button w-200px mt-12px mb-40px login-button-auto"
          @click="normalLogin('PC', true, true)">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 底部操作栏 -->
    <div class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full" id="bottomBar">
      <div
        class="text-brand cursor-pointer justify-self-end text-right"
        :title="qrCodeTitle"
        @click="router.push('/qrCode')">
        {{ qrCodeLabel }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-var(--hula-brand-primary) justify-self-center"></div>
      <div
        v-if="uiState === 'auto'"
        class="text-brand cursor-pointer justify-self-start text-left"
        :title="removeAccountTitle"
        @click="removeToken">
        {{ removeAccountLabel }}
      </div>
      <div v-else class="justify-self-start text-left">
        <n-popover
          trigger="click"
          id="moreShow"
          class="bg-var(--hula-brand-primary)98! dark:bg-var(--hula-brand-primary)98! backdrop-blur-sm"
          v-model:show="moreShow"
          :show-checkmark="false"
          :show-arrow="false">
          <template #trigger>
            <div class="text-brand cursor-pointer" :title="moreTitle">{{ moreLabel }}</div>
          </template>
          <n-flex vertical :size="2">
            <div
              class="register text-14px cursor-pointer hover:bg-var(--hula-brand-primary)30 hover:rounded-6px p-8px"
              @click="createWebviewWindow('注册', 'register', 600, 600)">
              {{ t('login.register') }}
            </div>
            <div
              class="text-14px cursor-pointer hover:bg-var(--hula-brand-primary)30 hover:rounded-6px p-8px"
              @click="createWebviewWindow('忘记密码', 'forgetPassword', 600, 600)">
              {{ t('login.option.items.forget') }}
            </div>
            <div
              v-if="!isCompatibility()"
              @click="router.push('/network')"
              :class="{ network: isMac() }"
              class="text-14px cursor-pointer hover:bg-var(--hula-brand-primary)30 hover:rounded-6px p-8px">
              {{ t('login.option.items.network_setting') }}
            </div>
          </n-flex>
        </n-popover>
      </div>
    </div>
  </n-config-provider>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useNetwork } from '@vueuse/core'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCheckUpdate } from '@/hooks/useCheckUpdate'
import { type DriverStepConfig, useDriver } from '@/hooks/useDriver'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import type { UserInfoType } from '@/services/types.ts'
import { WsResponseMessageType } from '@/services/wsType'
import { useGlobalStore } from '@/stores/global'
import { useGuideStore } from '@/stores/guide'
import { useLoginHistoriesStore } from '@/stores/loginHistory.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isCompatibility, isDesktop, isMac } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { useLogin } from '@/hooks/useLogin'
import { formatBottomText } from '@/utils/formatUtils'
import { ThemeEnum } from '@/enums'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { suggestActionForLogin } from '@/services/matrixAccountCheck'
import { useDebounceFn } from '@vueuse/core'
import { logger } from '@/utils/logger'
import ActionBar from '@/components/windows/ActionBar.vue'

const { t } = useI18n()

const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const userStore = useUserStore()
const globalStore = useGlobalStore()
const guideStore = useGuideStore()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { isGuideCompleted } = storeToRefs(guideStore)
/** 网络连接是否正常 */
const { isOnline } = useNetwork()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = loginHistoriesStore
const { login } = storeToRefs(settingStore)
/** 协议 */
const protocol = ref(true)
const arrowStatus = ref(false)
const moreShow = ref(false)
const { createWebviewWindow, createModalWindow, getWindowPayload } = useWindow()
const { checkUpdate, CHECK_UPDATE_LOGIN_TIME } = useCheckUpdate()
const { normalLogin, loading, loginText, loginDisabled, info, uiState } = useLogin()
const matrixAuthStore = useMatrixAuthStore()
const { baseUrl: matrixBaseUrl } = storeToRefs(matrixAuthStore)

// 账户检查状态
const accountCheckStatus = ref<{
  checking: boolean
  exists: boolean | null
  suggestedAction: 'login' | 'register' | 'none' | null
  reason: string | null
}>({
  checking: false,
  exists: null,
  suggestedAction: null,
  reason: null
})

/**
 * 检查 Matrix 账户状态（防抖）
 */
const checkMatrixAccount = useDebounceFn(async (username: string) => {
  // 如果输入为空或太短，不进行检查
  if (!username || username.length < 3) {
    accountCheckStatus.value = {
      checking: false,
      exists: null,
      suggestedAction: null,
      reason: null
    }
    return
  }

  // 如果 Matrix 未启用，不检查
  if (!matrixBaseUrl.value) {
    return
  }

  accountCheckStatus.value.checking = true

  try {
    const result = await suggestActionForLogin(matrixBaseUrl.value, username)
    accountCheckStatus.value = {
      checking: false,
      exists: result.exists,
      suggestedAction: result.suggestedAction,
      reason: result.reason || null
    }
  } catch (error) {
    accountCheckStatus.value = {
      checking: false,
      exists: null,
      suggestedAction: 'none',
      reason: '账户状态检查失败'
    }
  }
}, 800) // 800ms 防抖延迟

const driverSteps = computed<DriverStepConfig[]>(() => [
  {
    element: '.welcome',
    popover: {
      title: t('login.guide.welcome.title'),
      description: t('login.guide.welcome.desc'),
      side: 'bottom',
      align: 'center'
    }
  },
  {
    element: '.agreement',
    popover: {
      title: t('login.guide.privacy.title'),
      description: t('login.guide.privacy.desc'),
      onNextClick: () => {
        if (isMac()) {
          moreShow.value = true
        }
      }
    }
  },
  {
    element: '.network',
    popover: {
      title: t('login.guide.network.title'),
      description: t('login.guide.network.desc'),
      onNextClick: () => {
        moreShow.value = true
      }
    }
  },
  {
    element: '.register',
    popover: {
      title: t('login.guide.register.title'),
      description: t('login.guide.register.desc')
    }
  }
])

const driverConfig = computed(() => ({
  nextBtnText: t('login.guide.actions.next'),
  prevBtnText: t('login.guide.actions.prev'),
  doneBtnText: t('login.guide.actions.done'),
  progressText: t('login.guide.actions.progress', {
    current: '{{current}}',
    total: '{{total}}'
  })
}))

const { startTour, reinitialize } = useDriver(driverSteps.value, driverConfig.value)

watch([driverSteps, driverConfig], ([steps, config]) => {
  reinitialize(steps, config)
})

// 输入框占位符
const accountPH = ref(t('login.input.account.placeholder'))
const passwordPH = ref(t('login.input.pass.placeholder'))

// 底部操作栏多语言超过6个字符时显示省略号
const MAX_BOTTOM_TEXT_LEN = 6
const qrCodeText = computed(() => t('login.button.qr_code'))
const moreText = computed(() => t('login.option.more'))
const removeAccountText = computed(() => t('login.button.remove_account'))
const qrCodeLabel = computed(() => formatBottomText(qrCodeText.value, MAX_BOTTOM_TEXT_LEN))
const moreLabel = computed(() => formatBottomText(moreText.value, MAX_BOTTOM_TEXT_LEN))
const removeAccountLabel = computed(() => formatBottomText(removeAccountText.value, MAX_BOTTOM_TEXT_LEN))
const qrCodeTitle = computed(() => (qrCodeLabel.value !== qrCodeText.value ? qrCodeText.value : undefined))
const moreTitle = computed(() => (moreLabel.value !== moreText.value ? moreText.value : undefined))
const removeAccountTitle = computed(() =>
  removeAccountLabel.value !== removeAccountText.value ? removeAccountText.value : undefined
)

/** 是否直接跳转 */
const isJumpDirectly = ref(false)

// 导入Web Worker
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url))

// 添加错误处理
timerWorker.onerror = (error) => {
  logger.error('[Worker Error]', error)
}

// 监听 Worker 消息
timerWorker.onmessage = (e) => {
  const { type } = e.data
  if (type === 'timeout') {
    checkUpdate('login')
  }
}

watchEffect(() => {
  loginDisabled.value = !(info.value.account && info.value.password && protocol.value && isOnline.value)
})

watch(isOnline, (v) => {
  loginDisabled.value = !v
  loginText.value = v ? t('login.button.login.default') : t('login.button.login.network_error')
})

// 监听账号输入
watch(
  () => info.value.account,
  (newAccount) => {
    if (!newAccount) {
      info.value.avatar = '/logoD.png'
      accountCheckStatus.value = {
        checking: false,
        exists: null,
        suggestedAction: null,
        reason: null
      }
      return
    }

    // 在登录历史中查找匹配的账号
    const matchedAccount = loginHistories.find(
      (history) => history.account === newAccount || history.email === newAccount
    )
    if (matchedAccount) {
      info.value.avatar = matchedAccount.avatar
    } else {
      info.value.avatar = '/logoD.png'
    }

    // 检查 Matrix 账户状态（防抖）
    checkMatrixAccount(newAccount)
  }
)

const openRemoteLoginModal = async (ip?: string) => {
  if (!isDesktop()) {
    return
  }
  const payloadIp = ip ?? '未知IP'
  await createModalWindow(
    '异地登录提醒',
    'modal-remoteLogin',
    350,
    310,
    'login',
    {
      ip: payloadIp
    },
    {
      minWidth: 350,
      minHeight: 310
    }
  )
}

const handlePendingRemoteLoginPayload = async () => {
  if (!isDesktop()) {
    return
  }
  try {
    const payload = await getWindowPayload<{ remoteLogin?: { ip?: string } }>('login')
    if (payload?.remoteLogin) {
      openRemoteLoginModal(payload.remoteLogin.ip)
    }
  } catch (error) {
    logger.error('处理异地登录载荷失败:', error)
  }
}

/** 删除账号列表内容 */
const delAccount = (item: UserInfoType) => {
  // 获取删除前账户列表的长度
  const lengthBeforeDelete = loginHistories.length
  loginHistoriesStore.removeLoginHistory(item)
  // 判断是否删除了最后一个条目，并据此更新arrowStatus
  if (lengthBeforeDelete === 1 && loginHistories.length === 0) {
    arrowStatus.value = false
  }
  info.value.account = ''
  info.value.password = ''
  info.value.avatar = '/logoD.png'
}

/**
 * 给账号赋值
 * @param item 账户信息
 * */
const giveAccount = (item: UserInfoType) => {
  const { account, password, avatar, name, uid } = item
  info.value.account = account || ''
  info.value.password = password || ''
  info.value.avatar = avatar
  info.value.name = name
  info.value.uid = uid
  arrowStatus.value = false
}

/** 移除已登录账号 */
const removeToken = () => {
  localStorage.removeItem('TOKEN')
  localStorage.removeItem('REFRESH_TOKEN')
  userStore.reset()
}

/** 打开服务协议窗口 */
const openServiceAgreement = async () => {
  await createModalWindow('服务协议', 'modal-serviceAgreement', 600, 600, 'login')
}

/** 打开隐私保护协议窗口 */
const openPrivacyAgreement = async () => {
  await createModalWindow('隐私保护指引', 'modal-privacyAgreement', 600, 600, 'login')
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
  if (!target.matches('#moreShow')) {
    moreShow.value = false
  }
}

const enterKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !loginDisabled.value) {
    normalLogin('PC', true, false)
  }
}

onBeforeMount(async () => {
  await handlePendingRemoteLoginPayload()
  // 始终初始化托盘菜单状态为false
  isTrayMenuShow.value = false

  if (!login.value.autoLogin) {
    // 非自动登录模式，直接显示手动登录界面
    uiState.value = 'manual'
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    clearListener()
    return
  }
})

onMounted(async () => {
  // 检查引导状态，只有未完成时才启动引导
  if (!isGuideCompleted.value) {
    try {
      startTour()
    } catch (error) {
      logger.debug('[Login] Failed to start tour:', error)
    }
  }

  // 只有在需要登录的情况下才显示登录窗口
  // 检查是否在 Tauri 环境中
  if (!isJumpDirectly.value) {
    try {
      // 检查 Tauri API 是否可用
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const currentWindow = await getCurrentWebviewWindow()
        await currentWindow.show()
      }
    } catch (error) {
      // 在非 Tauri 环境（如浏览器开发）中忽略此错误
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        logger.warn('[Login] Failed to show window:', error)
      }
    }
  }

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = t('login.status.service_disconnected')
  })

  // 自动登录时显示自动登录界面并触发登录
  if (login.value.autoLogin) {
    uiState.value = 'auto'
    normalLogin('PC', true, true)
  } else {
    // 手动登录模式，自动填充第一个历史账号
    uiState.value = 'manual'
    loginHistories.length > 0 && giveAccount(loginHistories[0])
  }

  window.addEventListener('click', closeMenu, true)
  window.addEventListener('keyup', enterKey)
  await checkUpdate('login', true)
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: 'checkUpdate',
    duration: CHECK_UPDATE_LOGIN_TIME
  })
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  window.removeEventListener('keyup', enterKey)
  // 清除Web Worker计时器
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: 'checkUpdate'
  })
  timerWorker.terminate()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';

.account-dropdown {
  border: 1px solid rgba(70, 70, 70, 0.1);
}

.account-scrollbar {
  max-height: 120px;
}

.login-button-manual,
.login-button-auto {
  color: #fff;
}

.user-name-ellipsis {
  max-width: 200px;
}
</style>
