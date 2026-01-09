<template>
  <van-action-sheet v-model:show="show" :title="t('setting.e2ee.devices.verify_title')" :closeable="true">
    <div class="device-verification-sheet">
      <van-loading v-if="verifying" size="24px" vertical>
        {{ t('setting.e2ee.devices.verifying') }}
      </van-loading>

      <template v-else-if="device">
        <!-- Device Info -->
        <van-cell-group inset>
          <van-cell :title="device.displayName || device.deviceId">
            <template #icon>
              <div class="device-avatar">
                {{ (device.displayName || device.deviceId).charAt(0) }}
              </div>
            </template>
          </van-cell>
          <van-cell title="Device ID" :value="device.deviceId" />
        </van-cell-group>

        <!-- Verification Method -->
        <van-cell-group inset title="选择验证方式">
          <van-cell :title="t('setting.e2ee.devices.verify_emoji')" is-link @click="verifyMethod = 'emoji'">
            <template #icon>
              <van-icon name="smile-o" />
            </template>
            <template #right-icon>
              <van-icon v-if="verifyMethod === 'emoji'" name="success" color="var(--hula-success)" />
            </template>
          </van-cell>

          <van-cell :title="t('setting.e2ee.devices.verify_key')" is-link @click="verifyMethod = 'key'">
            <template #icon>
              <van-icon name="key" />
            </template>
            <template #right-icon>
              <van-icon v-if="verifyMethod === 'key'" name="success" color="var(--hula-success)" />
            </template>
          </van-cell>
        </van-cell-group>

        <!-- Emoji Verification -->
        <template v-if="verifyMethod === 'emoji' && !emojiVerified">
          <van-notice-bar type="info" :text="t('setting.e2ee.devices.emoji_instruction')" wrapable />

          <div class="emoji-grid">
            <div v-for="(emoji, index) in emojiList" :key="index" class="emoji-item">
              <div class="emoji-char">{{ emoji.char }}</div>
              <div class="emoji-name">{{ emoji.name }}</div>
            </div>
          </div>

          <div class="action-buttons">
            <van-button type="success" block round @click="handleVerifyEmoji">
              {{ t('setting.e2ee.devices.emoji_match') }}
            </van-button>
            <van-button plain block round @click="handleNotMatch">
              {{ t('setting.e2ee.devices.not_match') }}
            </van-button>
          </div>
        </template>

        <!-- Key Verification -->
        <template v-if="verifyMethod === 'key' && !keyVerified">
          <van-notice-bar type="info" :text="t('setting.e2ee.devices.key_instruction')" wrapable />

          <div class="key-display">
            <van-field
              :model-value="deviceKey"
              type="textarea"
              readonly
              :autosize="{ minHeight: 80, maxHeight: 120 }" />
          </div>

          <div class="action-buttons">
            <van-button type="success" block round @click="handleVerifyKey">
              {{ t('setting.e2ee.devices.key_match') }}
            </van-button>
            <van-button plain block round @click="handleNotMatch">
              {{ t('setting.e2ee.devices.not_match') }}
            </van-button>
          </div>
        </template>

        <!-- Verified Success -->
        <template v-if="emojiVerified || keyVerified">
          <van-empty image="success" :description="t('setting.e2ee.devices.verified')">
            <van-button type="primary" round @click="handleClose">
              {{ t('common.close') }}
            </van-button>
          </van-empty>
        </template>
      </template>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, showConfirmDialog } from 'vant'
import {
  ActionSheet as VanActionSheet,
  Icon as VanIcon,
  Loading as VanLoading,
  CellGroup as VanCellGroup,
  Cell as VanCell,
  NoticeBar as VanNoticeBar,
  Field as VanField,
  Button as VanButton,
  Empty as VanEmpty
} from 'vant'
import { useE2EEStore } from '@/stores/e2ee'
import { logger } from '@/utils/logger'

interface DeviceInfo {
  deviceId: string
  userId?: string
  displayName?: string
  verified: boolean
  blocked?: boolean
  lastSeenTs?: number
}

interface Props {
  show: boolean
  device: DeviceInfo | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'verified'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const e2eeStore = useE2EEStore()

const verifying = ref(false)
const verifyMethod = ref<'emoji' | 'key'>('emoji')
const emojiVerified = ref(false)
const keyVerified = ref(false)

const emojiList = ref([
  { char: '🐱', name: 'Cat' },
  { char: '🐶', name: 'Dog' },
  { char: '🦁', name: 'Lion' },
  { char: '🐸', name: 'Frog' },
  { char: '🦊', name: 'Fox' },
  { char: '🐼', name: 'Panda' },
  { char: '🐨', name: 'Koala' }
])

const deviceKey = computed(() => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      verifying.value = false
      verifyMethod.value = 'emoji'
      emojiVerified.value = false
      keyVerified.value = false
    }
  }
)

async function handleVerifyEmoji() {
  if (!props.device) return

  verifying.value = true
  try {
    const success = await e2eeStore.verifyDevice(props.device.deviceId)
    if (success) {
      emojiVerified.value = true
      showToast.success(t('setting.e2ee.devices.verification_success'))
      emit('verified')
    } else {
      showToast.fail(t('setting.e2ee.devices.verification_failed'))
    }
  } catch (error) {
    logger.error('[MobileDeviceVerify] Failed to verify:', error)
    showToast.fail(t('setting.e2ee.devices.verification_failed'))
  } finally {
    verifying.value = false
  }
}

async function handleVerifyKey() {
  if (!props.device) return

  verifying.value = true
  try {
    const success = await e2eeStore.verifyDevice(props.device.deviceId)
    if (success) {
      keyVerified.value = true
      showToast.success(t('setting.e2ee.devices.verification_success'))
      emit('verified')
    } else {
      showToast.fail(t('setting.e2ee.devices.verification_failed'))
    }
  } catch (error) {
    logger.error('[MobileDeviceVerify] Failed to verify:', error)
    showToast.fail(t('setting.e2ee.devices.verification_failed'))
  } finally {
    verifying.value = false
  }
}

async function handleNotMatch() {
  try {
    await showConfirmDialog({
      title: t('setting.e2ee.devices.not_match_title'),
      message: t('setting.e2ee.devices.not_match_content')
    })
    showToast.warning(t('setting.e2ee.devices.verification_cancelled'))
    handleClose()
  } catch {
    // User cancelled
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.device-verification-sheet {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;

  .device-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--van-gray-1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--van-text-color-2);
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 16px 0;

    .emoji-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px;
      background: var(--van-gray-1);
      border-radius: 8px;

      .emoji-char {
        font-size: 32px;
        line-height: 1;
      }

      .emoji-name {
        font-size: 11px;
        color: var(--van-text-color-3);
      }
    }
  }

  .key-display {
    margin: 16px 0;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
