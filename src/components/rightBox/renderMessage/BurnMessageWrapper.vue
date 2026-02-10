<template>
  <div class="burn-message-wrapper relative" :class="{ 'is-burned': isBurned }">
    <!-- 正常消息内容 -->
    <div class="message-content" :class="{ 'blur-content': isBlurred && !isMe }" @click="handleView">
      <slot></slot>
    </div>

    <!-- 阅后即焚遮罩 (仅接收方显示) -->
    <div
      v-if="isBlurred && !isMe"
      class="absolute inset-0 z-10 flex-center flex-col bg-[--bg-bubble] rounded-[inherit] cursor-pointer backdrop-blur-sm bg-opacity-90"
      @click.stop="handleView">
      <svg class="size-24px color-#ff5722 mb-4px">
        <use href="#fire"></use>
      </svg>
      <span class="text-(12px #ff5722)">{{ t('chat.burn_after_reading.click_to_view') }}</span>
    </div>

    <!-- 倒计时提示 -->
    <div v-if="showCountdown" class="absolute -bottom-18px right-0 flex items-center gap-4px select-none">
      <svg class="size-12px color-#ff5722">
        <use href="#time"></use>
      </svg>
      <span class="text-(10px #ff5722)">{{ timeLeft }}s</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import ChatroomService from '@/services/matrix/ChatroomService'

const props = defineProps<{
  message: any // MessageType
  isMe: boolean
}>()

const { t } = useI18n()
const userStore = useUserStore()
const chatStore = useChatStore()

// 状态
const isViewing = ref(false)
const timeLeft = ref(0)
let timer: number | null = null

// 计算属性
const metadata = computed(() => props.message.message?.metadata || {})
const isBurnEnabled = computed(() => !!metadata.value.burn_after_read)
const ttlSeconds = computed(() => Number(metadata.value.ttl_seconds) || 30)

// 是否已焚毁 (后端已删除或本地倒计时结束)
const isBurned = computed(() => {
  return props.message.message.type === 'm.room.redaction' || (timeLeft.value <= 0 && isViewing.value)
})

// 是否显示遮罩 (开启了阅后即焚 + 不是自己发的 + 还没点击查看 + 没焚毁)
const isBlurred = computed(() => {
  return isBurnEnabled.value && !props.isMe && !isViewing.value && !isBurned.value
})

// 是否显示倒计时
const showCountdown = computed(() => {
  return isBurnEnabled.value && isViewing.value && timeLeft.value > 0
})

// 处理点击查看
const handleView = async () => {
  if (props.isMe || isViewing.value || isBurned.value || !isBurnEnabled.value) return

  isViewing.value = true
  timeLeft.value = ttlSeconds.value

  // 发送已读回执，触发后端计时
  try {
    await ChatroomService.getInstance().markAsRead(props.message.message.roomId, props.message.message.id)
  } catch (e) {
    console.error('Failed to send burn receipt', e)
  }

  // 本地倒计时
  startCountdown()
}

const startCountdown = () => {
  if (timer) clearInterval(timer)

  timer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      if (timer) clearInterval(timer)
      // 倒计时结束，视觉上隐藏或显示已焚毁
      // 实际删除依赖后端推送到来的 redaction 事件
    }
  }, 1000)
}

// 清理定时器
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 如果消息已经是 redaction 类型，说明已焚毁
watchEffect(() => {
  if (props.message.message.type === 'm.room.redaction') {
    if (timer) clearInterval(timer)
    timeLeft.value = 0
  }
})
</script>

<style scoped lang="scss">
.burn-message-wrapper {
  // 继承父级的圆角，确保遮罩贴合
  border-radius: inherit;

  &.is-burned {
    opacity: 0.5;
    pointer-events: none;
  }
}

.blur-content {
  filter: blur(8px);
  user-select: none;
}
</style>
