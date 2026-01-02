<template>
  <div class="chat-integration">
    <!-- Matrix聊天界面 -->
    <MatrixChatBox
      v-if="isMatrixRoom"
      :room-id="roomId"
      @message-sent="handleMessageSent"
    />

    <!-- 原有的HuLa聊天界面 -->
    <ChatBox
      v-else
      ref="chatBoxRef"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGlobalStore } from '@/stores/global'
import ChatBox from '@/components/rightBox/chatBox/index.vue'
import MatrixChatBox from '@/components/matrix/MatrixChatBox.vue'
import type { MatrixMessageContent } from '@/types/matrix'

const emit = defineEmits<{
  messageSent: [roomId: string, content: MatrixMessageContent]
}>()

// Stores
const globalStore = useGlobalStore()

// Refs
const chatBoxRef = ref()

// Computed
const roomId = computed(() => globalStore.currentSessionRoomId || '')

// 判断是否为Matrix房间 - 临时禁用以显示原始聊天界面
const isMatrixRoom = computed(() => {
  // 临时禁用Matrix聊天，确保原始聊天界面显示
  return false
})

// Methods
const handleMessageSent = (roomId: string, content: MatrixMessageContent) => {
  emit('messageSent', roomId, content)
}

// 暴露ChatBox的引用，以便父组件可以调用其方法
defineExpose({
  chatBoxRef
})
</script>

<style scoped>
.chat-integration {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  z-index: 1;
}

/* 确保背景透明，让父元素的背景显示出来 */
.chat-integration > * {
  background: transparent;
}

/* 聊天框样式调整 */
.chat-integration :deep(.chat-box) {
  background: var(--right-theme-bg-color, rgba(255, 255, 255, 0.9)) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 深色模式下的调整 */
html[data-theme='dark'] .chat-integration :deep(.chat-box) {
  background: var(--right-theme-bg-color, rgba(24, 24, 28, 0.9)) !important;
  color: white;
}
</style>