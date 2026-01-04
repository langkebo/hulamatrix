<template>
  <MobileLayout :safeAreaTop="shouldShowTopSafeArea" :safeAreaBottom="true">
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-hidden">
        <RouterView v-slot="{ Component }">
          <Transition name="slide" appear mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </RouterView>
      </div>

      <div class="flex-shrink-0">
        <TabBar ref="tabBarElement" />
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { default as TabBarType } from '#/layout/tabBar/index.vue'
import TabBar from '#/layout/tabBar/index.vue'
import { initializeNotifications } from '@/services/notificationService'

const route = useRoute()
const tabBarElement = ref<InstanceType<typeof TabBarType>>()

// 根据路由动态控制顶部安全区域
// 当在房间页面时，关闭顶部安全区域
const shouldShowTopSafeArea = computed(() => {
  return route.path !== '/mobile/rooms'
})

// 初始化通知服务
onMounted(async () => {
  await initializeNotifications()
})
</script>

<style lang="scss"></style>
