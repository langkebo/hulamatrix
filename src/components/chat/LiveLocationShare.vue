<template>
  <div class="live-location-share">
    <!-- 未共享状态 -->
    <div v-if="!isSharingLocation" class="share-inactive">
      <n-button type="primary" secondary :loading="loading" @click="handleStartSharing">
        <template #icon>
          <svg class="size-16px">
            <use href="#location"></use>
          </svg>
        </template>
        {{ t('message.location.share_button.start') }}
      </n-button>
    </div>

    <!-- 共享中状态 -->
    <div v-else class="share-active">
      <n-flex align="center" :size="8">
        <!-- 脉动指示器 -->
        <div class="pulse-indicator">
          <div class="pulse-dot"></div>
        </div>

        <!-- 位置信息 -->
        <div class="share-info">
          <p class="share-description">{{ myActiveBeacon?.info.description }}</p>
          <p class="share-time">
            {{ formatRemainingTime(myActiveBeacon?.remainingTime || 0) }}
          </p>
        </div>

        <!-- 停止按钮 -->
        <n-button size="small" tertiary :loading="loading" @click="handleStopSharing">
          {{ t('message.location.share_button.stop') }}
        </n-button>
      </n-flex>
    </div>

    <!-- 进度条 -->
    <n-progress
      v-if="isSharingLocation && myActiveBeacon"
      type="line"
      :percentage="progressPercentage"
      :show-indicator="false"
      :height="2"
      :color="progressColor" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatrixBeacons } from '@/hooks/useMatrixBeacons'
import { logger } from '@/utils/logger'

interface Props {
  roomId: string
  autoRefresh?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true
})

const emit = defineEmits<{
  sharingStarted: [beaconId: string]
  sharingStopped: []
  error: [error: string]
}>()

const { t } = useI18n()

// Beacons Hook
const { isSharingLocation, myActiveBeacon, loading, error, startSharing, stopSharing, refresh } = useMatrixBeacons({
  roomId: props.roomId,
  autoLoad: props.autoRefresh
})

// 本地状态
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const shareStartTime = ref<number>(0)
const shareDuration = ref<number>(0)

// 计算属性
const progressPercentage = computed(() => {
  if (!myActiveBeacon.value || !shareDuration.value) return 0
  const elapsed = Date.now() - shareStartTime.value
  const percentage = Math.min(100, (elapsed / shareDuration.value) * 100)
  return 100 - percentage // 倒计时进度
})

const progressColor = computed(() => {
  const percentage = progressPercentage.value
  if (percentage > 70) return 'var(--hula-brand-primary)' // 绿色
  if (percentage > 30) return 'var(--hula-brand-primary)' // 橙色
  return 'var(--hula-brand-primary)' // 红色
})

// 方法
const handleStartSharing = async () => {
  try {
    const beaconId = await startSharing(props.roomId, {
      description: t('message.location.share_button.default_description'),
      duration: 3600000, // 1 小时
      updateInterval: 30000 // 30 秒
    })

    if (beaconId) {
      shareStartTime.value = Date.now()
      shareDuration.value = 3600000

      emit('sharingStarted', beaconId)

      // 开始定期刷新
      startRefreshInterval()
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to start sharing'
    emit('error', errorMessage)
  }
}

const handleStopSharing = async () => {
  try {
    await stopSharing(props.roomId)

    // 停止定期刷新
    stopRefreshInterval()

    emit('sharingStopped')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to stop sharing'
    emit('error', errorMessage)
  }
}

const formatRemainingTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return t('message.location.share_button.remaining_hours', { hours, minutes: minutes % 60 })
  } else if (minutes > 0) {
    return t('message.location.share_button.remaining_minutes', { minutes, seconds: seconds % 60 })
  } else {
    return t('message.location.share_button.remaining_seconds', { seconds })
  }
}

const startRefreshInterval = () => {
  stopRefreshInterval()

  refreshInterval.value = setInterval(() => {
    refresh(props.roomId)

    // 更新剩余时间显示
    if (myActiveBeacon.value?.remainingTime !== undefined) {
      myActiveBeacon.value.remainingTime = Math.max(0, myActiveBeacon.value.remainingTime - 5000)
    }
  }, 5000) // 每 5 秒刷新一次
}

const stopRefreshInterval = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// 监听共享状态变化
watch(isSharingLocation, (isSharing) => {
  if (isSharing && myActiveBeacon.value) {
    shareStartTime.value = Date.now()
    shareDuration.value = myActiveBeacon.value.info.timeout || 3600000
    startRefreshInterval()
  } else {
    stopRefreshInterval()
  }
})

// 监听错误
watch(error, (newError) => {
  if (newError) {
    emit('error', newError)
  }
})

// 清理
onUnmounted(() => {
  stopRefreshInterval()
})
</script>

<style scoped lang="scss">
.live-location-share {
  width: 100%;
}

.share-inactive,
.share-active {
  padding: 8px 0;
}

.share-active {
  position: relative;
}

.pulse-indicator {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background-color: var(--hula-brand-primary);
  border-radius: 50%;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: var(--hula-brand-primary);
    opacity: 0.4;
    animation: pulse 2s ease-out infinite;
  }

  &::after {
    animation-delay: 1s;
  }
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.4;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
  }
}

.share-info {
  flex: 1;
}

.share-description {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 2px 0;
}

.share-time {
  font-size: 12px;
  margin: 0;
  color: var(--text-color-3, var(--hula-gray-400));
}
</style>
