<template>
  <MobileLayout :backgroundImage="'/login_bg.png'" :safeAreaTop="false" :safeAreaBottom="false">
    <div class="h-full flex-col-center gap-40px">
      <div class="flex-center absolute top-13vh left-36px">
        <p class="text-(20px var(--hula-gray-900))">HI, 欢迎来到</p>
        <img :src="brandSvg" alt="HuLa 品牌标志" class="w-80px h-20px" />
      </div>

      <!-- 选项卡导航 -->
      <div class="w-80% h-40px absolute top-20vh flex-center">
        <div class="flex w-200px relative">
          <div
            @click="activeTab = 'login'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'login' ? 'text-(18px var(--hula-black))' : 'text-(16px var(--hula-gray-700))'
            ]">
            登录
          </div>
          <div
            @click="activeTab = 'register'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'register' ? 'text-(18px var(--hula-black))' : 'text-(16px var(--hula-gray-700))'
            ]">
            注册
          </div>
          <!-- 选中条 -->
          <div
            :class="[
              'z-10 absolute bottom--4px h-6px w-34px brand-bg transition-all duration-300 ease-out tab-indicator',
              activeTab === 'login' ? 'left-[33px]' : 'left-[133px]'
            ]"></div>
        </div>
      </div>

      <!-- 头像 -->
      <img v-if="activeTab === 'login'" :src="userInfo.avatar" alt="logo" class="size-86px rounded-full" />

      <!-- 登录表单 -->
      <n-flex v-if="activeTab === 'login'" class="text-center w-80%" vertical :size="16">
        <n-flex justify="center" class="mt--10px">
          <n-button text :style="{ color: 'var(--hula-brand-primary)' }" @click="toggleServerInput()">
            自定义服务器
          </n-button>
        </n-flex>
        <n-collapse-transition :show="matrixStore.serverInputVisible">
          <n-flex vertical :size="8">
            <p class="text-12px text-center">自定义服务器</p>
            <n-input
              class="pl-16px centered-input"
              size="large"
              v-model:value="customServer"
              type="text"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              :placeholder="'例如 matrix.example.com 或 https://matrix.example.com'"
              clearable />
            <n-button tertiary class="w-full" @click="applyServer">连接服务器</n-button>
          </n-flex>
        </n-collapse-transition>
        <n-input
          :class="{ 'pl-22px': loginHistories.length > 0 }"
          class="centered-input"
          size="large"
          v-model:value="userInfo.account"
          type="text"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = '输入HuLa账号'"
          clearable>
          <template #suffix>
            <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-var(--hula-gray-600)">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-var(--hula-gray-600)"><use href="#up"></use></svg>
            </n-flex>
          </template>
        </n-input>

        <!-- 账号选择框-->
        <div
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-box account-dropdown absolute w-80% max-h-140px bg-var(--hula-white) mt-45px z-99 rounded-8px p-8px box-border">
          <n-scrollbar class="account-scrollbar" trigger="none">
            <n-flex
              vertical
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px hover:bg-var(--hula-gray-100) hover:rounded-6px">
              <div class="flex-between-center">
                <n-avatar
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  class="size-28px bg-var(--hula-gray-300) rounded-50%" />
                <p class="text-14px color-var(--hula-gray-600)">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px">
                  <use href="#close"></use>
                </svg>
              </div>
            </n-flex>
          </n-scrollbar>
        </div>

        <n-input
          class="pl-22px mt-8px centered-input"
          size="large"
          show-password-on="click"
          v-model:value="userInfo.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = '输入HuLa密码'"
          clearable />

        <n-flex justify="flex-end" :size="6">
          <n-button text :style="{ color: 'var(--hula-brand-primary)' }" @click="handleForgetPassword">
            忘记密码
          </n-button>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          class="w-full mt-8px mb-50px gradient-button login-button"
          @click="normalLogin('MOBILE', true, false)">
          <span>{{ loginText }}</span>
        </n-button>

        <!-- 协议 -->
        <n-flex align="center" justify="center" :style="agreementStyle" :size="6" class="absolute bottom-0 w-[80%]">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-var(--hula-gray-400) cursor-default lh-14px">
            <span>已阅读并同意</span>
            <span @click.stop="toServiceAgreement" class="brand-link">服务协议</span>
            <span>和</span>
            <span @click.stop="toPrivacyAgreement" class="brand-link">HuLa隐私保护指引</span>
          </div>
        </n-flex>
      </n-flex>

      <!-- 注册表单（无验证码，单步注册） -->
      <n-flex v-if="activeTab === 'register'" class="text-center w-80%" vertical :size="16">
        <n-input
          class="centered-input"
          size="large"
          maxlength="8"
          minlength="1"
          v-model:value="registerInfo.nickName"
          type="text"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="registerNamePH"
          @focus="registerNamePH = ''"
          @blur="registerNamePH = '输入HuLa昵称'"
          clearable />

        <n-input
          class="pl-16px centered-input"
          size="large"
          minlength="6"
          show-password-on="click"
          v-model:value="registerInfo.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="registerPasswordPH"
          @focus="registerPasswordPH = ''"
          @blur="registerPasswordPH = '设置密码'"
          clearable />

        <n-input
          class="pl-16px centered-input"
          size="large"
          minlength="6"
          show-password-on="click"
          v-model:value="registerInfo.confirmPassword"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="confirmPasswordPH"
          @focus="confirmPasswordPH = ''"
          @blur="confirmPasswordPH = '确认密码'"
          clearable />

        <!-- 密码提示信息 -->
        <n-flex vertical v-if="registerInfo.password" :size="10" class="mt-8px">
          <Validation :value="registerInfo.password" message="最少6位" :validator="validateMinLength" />
          <Validation :value="registerInfo.password" message="由英文和数字构成" :validator="validateAlphaNumeric" />
          <Validation :value="registerInfo.password" message="必须有一个特殊字符" :validator="validateSpecialChar" />
        </n-flex>

        <!-- 协议 -->
        <n-flex align="center" justify="center" :size="6" class="mt-10px">
          <n-checkbox v-model:checked="registerProtocol" />
          <div class="text-12px color-var(--hula-gray-400) cursor-default lh-14px">
            <span>已阅读并同意</span>
            <span @click.stop="toServiceAgreement" class="brand-link">服务协议</span>
            <span>和</span>
            <span @click.stop="toPrivacyAgreement" class="brand-link">HuLa隐私保护指引</span>
          </div>
        </n-flex>

        <n-button
          :loading="registerLoading"
          :disabled="!isStep1Valid"
          tertiary
          class="w-full mt-8px mb-50px gradient-button login-button"
          @click="handleRegisterComplete">
          <span>注册</span>
        </n-button>
      </n-flex>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, watchEffect, onBeforeMount, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import Validation from '@/components/common/Validation.vue'
import router from '@/router'
import type { RegisterUserReq, UserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '@/stores/loginHistory'
import { useMobileStore } from '@/stores/mobile'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isAndroid, isIOS } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import { useMitt } from '@/hooks/useMitt'
import { WsResponseMessageType } from '@/services/wsType'
import { useSettingStore } from '@/stores/setting'
import { clearListener } from '@/utils/ReadCountQueue'
import { useLogin } from '@/hooks/useLogin'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import brandSvg from '@/assets/mobile/2.svg'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { secureRandomFloat } from '@/utils/secureRandom' // 本地注册信息类型，扩展API类型以包含确认密码
interface LocalRegisterInfo extends RegisterUserReq {}

const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = loginHistoriesStore
const mobileStore = useMobileStore()
const safeArea = computed(() => mobileStore.safeArea)
const settingStore = useSettingStore()
const login = computed(() => settingStore.login)

const isJumpDirectly = ref(false)

/** 当前激活的选项卡 */
const activeTab = ref<'login' | 'register'>('login')

/** 当前注册步骤 */
const currentStep = ref(1)

/** 注册账号信息 */
const registerInfo = ref<LocalRegisterInfo>({
  nickName: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: '',
  avatar: '',
  key: 'REGISTER_EMAIL',
  systemType: 2
})

// 登录相关的占位符和状态
const accountPH = ref('matrix账号')
const passwordPH = ref('matrix密码')
const protocol = ref(true)
const arrowStatus = ref(false)

// 注册相关的占位符和状态
const registerNamePH = ref('输入HuLa昵称')
const registerEmailPH = ref('输入邮箱')
const registerPasswordPH = ref('设置密码')
const confirmPasswordPH = ref('确认密码')
const registerCodePH = ref('输入邮箱验证码')
const registerProtocol = ref(true)
const registerLoading = ref(false)
const sendCodeLoading = ref(false)
const sendCodeCountdown = ref(0)
const MOBILE_EMAIL_TIMER_ID = 'mobile_register_email_timer'
const timerWorker = new Worker(new URL('@/workers/timer.worker.ts', import.meta.url))
const { normalLogin, loading, loginText, loginDisabled, info: userInfo } = useLogin()
const { toggleServerInput, applyCustomServer, store: matrixStore, registerMatrix } = useMatrixAuth()
const customServer = ref('')
const applyServer = async () => {
  await applyCustomServer(customServer.value)
}

const agreementStyle = computed(() => {
  const inset = safeArea.value.bottom || 0
  if (isAndroid()) {
    return { bottom: `${inset + 10}px` }
  }
  if (inset > 0) {
    return { bottom: `${inset}px` }
  }
  return { bottom: 'var(--safe-area-inset-bottom)' }
})

const stopSendCodeCountdown = () => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: MOBILE_EMAIL_TIMER_ID
  })
  sendCodeCountdown.value = 0
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data
  if (msgId !== MOBILE_EMAIL_TIMER_ID) return

  if (type === 'debug') {
    sendCodeCountdown.value = Math.max(0, Math.ceil(remainingTime / 1000))
  } else if (type === 'timeout') {
    sendCodeCountdown.value = 0
  }
}

timerWorker.onerror = () => {
  sendCodeCountdown.value = 0
}

watch(activeTab, () => {
  stopSendCodeCountdown()
  sendCodeLoading.value = false
})

/** 不允许输入空格 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 检查邮箱格式 */

/** 密码验证函数 */
const validateMinLength = (value: string) => value.length >= 6

/** 检查密码是否满足所有条件 */
const isPasswordValid = computed(() => {
  const password = registerInfo.value.password
  return validateMinLength(password) && validateAlphaNumeric(password) && validateSpecialChar(password)
})

/** 检查第一步是否可以继续 */
const isStep1Valid = computed(() => {
  return (
    registerInfo.value.nickName &&
    isPasswordValid.value &&
    registerInfo.value.confirmPassword === registerInfo.value.password &&
    registerProtocol.value
  )
})

// 监听登录表单变化
watchEffect(() => {
  loginDisabled.value = !(userInfo.value.account && userInfo.value.password && protocol.value)
  // 清空账号的时候设置默认头像
  if (!userInfo.value.account) {
    userInfo.value.avatar = '/logo.png'
  }
})

// 监听选项卡切换，重置状态
watch(activeTab, (newTab) => {
  if (newTab === 'login') {
    // 切换到登录时重置注册状态
    resetRegisterForm()
  } else {
    // 切换到注册时重置登录表单
    resetLoginForm()
  }
})

// 监听账号输入
watch(
  () => userInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      userInfo.value.avatar = '/logo.png'
      return
    }

    refreshAvatar(newAccount)
  }
)

/** 重置登录表单 */
const resetLoginForm = () => {
  userInfo.value = {
    account: '',
    password: '',
    avatar: '',
    uid: '',
    name: ''
  }
  accountPH.value = '输入HuLa账号'
  passwordPH.value = '输入HuLa密码'
  arrowStatus.value = false
}

/** 重置注册表单 */
const resetRegisterForm = () => {
  registerInfo.value = {
    nickName: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    uuid: '',
    avatar: '',
    systemType: 2,
    key: 'REGISTER_EMAIL'
  } as LocalRegisterInfo
  currentStep.value = 1
  registerNamePH.value = '输入HuLa昵称'
  registerEmailPH.value = '输入邮箱'
  registerPasswordPH.value = '设置密码'
  confirmPasswordPH.value = '确认密码'
  registerCodePH.value = '输入邮箱验证码'
  sendCodeLoading.value = false
  stopSendCodeCountdown()
}

/** 完成注册 */
const handleRegisterComplete = async () => {
  if (!isStep1Valid.value) {
    msg.warning('请完善信息后再注册')
    return
  }

  try {
    registerLoading.value = true
    registerInfo.value.email = (registerInfo.value.email || '').trim()
    registerInfo.value.code = ''
    registerInfo.value.uuid = ''
    // 随机生成头像编号
    const avatarNum = Math.floor(secureRandomFloat() * 21) + 1
    const avatarId = avatarNum.toString().padStart(3, '0')
    registerInfo.value.avatar = avatarId

    // 使用 Matrix SDK 注册
    const username = registerInfo.value.nickName || registerInfo.value.email
    const password = registerInfo.value.password

    if (!username || !password) {
      msg.error('用户名和密码不能为空')
      return
    }

    // 调用 Matrix SDK 注册
    const registerResult = await registerMatrix(username, password)

    if (!registerResult) {
      throw new Error('注册失败，未返回结果')
    }

    msg.success('注册成功')

    // 注册成功后设置用户信息
    const token = registerResult.access_token || registerResult.accessToken || ''
    const uid = registerResult.user_id || registerResult.userId || ''

    if (token && uid) {
      // 设置认证信息
      const { useMatrixAuthStore } = await import('@/stores/matrixAuth')
      const matrixAuthStore = useMatrixAuthStore()
      matrixAuthStore.setAuth(token, uid)

      // 设置用户信息到 userStore
      userInfo.value.uid = uid
      userInfo.value.account = username
      userInfo.value.name = registerInfo.value.nickName || username
      userInfo.value.password = password

      // 保存到登录历史
      loginHistoriesStore.addLoginHistory({
        uid,
        account: username,
        name: registerInfo.value.nickName || username,
        avatar: registerInfo.value.avatar || '',
        password
      } as UserInfoType)

      router.push('/mobile/message')
    } else {
      throw new Error('注册后未返回 token 或 user_id')
    }
  } catch (error) {
    // 处理注册失败
    const errorMsg = error instanceof Error ? error.message : String(error)
    msg.error(errorMsg || '注册失败')
    logger.error('注册失败:', error)
  } finally {
    registerLoading.value = false
  }
}

/**
 * 给账号赋值
 * @param item 账户信息
 * */
const giveAccount = (item: UserInfoType | undefined) => {
  if (!item) return
  const { account, avatar, name, uid } = item
  userInfo.value.account = account || ''
  userInfo.value.avatar = avatar
  userInfo.value.name = name
  userInfo.value.uid = uid
  arrowStatus.value = false
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
  userInfo.value.account = ''
  userInfo.value.password = ''
  userInfo.value.avatar = '/logo.png'
}

const handleForgetPassword = () => {
  router.push({
    name: 'mobileForgetPassword'
  })
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
}

onBeforeMount(async () => {
  // const token = localStorage.getItem('TOKEN')
  // const refreshToken = localStorage.getItem('REFRESH_TOKEN')

  if (!login.value.autoLogin) {
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    clearListener()
    return
  }

  // 只有在非自动登录的情况下才验证token并直接打开主窗口
  // if (token && refreshToken && !login.value.autoLogin) {
  //   isJumpDirectly.value = true
  //   try {
  //     // await openHomeWindow()
  //     return // 直接返回，不执行后续的登录相关逻辑
  //   } catch (error) {
  //     isJumpDirectly.value = false
  //     // token无效，清除token并重置状态
  //     localStorage.removeItem('TOKEN')
  //     localStorage.removeItem('REFRESH_TOKEN')
  //     userStore.userInfo = undefined
  //   }
  // }
})

const toServiceAgreement = () => {
  router.push({
    name: 'mobileServiceAgreement'
  })
}

const toPrivacyAgreement = () => {
  router.push({
    name: 'mobilePrivacyAgreement'
  })
}

const refreshAvatar = useDebounceFn((newAccount: string) => {
  const matchedAccount = loginHistories.find(
    (history) => history.account === newAccount || history.email === newAccount
  )
  if (matchedAccount) {
    userInfo.value.avatar = AvatarUtils.getAvatarUrl(matchedAccount.avatar)
  } else {
    userInfo.value.avatar = '/logo.png'
  }
}, 300)

onMounted(async () => {
  window.addEventListener('click', closeMenu, true)
  if (isIOS()) {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) invoke('set_webview_keyboard_adjustment', { enabled: false })
  }
  // 只有在需要登录的情况下才显示登录窗口
  if (isJumpDirectly.value) {
    loading.value = false
    router.push('/mobile/message')
    return
  }

  // 进入登录页面时立即隐藏首屏，确保无论登录成功或失败都能看到登录界面
  {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) await invoke('hide_splash_screen')
  }

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = '服务异常断开'
  })

  if (login.value.autoLogin) {
    normalLogin('MOBILE', true, true)
  } else {
    loginHistories.length > 0 && giveAccount(loginHistories[0])
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  stopSendCodeCountdown()
  timerWorker.terminate()
  if (isIOS()) {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) invoke('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';

/* 输入框文字居中对齐 */
.centered-input {
  :deep(.n-input__input-el) {
    text-align: center;
  }
  :deep(.n-input__placeholder) {
    text-align: center;
  }
}

/* 确保按钮完全居中 */
.gradient-button {
  text-align: center;
}

/* HuLa 品牌色链接 */
.brand-link {
  color: var(--hula-brand-primary);
  cursor: pointer;

  &:hover {
    color: var(--hula-brand-hover);
  }

  &:active {
    color: var(--hula-brand-active);
  }
}

/* HuLa 品牌色背景 */
.brand-bg {
  background: var(--hula-brand-primary);
}

/* 选项卡指示器 */
.tab-indicator {
  border-radius: 24px 42px 4px 24px;
}

/* 账号下拉框 */
.account-dropdown {
  border: 1px solid rgba(var(--hula-gray-600-rgb), 0.1);
}

/* 账号滚动条 */
.account-scrollbar {
  max-height: 120px;
}

/* 登录/注册按钮 */
.login-button {
  color: var(--hula-white);
}
</style>
