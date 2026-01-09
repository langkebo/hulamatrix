<!--
  PrivateChatDialog - 私密聊天对话框
  用于创建和配置私密聊天会话
-->
<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
    preset="card"
    title="创建私密聊天"
    class="w-600px"
    :mask-closable="true">
    <n-space vertical :size="16">
      <n-alert type="info" title="私密聊天">私密聊天使用端到端加密技术，确保只有对话参与者能够阅读消息内容。</n-alert>

      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left">
        <n-form-item label="选择用户" path="userId">
          <n-select
            v-model:value="formData.userId"
            :options="userOptions"
            filterable
            placeholder="搜索用户..."
            :loading="loading" />
        </n-form-item>

        <n-form-item label="加密类型" path="encryption">
          <n-radio-group v-model:value="formData.encryption" disabled>
            <n-radio value="megolm">Megolm (推荐)</n-radio>
            <n-radio value="olm">Olm</n-radio>
          </n-radio-group>
        </n-form-item>
      </n-form>
    </n-space>

    <template #footer>
      <n-space justify="end">
        <n-button @click="$emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreate">创建私密聊天</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NSpace, NAlert, NForm, NFormItem, NSelect, NRadioGroup, NRadio, NButton } from 'naive-ui'
import { useFriendsStore } from '@/stores/friendsSDK'
import { logger } from '@/utils/logger'
import type { FormInst, FormRules } from 'naive-ui'
import type { FriendItem } from '@/stores/friendsSDK'

interface Props {
  show?: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'chat-created', roomId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})

const emit = defineEmits<Emits>()

const friendsStore = useFriendsStore()

// 表单数据
interface FormData {
  userId: string | null
  encryption: string
}

const formData = ref<FormData>({
  userId: null,
  encryption: 'megolm'
})

// 状态
const loading = ref(false)
const creating = ref(false)
const formRef = ref<FormInst | null>(null)

// 表单验证规则
const rules: FormRules = {
  userId: {
    required: true,
    type: 'string',
    message: '请选择用户',
    trigger: ['blur', 'change']
  }
}

// 用户选项（从好友列表获取）
const userOptions = computed(() => {
  const friends = friendsStore.friends || []
  return friends.map((friend: FriendItem) => ({
    label: friend.name || friend.display_name || friend.remark || friend.friend_id,
    value: friend.friend_id
  }))
})

// 监听对话框打开，加载好友列表
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      loadFriends()
    }
  }
)

// 加载好友列表
async function loadFriends() {
  try {
    loading.value = true
    await friendsStore.refreshAll()
  } catch (error) {
    logger.error('[PrivateChatDialog] Failed to load friends:', error)
  } finally {
    loading.value = false
  }
}

// 创建私密聊天
async function handleCreate() {
  try {
    await formRef.value?.validate()

    creating.value = true

    // TODO: 调用 Matrix SDK 创建私密聊天房间
    // const roomId = await createPrivateRoom(formData.value.userId!, {
    //   encryption: formData.value.encryption
    // })

    // 模拟创建成功
    const roomId = `!private_${Date.now()}:matrix.org`

    emit('chat-created', roomId)
    emit('update:show', false)

    // 重置表单
    formData.value = {
      userId: null,
      encryption: 'megolm'
    }
  } catch (error) {
    logger.error('[PrivateChatDialog] Failed to create private chat:', error)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
/* 私密聊天对话框样式 */
</style>
