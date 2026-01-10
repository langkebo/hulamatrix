<template>
  <Transition name="typing">
    <div
      v-if="shouldShowIndicator"
      class="typing-indicator"
      role="status"
      aria-live="polite"
      :aria-label="typingTextAria">
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
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText } from 'naive-ui'
import { useTypingStore } from '@/integrations/matrix/typing'
import { useUserStore } from '@/stores/user'

interface Props {
  roomId: string
  debounceMs?: number // Delay before showing indicator (default 300ms)
}

const props = withDefaults(defineProps<Props>(), {
  debounceMs: 300
})

const { t } = useI18n()
const typingStore = useTypingStore()
const userStore = useUserStore()

// Debounced state to prevent flickering
const showIndicator = ref(false)
let debounceTimer: number | null = null

const typingUsers = computed(() => {
  return typingStore.get(props.roomId) || []
})

const typingText = computed(() => {
  const users = typingUsers.value
  const myUserId = userStore.userInfo?.uid

  // Filter out current user
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

// ARIA-friendly text for screen readers
const typingTextAria = computed(() => {
  const users = typingUsers.value
  const myUserId = userStore.userInfo?.uid
  const otherUsers = users.filter((id) => id !== myUserId)

  if (otherUsers.length === 0) return ''

  if (otherUsers.length === 1) {
    const userId = otherUsers[0]
    const displayName = userStore.getDisplayName(userId) || userId
    return t('typing.single', { name: displayName })
  }

  return t('typing.many', { count: otherUsers.length })
})

// Debounced indicator visibility
const shouldShowIndicator = computed(() => {
  return showIndicator.value && typingUsers.value.length > 0
})

// Watch for typing state changes and apply debouncing
watch(
  typingUsers,
  (newUsers) => {
    // Clear existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    const hasTypingUsers = newUsers.length > 0

    if (hasTypingUsers) {
      // Start debounce timer to show indicator
      debounceTimer = window.setTimeout(() => {
        showIndicator.value = true
      }, props.debounceMs)
    } else {
      // Hide immediately when no typing
      showIndicator.value = false
    }
  },
  { immediate: true }
)
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
  60%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  30% {
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
