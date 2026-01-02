<template>
  <div 
    v-if="isSelfDestructMessage && !isDestroyed" 
    class="self-destruct-countdown"
    :class="{ 
      'warning': isWarningState, 
      'destroying': isDestroying,
      'inline': inline 
    }">
    <!-- 倒计时指示器 -->
    <div class="countdown-badge" :style="{ borderColor: countdownColor }">
      <Icon 
        icon="mdi:timer-sand" 
        class="timer-icon" 
        :class="{ 'animate-pulse': isWarningState }"
        :style="{ color: countdownColor }" 
      />
      <span class="countdown-text" :style="{ color: countdownColor }">
        {{ formattedRemainingTime }}
      </span>
    </div>
    
    <!-- 进度条 (可选) -->
    <div v-if="showProgress" class="countdown-progress">
      <div 
        class="progress-bar" 
        :style="{ 
          width: countdownProgress + '%',
          backgroundColor: countdownColor 
        }" 
      />
    </div>
    
    <!-- 警告提示 -->
    <Transition name="fade">
      <div v-if="isWarningState && showWarningText" class="warning-text">
        <Icon icon="mdi:alert" class="warning-icon" />
        <span>{{ warningLabel }}</span>
      </div>
    </Transition>
  </div>
  
  <!-- 已销毁提示 (Requirements 7.5) -->
  <Transition name="fade">
    <div v-if="isDestroyed && showDestroyedNotice" class="destroyed-notice">
      <Icon icon="mdi:timer-off-outline" class="destroyed-icon" />
      <span>{{ destroyedLabel }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * SelfDestructCountdown Component
 *
 * Requirements 7.2: THE UI SHALL display countdown timer for self-destruct messages
 * Requirements 7.5: THE UI SHALL show "message expired" placeholder after destruction
 */
import { computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useSelfDestructMessage } from '@/composables/useSelfDestructMessage'

interface UseSelfDestructMessageOptions {
  messageId: string
  roomId: string
  eventId?: string
  messageBody?: Record<string, unknown>
  onDestroy?: (id: string) => void
  onWarning?: (id: string, time: number) => void
}

interface Props {
  messageId: string
  roomId: string
  eventId?: string
  messageBody?: Record<string, unknown>
  inline?: boolean
  showProgress?: boolean
  showWarningText?: boolean
  showDestroyedNotice?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inline: true,
  showProgress: false,
  showWarningText: false,
  showDestroyedNotice: true
})

const emit = defineEmits<{
  destroy: [messageId: string]
  warning: [messageId: string, remainingTime: number]
}>()

const { t } = useI18n()

const warningLabel = computed(() => t('message.selfDestruct.aboutToDestroy'))
const destroyedLabel = computed(() => t('message.selfDestruct.messageDestroyed'))

// Build options object conditionally
const selfDestructOptions: UseSelfDestructMessageOptions = {
  messageId: props.messageId,
  roomId: props.roomId,
  onDestroy: (id) => emit('destroy', id),
  onWarning: (id, time) => emit('warning', id, time)
}

// Conditionally add optional properties
if (props.eventId !== undefined) {
  selfDestructOptions.eventId = props.eventId
}

if (props.messageBody !== undefined) {
  selfDestructOptions.messageBody = props.messageBody
}

const {
  isSelfDestructMessage,
  isDestroying,
  isWarningState,
  isDestroyed,
  formattedRemainingTime,
  countdownProgress,
  countdownColor
} = useSelfDestructMessage(selfDestructOptions)

// Watch for external destruction events
watch(isDestroyed, (destroyed) => {
  if (destroyed) {
    emit('destroy', props.messageId)
  }
})
</script>

<style scoped lang="scss">
.self-destruct-countdown {
  display: flex;
  align-items: center;
  gap: 6px;
  
  &.inline {
    display: inline-flex;
    margin-left: 8px;
  }
  
  &.warning {
    animation: warningPulse 1.5s infinite;
  }
  
  &.destroying {
    animation: destroyingBlink 0.5s infinite;
  }
}

.countdown-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid;
  font-size: 11px;
  
  .timer-icon {
    font-size: 12px;
  }
  
  .countdown-text {
    font-weight: 500;
    white-space: nowrap;
  }
}

.countdown-progress {
  width: 100%;
  height: 2px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 1px;
  overflow: hidden;
  
  .progress-bar {
    height: 100%;
    transition: width 1s linear, background-color 0.3s ease;
  }
}

.warning-text {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  font-size: 10px;
  color: #ef4444;
  
  .warning-icon {
    font-size: 12px;
  }
}

.destroyed-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  font-size: 11px;
  color: white;
  
  .destroyed-icon {
    font-size: 14px;
    color: #9ca3af;
  }
}

// 动画
@keyframes warningPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes destroyingBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

// Fade transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 暗色主题适配
:global(.dark) {
  .countdown-badge {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .countdown-progress {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .warning-text {
    background: rgba(239, 68, 68, 0.2);
  }
}
</style>
