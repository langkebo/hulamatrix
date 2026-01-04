<template>
  <n-modal
    v-model:show="showModal"
    preset="dialog"
    :title="t('friends.add_friend_title')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    :loading="loading"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <n-flex vertical :size="16" class="py-4">
      <!-- 用户信息 -->
      <n-flex align="center" :size="12">
        <n-avatar
          :size="56"
          :src="avatarUrl"
          round
          :fallback-src="'/logoD.png'"
        />
        <n-flex vertical :size="4">
          <span class="text-16px font-medium">{{ displayName }}</span>
          <span class="text-12px text-gray-500">{{ userId }}</span>
        </n-flex>
      </n-flex>
      
      <!-- 验证消息输入 -->
      <n-form-item :label="t('friends.verify_message')">
        <n-input
          v-model:value="verifyMessage"
          type="textarea"
          :placeholder="t('friends.verify_message_placeholder')"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </n-form-item>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { sendRequest } from '@/integrations/synapse/friends'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  userId: string
  displayName?: string
  avatar?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
  (e: 'error', error: Error): void
}>()

const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const loading = ref(false)
const verifyMessage = ref('')

const avatarUrl = computed(() => props.avatar || '')
const displayName = computed(() => props.displayName || props.userId.split(':')[0].substring(1))

// 重置表单
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      verifyMessage.value = t('friends.default_verify_message')
    }
  }
)

const handleConfirm = async () => {
  loading.value = true
  try {
    const auth = useMatrixAuthStore()
    const requester = auth.userId || ''

    await sendRequest({
      requester_id: requester,
      target_id: props.userId,
      message: verifyMessage.value || undefined
    })

    msg.success(t('friends.request_sent_success'))
    emit('success')
    showModal.value = false
  } catch (error: unknown) {
    logger.error('[AddFriendModal] Failed to send friend request', { error })

    // 尝试通过创建 DM 房间作为 fallback
    try {
      const { getOrCreateDirectRoom, updateDirectMapping } = await import('@/integrations/matrix/contacts')
      const roomId = await getOrCreateDirectRoom(props.userId)
      if (roomId) {
        await updateDirectMapping(props.userId, roomId)
        msg.success(t('friends.request_sent_success'))
        emit('success')
        showModal.value = false
        return
      }
    } catch (fallbackError) {
      logger.error('[AddFriendModal] Fallback also failed', { error: fallbackError })
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    msg.error(errorMessage || t('friends.request_sent_failed'))
    emit('error', error instanceof Error ? error : new Error(String(error)))
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  showModal.value = false
}
</script>
