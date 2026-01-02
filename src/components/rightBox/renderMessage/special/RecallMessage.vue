<template>
  <!--  消息为撤回消息  -->
  <main class="w-full flex-center">
    <template v-if="isGroup">
      <n-flex align="center" :size="6" v-if="fromUserUid === userUid">
        <p class="text-(12px #909090) select-none cursor-default">{{ message.body.content }}</p>
        <p
          v-if="canReEdit(message.id)"
          class="text-(12px #13987f) select-none cursor-pointer"
          @click="handleReEdit(message.id)">
          重新编辑
        </p>
      </n-flex>
      <span v-else class="text-12px color-#909090 select-none" v-html="recallText"></span>
    </template>
    <template v-else>
      <n-flex align="center" :size="6">
        <p class="text-(12px #909090) select-none cursor-default">
          {{ message.body.content }}
        </p>
        <p
          v-if="canReEdit(message.id)"
          class="text-(12px #13987f) select-none cursor-pointer"
          @click="handleReEdit(message.id)">
          重新编辑
        </p>
      </n-flex>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MittEnum, MsgEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { MessageBody, MsgType } from '@/services/types'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  message: MsgType
  fromUserUid: string
  isGroup?: boolean
  body: MessageBody
}>()

const chatStore = useChatStore()
const userStore = useUserStore()

const userUid = computed(() => userStore.userInfo!.uid)

const recallText = computed(() => {
  // 处理body可能是字符串或对象的情况
  let content = ''
  if (typeof props.body === 'string') {
    content = props.body
  } else if (props.body && typeof props.body === 'object' && 'content' in props.body) {
    // Ensure content is always a string
    const bodyContent = props.body.content
    content = typeof bodyContent === 'string' ? bodyContent : String(bodyContent || '')
  } else {
    content = '撤回了一条消息'
  }
  // Sanitize HTML to prevent XSS attacks
  return sanitizeHtml(content)
})

const canReEdit = computed(() => (msgId: string) => {
  const recalledMsg = chatStore.getRecalledMessage(msgId)
  const message = chatStore.getMessage(msgId)
  if (!recalledMsg || !message) return false

  // 只有文本类型的撤回消息才能重新编辑
  if (recalledMsg.originalType !== MsgEnum.TEXT) return false

  // 只需要判断是否是当前用户的消息，时间检查已经在 getRecalledMessage 中处理
  return message.fromUser.uid === userUid.value
})

const handleReEdit = (msgId: string) => {
  const recalledMsg = chatStore.getRecalledMessage(msgId)
  if (recalledMsg) {
    useMitt.emit(MittEnum.RE_EDIT, recalledMsg.content)
  }
}
</script>
