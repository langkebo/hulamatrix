<template>
  <n-card :title="t('encryption.cross_signing.title')" :bordered="false" class="cross-signing-panel">
    <template #header-extra>
      <n-tag :type="crossSigningStatus.enabled ? 'success' : 'warning'" size="small">
        {{ crossSigningStatus.enabled ? t('encryption.cross_signing.enabled') : t('encryption.cross_signing.disabled') }}
      </n-tag>
    </template>

    <n-flex :size="16" vertical>
      <n-alert v-if="!crossSigningStatus.enabled" type="warning" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#warning"></use></svg>
        </template>
        {{ t('encryption.cross_signing.warning_message') }}
      </n-alert>

      <n-alert v-else-if="crossSigningStatus.enabled && !crossSigningStatus.trusted" type="info" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#info"></use></svg>
        </template>
        {{ t('encryption.cross_signing.not_trusted_message') }}
      </n-alert>

      <n-alert v-else type="success" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#check-circle"></use></svg>
        </template>
        {{ t('encryption.cross_signing.trusted_message') }}
      </n-alert>

      <n-divider style="margin: 8px 0" />

      <n-flex :size="12" vertical>
        <div class="text-14px font-medium">{{ t('encryption.cross_signing.key_info') }}</div>

        <n-descriptions :column="1" bordered size="small">
          <n-descriptions-item :label="t('encryption.cross_signing.master_key')">
            <n-tag v-if="crossSigningStatus.enabled" type="success" size="small">
              {{ t('encryption.cross_signing.configured') }}
            </n-tag>
            <n-tag v-else type="default" size="small">
              {{ t('encryption.cross_signing.not_configured') }}
            </n-tag>
          </n-descriptions-item>

          <n-descriptions-item :label="t('encryption.cross_signing.self_signing_key')">
            <n-tag v-if="crossSigningStatus.enabled" type="success" size="small">
              {{ t('encryption.cross_signing.configured') }}
            </n-tag>
            <n-tag v-else type="default" size="small">
              {{ t('encryption.cross_signing.not_configured') }}
            </n-tag>
          </n-descriptions-item>

          <n-descriptions-item :label="t('encryption.cross_signing.user_signing_key')">
            <n-tag v-if="crossSigningStatus.enabled" type="success" size="small">
              {{ t('encryption.cross_signing.configured') }}
            </n-tag>
            <n-tag v-else type="default" size="small">
              {{ t('encryption.cross_signing.not_configured') }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>
      </n-flex>

      <n-divider style="margin: 8px 0" />

      <n-flex :size="12" vertical>
        <div class="text-14px font-medium">{{ t('encryption.cross_signing.actions') }}</div>

        <n-button v-if="!crossSigningStatus.enabled" type="primary" @click="handleSetupCrossSigning" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#shield"></use></svg>
          </template>
          {{ t('encryption.cross_signing.setup_cross_signing') }}
        </n-button>

        <n-button v-else-if="crossSigningStatus.enabled && !crossSigningStatus.trusted" type="primary" @click="handleVerifyIdentity" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#check"></use></svg>
          </template>
          {{ t('encryption.cross_signing.verify_identity') }}
        </n-button>

        <n-button @click="handleResetCrossSigning" :loading="loading">
          <template #icon>
            <svg class="size-16px"><use href="#refresh"></use></svg>
          </template>
          {{ t('encryption.cross_signing.reset_cross_signing') }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-modal v-model:show="showVerifyModal" preset="card" :title="t('encryption.cross_signing.verify_modal_title')" style="width: 500px">
      <n-flex :size="16" vertical>
        <n-alert type="info" :bordered="false">
          {{ t('encryption.cross_signing.verify_modal_description') }}
        </n-alert>

        <n-descriptions :column="1" bordered size="small">
          <n-descriptions-item :label="t('encryption.cross_signing.user_id')">
            {{ currentUserId }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.cross_signing.device_id')">
            {{ currentDeviceId }}
          </n-descriptions-item>
        </n-descriptions>

        <n-button type="primary" block @click="handleConfirmVerify" :loading="loading">
          {{ t('encryption.cross_signing.confirm_verify') }}
        </n-button>
      </n-flex>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const { t } = useI18n()
const crossSigningService = MatrixCrossSigningService.getInstance()
const clientService = MatrixClientService.getInstance()

const loading = ref(false)
const crossSigningStatus = ref<{
  enabled: boolean
  trusted: boolean
  needsBootstrap: boolean
}>({
  enabled: false,
  trusted: false,
  needsBootstrap: false
})

const showVerifyModal = ref(false)
const currentUserId = ref('')
const currentDeviceId = ref('')

const loadCrossSigningStatus = async () => {
  try {
    loading.value = true
    const enabled = await crossSigningService.isCrossSigningEnabled()

    const client = clientService.getClient()
    const userId = client?.getUserId()
    const deviceId = client?.getDeviceId()

    if (userId) {
      currentUserId.value = userId
    }
    if (deviceId) {
      currentDeviceId.value = deviceId
    }

    crossSigningStatus.value = {
      enabled,
      trusted: enabled,
      needsBootstrap: !enabled
    }
  } catch (error) {
    console.error('Failed to load cross signing status:', error)
  } finally {
    loading.value = false
  }
}

const handleSetupCrossSigning = async () => {
  try {
    loading.value = true
    const success = await crossSigningService.setupCrossSigning()
    if (success) {
      window.$message.success(t('encryption.cross_signing.setup_success'))
      await loadCrossSigningStatus()
    } else {
      window.$message.error(t('encryption.cross_signing.setup_failed'))
    }
  } catch (error) {
    console.error('Failed to setup cross signing:', error)
    window.$message.error(t('encryption.cross_signing.setup_failed'))
  } finally {
    loading.value = false
  }
}

const handleVerifyIdentity = () => {
  showVerifyModal.value = true
}

const handleConfirmVerify = async () => {
  try {
    loading.value = true
    const success = await crossSigningService.verifyDevice(currentDeviceId.value)
    if (success) {
      window.$message.success(t('encryption.cross_signing.verify_success'))
      showVerifyModal.value = false
      await loadCrossSigningStatus()
    } else {
      window.$message.error(t('encryption.cross_signing.verify_failed'))
    }
  } catch (error) {
    console.error('Failed to verify identity:', error)
    window.$message.error(t('encryption.cross_signing.verify_failed'))
  } finally {
    loading.value = false
  }
}

const handleResetCrossSigning = () => {
  window.$dialog.warning({
    title: t('encryption.cross_signing.reset_title'),
    content: t('encryption.cross_signing.reset_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        loading.value = true
        const success = await crossSigningService.bootstrapCrossSigning({ uploadDeviceSigningKeys: true })
        if (success) {
          window.$message.success(t('encryption.cross_signing.reset_success'))
          await loadCrossSigningStatus()
        } else {
          window.$message.error(t('encryption.cross_signing.reset_failed'))
        }
      } catch (error) {
        console.error('Failed to reset cross signing:', error)
        window.$message.error(t('encryption.cross_signing.reset_failed'))
      } finally {
        loading.value = false
      }
    }
  })
}

onMounted(() => {
  loadCrossSigningStatus()
})
</script>

<style scoped>
.cross-signing-panel {
  background: var(--bg-color);
}
</style>
