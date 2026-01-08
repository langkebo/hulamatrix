<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider
    :theme="naiveTheme"
    data-tauri-drag-region
    class="login-box size-full rounded-8px select-none flex flex-col">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" />

    <n-flex vertical justify="center" :size="25" class="w-full mt--40px flex-1 pointer-events-none">
      <!-- 注册菜单 -->
      <n-flex class="ma text-center w-260px pointer-events-auto" vertical :size="16">
        <n-flex justify="center" align="center">
          <span class="text-(24px #70938c) textFont">{{ t('auth.register.title') }}</span>
        </n-flex>
        <n-flex justify="center" class="mt-6px">
          <n-button text class="text-brand" @click="toggleServerInput()">自定义服务器</n-button>
        </n-flex>
        <n-collapse-transition :show="matrixStore.serverInputVisible">
          <n-flex vertical :size="8">
            <p class="text-12px">自定义服务器</p>
            <n-input
              class="pl-16px"
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

        <n-form :model="info" :rules="rules" ref="registerForm">
          <!-- 注册信息 - 仅昵称和密码 (Matrix不需要邮箱) -->
          <div>
            <n-form-item path="name">
              <n-input
                :class="[{ 'pr-20px': info.nickName }, { 'pr-16px': showNamePrefix && !info.nickName }]"
                maxlength="8"
                minlength="1"
                size="large"
                v-model:value="info.nickName"
                type="text"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                :allow-input="noSideSpace"
                :placeholder="showNamePrefix ? '' : t('auth.register.placeholders.nickname')"
                @focus="handleInputState($event, 'nickName')"
                @blur="handleInputState($event, 'nickName')"
                clearable>
                <template #prefix v-if="showNamePrefix || info.nickName">
                  <p class="text-12px">{{ t('auth.register.labels.nickname') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item path="password">
              <n-input
                :class="{ 'pl-16px': !showPasswordPrefix && !info.password }"
                maxlength="16"
                minlength="6"
                size="large"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                show-password-on="click"
                v-model:value="info.password"
                type="password"
                :allow-input="noSideSpace"
                :placeholder="showPasswordPrefix ? '' : t('auth.register.placeholders.password')"
                @focus="handleInputState($event, 'password')"
                @blur="handleInputState($event, 'password')"
                clearable>
                <template #prefix v-if="showPasswordPrefix || info.password">
                  <p class="text-12px">{{ t('auth.register.labels.password') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item path="confirmPassword">
              <n-input
                :class="{ 'pl-16px': !showConfirmPasswordPrefix && !confirmPassword }"
                maxlength="16"
                minlength="6"
                size="large"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                show-password-on="click"
                v-model:value="confirmPassword"
                type="password"
                :allow-input="noSideSpace"
                :placeholder="showConfirmPasswordPrefix ? '' : t('auth.register.placeholders.confirm_placeholder')"
                @focus="handleInputState($event, 'confirmPassword')"
                @blur="handleInputState($event, 'confirmPassword')"
                clearable>
                <template #prefix v-if="showConfirmPasswordPrefix || confirmPassword">
                  <p class="text-12px">{{ t('auth.register.labels.confirm') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <!-- 密码提示信息 -->
            <n-flex vertical v-if="info.password">
              <n-flex vertical :size="4">
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.min_length')"
                  :validator="validateMinLength" />
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.alpha_numeric')"
                  :validator="validateAlphaNumeric" />
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.special_char')"
                  :validator="validateSpecialChar" />
              </n-flex>
            </n-flex>

            <!-- 协议 -->
            <n-flex align="center" justify="center" :size="6" class="mt-10px">
              <n-checkbox v-model:checked="protocol" />
              <div class="text-12px color-#909090 cursor-default lh-14px">
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
          </div>
        </n-form>

        <!-- Matrix 注册按钮 (主要注册方式) -->
        <n-button
          :loading="loading"
          :disabled="!protocol"
          tertiary
          class="w-full mt-8px gradient-button register-button"
          @click="handleMatrixRegister">
          {{ loading ? '注册中...' : '注册' }}
        </n-button>

        <n-button text size="small" @click="closeWindow" class="mt-10px color-#909090">返回登录</n-button>
      </n-flex>
    </n-flex>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Ref } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, lightTheme, type FormInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useSettingStore } from '@/stores/setting'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import ActionBar from '@/components/windows/ActionBar.vue'

// 输入框类型定义
type InputType = 'nickName' | 'password' | 'confirmPassword'

const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()

const { toggleServerInput, applyCustomServer, registerMatrix, store: matrixStore } = useMatrixAuth()
const customServer = ref('')
const applyServer = async () => {
  // applyCustomServer takes a server URL string
  await applyCustomServer(customServer.value)
}

// 表单数据
const info = ref<{
  nickName: string
  password: string
  confirmPassword: string
}>({
  nickName: '',
  password: '',
  confirmPassword: ''
})

const confirmPassword = ref('')
const protocol = ref(false)
const loading = ref(false)

// 输入框状态
const inputStates = ref<Record<InputType, boolean>>({
  nickName: false,
  password: false,
  confirmPassword: false
})

const showNamePrefix = computed(() => inputStates.value.nickName)
const showPasswordPrefix = computed(() => inputStates.value.password)
const showConfirmPasswordPrefix = computed(() => inputStates.value.confirmPassword)

// 表单规则
const rules = {
  name: {
    required: true,
    message: t('auth.register.rules.nickname_required'),
    trigger: ['blur', 'input']
  },
  password: [
    {
      required: true,
      message: t('auth.register.rules.password_required'),
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule: unknown, value: string) => value.length >= 6,
      message: t('auth.register.password_hints.min_length'),
      trigger: ['blur', 'input']
    }
  ],
  confirmPassword: [
    {
      required: true,
      message: t('auth.register.rules.confirm_required'),
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule: unknown, value: string) => value === info.value.password,
      message: t('auth.register.password_hints.match'),
      trigger: ['blur', 'input']
    }
  ]
}

// 密码验证器
const validateMinLength = (value: string) => value.length >= 6

// 输入处理
const handleInputState = (event: FocusEvent, type: InputType) => {
  const target = event.target as HTMLInputElement
  inputStates.value[type] = target.value.length > 0
}

const noSideSpace = (value: string) => !value.includes(' ')

// Matrix 注册
const handleMatrixRegister = async () => {
  if (!info.value.nickName || !info.value.password) {
    msg.warning('请输入昵称与密码')
    return
  }

  if (!protocol.value) {
    msg.warning('请先同意用户协议和隐私政策')
    return
  }

  if (info.value.password !== confirmPassword.value) {
    msg.warning('两次输入的密码不一致')
    return
  }

  if (customServer.value) {
    await applyCustomServer(customServer.value)
  }

  loading.value = true
  try {
    await registerMatrix(info.value.nickName, info.value.password)
    msg.success('注册成功！正在跳转到登录页面...')
    setTimeout(() => {
      closeWindow()
    }, 1500)
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e)
    const sanitized = raw.replace(/https?:\/\/\S+/g, '')
    const friendly = /M_USER_IN_USE/i.test(raw)
      ? '该用户名已被注册'
      : /M_MISSING_TOKEN/i.test(raw)
        ? '缺少访问令牌，请重新登录或注册'
        : sanitized.trim()
    msg.error(`注册失败: ${friendly}`)
    logger.warn('[Register] Matrix 注册失败:', e)
  } finally {
    loading.value = false
  }
}

const closeWindow = () => {
  WebviewWindow.getByLabel('register')?.then((win) => {
    win?.close()
  })
  WebviewWindow.getByLabel('login')?.then((win) => {
    win?.setFocus()
  })
}

const openServiceAgreement = () => {
  // 打开用户协议页面
  // 可以使用外部URL或本地Markdown文件
  const agreementUrl = 'https://example.com/terms-of-service' // 替换为实际的服务协议URL

  // 如果有Tauri窗口管理器，使用新窗口打开
  // 否则在浏览器中打开
  if (typeof window !== 'undefined' && window.open) {
    window.open(agreementUrl, '_blank', 'width=800,height=600,scrollbars=yes')
  }

  logger.info('[RegisterWindow] Opening service agreement', { url: agreementUrl })
}

const openPrivacyAgreement = () => {
  // 打开隐私政策页面
  const privacyUrl = 'https://example.com/privacy-policy' // 替换为实际的隐私政策URL

  // 如果有Tauri窗口管理器，使用新窗口打开
  // 否则在浏览器中打开
  if (typeof window !== 'undefined' && window.open) {
    window.open(privacyUrl, '_blank', 'width=800,height=600,scrollbars=yes')
  }

  logger.info('[RegisterWindow] Opening privacy policy', { url: privacyUrl })
}

onMounted(() => {
  // 自动聚焦到昵称输入框
  inputStates.value.nickName = true
})
</script>

<style scoped lang="scss">
.gradient-button {
  background: linear-gradient(145deg, #acd7da, #13987f);
  border: none;
  transition: all 0.3s ease;

  &.register-button {
    color: #fff;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(19, 152, 127, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
