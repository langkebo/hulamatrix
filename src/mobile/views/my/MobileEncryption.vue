<template>
  <AutoFixHeightPage :title="t('encryption.title')">
    <template #header-extra>
      <EncryptionStatusIndicator :show-text="true" @click="() => {}" />
    </template>

    <div class="flex flex-col gap-16px p-20px">
      <n-spin :show="loading">
        <KeyBackupPanel />
        
        <CrossSigningPanel />
        
        <DeviceVerificationPanel />
      </n-spin>
    </div>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KeyBackupPanel from '@/components/encryption/KeyBackupPanel.vue'
import CrossSigningPanel from '@/components/encryption/CrossSigningPanel.vue'
import DeviceVerificationPanel from '@/components/encryption/DeviceVerificationPanel.vue'
import EncryptionStatusIndicator from '@/components/encryption/EncryptionStatusIndicator.vue'

const { t } = useI18n()
const loading = ref(false)
</script>

<style scoped>
.encryption-page {
  background: var(--bg-color);
}
</style>
