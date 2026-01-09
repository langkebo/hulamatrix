<template>
  <van-popup v-model:show="show" position="bottom" :style="{ height: '80%' }" round>
    <div class="mobile-uia-flow">
      <!-- Header -->
      <div class="flow-header">
        <van-icon name="cross" @click="handleClose" />
        <div class="header-title">{{ title }}</div>
        <div style="width: 24px" />
      </div>

      <!-- Progress -->
      <van-steps :active="stepIndex" direction="horizontal" active-color="var(--hula-success)">
        <van-step v-for="(step, index) in steps" :key="index">
          {{ step.title }}
        </van-step>
      </van-steps>

      <!-- Content -->
      <div class="flow-content">
        <van-loading v-if="loading" size="24px" vertical>
          {{ t('auth.uia.loading') }}
        </van-loading>

        <!-- Password Step -->
        <template v-else-if="currentStep === 'password'">
          <van-field
            v-model="passwordForm.password"
            type="password"
            :label="t('auth.uia.password.label')"
            :placeholder="t('auth.uia.password.placeholder')"
            clearable />
        </template>

        <!-- Email Step -->
        <template v-else-if="currentStep === 'email'">
          <van-field
            v-model="emailForm.email"
            type="email"
            :label="t('auth.uia.email.label')"
            :placeholder="t('auth.uia.email.placeholder')"
            clearable />

          <van-field
            v-if="emailSent"
            v-model="emailForm.code"
            type="digit"
            :label="t('auth.uia.email.code_label')"
            :placeholder="t('auth.uia.email.code_placeholder')"
            maxlength="6"
            center
            clearable>
            <template #button>
              <van-button size="small" type="primary" :disabled="countdown > 0" @click="handleSendEmailCode">
                {{ countdown > 0 ? `${countdown}s` : t('auth.uia.email.resend') }}
              </van-button>
            </template>
          </van-field>

          <van-notice-bar v-if="!emailSent" type="info" :text="t('auth.uia.email.description')" wrapable />
        </template>

        <!-- MSISDN Step -->
        <template v-else-if="currentStep === 'msisdn'">
          <van-field
            v-model="msisdnForm.phone"
            type="tel"
            :label="t('auth.uia.msisdn.label')"
            :placeholder="t('auth.uia.msisdn.placeholder')"
            clearable />

          <van-field
            v-if="smsSent"
            v-model="msisdnForm.code"
            type="digit"
            :label="t('auth.uia.msisdn.code_label')"
            :placeholder="t('auth.uia.msisdn.code_placeholder')"
            maxlength="6"
            center
            clearable>
            <template #button>
              <van-button size="small" type="primary" :disabled="countdown > 0" @click="handleSendSMS">
                {{ countdown > 0 ? `${countdown}s` : t('auth.uia.msisdn.resend') }}
              </van-button>
            </template>
          </van-field>
        </template>

        <!-- Terms Step -->
        <template v-else-if="currentStep === 'terms'">
          <van-notice-bar type="info" :text="t('auth.uia.terms.description')" wrapable />

          <div class="terms-scroll">
            <div class="terms-text">
              {{ termsContent }}
            </div>
          </div>

          <van-checkbox v-model="termsAccepted">
            {{ t('auth.uia.terms.accept') }}
          </van-checkbox>
        </template>

        <!-- Dummy Step -->
        <template v-else-if="currentStep === 'dummy'">
          <van-empty image="success" :description="t('auth.uia.dummy.title')">
            <van-button type="primary" round @click="handleSubmit">
              {{ t('auth.uia.dummy.submit') }}
            </van-button>
          </van-empty>
        </template>
      </div>

      <!-- Error -->
      <van-notice-bar v-if="error" type="danger" :text="error" closeable @close="error = ''" />

      <!-- Actions -->
      <div class="flow-actions">
        <van-button v-if="canGoBack" plain @click="handleBack">
          {{ t('common.back') }}
        </van-button>

        <van-button type="primary" block :loading="loading" :disabled="!canSubmit" @click="handleSubmit">
          {{ submitButtonText }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import {
  Popup as VanPopup,
  Icon as VanIcon,
  Steps as VanSteps,
  Step as VanStep,
  Loading as VanLoading,
  Field as VanField,
  Button as VanButton,
  NoticeBar as VanNoticeBar,
  Checkbox as VanCheckbox,
  Empty as VanEmpty
} from 'vant'
import { logger } from '@/utils/logger'

interface UIAFlow {
  stages: string[]
  session: string
  params: Record<string, unknown>
}

interface Props {
  show: boolean
  flow: UIAFlow | null
  authType?: 'register' | 'password' | 'generic'
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'complete', auth: Record<string, unknown>): void
}

const props = withDefaults(defineProps<Props>(), {
  authType: 'generic'
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const currentStep = ref('')
const completedSteps = ref<string[]>([])
const emailSent = ref(false)
const smsSent = ref(false)
const termsAccepted = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const passwordForm = ref({ password: '' })
const emailForm = ref({ email: '', code: '' })
const msisdnForm = ref({ phone: '', code: '' })

const termsContent = ref(`Terms of Service

1. Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.

2. Privacy Policy
Your privacy is important to us. Our Privacy Policy explains how we handle your personal data.

3. User Responsibilities
You are responsible for maintaining the confidentiality of your account and password.

4. Content
You retain ownership of any content you submit to the service.`)

const title = computed(() => {
  switch (props.authType) {
    case 'register':
      return t('auth.uia.register_title')
    case 'password':
      return t('auth.uia.password_title')
    default:
      return t('auth.uia.title')
  }
})

const steps = computed(() => {
  const stepMap: Record<string, { title: string }> = {
    password: { title: t('auth.uia.steps.password') },
    email: { title: t('auth.uia.steps.email') },
    msisdn: { title: t('auth.uia.steps.msisdn') },
    terms: { title: t('auth.uia.steps.terms') },
    recaptcha: { title: t('auth.uia.steps.recaptcha') },
    dummy: { title: t('auth.uia.steps.dummy') }
  }

  if (!props.flow) return []

  return props.flow.stages.map((stage) => ({
    type: stage,
    ...(stepMap[stage] || { title: stage })
  }))
})

const stepIndex = computed(() => {
  return steps.value.findIndex((s) => s.type === currentStep.value)
})

const canGoBack = computed(() => {
  return completedSteps.value.length > 0
})

const canSubmit = computed(() => {
  if (currentStep.value === 'terms') {
    return termsAccepted.value
  }
  return true
})

const submitButtonText = computed(() => {
  if (currentStep.value === 'email' && !emailSent.value) {
    return t('auth.uia.email.send_code')
  }
  if (currentStep.value === 'msisdn' && !smsSent.value) {
    return t('auth.uia.msisdn.send_code')
  }
  const isLastStep = stepIndex.value === steps.value.length - 1
  return isLastStep ? t('common.confirm') : t('common.next')
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal && props.flow) {
      resetFlow()
      if (props.flow.stages.length > 0) {
        currentStep.value = props.flow.stages[0]
      }
    } else {
      // Clean up countdown timer when closing
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }
)

function resetFlow() {
  loading.value = false
  error.value = ''
  completedSteps.value = []
  currentStep.value = ''
  emailSent.value = false
  smsSent.value = false
  termsAccepted.value = false
  countdown.value = 0
  passwordForm.value = { password: '' }
  emailForm.value = { email: '', code: '' }
  msisdnForm.value = { phone: '', code: '' }

  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function handleSendEmailCode() {
  showToast.success(t('auth.uia.email.code_sent'))
  emailSent.value = true
  startCountdown()
}

function handleSendSMS() {
  showToast.success(t('auth.uia.msisdn.code_sent'))
  smsSent.value = true
  startCountdown()
}

async function handleSubmit() {
  loading.value = true
  error.value = ''

  try {
    // Basic validation
    if (currentStep.value === 'password' && !passwordForm.value.password) {
      error.value = t('auth.uia.password.required')
      loading.value = false
      return
    }

    if (currentStep.value === 'email') {
      if (!emailForm.value.email) {
        error.value = t('auth.uia.email.required')
        loading.value = false
        return
      }
      if (!emailSent.value) {
        handleSendEmailCode()
        loading.value = false
        return
      }
    }

    if (currentStep.value === 'msisdn') {
      if (!msisdnForm.value.phone) {
        error.value = t('auth.uia.msisdn.required')
        loading.value = false
        return
      }
      if (!smsSent.value) {
        handleSendSMS()
        loading.value = false
        return
      }
    }

    // Collect auth data
    const authData: Record<string, unknown> = {
      type: currentStep.value,
      session: props.flow?.session
    }

    switch (currentStep.value) {
      case 'password':
        authData.password = passwordForm.value.password
        break
      case 'email':
        authData.email = emailForm.value.email
        authData.code = emailForm.value.code
        break
      case 'msisdn':
        authData.phone = msisdnForm.value.phone
        authData.code = msisdnForm.value.code
        break
      case 'terms':
        authData.accepted = termsAccepted.value
        break
    }

    if (!completedSteps.value.includes(currentStep.value)) {
      completedSteps.value.push(currentStep.value)
    }

    const currentIndex = steps.value.findIndex((s) => s.type === currentStep.value)
    const nextStep = steps.value[currentIndex + 1]

    if (nextStep) {
      currentStep.value = nextStep.type
    } else {
      emit('complete', authData)
    }
  } catch (err: unknown) {
    logger.error('[MobileUIA] Submit failed:', err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function handleBack() {
  if (completedSteps.value.length > 0) {
    completedSteps.value.pop()
    const lastCompleted = completedSteps.value[completedSteps.value.length - 1]
    currentStep.value = lastCompleted || steps.value[0]?.type || ''
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.mobile-uia-flow {
  height: 100%;
  display: flex;
  flex-direction: column;

  .flow-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--van-gray-1);

    .header-title {
      font-size: 16px;
      font-weight: 600;
    }
  }

  .flow-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    .terms-scroll {
      max-height: 300px;
      overflow-y: auto;
      background: var(--van-gray-1);
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0;

      .terms-text {
        white-space: pre-wrap;
        line-height: 1.6;
        font-size: 14px;
      }
    }
  }

  .flow-actions {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--van-gray-1);

    .van-button {
      flex: 1;
    }
  }
}
</style>
