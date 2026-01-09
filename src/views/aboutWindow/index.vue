<template>
  <main class="login-box size-full select-none">
    <ActionBar :shrink="false" :max-w="false" />

    <n-flex vertical align="center" :size="20" class="size-full pt-100px" data-tauri-drag-region>
      <div @mousemove="handleMouseMove" @mouseleave="handleMouseLeave" class="box" data-tauri-drag-region>
        <div id="computer" class="computer" v-once>
          <img class="w-224px h-158px relative" src="../../assets/img/win.png" alt="" />
          <div
            class="screen-overlay w-170px h-113px absolute top-9% left-51% transform -translate-x-51% -translate-y-9%"></div>
          <picture class="drop-shadow-md absolute top-30% left-1/2 transform -translate-x-1/2 -translate-y-30%">
            <source
              srcset="/hula.png 1x, /hula.png 2x"
              type="image/png"
              sizes="(max-width:640px) 120px, (max-width:1024px) 140px, 160px" />
            <img class="w-140px h-60px" src="/hula.png" srcset="/hula.png 1x, /hula.png 2x" alt="" />
          </picture>
        </div>
      </div>

      <n-flex vertical align="center" :size="20" class="cursor-default" data-tauri-drag-region>
        <span class="text-(15px var(--hula-brand-primary))">
          {{ t('home.about.version', { version: _pkg.version, arch: osArch || '' }) }}
        </span>
        <span class="text-(15px var(--hula-brand-primary))">
          {{ t('home.about.device', { type: osType || '', version: osVersion || '' }) }}
        </span>
        <n-flex vertical class="text-(12px var(--hula-brand-primary))" :size="8" align="center">
          <span>
            {{ t('home.about.copyright', { start: currentYear - 1, end: currentYear }) }}
          </span>
          <span>{{ t('home.about.rights') }}</span>
        </n-flex>
      </n-flex>
    </n-flex>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { reactive, ref, onMounted } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { arch, version } from '@tauri-apps/plugin-os'
import dayjs from 'dayjs'
import { getOSType, isWindows } from '@/utils/PlatformConstants'

// Vite 环境变量类型定义
interface ImportMetaEnv {
  VITE_APP_VERSION?: string
  [key: string]: string | boolean | undefined
}

interface ImportMetaWithEnv {
  env?: ImportMetaEnv
}

const meta = import.meta as unknown as ImportMetaWithEnv
const appVersion = meta.env?.VITE_APP_VERSION || ''

const { t } = useI18n()

const _pkg = reactive({
  version: appVersion
})
const osType = ref()
const osArch = ref()
const osVersion = ref()
// 使用day.js获取当前年份
const currentYear = dayjs().year()

const element = ref<HTMLElement | null>(null)
/** 鼠标移动时，对元素进行旋转的指数 */
const multiple = 20

const transformElement = (x: number, y: number) => {
  if (element.value) {
    const box = element.value.getBoundingClientRect()
    const calcX = -(y - box.y - box.height / 2) / multiple
    const calcY = (x - box.x - box.width / 2) / multiple

    element.value.style.transform = `rotateX(${calcX}deg) rotateY(${calcY}deg)`
  }
}

const handleMouseMove = (event: MouseEvent) => {
  window.requestAnimationFrame(() => {
    transformElement(event.clientX, event.clientY)
  })
}

const handleMouseLeave = () => {
  window.requestAnimationFrame(() => {
    if (element.value) {
      element.value.style.transform = 'rotateX(0) rotateY(0)'
    }
  })
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  osType.value = getOSType()
  osArch.value = arch()
  osVersion.value = version()
  if (isWindows()) {
    const parts = version().split('.')
    const build_number = Number(parts[2])
    osVersion.value = build_number > 22000 ? '11' : '10'
  }
  element.value = document.getElementById('computer')
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
:deep(.hover-box) {
  @apply w-28px h24px flex-center hover:bg-var(--hula-brand-primary);
  svg {
    color: var(--hula-brand-primary);
  }
}
:deep(.action-close) {
  svg {
    color: var(--hula-brand-primary);
  }
}

.box {
  width: 240px;
  height: 200px;
  perspective: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  .computer {
    position: relative;
    transition: all 0.2s;
  }
}

.screen-overlay {
  background: rgba(111, 111, 111, 0.1);
}
</style>
