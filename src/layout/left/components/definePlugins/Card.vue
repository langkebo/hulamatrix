<template>
  <div>
    <n-scrollbar class="plugins-scrollbar">
      <n-flex :size="26" class="z-10 p-[18px_18px_36px_18px] box-border w-full">
        <template v-for="(plugin, index) in allPlugins" :key="plugin.url || index">
          <Transition name="state-change" mode="out-in">
            <!-- 未安装和下载中状态 -->
            <n-flex
              v-if="plugin.state === PluginEnum.NOT_INSTALLED || plugin.state === PluginEnum.DOWNLOADING"
              vertical
              justify="center"
              align="center"
              :size="8"
              :class="{ 'filter-shadow': page.shadow }"
              class="box bg-[--plugin-bg-color]">
              <svg class="size-38px color-var(--hula-gray-400)">
                <use :href="`#${plugin.icon}`"></use>
              </svg>
              <p class="text-(12px var(--hula-gray-700))">{{ plugin.title }}</p>

              <!-- 在下载中进度条 -->
              <n-flex
                @click="handleState(plugin)"
                class="relative rounded-22px border-(1px solid var(--hula-brand-primary))"
                :class="[
                  plugin.state === PluginEnum.DOWNLOADING ? 'downloading' : 'bg-[--progress-bg] size-fit p-[4px_8px]'
                ]">
                <div
                  :style="{
                    width: plugin.state === PluginEnum.DOWNLOADING ? `${(plugin.progress ?? 0) * 0.8}px` : 'auto'
                  }"
                  :class="[
                    (plugin.progress ?? 0) < 100 ? 'rounded-l-24px rounded-r-0' : 'rounded-24px',
                    (plugin.progress ?? 0) > 0 ? 'h-18px border-(1px solid transparent)' : 'h-20px'
                  ]"
                  v-if="plugin.state === PluginEnum.DOWNLOADING"
                  class="bg-var(--hula-brand-primary)">
                  <p class="absolute-center text-(12px var(--hula-brand-primary))">{{ plugin.progress ?? 0 }}%</p>
                </div>

                <p v-else class="text-(12px var(--hula-brand-primary) center)">
                  {{ t('home.plugins.actions.install') }}
                </p>
              </n-flex>

              <!-- 闪光效果 -->
              <div class="flash"></div>
            </n-flex>

            <!-- 可卸载状态或内置插件状态 -->
            <n-flex
              v-else
              vertical
              justify="center"
              align="center"
              :size="8"
              class="box"
              :class="[
                plugin.state === PluginEnum.BUILTIN
                  ? 'built'
                  : plugin.state === PluginEnum.UNINSTALLING
                    ? 'unload'
                    : 'colorful',
                {
                  'filter-shadow': page.shadow
                }
              ]">
              <svg class="size-38px color-#555">
                <use :href="`#${plugin.iconAction || plugin.icon}`"></use>
              </svg>
              <p class="text-(12px var(--hula-gray-700))">{{ plugin.title }}</p>

              <n-flex
                v-if="plugin.state === PluginEnum.UNINSTALLING"
                class="relative rounded-22px border-(1px solid var(--hula-brand-primary)) bg-var(--hula-brand-primary) p-[4px_8px]">
                <p class="text-(12px var(--hula-brand-primary) center)">{{ t('home.plugins.status.uninstalling') }}</p>
              </n-flex>

              <n-flex
                v-if="plugin.state === PluginEnum.BUILTIN"
                class="relative rounded-22px border-(1px solid #777) bg-var(--hula-brand-primary) size-fit p-[4px_8px]">
                <p class="text-(12px #777 center)">{{ t('home.plugins.status.builtin') }}</p>
              </n-flex>

              <n-flex
                v-if="plugin.state === PluginEnum.INSTALLED"
                class="relative rounded-22px border-(1px solid var(--hula-brand-primary)) bg-var(--hula-brand-primary) p-[4px_8px]">
                <p class="text-(12px var(--hula-brand-primary) center)">{{ plugin.version }}</p>
              </n-flex>

              <!-- 闪光效果 -->
              <div class="flash"></div>

              <Transition>
                <svg
                  v-if="plugin.isAdd && plugin.state !== PluginEnum.BUILTIN"
                  class="absolute color-var(--hula-gray-700) left-2px top-2px size-14px">
                  <use href="#notOnTop"></use>
                </svg>
              </Transition>

              <!-- 插件操作 -->
              <n-popover
                v-if="plugin.state === PluginEnum.INSTALLED || index === isCurrently"
                :show="isCurrently === index"
                class="popover-no-padding"
                :show-arrow="false"
                trigger="click"
                placement="bottom">
                <template #trigger>
                  <svg @click.stop="isCurrently = index" class="absolute color-var(--hula-gray-700) right-0 top-0 size-18px rotate-90">
                    <use href="#more"></use>
                  </svg>
                </template>

                <div class="action-item">
                  <div class="menu-list">
                    <div v-if="!plugin.isAdd" @click="handleAdd(plugin)" class="menu-item">
                      <svg class="color-var(--hula-brand-primary)">
                        <use href="#add"></use>
                      </svg>
                      <p class="text-var(--hula-brand-primary)">{{ t('home.plugins.actions.pin') }}</p>
                    </div>
                    <div v-else @click="handleDelete(plugin)" class="menu-item">
                      <svg class="color-var(--hula-brand-primary)">
                        <use href="#reduce"></use>
                      </svg>
                      <p class="text-var(--hula-brand-primary)">{{ t('home.plugins.actions.unpin') }}</p>
                    </div>
                    <div @click="handleUnload(plugin)" class="menu-item">
                      <svg>
                        <use href="#delete"></use>
                      </svg>
                      <p>{{ t('home.plugins.actions.uninstall') }}</p>
                    </div>
                  </div>
                </div>
              </n-popover>
            </n-flex>
          </Transition>
        </template>
      </n-flex>
    </n-scrollbar>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { cloneDeep } from 'es-toolkit'
import { PluginEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config'
import { usePluginsStore } from '@/stores/plugins'
import { useSettingStore } from '@/stores/setting'

interface PluginItem {
  url: string
  title?: string
  icon?: string
  iconAction?: string
  version?: string
  isAdd?: boolean
  state?: PluginEnum
  progress?: number
  [key: string]: unknown
}

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const pluginsStore = usePluginsStore()
const pluginsList = usePluginsList()
const page = computed(() => settingStore.page)
const plugins = computed(() => pluginsStore.plugins)
const isCurrently = ref(-1)
const allPlugins = ref<PluginItem[]>([])
const pluginsLists = ref<PluginItem[]>(cloneDeep(pluginsList.value))

// 同步插件状态
const syncPlugins = (list: PluginItem[]) =>
  list.map((item: PluginItem) => {
    const matchedIndex = plugins.value.findIndex((z) => z.url === item.url)
    const matched = matchedIndex !== -1 ? plugins.value[matchedIndex] : undefined
    return matched
      ? {
          ...item,
          state: matched.state,
          isAdd: matched.isAdd
        }
      : item
  })

const handleState = (plugin: PluginItem) => {
  if (plugin.state === PluginEnum.INSTALLED) return
  plugin.state = PluginEnum.DOWNLOADING
  const interval = setInterval(() => {
    if ((plugin.progress ?? 0) < 100) {
      plugin.progress = (plugin.progress ?? 0) + 50
    } else {
      clearInterval(interval)
      plugin.state = PluginEnum.INSTALLED
      plugin.progress = 0
      pluginsStore.addPlugin(plugin)
    }
  }, 500)
}

const handleUnload = (plugin: PluginItem) => {
  plugin.state = PluginEnum.UNINSTALLING
  setTimeout(() => {
    handleDelete(plugin)
    plugin.state = PluginEnum.NOT_INSTALLED
    plugin.progress = 0
    pluginsStore.removePlugin(plugin)
  }, 2000)
}

const handleDelete = (p: PluginItem) => {
  const pid: string = String(p.url)
  const plugin = plugins.value.find((i) => String(i.url) === pid)
  if (plugin) {
    setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: false })
      ;(p as PluginItem).isAdd = false
      emitTo(appWindow.label, 'startResize')
    }, 300)
  }
}

const handleAdd = (p: PluginItem) => {
  const pid: string = String(p.url)
  const plugin = plugins.value.find((i) => String(i.url) === pid)
  if (plugin) {
    setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: true })
      ;(p as PluginItem).isAdd = true
      emitTo(appWindow.label, 'startResize')
    }, 300)
  }
}

const closeMenu = (event: Event) => {
  const e = event.target as HTMLInputElement
  if (!e.matches('.action-item')) {
    isCurrently.value = -1
  }
}

watch(
  pluginsList,
  (latest) => {
    pluginsLists.value = cloneDeep(latest)
    allPlugins.value = syncPlugins(pluginsLists.value)
  },
  { immediate: false }
)

onMounted(() => {
  allPlugins.value = syncPlugins(pluginsLists.value)
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;

.plugins-scrollbar {
  max-height: 280px;
}

.popover-no-padding {
  padding: 0;
}

.box {
  @apply relative select-none custom-shadow cursor-pointer size-fit w-100px h-100px rounded-8px overflow-hidden;
  transition: all 0.3s ease-in-out;

  &.state-change-enter-active,
  &.state-change-leave-active {
    transition: all 0.3s ease-in-out;
  }

  &.state-change-enter-from,
  &.state-change-leave-to {
    opacity: 0;
    transform: scale(0.9);
  }

  .flash {
    position: absolute;
    left: -130%;
    top: 0;
    width: 100px;
    height: 100px;
    background-image: linear-gradient(90deg, rgba(var(--hula-white-rgb), 0), rgba(var(--hula-white-rgb), 0.5), rgba(var(--hula-white-rgb), 0));
    transform: skew(-30deg);
    pointer-events: none;
  }

  &:hover .flash {
    left: 130%;
    transition: all 0.8s ease-in-out;
  }
}

.downloading {
  width: 80px;
  background: var(--progress-bg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.action-item {
  @include menu-item-style();
  left: -80px;
  @include menu-list();
}

.colorful {
  background-image: linear-gradient(45deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
}

.built {
  background-image: linear-gradient(-20deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
}

.unload {
  background-image: linear-gradient(to top, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
}

.filter-shadow {
  filter: drop-shadow(0 0 2px rgba(var(--hula-black-rgb), 0.2));
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
