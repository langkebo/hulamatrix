<template>
  <div class="matrix-invite-member">
    <n-modal v-bind="show !== undefined ? { show } : {}" @update:show="$emit('update:show', $event)">
      <n-card title="邀请成员" :bordered="false" size="huge" role="dialog" aria-modal="true">
        <n-space vertical>
          <n-input
            placeholder="输入用户 ID (例: @username:server.com)"
            v-model:value="userIdInput"
            @keyup.enter="handleInvite" />
          <n-text depth="3">输入要邀请的用户 Matrix ID。用户必须是已注册的 Matrix 用户。</n-text>
        </n-space>
        <template #footer>
          <n-space justify="end">
            <n-button @click="handleCancel">取消</n-button>
            <n-button type="primary" @click="handleInvite" :loading="inviting" :disabled="!userIdInput.trim()">
              邀请
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NCard, NSpace, NButton, NInput, NText } from 'naive-ui'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface Props {
  show?: boolean
  roomId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  invited: [userId: string]
}>()

const userIdInput = ref('')
const inviting = ref(false)

const handleInvite = async () => {
  if (!props.roomId) {
    msg.error('房间 ID 未指定')
    return
  }

  const userId = userIdInput.value.trim()
  if (!userId) {
    msg.error('请输入用户 ID')
    return
  }

  // Validate Matrix ID format (basic check)
  if (!userId.includes(':')) {
    msg.error('请输入有效的 Matrix ID (例: @username:server.com)')
    return
  }

  try {
    inviting.value = true

    // Import roomService dynamically
    const { createRoomService } = await import('@/services/roomService')
    const { useMatrixClient } = await import('@/composables/useMatrixClient')
    const { client } = useMatrixClient()

    if (!client.value) {
      msg.error('Matrix 客户端未连接')
      return
    }

    const roomService = createRoomService(client.value as unknown as import('matrix-js-sdk').MatrixClient)
    await roomService.inviteUser(props.roomId, userId)

    msg.success(`已邀请 ${userId}`)
    emit('invited', userId)
    userIdInput.value = ''

    // Close modal after short delay
    setTimeout(() => {
      emit('update:show', false)
    }, 500)
  } catch (error) {
    logger.error('[MatrixInviteMember] 邀请成员失败:', error)
    msg.error('邀请失败，请检查用户 ID 是否正确')
  } finally {
    inviting.value = false
  }
}

const handleCancel = () => {
  userIdInput.value = ''
  emit('update:show', false)
}
</script>

<style scoped>
.matrix-invite-member {
  /* Modal styles handled by Naive UI */
}
</style>
