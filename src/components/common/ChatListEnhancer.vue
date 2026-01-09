<template>
  <div class="chat-list-enhancer">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <n-spin size="medium" />
      <span class="loading-text">加载聊天列表...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="isEmpty" class="empty-container">
      <n-empty
        description="暂无聊天记录"
        size="large"
        :image="emptyImage"
        :image-style="{
          width: '120px',
          height: '120px',
          opacity: 0.6
        }">
        <template #extra>
          <n-button size="small" @click="handleStartChat">开始聊天</n-button>
        </template>
      </n-empty>
      <div class="empty-tips">
        <p>• 添加好友开始对话</p>
        <p>• 加入群组参与讨论</p>
        <p>• 扫描二维码快速添加</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <n-result status="error" title="加载失败" :description="errorMessage">
        <template #footer>
          <n-space>
            <n-button @click="handleRetry">重试</n-button>
            <n-button tertiary @click="handleRefresh">刷新</n-button>
          </n-space>
        </template>
      </n-result>
    </div>

    <!-- 正常状态 - 插槽用于渲染实际的聊天列表 -->
    <div v-else class="chat-list-container">
      <slot />

      <!-- 加载更多 -->
      <div v-if="hasMore" class="load-more" ref="loadMoreRef">
        <n-spin v-if="loadingMore" size="small" />
        <n-button v-else text @click="handleLoadMore">加载更多</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NSpin, NEmpty, NButton, NResult, NSpace } from 'naive-ui'
import { logger } from '@/utils/logger'

interface Props {
  // 加载状态
  loading?: boolean
  // 错误状态
  error?: boolean
  // 错误信息
  errorMessage?: string
  // 是否为空
  isEmpty?: boolean
  // 是否有更多数据
  hasMore?: boolean
  // 正在加载更多
  loadingMore?: boolean
  // 自定义空状态图片
  emptyImage?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: false,
  errorMessage: '加载聊天列表失败',
  isEmpty: false,
  hasMore: false,
  loadingMore: false
})

const emit = defineEmits<{
  retry: []
  refresh: []
  loadMore: []
  startChat: []
}>()

const loadMoreRef = ref<HTMLElement>()

// 事件处理
const handleRetry = () => {
  logger.info('[ChatListEnhancer] 用户点击重试')
  emit('retry')
}

const handleRefresh = () => {
  logger.info('[ChatListEnhancer] 用户点击刷新')
  emit('refresh')
}

const handleLoadMore = () => {
  logger.info('[ChatListEnhancer] 加载更多')
  emit('loadMore')
}

const handleStartChat = () => {
  logger.info('[ChatListEnhancer] 开始聊天')
  emit('startChat')
}

// 滚动加载更多
onMounted(() => {
  if (!props.hasMore || !loadMoreRef.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !props.loadingMore) {
        handleLoadMore()
      }
    },
    { threshold: 0.1 }
  )

  observer.observe(loadMoreRef.value)

  onUnmounted(() => {
    observer.disconnect()
  })
})
</script>

<style scoped lang="scss">
.chat-list-enhancer {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 12px;

  .loading-text {
    color: var(--text-color-3);
    font-size: 14px;
  }
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  padding: 20px;

  .empty-tips {
    margin-top: 20px;
    text-align: center;
    color: var(--text-color-3);
    font-size: 12px;
    line-height: 1.8;

    p {
      margin: 4px 0;
    }
  }
}

.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  padding: 20px;
}

.chat-list-container {
  flex: 1;
  overflow: hidden;
}

.load-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  color: var(--text-color-3);
  font-size: 14px;
}
</style>
