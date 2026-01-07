<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('privateChat.create_session.title')"
    :style="{ width: '500px' }"
    @close="handleClose">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="80">
      <!-- 用户 ID -->
      <n-form-item :label="t('privateChat.create_session.user_id_label')" path="userId">
        <n-input
          v-model:value="formData.userId"
          :placeholder="t('privateChat.create_session.user_id_placeholder')"
          @keydown.enter="handleCreate" />
      </n-form-item>

      <!-- 初始消息（可选） -->
      <n-form-item :label="t('privateChat.create_session.message_label')" path="initialMessage">
        <n-input
          v-model:value="formData.initialMessage"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('privateChat.create_session.message_placeholder')"
          @keydown.enter.ctrl="handleCreate" />
      </n-form-item>

      <!-- 好友快捷选择 -->
      <n-form-item :label="t('privateChat.create_session.friends_label')">
        <n-scrollbar style="max-height: 200px" class="friends-scrollbar">
          <n-space v-if="friends.length > 0" :size="8" vertical>
            <div
              v-for="friend in friends"
              :key="friend.friend_id || friend.user_id"
              class="friend-item"
              :class="{ 'is-selected': formData.userId === (friend.friend_id || friend.user_id) }"
              @click="handleSelectFriend(friend)">
              <n-avatar round :size="32" :src="friend.avatar_url || ''">
                <svg class="size-16px">
                  <use href="#user"></use>
                </svg>
              </n-avatar>
              <span class="friend-name">{{ friend.display_name || friend.friend_id || friend.user_id }}</span>
              <svg v-if="formData.userId === (friend.friend_id || friend.user_id)" class="size-16px check-icon">
                <use href="#check"></use>
              </svg>
            </div>
          </n-space>
          <n-empty v-else :description="t('privateChat.create_session.no_friends')" size="small" />
        </n-scrollbar>
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" @click="handleCreate" :loading="isCreating" :disabled="!formData.userId.trim()">
          {{ t('privateChat.create_session.create_button') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateChatSDKStore } from '@/stores/privateChatSDK'
import { useFriendsSDKStore, type FriendWithProfile } from '@/stores/friendsSDK'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import type { FormInst, FormRules } from 'naive-ui'

const { t } = useI18n()
const privateChatStore = usePrivateChatSDKStore()
const friendsStore = useFriendsSDKStore()

// Props
interface Props {
  show: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})

// Emits
interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'created', sessionId: string): void
}

const emit = defineEmits<Emits>()

// 状态
const formRef = ref<FormInst | null>(null)
const isCreating = ref(false)

// 表单数据
const formData = ref({
  userId: '',
  initialMessage: ''
})

// 表单验证规则
const formRules: FormRules = {
  userId: {
    required: true,
    message: t('privateChat.create_session.user_id_required'),
    trigger: ['blur', 'input']
  }
}

// 好友列表
const friends = computed(() => friendsStore.friends)

// 控制显示
const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// 选择好友
const handleSelectFriend = (friend: FriendWithProfile) => {
  const userId = friend.friend_id || friend.user_id
  if (userId) {
    formData.value.userId = userId
  }
}

// 创建会话
const handleCreate = async () => {
  // 验证表单
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const userId = formData.value.userId.trim()
  if (!userId) {
    msg.warning(t('privateChat.create_session.user_id_required'))
    return
  }

  isCreating.value = true

  try {
    // 创建 PrivateChat 会话
    const sessionId = await privateChatStore.createSession({
      participants: [userId]
    })

    // 如果有初始消息，发送消息
    if (formData.value.initialMessage.trim()) {
      await privateChatStore.sendMessage(formData.value.initialMessage.trim(), 'text')
    }

    msg.success(t('privateChat.create_session.created'))

    logger.info('[CreateSessionModal] PrivateChat session created', {
      sessionId,
      userId
    })

    // 刷新会话列表
    await privateChatStore.fetchSessions()

    // 通知父组件
    emit('created', sessionId)

    // 关闭对话框
    handleClose()
  } catch (error) {
    msg.error(t('privateChat.create_session.create_failed'))
    logger.error('[CreateSessionModal] Failed to create session:', error)
  } finally {
    isCreating.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  // 重置表单
  formData.value = {
    userId: '',
    initialMessage: ''
  }
  formRef.value?.restoreValidation()
  emit('update:show', false)
}

// 监听显示状态，初始化时加载好友列表
watch(
  () => props.show,
  async (show) => {
    if (show) {
      // 初始化 Friends Store（如果未初始化）
      if (!friendsStore.initialized) {
        try {
          await friendsStore.initialize()
        } catch (error) {
          logger.warn('[CreateSessionModal] Failed to initialize friends store:', error)
        }
      }
    }
  }
)
</script>

<style scoped lang="scss">
.friends-scrollbar {
  border: 1px solid var(--line-color);
  border-radius: 6px;
  padding: 8px;
}

.friend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hover-color);
  }

  &.is-selected {
    background: var(--active-color);
    border-left: 3px solid var(--hula-primary);
  }
}

.friend-name {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  color: var(--hula-primary);
  flex-shrink: 0;
}
</style>
