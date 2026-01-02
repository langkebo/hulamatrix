<!-- Mobile Message with Gestures - Message component with touch gestures -->
<template>
  <div
    ref="messageRef"
    class="mobile-message-gestures"
    :class="{
      'is-swiped': isSwiped,
      'is-confirmed': isConfirmed,
      'is-own': isOwn,
      'has-reaction': reactionCount > 0
    }"
    @contextmenu.prevent
  >
    <!-- Swipe Actions Background -->
    <div class="swipe-actions">
      <div class="swipe-action reply" :style="{ opacity: isSwiped ? 1 : 0 }">
        <n-icon :size="24"><Repeat /></n-icon>
        <span>回复</span>
      </div>
      <div class="swipe-action delete" :style="{ opacity: isConfirmed ? 1 : 0 }">
        <n-icon :size="24"><Trash /></n-icon>
        <span>确认删除</span>
      </div>
    </div>

    <!-- Message Content -->
    <div
      class="message-content"
      :style="{ transform: `translateX(${swipeX}px)` }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Sender Avatar (not for own messages) -->
      <div v-if="!isOwn" class="message-avatar">
        <n-avatar :src="avatarUrl" :size="36" round>
          <template #fallback>
            <span>{{ senderName?.charAt(0) || '?' }}</span>
          </template>
        </n-avatar>
      </div>

      <!-- Message Bubble -->
      <div class="message-bubble" @dblclick="handleDoubleClick">
        <!-- Reply Preview -->
        <div v-if="replyTo" class="reply-preview">
          <div class="reply-line"></div>
          <div class="reply-content">
            <span class="reply-sender">{{ replyTo.senderName }}</span>
            <span class="reply-text">{{ replyTo.content }}</span>
          </div>
        </div>

        <!-- Message Text -->
        <div class="message-text">
          <span v-if="isEdited" class="edited-badge">已编辑</span>
          {{ content }}
        </div>

        <!-- Image Attachment -->
        <div v-if="imageUrl" class="message-image">
          <img :src="imageUrl" @click="previewImage" />
        </div>

        <!-- Reactions -->
        <div v-if="reactions.length > 0" class="message-reactions">
          <div
            v-for="(reaction, index) in reactions"
            :key="index"
            class="reaction-item"
            :class="{ 'has-voted': reaction.hasVoted }"
          >
            <span class="reaction-emoji">{{ reaction.emoji }}</span>
            <span class="reaction-count">{{ reaction.count }}</span>
          </div>
        </div>

        <!-- Message Info -->
        <div class="message-info">
          <span v-if="!isOwn" class="sender-name">{{ senderName }}</span>
          <span class="message-time">{{ formattedTime }}</span>
          <n-icon v-if="status === 'sent'" :size="14" class="status-icon">
            <Check />
          </n-icon>
          <n-icon v-else-if="status === 'delivered'" :size="14" class="status-icon delivered">
            <Checks />
          </n-icon>
          <n-icon v-else-if="status === 'failed'" :size="14" class="status-icon failed">
            <AlertCircle />
          </n-icon>
        </div>

        <!-- Self-Destruct Message Indicator -->
        <div v-if="isSelfDestruct && destroyAt" class="message-destruct-indicator">
          <MobileSelfDestructIndicator
            :destroy-at="destroyAt"
            :created-at="messageCreatedAt"
            mode="icon"
            :show-text="true"
            @destroyed="handleMessageDestroyed"
          />
        </div>

        <!-- Double Tap Heart Animation -->
        <transition name="heart-burst">
          <div v-if="showHeartAnimation" class="heart-animation">
            <n-icon :size="60" color="#ff4757">
              <Heart />
            </n-icon>
          </div>
        </transition>
      </div>
    </div>

    <!-- Quick Action Menu (Long Press) -->
    <n-modal
      v-model:show="showActionMenu"
      :show-icon="false"
      :mask-closable="true"
      preset="card"
      :style="{
        width: '90%',
        maxWidth: '320px',
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        margin: '0',
        borderRadius: '16px'
      }"
    >
      <div class="action-menu">
        <div class="action-menu-header">
          <n-avatar :src="avatarUrl" :size="48" round />
          <div class="header-text">
            <div class="header-name">{{ senderName }}</div>
            <div class="header-time">{{ formattedTime }}</div>
          </div>
        </div>

        <div class="action-grid">
          <div class="action-item" @click="handleAction('reply')">
            <div class="action-icon reply">
              <n-icon :size="24"><Repeat /></n-icon>
            </div>
            <span>回复</span>
          </div>
          <div class="action-item" @click="handleAction('react')">
            <div class="action-icon react">
              <n-icon :size="24"><MoodHappy /></n-icon>
            </div>
            <span>反应</span>
          </div>
          <div class="action-item" v-if="isOwn" @click="handleAction('edit')">
            <div class="action-icon edit">
              <n-icon :size="24"><Edit /></n-icon>
            </div>
            <span>编辑</span>
          </div>
          <div class="action-item" @click="handleAction('forward')">
            <div class="action-icon forward">
              <n-icon :size="24"><Share /></n-icon>
            </div>
            <span>转发</span>
          </div>
          <div class="action-item" @click="handleAction('copy')">
            <div class="action-icon copy">
              <n-icon :size="24"><Copy /></n-icon>
            </div>
            <span>复制</span>
          </div>
          <div class="action-item" @click="handleAction('pin')">
            <div class="action-icon pin">
              <n-icon :size="24"><Pin /></n-icon>
            </div>
            <span>{{ isPinned ? '取消置顶' : '置顶' }}</span>
          </div>
          <div class="action-item" @click="handleAction('select')">
            <div class="action-icon select">
              <n-icon :size="24"><BoxSelect /></n-icon>
            </div>
            <span>多选</span>
          </div>
          <div class="action-item danger" @click="handleAction('delete')">
            <div class="action-icon delete">
              <n-icon :size="24"><Trash /></n-icon>
            </div>
            <span>删除</span>
          </div>
        </div>

        <div class="action-menu-footer">
          <n-button block @click="showActionMenu = false">取消</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Reaction Picker -->
    <div v-if="showReactionPicker" class="reaction-picker">
      <div class="reaction-picker-content">
        <div
          v-for="emoji in quickReactions"
          :key="emoji"
          class="emoji-option"
          @click="addReaction(emoji)"
        >
          {{ emoji }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NAvatar, NIcon, NModal, NButton } from 'naive-ui'
import {
  Repeat,
  Trash,
  Edit,
  Share,
  Copy,
  Pin,
  Select,
  Check,
  Checks,
  AlertCircle,
  MoodHappy,
  Heart
} from '@vicons/tabler'
import { useHaptic } from '@/composables/useMobileGestures'
import MobileSelfDestructIndicator from './MobileSelfDestructIndicator.vue'

// ==================== Props ====================

interface MessageReaction {
  emoji: string
  count: number
  hasVoted?: boolean
}

interface ReplyTo {
  senderName: string
  content: string
}

interface Props {
  eventId: string
  content: string
  senderName: string
  avatarUrl?: string
  imageUrl?: string
  isOwn?: boolean
  isEdited?: boolean
  isPinned?: boolean
  status?: 'sending' | 'sent' | 'delivered' | 'failed'
  timestamp: number
  replyTo?: ReplyTo
  reactions?: MessageReaction[]
  // 自毁消息相关 props
  isSelfDestruct?: boolean
  destroyAt?: number
  messageCreatedAt?: number
}

const props = withDefaults(defineProps<Props>(), {
  isOwn: false,
  isEdited: false,
  isPinned: false,
  status: 'sent',
  reactions: () => [],
  isSelfDestruct: false,
  messageCreatedAt: Date.now()
})

// ==================== Emits ====================

interface Emits {
  (e: 'reply'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'copy'): void
  (e: 'forward'): void
  (e: 'pin'): void
  (e: 'react', emoji: string): void
  (e: 'select'): void
  (e: 'imagePreview'): void
  (e: 'destroyed'): void // 自毁消息销毁事件
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const messageRef = ref<HTMLElement>()
const showActionMenu = ref(false)
const showReactionPicker = ref(false)
const showHeartAnimation = ref(false)

// Swipe state
const isSwiped = ref(false)
const swipeX = ref(0)
const isConfirmed = ref(false)
let startX = 0
let currentX = 0

// Haptic feedback
const haptic = useHaptic()

// Quick reactions
const quickReactions = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE20', '\uD83D\uDE0E']

// ==================== Computed ====================

const reactionCount = computed(() => {
  return props.reactions.reduce((sum, r) => sum + r.count, 0)
})

const formattedTime = computed(() => {
  const now = Date.now()
  const diff = now - props.timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`

  const date = new Date(props.timestamp)
  return date.toLocaleDateString()
})

// ==================== Gesture Handlers ====================

const handleTouchStart = (e: TouchEvent) => {
  startX = e.touches[0].clientX
  currentX = startX
}

const handleTouchMove = (e: TouchEvent) => {
  currentX = e.touches[0].clientX
  const diff = currentX - startX

  // Only allow swipe right (for reply) on messages, swipe left for delete on own messages
  if (diff > 0 && !isSwiped.value) {
    // Swipe right to reply
    swipeX.value = Math.min(diff * 0.8, 100)
    isSwiped.value = swipeX.value > 50
  } else if (diff < 0 && props.isOwn && !isConfirmed.value) {
    // Swipe left to delete (own messages only)
    swipeX.value = Math.max(diff * 0.8, -100)
    isConfirmed.value = Math.abs(swipeX.value) > 100
  }
}

const handleTouchEnd = () => {
  if (isSwiped.value && swipeX.value > 50) {
    // Trigger reply
    haptic.selection()
    emit('reply')
    resetSwipe()
  } else if (isConfirmed.value) {
    // Confirm delete
    haptic.error()
    emit('delete')
    resetSwipe()
  } else {
    // Animate back
    resetSwipe()
  }
}

const resetSwipe = () => {
  isSwiped.value = false
  isConfirmed.value = false
  swipeX.value = 0
}

const handleDoubleClick = () => {
  // Double tap to like
  showHeartAnimation.value = true
  haptic.impactLight()
  emit('react', '\u2764\uFE0F') // ❤️

  setTimeout(() => {
    showHeartAnimation.value = false
  }, 1000)
}

const handleAction = (action: string) => {
  showActionMenu.value = false
  haptic.selection()

  switch (action) {
    case 'reply':
      emit('reply')
      break
    case 'edit':
      emit('edit')
      break
    case 'delete':
      emit('delete')
      break
    case 'copy':
      emit('copy')
      break
    case 'forward':
      emit('forward')
      break
    case 'pin':
      emit('pin')
      break
    case 'react':
      showReactionPicker.value = true
      break
    case 'select':
      emit('select')
      break
  }
}

const addReaction = (emoji: string) => {
  showReactionPicker.value = false
  haptic.selection()
  emit('react', emoji)
}

const previewImage = () => {
  if (props.imageUrl) {
    emit('imagePreview')
  }
}

// 自毁消息销毁处理
const handleMessageDestroyed = () => {
  haptic.error()
  emit('destroyed')
}

// ==================== Lifecycle ====================

onMounted(() => {
  // Attach long press listener
  let longPressTimer: number | null = null
  let isLongPress = false

  const handleStart = () => {
    isLongPress = false
    longPressTimer = window.setTimeout(() => {
      isLongPress = true
      haptic.impactMedium()
      showActionMenu.value = true
    }, 500)
  }

  const handleEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  const el = messageRef.value
  if (el) {
    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchend', handleEnd, { passive: true })
    el.addEventListener('touchmove', handleEnd, { passive: true })
  }

  onUnmounted(() => {
    if (el) {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchend', handleEnd)
      el.removeEventListener('touchmove', handleEnd)
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer)
    }
  })
})
</script>

<style scoped lang="scss">
.mobile-message-gestures {
  position: relative;
  margin: 8px 0;
  overflow: hidden;
}

.swipe-actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1;
  pointer-events: none;

  .swipe-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: white;
    transition: opacity 0.2s;

    &.reply {
      background: rgba(24, 160, 88, 0.9);
      padding: 12px 16px;
      border-radius: 12px;
    }

    &.delete {
      background: rgba(208, 48, 80, 0.9);
      padding: 12px 16px;
      border-radius: 12px;
    }
  }
}

.message-content {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 8px;
  transition: transform 0.2s ease-out;
}

.message-avatar {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--card-color);
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;

  .is-own & {
    background: var(--primary-color);
    color: white;
    margin-left: auto;
    border-bottom-right-radius: 4px;
  }

  .is-own:not & {
    border-bottom-left-radius: 4px;
  }
}

.reply-preview {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;

  .reply-line {
    width: 3px;
    background: var(--primary-color);
    border-radius: 2px;
  }

  .reply-content {
    flex: 1;
    min-width: 0;

    .reply-sender {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--primary-color);
      margin-bottom: 2px;
    }

    .reply-text {
      display: block;
      font-size: 13px;
      color: var(--text-color-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.message-text {
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;

  .edited-badge {
    font-size: 11px;
    opacity: 0.7;
    margin-right: 4px;
  }
}

.message-image {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;

  img {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
  }
}

.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;

  .reaction-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    font-size: 14px;

    &.has-voted {
      background: rgba(24, 160, 88, 0.2);
    }
  }
}

.message-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;

  .sender-name {
    font-weight: 600;
  }

  .status-icon {
    &.delivered {
      color: #18a058;
    }

    &.failed {
      color: #d03050;
    }
  }
}

// 自毁消息指示器样式
.message-destruct-indicator {
  display: flex;
  align-items: center;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);

  .is-own & {
    border-top-color: rgba(255, 255, 255, 0.15);
  }
}

// Heart animation
.heart-burst-enter-active {
  animation: heart-burst 0.6s ease-out;
}

.heart-burst-leave-active {
  transition: all 0.3s ease;
}

.heart-burst-leave-to {
  opacity: 0;
  transform: scale(1.5);
}

@keyframes heart-burst {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}

.heart-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 2px 8px rgba(255, 71, 87, 0.5));
}

// Action menu
.action-menu {
  .action-menu-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .header-text {
      .header-name {
        font-size: 16px;
        font-weight: 600;
      }

      .header-time {
        font-size: 13px;
        color: var(--text-color-3);
      }
    }
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 16px;

    .action-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px 8px;
      background: var(--bg-color);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;

      &:active {
        transform: scale(0.95);
        background: var(--item-hover-bg);
      }

      &.danger .action-icon {
        background: rgba(208, 48, 80, 0.1);
        color: #d03050;
      }

      .action-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--card-color);
        color: var(--text-color-1);

        &.reply { background: rgba(24, 160, 88, 0.1); color: #18a058; }
        &.react { background: rgba(24, 160, 88, 0.1); color: #18a058; }
        &.edit { background: rgba(102, 126, 234, 0.1); color: #667eea; }
        &.forward { background: rgba(0, 206, 201, 0.1); color: #00cec9; }
        &.copy { background: rgba(253, 203, 110, 0.1); color: #fdcb6e; }
        &.pin { background: rgba(162, 155, 254, 0.1); color: #a29bfe; }
        &.select { background: rgba(255, 154, 158, 0.1); color: #ff9a9e; }
      }

      span {
        font-size: 12px;
        color: var(--text-color-2);
      }
    }
  }
}

// Reaction picker
.reaction-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  background: var(--card-color);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);

  .reaction-picker-content {
    display: flex;
    gap: 4px;

    .emoji-option {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      font-size: 24px;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;

      &:active {
        transform: scale(1.2);
        background: var(--item-hover-bg);
      }
    }
  }
}
</style>
