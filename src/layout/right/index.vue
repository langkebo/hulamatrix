<template>
  <!-- 主容器维持 600px 的最小宽度，确保聊天侧边信息不过度挤压 -->
  <main data-tauri-drag-region class="flex-1 flex flex-col min-h-0 min-w-720px pr-24px box-border" :style="{ background: 'var(--right-theme-bg)' }">
    <div
      :style="{ background: shouldShowChat ? 'transparent' : '' }"
      data-tauri-drag-region
      class="flex-1 flex flex-col min-h-0"
    >
      <ActionBar :current-label="appWindow.label" />

      <!-- 需要判断当前路由是否是信息详情界面 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <ChatBox v-if="isChatRoute" />
        <TypingIndicator v-if="isChatRoute" />

        <Details :content="detailsContent" v-else-if="detailsShow && isDetails && isSessionItem(detailsContent)" />

        <!-- 好友申请列表 -->
        <ApplyList
          v-else-if="detailsContent && isDetails && isDetailsContent(detailsContent)"
          :type="detailsContent.applyType" />

        <!-- 聊天界面背景图标 -->
        <div v-else class="flex-center size-full select-none" style="pointer-events: none;">
          <picture>
            <source
              srcset="/logoD.png 1x, /logoD.png 2x"
              type="image/png"
              media="(prefers-color-scheme: light)"
              sizes="(max-width:640px) 120px, (max-width:1024px) 140px, 160px" />
            <source
              srcset="/logoL.png 1x, /logoL.png 2x"
              type="image/png"
              media="(prefers-color-scheme: dark)"
              sizes="(max-width:640px) 120px, (max-width:1024px) 140px, 160px" />
            <img
              class="w-150px h-140px"
              :src="imgTheme === 'dark' ? '/logoL.png' : '/logoD.png'"
              srcset="/logoD.png 1x, /logoD.png 2x"
              alt="" />
          </picture>
        </div>
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'
import type { DetailsContent, SessionItem } from '@/services/types'
import { useSettingStore } from '@/stores/setting'
import { useGlobalStore } from '@/stores/global'
import Details from '@/components/rightBox/Details.vue'
import TypingIndicator from '@/components/rightBox/TypingIndicator.vue'
import ChatBox from '@/components/rightBox/chatBox/index.vue'
import ApplyList from '@/components/rightBox/ApplyList.vue'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// App window interface (Tauri WebviewWindow or web fallback)
interface AppWindow {
  label: string
  [key: string]: unknown
}

const getAppWindow = (): AppWindow => {
  if (isTauri) {
    const currentWindow = WebviewWindow.getCurrent()
    // Spread all properties from currentWindow, but don't override label
    const { label: _, ...rest } = currentWindow as { label: string }
    return {
      label: currentWindow.label,
      ...rest
    } as AppWindow
  }
  return { label: 'web' }
}

const appWindow = getAppWindow()
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const globalStore = useGlobalStore()
const currentSession = computed(() => globalStore.currentSession)
const detailsShow = ref(false)
const detailsContent = ref<DetailsContent | SessionItem | undefined>()
const imgTheme = ref<ThemeEnum>(themes.value.content as ThemeEnum)
const prefers = matchMedia('(prefers-color-scheme: dark)')
const isChatRoute = computed(() => router.currentRoute.value.path.includes('/message'))
const shouldShowChat = computed(
  () => isChatRoute.value && (!!currentSession.value || !!globalStore.currentSessionRoomId)
)
const isDetails = computed(() => {
  return router.currentRoute.value.path.includes('/friendsList')
})

// Type guard to check if content is DetailsContent (apply type)
function isDetailsContent(content: DetailsContent | SessionItem | undefined): content is DetailsContent {
  return content !== undefined && 'type' in content && content.type === 'apply'
}

// Type guard to check if content is SessionItem
function isSessionItem(content: DetailsContent | SessionItem | undefined): content is SessionItem {
  return content !== undefined && !isDetailsContent(content)
}

/** 跟随系统主题模式切换主题 */
const followOS = () => {
  imgTheme.value = prefers.matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

watchEffect(() => {
  if (themes.value.pattern === ThemeEnum.OS) {
    followOS()
    prefers.addEventListener('change', followOS)
  } else {
    imgTheme.value = (themes.value.content as ThemeEnum) || ThemeEnum.LIGHT
    prefers.removeEventListener('change', followOS)
  }
})

onMounted(() => {
  // 好友详情页面通过 mitt 接收主体传来的选中信息
  if (isDetails) {
    useMitt.on(MittEnum.APPLY_SHOW, (event: { context: DetailsContent }) => {
      detailsContent.value = event.context
    })
    useMitt.on(MittEnum.DETAILS_SHOW, (event: { context: DetailsContent; detailsShow?: boolean }) => {
      detailsContent.value = event.context
      detailsShow.value = event.detailsShow ?? false
    })
  }
})
</script>

<style scoped>
.main-layout {
  background: var(--right-theme-bg-color, rgba(255, 255, 255, 0.9)) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 深色模式 */
html[data-theme='dark'] .main-layout {
  background: var(--right-theme-bg-color, rgba(24, 24, 28, 0.9)) !important;
}

/* 确保聊天组件显示 */
.chat-integration {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  min-height: 0 !important;
}

.chat-integration > * {
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
}
</style>
