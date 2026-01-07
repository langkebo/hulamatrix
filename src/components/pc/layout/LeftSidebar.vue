/** * LeftSidebar - PC端左侧导航栏组件 * 基于设计图img2-8.webp的三栏布局左侧 * 深青绿色背景(#2D5A5A)，圆形导航图标 */
<template>
  <div class="left-sidebar">
    <!-- Logo区域 -->
    <div class="logo-section">
      <img :src="logoUrl" alt="HuLa" class="logo" />
    </div>

    <!-- 导航图标 -->
    <nav class="nav-icons">
      <NavItem
        v-for="item in navItems"
        :key="item.id"
        :icon="item.icon"
        :label="item.label"
        :active="activeNav === item.id"
        :badge="item.badge"
        :dot="item.dot"
        @click="handleNav(item.id)" />
    </nav>

    <!-- 底部操作区 -->
    <div class="bottom-actions">
      <NavItem icon="settings" label="设置" :active="activeNav === 'settings'" @click="handleNav('settings')" />
      <NavItem icon="menu" label="菜单" :active="activeNav === 'menu'" @click="toggleMenu" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMatrixAuthStore } from '@/stores/matrixAuth'

/**
 * 导航项配置
 */
interface NavItemConfig {
  id: string
  icon: string
  label: string
  badge?: number
  dot?: boolean
}

const router = useRouter()
const authStore = useMatrixAuthStore()

const activeNav = ref('messages')

/**
 * Logo URL
 */
const logoUrl = computed(() => '/logo.png')

/**
 * 导航项列表
 */
const navItems: NavItemConfig[] = [
  { id: 'profile', icon: 'user', label: '个人资料' },
  { id: 'messages', icon: 'message', label: '消息', badge: 0 },
  { id: 'discover', icon: 'compass', label: '发现' },
  { id: 'favorites', icon: 'bookmark', label: '收藏' }
]

/**
 * 导航处理
 */
function handleNav(id: string) {
  activeNav.value = id

  const routes: Record<string, string> = {
    messages: '/home',
    discover: '/spaces',
    settings: '/settings'
  }

  const route = routes[id]
  if (route) {
    router.push(route)
  }
}

/**
 * 切换菜单
 */
function toggleMenu() {
  // 打开菜单抽屉
}
</script>

<style scoped>
.left-sidebar {
  width: 80px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--pc-bg-primary);
  box-shadow: var(--shadow-dark-md);
  z-index: 100;
  padding: var(--space-md) 0;
}

.logo-section {
  margin-bottom: var(--space-xl);
}

.logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.nav-icons {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
  align-items: center;
}

.bottom-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

@media (max-width: 768px) {
  .left-sidebar {
    display: none;
  }
}
</style>
