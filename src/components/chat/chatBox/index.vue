<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- 头部 -->
    <ChatHeader />

    <div class="flex-1 flex min-h-0">
      <div class="flex-1 min-h-0">
        <div v-if="isLoadingSession" class="flex-center size-full select-none">
          <n-spin size="large">
            <template #description>正在加载房间内容...</template>
          </n-spin>
        </div>
        <template v-else>
        <n-split
          direction="vertical"
          :resize-trigger-size="8"
          class="h-full"
          :min="0.55"
          :max="0.74"
          :default-size="0.74">
          <template #1>
            <ChatMain />
          </template>
          <template #2>
            <!-- 输入框和操作列表 -->
            <ChatFooter :detail-id="currentSession?.detailId" />
          </template>
        </n-split>
        </template>
      </div>
      <!-- 右侧栏占位：群聊时预留宽度直至 Sidebar 挂载完成，随后由子组件控制宽度（含折叠） -->
      <ChatSidebar />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()
const currentSession = computed(() => globalStore.currentSession)
const isLoadingSession = computed(() => !!globalStore.currentSessionRoomId && !currentSession.value)
</script>
<style scoped lang="scss">
:deep(.n-split .n-split__resize-trigger) {
  height: 16px !important;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  z-index: 998;
  position: relative;
  // 确保不干扰 ChatFooter 的顶部边框
  margin-top: -7px;

  // 主指示线（默认隐藏，hover 时显示）
  &::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 3px;
    background: #909090;
    border-radius: 2px;
    opacity: 0;
    transition: all 0.2s ease;
  }

  // 上下辅助线（默认隐藏，hover 时显示）
  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 1px;
    background: transparent;
    border-radius: 1px;
    transition: all 0.2s ease;
    opacity: 0;
    box-shadow:
      0 -3px 0 0 rgba(102, 102, 102, 0.5),
      0 3px 0 0 rgba(102, 102, 102, 0.5);
    pointer-events: none;
  }

  // hover 状态 - 显示指示器
  &:hover {
    &::before {
      opacity: 0.8;
      transform: scaleY(1.2);
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 rgba(102, 102, 102, 0.8),
        0 3px 0 0 rgba(102, 102, 102, 0.8);
    }
  }

  // active/dragging 状态 - 显示高亮指示器
  &:active {
    &::before {
      opacity: 1;
      transform: scaleY(1.2);
      background: rgba(19, 152, 127, 0.5);
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 rgba(19, 152, 127, 0.5),
        0 3px 0 0 rgba(19, 152, 127, 0.5);
    }
  }
}
</style>
