<!-- Biometric Settings - Mobile biometric authentication settings -->
<template>
  <div class="biometric-settings">
    <n-card :bordered="false" class="settings-card">
      <!-- Header -->
      <template #header>
        <div class="card-header">
          <n-icon :size="24" class="header-icon">
            <Fingerprint />
          </n-icon>
          <div class="header-text">
            <h3>生物识别</h3>
            <p>使用指纹或面部识别快速登录</p>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <n-spin size="medium" />
        <p>检查生物识别功能中...</p>
      </div>

      <!-- Not Available -->
      <div v-else-if="!capability?.available" class="not-available">
        <n-icon :size="48" color="var(--hula-error)">
          <LockOff />
        </n-icon>
        <p class="not-available-text">
          {{ capability?.reason || '您的设备不支持生物识别功能' }}
        </p>
        <n-text depth="3" class="not-available-hint">需要在支持生物识别的设备上使用此功能</n-text>
      </div>

      <!-- Available -->
      <div v-else class="settings-content">
        <!-- Status Banner -->
        <n-alert :type="isEnabled ? 'success' : 'info'" :show-icon="true" class="status-banner">
          <template #icon>
            <n-icon v-if="isEnabled">
              <Check />
            </n-icon>
            <n-icon v-else>
              <InfoCircle />
            </n-icon>
          </template>
          {{ isEnabled ? '生物识别已启用' : '生物识别未启用' }}
        </n-alert>

        <!-- Biometric Type Info -->
        <div class="biometric-type">
          <div class="type-icon">
            <n-icon :size="32">
              <Fingerprint v-if="capability?.biometricType === 'fingerprint'" />
              <FaceId v-else-if="capability?.biometricType === 'face'" />
              <Scan v-else />
            </n-icon>
          </div>
          <div class="type-info">
            <div class="type-name">{{ biometricTypeName }}</div>
            <div class="type-description">
              {{ capability?.biometricType === 'fingerprint' ? '使用指纹进行身份验证' : '使用面部进行身份验证' }}
            </div>
          </div>
        </div>

        <!-- Toggle Switch -->
        <div class="setting-item">
          <div class="setting-label">
            <span>启用生物识别登录</span>
            <n-text depth="3">快速且安全</n-text>
          </div>
          <n-switch :value="isEnabled" :loading="isAuthenticating" @update:value="handleToggle" />
        </div>

        <!-- Security Info -->
        <div v-if="!isEnabled" class="security-info">
          <h4>为什么启用生物识别？</h4>
          <ul>
            <li>更安全 - 比密码更难被破解</li>
            <li>更快速 - 无需输入密码</li>
            <li>更便捷 - 轻松一触即可登录</li>
          </ul>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <n-button
            v-if="!isEnabled"
            type="primary"
            size="large"
            block
            :loading="isAuthenticating"
            @click="handleEnable">
            <template #icon>
              <n-icon><Fingerprint /></n-icon>
            </template>
            启用生物识别
          </n-button>

          <n-button v-else type="error" size="large" block :loading="isAuthenticating" @click="handleDisable">
            <template #icon>
              <n-icon><LockOff /></n-icon>
            </template>
            禁用生物识别
          </n-button>

          <n-button v-if="isEnabled" size="large" block @click="handleTest">
            <template #icon>
              <n-icon><Fingerprint /></n-icon>
            </template>
            测试生物识别
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- Test Result Dialog -->
    <n-modal
      v-model:show="showTestResult"
      preset="card"
      :title="testResult?.success ? '验证成功' : '验证失败'"
      class="w-90-max-w-320px">
      <div class="test-result">
        <n-icon
          :size="60"
          :color="testResult?.success ? 'var(--hula-success)' : 'var(--hula-error)'"
          class="result-icon">
          <Check v-if="testResult?.success" />
          <X v-else />
        </n-icon>
        <p class="result-message">
          {{ testResult?.success ? '生物识别验证成功！' : testResult?.error || '验证失败' }}
        </p>
      </div>

      <template #footer>
        <n-button block @click="showTestResult = false">确定</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NCard, NIcon, NSpin, NAlert, NSwitch, NButton, NModal, NText, useDialog } from 'naive-ui'
import { Fingerprint, LockOff, Check, InfoCircle, Scan, FaceId, X } from '@vicons/tabler'
import { useBiometricSettings } from '@/composables/useBiometricAuth'
import { msg } from '@/utils/SafeUI'

const dialog = useDialog()

// Use biometric settings hook
const {
  capability,
  isLoading,
  isAuthenticating,
  isEnabled,
  platform,
  checkCapability,
  authenticate,
  enableBiometric,
  disableBiometric,
  getBiometricTypeName
} = useBiometricSettings()

// Test result state
const showTestResult = ref(false)
const testResult = ref<{ success: boolean; error?: string } | null>(null)

// Computed
const biometricTypeName = computed(() => {
  if (!capability.value) return ''
  return getBiometricTypeName(capability.value.biometricType)
})

// Methods
const handleToggle = async (value: boolean) => {
  if (value) {
    await handleEnable()
  } else {
    await handleDisable()
  }
}

const handleEnable = async () => {
  // First, verify with biometric before enabling
  const result = await authenticate({
    title: '启用生物识别',
    description: '请验证您的身份以启用生物识别登录',
    negativeButtonText: '取消'
  })

  if (result.success) {
    const enabled = await enableBiometric()
    if (enabled) {
      msg.success('生物识别已启用')
    } else {
      msg.error('启用失败，请重试')
    }
  } else {
    msg.warning('需要先通过生物识别验证')
  }
}

const handleDisable = async () => {
  dialog.warning({
    title: '确认禁用',
    content: '禁用后需要使用密码登录，确定要禁用生物识别吗？',
    positiveText: '确认禁用',
    negativeText: '取消',
    onPositiveClick: async () => {
      const disabled = await disableBiometric()
      if (disabled) {
        msg.success('生物识别已禁用')
      } else {
        msg.error('禁用失败，请重试')
      }
    }
  })
}

const handleTest = async () => {
  const result = await authenticate({
    title: '测试生物识别',
    description: '请验证您的身份',
    negativeButtonText: '取消'
  })

  testResult.value = result
  showTestResult.value = true
}

// Lifecycle
onMounted(() => {
  checkCapability()
})
</script>

<style scoped lang="scss">
.biometric-settings {
  .settings-card {
    margin: 16px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;

    .header-icon {
      color: var(--primary-color);
    }

    .header-text {
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: var(--text-color-3);
      }
    }
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 12px;

  p {
    color: var(--text-color-3);
  }
}

.not-available {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;

  .not-available-text {
    margin: 16px 0 8px 0;
    font-size: 15px;
    font-weight: 500;
  }

  .not-available-hint {
    font-size: 13px;
  }
}

.settings-content {
  .status-banner {
    margin-bottom: 16px;
  }

  .biometric-type {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 12px;
    margin-bottom: 16px;

    .type-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: var(--card-color);
      border-radius: 50%;
      color: var(--primary-color);
    }

    .type-info {
      .type-name {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .type-description {
        font-size: 13px;
        color: var(--text-color-3);
      }
    }
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 12px;
    margin-bottom: 16px;

    .setting-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }
  }

  .security-info {
    padding: 16px;
    background: rgba(var(--hula-success-rgb), 0.05);
    border-radius: 12px;
    margin-bottom: 16px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: var(--text-color-2);

      li {
        margin-bottom: 6px;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.test-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;

  .result-icon {
    margin-bottom: 16px;
  }

  .result-message {
    text-align: center;
    font-size: 15px;
    margin: 0;
  }
}
</style>
