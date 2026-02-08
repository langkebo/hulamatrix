<template>
  <n-flex align="center" :size="8" class="encryption-status-indicator">
    <svg
      :class="['size-16px', statusIconClass]"
      @click="handleClick">
      <use :href="statusIcon"></use>
    </svg>
    <span v-if="showText" :class="['text-12px', statusTextClass]">
      {{ statusText }}
    </span>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixCryptoService from '@/services/matrix/MatrixCryptoService'
import MatrixKeyBackupService from '@/services/matrix/MatrixKeyBackupService'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'

interface Props {
  showText?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showText: true,
  clickable: true
})

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()
const cryptoService = MatrixCryptoService.getInstance()
const keyBackupService = MatrixKeyBackupService.getInstance()
const crossSigningService = MatrixCrossSigningService.getInstance()

const cryptoStatus = ref<'disabled' | 'enabled' | 'unverified' | 'verifying' | 'error'>('disabled')
const backupEnabled = ref(false)
const crossSigningEnabled = ref(false)

const overallStatus = computed(() => {
  if (cryptoStatus.value === 'disabled' || cryptoStatus.value === 'error') {
    return 'error'
  }

  if (!backupEnabled.value || !crossSigningEnabled.value) {
    return 'warning'
  }

  return 'success'
})

const statusIcon = computed(() => {
  switch (overallStatus.value) {
    case 'success':
      return '#shield-check'
    case 'warning':
      return '#shield-exclamation'
    case 'error':
      return '#shield-x'
    default:
      return '#shield'
  }
})

const statusIconClass = computed(() => {
  switch (overallStatus.value) {
    case 'success':
      return 'text-green-500'
    case 'warning':
      return 'text-yellow-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
})

const statusText = computed(() => {
  switch (overallStatus.value) {
    case 'success':
      return t('encryption.status.secure')
    case 'warning':
      return t('encryption.status.partially_secure')
    case 'error':
      return t('encryption.status.insecure')
    default:
      return t('encryption.status.unknown')
  }
})

const statusTextClass = computed(() => {
  switch (overallStatus.value) {
    case 'success':
      return 'text-green-600'
    case 'warning':
      return 'text-yellow-600'
    case 'error':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
})

const loadStatus = async () => {
  try {
    cryptoStatus.value = cryptoService.cryptoStatus.value.valueOf() as typeof cryptoStatus.value

    const backupStatus = await keyBackupService.isBackupEnabled()
    backupEnabled.value = backupStatus

    const crossSigningStatus = await crossSigningService.isCrossSigningEnabled()
    crossSigningEnabled.value = crossSigningStatus
  } catch (error) {
    console.error('Failed to load encryption status:', error)
    cryptoStatus.value = 'error'
  }
}

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}

onMounted(() => {
  loadStatus()
})
</script>

<style scoped>
.encryption-status-indicator {
  cursor: v-bind('props.clickable ? "pointer" : "default"');
  transition: opacity 0.2s;
}

.encryption-status-indicator:hover {
  opacity: 0.8;
}
</style>
