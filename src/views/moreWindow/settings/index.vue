<template>
  <main class="size-full flex select-none">
    <!-- 移动端菜单遮罩 -->
    <Transition name="fade">
      <div v-if="showMobileMenu" class="mobile-overlay" @click="showMobileMenu = false"></div>
    </Transition>

    <!-- 移动端菜单按钮 -->
    <button
      v-if="isMobile"
      class="mobile-menu-button"
      @click="showMobileMenu = !showMobileMenu"
      :class="{ 'is-open': showMobileMenu }">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <!-- 侧边栏选项 -->
    <section class="left-bar" :class="{ 'is-mobile-open': showMobileMenu && isMobile }" data-tauri-drag-region>
      <div class="menu-list relative">
        <div v-for="(item, index) in sideOptions" :key="index">
          <div class="menu-item" :class="{ active: activeItem === item.url }" @click="pageJumps(item.url)">
            <n-flex align="center">
              <svg><use :href="`#${item.icon}`"></use></svg>
              {{ item.label }}
            </n-flex>
            <Transition>
              <div
                v-if="item.versionStatus && activeItem !== item.url"
                class="bg-[--danger-bg] p-[2px_6px] rounded-6px text-(12px [--danger-text])">
                {{ t(item.versionStatus) }}
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div class="absolute bottom-20px left-60px select-none cursor-default flex items-center gap-10px">
        <p class="text-(12px var(--hula-gray-700))">{{ t('setting.common.provider_label') }}:</p>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/HuLaSpark/HuLa"
          class="text-(12px) text-brand cursor-pointer no-underline">
          {{ t('setting.common.provider_name') }}
        </a>
      </div>
    </section>

    <!-- 右边内容 -->
    <section class="bg-[--right-bg-color] relative rounded-r-8px flex-1 border-l-(1px solid [--line-color])">
      <ActionBar :shrink="false" :max-w="false" />

      <header class="header" data-tauri-drag-region>
        {{ title }}
      </header>

      <n-scrollbar class="settings-scrollbar" :class="{ 'shadow-inner': page.shadow }" data-tauri-drag-region>
        <n-flex vertical class="p-16px md:p-24px" :space="12" justify="center" v-if="skeleton">
          <n-skeleton class="rounded-8px skeleton-short" height="26px" text />
          <n-skeleton class="rounded-8px" height="26px" text :repeat="5" />
          <n-skeleton class="rounded-8px skeleton-medium" height="26px" text />
        </n-flex>
        <template v-else>
          <div class="flex-1 p-16px md:p-24px"><router-view /></div>

          <Foot />
        </template>
      </n-scrollbar>
    </section>
  </main>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import router from '@/router'
import { useScannerStore } from '@/stores/scanner'
import { useSettingStore } from '@/stores/setting'
import Foot from '@/views/moreWindow/settings/Foot.vue'
import { useSideOptions } from './config'
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const settingStore = useSettingStore()
const scannerStore = useScannerStore()
const skeleton = ref(true)
const page = computed(() => settingStore.page)
const sideOptions = useSideOptions()
const { t } = useI18n()
/**当前选中的元素 默认选中itemsTop的第一项*/
const activeItem = ref<string>('/general')
const title = ref<string>('')

// 移动端状态
const showMobileMenu = ref(false)
const isMobile = ref(false)

// 检测是否为移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) {
    showMobileMenu.value = false
  }
}

// 监听窗口大小变化
const handleResize = () => {
  checkMobile()
}

watch(
  sideOptions,
  (options) => {
    if (!options.length) return
    const current = options.find((item) => item.url === activeItem.value) ?? options[0]
    activeItem.value = current?.url || ''
    title.value = current?.label || ''
  },
  { immediate: true }
)

/**
 * 统一跳转路由方法
 * @param url 跳转的路由
 * @param label 页面的标题
 * */
const pageJumps = (url: string) => {
  const matched = sideOptions.value.find((item) => item.url === url)
  if (matched) {
    activeItem.value = matched.url
    title.value = matched.label
  }
  router.push(url)
  // 移动端跳转后关闭菜单
  if (isMobile.value) {
    showMobileMenu.value = false
  }
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()

  // 重置扫描器状态
  scannerStore.resetState()

  // 检测移动端
  checkMobile()
  window.addEventListener('resize', handleResize)

  setTimeout(() => {
    skeleton.value = false
  }, 300)
  pageJumps(activeItem.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// 设置窗口关闭时清理扫描器资源
onUnmounted(async () => {
  await scannerStore.cleanup()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable' as *;

// 设置页面滚动条
.settings-scrollbar {
  max-height: calc(100vh / var(--page-scale, 1) - 70px);
}

// 骨架屏宽度
.skeleton-short {
  width: 30%;
}

.skeleton-medium {
  width: 60%;
}

// 移动端菜单按钮
.mobile-menu-button {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  width: 44px;
  height: 44px;
  background: var(--bg-color);
  border: 1px solid var(--line-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  transition: all 0.3s ease;

  span {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-color);
    border-radius: 2px;
    transition: all 0.3s ease;
  }

  &.is-open {
    span:nth-child(1) {
      transform: rotate(45deg) translate(5px, 5px);
    }
    span:nth-child(2) {
      opacity: 0;
    }
    span:nth-child(3) {
      transform: rotate(-45deg) translate(5px, -5px);
    }
  }

  &:hover {
    background: var(--hover-color);
  }
}

// 移动端遮罩
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--hula-black-rgb), 0.5);
  z-index: 998;
}

// 遮罩过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.left-bar {
  @include menu-list();
  background: var(--bg-left-menu);
  width: clamp(160px, 22vw, 240px);
  padding: 16px 8px;
  box-sizing: border-box;
  color: var(--text-color);
  transition: transform 0.3s ease;
  .menu-item {
    padding: 8px 8px;
    border-radius: 10px;
    margin-top: 6px;
    font-size: clamp(12px, 2vw, 14px);
    display: flex;
    justify-content: space-between;
    svg {
      width: clamp(16px, 2vw, 18px);
      height: clamp(16px, 2vw, 18px);
    }
    &:not(.active):hover {
      background-color: var(--bg-left-menu-hover);
    }
    &:hover {
      background-color: var(--bg-left-active);
      svg {
        animation: none;
      }
    }
  }

  // 移动端样式
  @media (max-width: 767px) {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 999;
    width: 260px;
    transform: translateX(-100%);
    border-right: 1px solid var(--line-color);

    &.is-mobile-open {
      transform: translateX(0);
    }
  }
}

.active {
  background-color: var(--bg-left-active);
}

.header {
  @apply w-full flex items-center select-none color-[--text-color] border-b-(1px solid [--line-color]);
  height: clamp(36px, 6vh, 42px);
  padding-left: clamp(16px, 3vw, 40px);
  font-size: clamp(16px, 2.4vw, 18px);

  // 移动端适配
  @media (max-width: 767px) {
    padding-left: 60px; // 为汉堡按钮留出空间
  }
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
