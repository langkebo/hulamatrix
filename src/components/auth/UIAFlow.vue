<template>
  <n-modal :show="show" :mask-closable="false" :closable="false" @update:show="handleClose">
    <n-card
      style="width: 480px; max-width: 90vw"
      :title="title"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true">
      <!-- Progress Steps -->
      <n-steps :current="currentStepIndex" :status="stepStatus">
        <n-step v-for="(step, index) in steps" :key="step.type || index" :title="step.title" />
      </n-steps>

      <n-divider />

      <!-- Step Content -->
      <div class="uia-content">
        <n-spin :show="loading">
          <!-- Password Step -->
          <template v-if="currentStep === 'password'">
            <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
              <n-form-item path="password" :label="t('auth.uia.password.label')">
                <n-input
                  v-model:value="passwordForm.password"
                  type="password"
                  show-password-on="click"
                  :placeholder="t('auth.uia.password.placeholder')"
                  @keydown.enter="handlePasswordSubmit" />
              </n-form-item>
            </n-form>
          </template>

          <!-- Email Step -->
          <template v-else-if="currentStep === 'email'">
            <n-form ref="emailFormRef" :model="emailForm" :rules="emailRules">
              <n-form-item path="email" :label="t('auth.uia.email.label')">
                <n-input v-model:value="emailForm.email" :placeholder="t('auth.uia.email.placeholder')" />
              </n-form-item>

              <n-form-item v-if="emailSent" path="code" :label="t('auth.uia.email.code_label')">
                <n-input
                  v-model:value="emailForm.code"
                  :placeholder="t('auth.uia.email.code_placeholder')"
                  maxlength="6" />
              </n-form-item>
            </n-form>

            <n-space v-if="!emailSent" vertical>
              <n-text>{{ t('auth.uia.email.description') }}</n-text>
            </n-space>
          </template>

          <!-- MSISDN Step -->
          <template v-else-if="currentStep === 'msisdn'">
            <n-form ref="msisdnFormRef" :model="msisdnForm" :rules="msisdnRules">
              <n-form-item path="phone" :label="t('auth.uia.msisdn.label')">
                <n-input v-model:value="msisdnForm.phone" :placeholder="t('auth.uia.msisdn.placeholder')" />
              </n-form-item>

              <n-form-item v-if="smsSent" path="code" :label="t('auth.uia.msisdn.code_label')">
                <n-input
                  v-model:value="msisdnForm.code"
                  :placeholder="t('auth.uia.msisdn.code_placeholder')"
                  maxlength="6" />
              </n-form-item>
            </n-form>
          </template>

          <!-- Terms Step -->
          <template v-else-if="currentStep === 'terms'">
            <div class="terms-content">
              <n-alert type="info" style="margin-bottom: 16px">
                {{ t('auth.uia.terms.description') }}
              </n-alert>

              <n-scrollbar style="max-height: 300px; margin-bottom: 16px">
                <div class="terms-text">
                  {{ termsContent }}
                </div>
              </n-scrollbar>

              <n-checkbox v-model:checked="termsAccepted">
                {{ t('auth.uia.terms.accept') }}
              </n-checkbox>
            </div>
          </template>

          <!-- ReCaptcha Step -->
          <template v-else-if="currentStep === 'recaptcha'">
            <div class="recaptcha-content">
              <n-text>{{ t('auth.uia.recaptcha.description') }}</n-text>
              <div ref="recaptchaContainer" class="recaptcha-container" />
            </div>
          </template>

          <!-- Dummy Step -->
          <template v-else-if="currentStep === 'dummy'">
            <n-result status="info" :title="t('auth.uia.dummy.title')">
              <template #footer>
                <n-button @click="handleDummySubmit">
                  {{ t('auth.uia.dummy.submit') }}
                </n-button>
              </template>
            </n-result>
          </template>
        </n-spin>
      </div>

      <!-- Error Display -->
      <n-alert v-if="error" type="error" :title="error" closable @close="error = ''" style="margin-top: 16px" />

      <!-- Actions -->
      <template #footer>
        <n-space justify="space-between">
          <n-button v-if="canGoBack" quaternary @click="handleBack">
            {{ t('common.back') }}
          </n-button>
          <div style="flex: 1" />
          <n-button quaternary @click="handleClose">
            {{ t('common.cancel') }}
          </n-button>
          <n-button type="primary" :loading="loading" :disabled="!canSubmit" @click="handleSubmit">
            {{ submitButtonText }}
          </n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NCard,
  NSteps,
  NStep,
  NDivider,
  NSpin,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NAlert,
  NCheckbox,
  NScrollbar,
  NResult,
  NText,
  useMessage
} from 'naive-ui'
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
const message = useMessage()

const loading = ref(false)
const error = ref('')
const currentStep = ref('')
const completedSteps = ref<string[]>([])
const emailSent = ref(false)
const smsSent = ref(false)
const termsAccepted = ref(false)

// Form refs
const passwordFormRef = ref()
const emailFormRef = ref()
const msisdnFormRef = ref()
const recaptchaContainer = ref()

// Form data
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

const passwordRules = {
  password: [{ required: true, message: t('auth.uia.password.required'), trigger: 'blur' }]
}

const emailRules = {
  email: [
    { required: true, message: t('auth.uia.email.required'), trigger: 'blur' },
    { type: 'email' as const, message: t('auth.uia.email.invalid'), trigger: 'blur' }
  ],
  code: [{ required: true, message: t('auth.uia.email.code_required'), trigger: 'blur' }]
}

const msisdnRules = {
  phone: [{ required: true, message: t('auth.uia.msisdn.required'), trigger: 'blur' }],
  code: [{ required: true, message: t('auth.uia.msisdn.code_required'), trigger: 'blur' }]
}

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

const stepStatus = computed(() => {
  return error.value ? 'error' : 'process'
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
      // Start with first available stage
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
    // grecaptcha.render(recaptchaContainer.value, { sitekey: '...' })
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
      formValid = await passwordFormRef.value?.validate()
    } else if (currentStep.value === 'email') {
      formValid = await emailFormRef.value?.validate()
    } else if (currentStep.value === 'msisdn') {
      formValid = await msisdnFormRef.value?.validate()
    }

    if (!formValid) {
      loading.value = false
      return
    }

    // Handle step-specific logic
    if (currentStep.value === 'email' && !emailSent.value) {
      // Send email verification code
      emailSent.value = true
      message.success(t('auth.uia.email.code_sent'))
      loading.value = false
      return
    }

    if (currentStep.value === 'msisdn' && !smsSent.value) {
      // Send SMS verification code
      smsSent.value = true
      message.success(t('auth.uia.msisdn.code_sent'))
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
        if (emailSent.value) {
          authData.code = emailForm.value.code
        } else {
          authData.email = emailForm.value.email
        }
        break
      case 'msisdn':
        if (smsSent.value) {
          authData.code = msisdnForm.value.code
        } else {
          authData.phone = msisdnForm.value.phone
        }
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
      // Move to next step
      currentStep.value = nextStep.type
    } else {
      // All steps completed
      emit('complete', authData)
    }
  } catch (err: unknown) {
    logger.error('[UIAFlow] Submit failed:', err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function handlePasswordSubmit() {
  await handleSubmit()
}

async function handleDummySubmit() {
  await handleSubmit()
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
.uia-content {
  min-height: 200px;
  padding: 16px 0;

  .terms-content {
    .terms-text {
      white-space: pre-wrap;
      line-height: 1.6;
      color: var(--text-color-2);
    }
  }

  .recaptcha-content {
    text-align: center;
    padding: 20px 0;

    .recaptcha-container {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }
  }
}
</style>
