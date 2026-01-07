/** * TabBar - 移动端底部导航栏组件 * 基于设计图img3-1.webp的五项底部导航 * 浅色主题，薄荷绿背景 */
<template>
  <div class="tab-bar">
    <TabItem
      v-for="tab in tabs"
      :key="tab.id"
      :icon="tab.icon"
      :label="tab.label"
      :active="activeTab === tab.id"
      :badge="tab.badge"
      @click="handleTab(tab.id)" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

/**
 * 导航标签配置
 */
interface TabConfig {
  id: string
  icon: string
  label: string
  badge?: number
  route: string
}

const router = useRouter()
const route = useRoute()

const activeTab = ref('message')

/**
 * 导航标签列表
 */
const tabs: TabConfig[] = [
  { id: 'message', icon: 'message', label: '消息', route: '/mobile/message', badge: 0 },
  { id: 'rooms', icon: 'users', label: '群聊', route: '/mobile/rooms' },
  { id: 'spaces', icon: 'grid', label: '空间', route: '/mobile/spaces' },
  { id: 'friends', icon: 'user-friends', label: '好友', route: '/mobile/mobileFriends' },
  { id: 'profile', icon: 'user', label: '我的', route: '/mobile/my' }
]

/**
 * 根据当前路由更新激活标签
 */
watch(
  () => route.path,
  (newPath) => {
    const tab = tabs.find((t) => newPath.startsWith(t.route))
    if (tab) {
      activeTab.value = tab.id
    }
  },
  { immediate: true }
)

/**
 * 标签点击处理
 */
function handleTab(id: string) {
  activeTab.value = id
  const tab = tabs.find((t) => t.id === id)
  if (tab) {
    router.push(tab.route)
  }
}
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--mobile-bg-secondary);
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 8px rgba(0, 184, 148, 0.1);
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* PC端隐藏 */
@media (min-width: 769px) {
  .tab-bar {
    display: none;
  }
}
</style>
