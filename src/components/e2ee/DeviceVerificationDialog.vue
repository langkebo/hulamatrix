<template>
  <n-modal :show="show" :mask-closable="false" @update:show="handleClose">
    <n-card
      style="width: 500px; max-width: 90vw"
      :title="t('setting.e2ee.devices.verify_title')"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true">
      <n-spin :show="verifying">
        <n-space vertical v-if="device">
          <!-- 设备信息 -->
          <n-alert type="info">
            <n-space vertical>
              <n-text strong>{{ device.displayName || device.deviceId }}</n-text>
              <n-text code>{{ device.deviceId }}</n-text>
            </n-space>
          </n-alert>

          <!-- 验证方式选择 -->
          <n-divider>{{ t('setting.e2ee.devices.verify_method') }}</n-divider>

          <n-space vertical>
            <n-card
              hoverable
              @click="verifyMethod = 'emoji'"
              :style="{ borderColor: verifyMethod === 'emoji' ? '#18a058' : undefined }">
              <template #header>
                <n-space align="center">
                  <n-icon size="24">
                    <MoodHappy />
                  </n-icon>
                  <n-text strong>{{ t('setting.e2ee.devices.verify_emoji') }}</n-text>
                </n-space>
              </template>
              <n-text depth="3">
                {{ t('setting.e2ee.devices.verify_emoji_desc') }}
              </n-text>
            </n-card>

            <n-card
              hoverable
              @click="verifyMethod = 'key'"
              :style="{ borderColor: verifyMethod === 'key' ? '#18a058' : undefined }">
              <template #header>
                <n-space align="center">
                  <n-icon size="24">
                    <Key />
                  </n-icon>
                  <n-text strong>{{ t('setting.e2ee.devices.verify_key') }}</n-text>
                </n-space>
              </template>
              <n-text depth="3">
                {{ t('setting.e2ee.devices.verify_key_desc') }}
              </n-text>
            </n-card>
          </n-space>

          <!-- Emoji 验证 -->
          <template v-if="verifyMethod === 'emoji'">
            <n-divider>{{ t('setting.e2ee.devices.compare_emoji') }}</n-divider>

            <n-space vertical v-if="!emojiVerified">
              <n-text>{{ t('setting.e2ee.devices.emoji_instruction') }}</n-text>

              <n-grid :cols="7" :x-gap="12" :y-gap="12">
                <n-gi v-for="(emoji, index) in emojiList" :key="index">
                  <div class="emoji-item">
                    <div class="emoji-char">{{ emoji.char }}</div>
                    <div class="emoji-name">{{ emoji.name }}</div>
                  </div>
                </n-gi>
              </n-grid>

              <n-space>
                <n-button type="success" @click="handleVerifyEmoji">
                  {{ t('setting.e2ee.devices.emoji_match') }}
                </n-button>
                <n-button @click="handleNotMatch">
                  {{ t('setting.e2ee.devices.not_match') }}
                </n-button>
              </n-space>
            </n-space>

            <n-result v-else status="success" :title="t('setting.e2ee.devices.verified')" />
          </template>

          <!-- 密钥验证 -->
          <template v-if="verifyMethod === 'key'">
            <n-divider>{{ t('setting.e2ee.devices.compare_key') }}</n-divider>

            <n-space vertical v-if="!keyVerified">
              <n-text>{{ t('setting.e2ee.devices.key_instruction') }}</n-text>

              <n-card>
                <n-text code style="font-size: 12px; word-break: break-all">
                  {{ deviceKey }}
                </n-text>
              </n-card>

              <n-space>
                <n-button type="success" @click="handleVerifyKey">
                  {{ t('setting.e2ee.devices.key_match') }}
                </n-button>
                <n-button @click="handleNotMatch">
                  {{ t('setting.e2ee.devices.not_match') }}
                </n-button>
              </n-space>
            </n-space>

            <n-result v-else status="success" :title="t('setting.e2ee.devices.verified')" />
          </template>
        </n-space>
      </n-spin>

      <template #footer>
        <n-space justify="end">
          <n-button @click="handleClose">{{ t('common.close') }}</n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NCard,
  NSpace,
  NSpin,
  NAlert,
  NText,
  NDivider,
  NGrid,
  NGi,
  NButton,
  NIcon,
  useMessage,
  useDialog
} from 'naive-ui'
import { MoodHappy, Key } from '@vicons/tabler'
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
const message = useMessage()
const dialog = useDialog()
const e2eeStore = useE2EEStore()

const verifying = ref(false)
const verifyMethod = ref<'emoji' | 'key'>('emoji')
const emojiVerified = ref(false)
const keyVerified = ref(false)

// Emoji 列表（示例）
const emojiList = ref([
  { char: '🐱', name: 'Cat' },
  { char: '🐶', name: 'Dog' },
  { char: '🦁', name: 'Lion' },
  { char: '🐸', name: 'Frog' },
  { char: '🦊', name: 'Fox' },
  { char: '🐼', name: 'Panda' },
  { char: '🐨', name: 'Koala' }
])

// 设备密钥（示例）
const deviceKey = computed(() => {
  // 实际应该从设备信息中获取
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
      // 生成新的 emoji 列表
      generateEmojiList()
    }
  }
)

function generateEmojiList() {
  // 实际应该从设备密钥生成
  const emojis = [
    { char: '🐱', name: 'Cat' },
    { char: '🐶', name: 'Dog' },
    { char: '🦁', name: 'Lion' },
    { char: '🐸', name: 'Frog' },
    { char: '🦊', name: 'Fox' },
    { char: '🐼', name: 'Panda' },
    { char: '🐨', name: 'Koala' }
  ]
  emojiList.value = emojis
}

async function handleVerifyEmoji() {
  if (!props.device) return

  verifying.value = true
  try {
    const success = await e2eeStore.verifyDevice(props.device.deviceId)
    if (success) {
      emojiVerified.value = true
      message.success(t('setting.e2ee.devices.verification_success'))
      emit('verified')
    } else {
      message.error(t('setting.e2ee.devices.verification_failed'))
    }
  } catch (error) {
    logger.error('[DeviceVerificationDialog] Failed to verify device:', error)
    message.error(t('setting.e2ee.devices.verification_failed'))
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
      message.success(t('setting.e2ee.devices.verification_success'))
      emit('verified')
    } else {
      message.error(t('setting.e2ee.devices.verification_failed'))
    }
  } catch (error) {
    logger.error('[DeviceVerificationDialog] Failed to verify device:', error)
    message.error(t('setting.e2ee.devices.verification_failed'))
  } finally {
    verifying.value = false
  }
}

function handleNotMatch() {
  dialog.warning({
    title: t('setting.e2ee.devices.not_match_title'),
    content: t('setting.e2ee.devices.not_match_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      message.warning(t('setting.e2ee.devices.verification_cancelled'))
      handleClose()
    }
  })
}

function handleClose() {
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.emoji-item {
  text-align: center;
  padding: 8px;

  .emoji-char {
    font-size: 32px;
    line-height: 1;
  }

  .emoji-name {
    font-size: 12px;
    color: var(--text-color-3);
    margin-top: 4px;
  }
}
</style>
