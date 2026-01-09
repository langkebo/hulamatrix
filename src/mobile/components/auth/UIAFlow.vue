<template>
  <van-popup v-model:show="visible" round position="bottom" :style="{ height: '70%' }" closeable>
    <div class="mobile-uia-flow">
      <!-- Header -->
      <div class="uia-header">
        <van-nav-bar :title="title" />
        <van-steps :active="currentStepIndex" direction="horizontal" active-color="var(--hula-success)">
          <van-step v-for="(step, index) in steps" :key="step.type || index">{{ step.title }}</van-step>
        </van-steps>
      </div>

      <!-- Content -->
      <div class="uia-content">
        <van-loading v-if="loading" size="24px" vertical>加载中...</van-loading>

        <!-- Password Step -->
        <template v-if="currentStep === 'password'">
          <van-cell-group inset>
            <van-field
              v-model="passwordForm.password"
              type="password"
              :label="t('auth.uia.password.label')"
              :placeholder="t('auth.uia.password.placeholder')"
              :rules="passwordRules.password" />
          </van-cell-group>
        </template>

        <!-- Email Step -->
        <template v-else-if="currentStep === 'email'">
          <van-cell-group inset>
            <van-field
              v-model="emailForm.email"
              type="email"
              :label="t('auth.uia.email.label')"
              :placeholder="t('auth.uia.email.placeholder')"
              :rules="emailRules.email" />

            <van-field
              v-if="emailSent"
              v-model="emailForm.code"
              type="text"
              :label="t('auth.uia.email.code_label')"
              :placeholder="t('auth.uia.email.code_placeholder')"
              maxlength="6"
              :rules="emailRules.code" />
          </van-cell-group>

          <van-notice-bar v-if="!emailSent" :text="t('auth.uia.email.description')" />
        </template>

        <!-- MSISDN Step -->
        <template v-else-if="currentStep === 'msisdn'">
          <van-cell-group inset>
            <van-field
              v-model="msisdnForm.phone"
              type="tel"
              :label="t('auth.uia.msisdn.label')"
              :placeholder="t('auth.uia.msisdn.placeholder')"
              :rules="msisdnRules.phone" />

            <van-field
              v-if="smsSent"
              v-model="msisdnForm.code"
              type="text"
              :label="t('auth.uia.msisdn.code_label')"
              :placeholder="t('auth.uia.msisdn.code_placeholder')"
              maxlength="6"
              :rules="msisdnRules.code" />
          </van-cell-group>
        </template>

        <!-- Terms Step -->
        <template v-else-if="currentStep === 'terms'">
          <van-notice-bar type="info" :text="t('auth.uia.terms.description')" />
          <div class="terms-content">
            <div class="terms-text">{{ termsContent }}</div>
          </div>
          <van-checkbox v-model="termsAccepted">{{ t('auth.uia.terms.accept') }}</van-checkbox>
        </template>

        <!-- ReCaptcha Step -->
        <template v-else-if="currentStep === 'recaptcha'">
          <div class="recaptcha-content">
            <p>{{ t('auth.uia.recaptcha.description') }}</p>
            <div ref="recaptchaContainer" class="recaptcha-container" />
          </div>
        </template>

        <!-- Dummy Step -->
        <template v-else-if="currentStep === 'dummy'">
          <van-empty :description="t('auth.uia.dummy.title')">
            <van-button type="primary" @click="handleDummySubmit">
              {{ t('auth.uia.dummy.submit') }}
            </van-button>
          </van-empty>
        </template>

        <!-- Error Display -->
        <van-notice-bar v-if="error" type="danger" :text="error" closable @close="error = ''" />
      </div>

      <!-- Footer Actions -->
      <div class="uia-footer">
        <van-button v-if="canGoBack" plain @click="handleBack">{{ t('common.back') }}</van-button>
        <van-button plain @click="handleClose">{{ t('common.cancel') }}</van-button>
        <van-button type="primary" :loading="loading" :disabled="!canSubmit" @click="handleSubmit">
          {{ submitButtonText }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast } from 'vant'
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

// Form data
const passwordForm = ref({ password: '' })
const emailForm = ref({ email: '', code: '' })
const msisdnForm = ref({ phone: '', code: '' })

const recaptchaContainer = ref()

const termsContent = ref(`Terms of Service

1. Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.

2. Privacy Policy
Your privacy is important to us. Our Privacy Policy explains how we handle your personal data.

3. User Responsibilities
You are responsible for maintaining the confidentiality of your account and password.

4. Content
You retain ownership of any content you submit to the service.`)

const passwordRules = {
  password: [{ required: true, message: t('auth.uia.password.required') }]
}

const emailRules = {
  email: [
    { required: true, message: t('auth.uia.email.required') },
    { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('auth.uia.email.invalid') }
  ],
  code: [{ required: true, message: t('auth.uia.email.code_required') }]
}

const msisdnRules = {
  phone: [{ required: true, message: t('auth.uia.msisdn.required') }],
  code: [{ required: true, message: t('auth.uia.msisdn.code_required') }]
}

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

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

const currentStepIndex = computed(() => {
  const index = steps.value.findIndex((s) => s.type === currentStep.value)
  return index >= 0 ? index : 0
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
  const isLastStep = currentStepIndex.value === steps.value.length - 1
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
    }
  }
)

watch(currentStep, async (newStep) => {
  if (newStep === 'recaptcha') {
    await nextTick()
    // Initialize reCAPTCHA if needed
  }
})

function resetFlow() {
  loading.value = false
  error.value = ''
  completedSteps.value = []
  currentStep.value = ''
  emailSent.value = false
  smsSent.value = false
  termsAccepted.value = false
  passwordForm.value = { password: '' }
  emailForm.value = { email: '', code: '' }
  msisdnForm.value = { phone: '', code: '' }
}

async function handleSubmit() {
  loading.value = true
  error.value = ''

  try {
    // Validate form
    let formValid = true
    if (currentStep.value === 'password') {
      if (!passwordForm.value.password) {
        formValid = false
        showToast(t('auth.uia.password.required'))
      }
    } else if (currentStep.value === 'email') {
      if (!emailForm.value.email || (!emailSent.value && !emailForm.value.email.includes('@'))) {
        formValid = false
        showToast(t('auth.uia.email.invalid'))
      }
      if (emailSent.value && !emailForm.value.code) {
        formValid = false
        showToast(t('auth.uia.email.code_required'))
      }
    } else if (currentStep.value === 'msisdn') {
      if (!msisdnForm.value.phone) {
        formValid = false
        showToast(t('auth.uia.msisdn.required'))
      }
      if (smsSent.value && !msisdnForm.value.code) {
        formValid = false
        showToast(t('auth.uia.msisdn.code_required'))
      }
    }

    if (!formValid) {
      loading.value = false
      return
    }

    // Handle step-specific logic
    if (currentStep.value === 'email' && !emailSent.value) {
      emailSent.value = true
      showToast.success(t('auth.uia.email.code_sent'))
      loading.value = false
      return
    }

    if (currentStep.value === 'msisdn' && !smsSent.value) {
      smsSent.value = true
      showToast.success(t('auth.uia.msisdn.code_sent'))
      loading.value = false
      return
    }

    // Collect auth data for this step
    const authData: Record<string, unknown> = {
      type: currentStep.value,
      session: props.flow?.session
    }

    // Add step-specific data
    switch (currentStep.value) {
      case 'password':
        authData.password = passwordForm.value.password
        break
      case 'email':
        authData.code = emailForm.value.code
        authData.email = emailForm.value.email
        break
      case 'msisdn':
        authData.code = msisdnForm.value.code
        authData.phone = msisdnForm.value.phone
        break
      case 'terms':
        authData.accepted = termsAccepted.value
        break
    }

    // Mark current step as completed
    if (!completedSteps.value.includes(currentStep.value)) {
      completedSteps.value.push(currentStep.value)
    }

    // Check if there are more steps
    const currentIndex = steps.value.findIndex((s) => s.type === currentStep.value)
    const nextStep = steps.value[currentIndex + 1]

    if (nextStep) {
      currentStep.value = nextStep.type
    } else {
      emit('complete', authData)
    }
  } catch (err: unknown) {
    logger.error('[MobileUIAFlow] Submit failed:', err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function handleDummySubmit() {
  handleSubmit()
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
  display: flex;
  flex-direction: column;
  height: 100%;

  .uia-header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--van-gray-3);
  }

  .uia-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;

    .terms-content {
      background: var(--van-gray-1);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;

      .terms-text {
        max-height: 300px;
        overflow-y: auto;
        white-space: pre-wrap;
        line-height: 1.6;
        font-size: 13px;
        color: var(--van-text-color-2);
      }
    }

    .recaptcha-content {
      text-align: center;
      padding: 20px;

      .recaptcha-container {
        display: flex;
        justify-content: center;
        margin-top: 16px;
      }
    }
  }

  .uia-footer {
    flex-shrink: 0;
    padding: 16px;
    border-top: 1px solid var(--van-gray-3);
    display: flex;
    gap: 8px;
    justify-content: space-between;

    .van-button {
      flex: 1;
    }
  }
}
</style>
