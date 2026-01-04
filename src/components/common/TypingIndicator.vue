<template>
  <Transition name="typing">
    <div v-if="typingUsers.length > 0" class="typing-indicator">
      <div class="typing-dots">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
      <div class="typing-text">
        <n-text>{{ typingText }}</n-text>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText } from 'naive-ui'
import { useTypingStore } from '@/integrations/matrix/typing'
import { useUserStore } from '@/stores/user'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const typingStore = useTypingStore()
const userStore = useUserStore()

const typingUsers = computed(() => {
  return typingStore.get(props.roomId) || []
})

const typingText = computed(() => {
  const users = typingUsers.value
  const myUserId = userStore.userInfo?.uid

  // 过滤掉当前用户
  const otherUsers = users.filter((id) => id !== myUserId)

  if (otherUsers.length === 0) return ''

  if (otherUsers.length === 1) {
    const userId = otherUsers[0]
    const displayName = userStore.getDisplayName(userId) || userId
    return t('typing.single', { name: displayName })
  }

  if (otherUsers.length === 2) {
    const user1 = userStore.getDisplayName(otherUsers[0]) || otherUsers[0]
    const user2 = userStore.getDisplayName(otherUsers[1]) || otherUsers[1]
    return t('typing.two', { name1: user1, name2: user2 })
  }

  return t('typing.many', { count: otherUsers.length })
})
</script>

<style lang="scss" scoped>
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-color-secondary);
  border-radius: 12px;
  font-size: 12px;

  .typing-dots {
    display: flex;
    gap: 3px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary-color);
      animation: typing-bounce 1.4s infinite ease-in-out;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
  }

  .typing-text {
    color: var(--text-color-2);
  }
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.typing-enter-active,
.typing-leave-active {
  transition: all 0.2s ease;
}

.typing-enter-from,
.typing-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
