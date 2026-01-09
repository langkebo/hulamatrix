<template>
  <Transition name="typing-slide">
    <div v-if="typingUsers.length > 0" class="mobile-typing-indicator">
      <div class="typing-dots">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
      <div class="typing-text">
        {{ typingText }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
.mobile-typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--hula-black-rgb), 0.6);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  font-size: 12px;
  color: var(--hula-white);

  .typing-dots {
    display: flex;
    gap: 3px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--hula-white);
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
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

.typing-slide-enter-active,
.typing-slide-leave-active {
  transition: all 0.2s ease;
}

.typing-slide-enter-from,
.typing-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
