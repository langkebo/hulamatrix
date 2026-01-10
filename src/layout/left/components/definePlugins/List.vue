<template>
  <div>
    <FloatBlockList
      :data-source="allPlugins"
      item-key="title"
      :item-height="70"
      max-height="280px"
      style-id="plugins-hover-classes">
      <template #item="{ item: plugin, index }">
        <n-flex align="center" justify="space-between" class="p-[10px_20px]">
          <n-flex :size="14" align="center">
            <n-flex align="center" justify="center" class="size-48px rounded-50% bg-var(--hula-brand-primary)0f">
              <Transition mode="out-in">
                <svg
                  v-if="plugin.state === PluginEnum.NOT_INSTALLED || plugin.state === PluginEnum.DOWNLOADING"
                  class="size-34px color-var(--hula-gray-400)">
                  <use :href="`#${plugin.icon}`"></use>
                </svg>
                <template v-else>
                  <svg class="size-34px color-var(--hula-gray-700)">
                    <use :href="`#${plugin.iconAction || plugin.icon}`"></use>
                  </svg>
                </template>
              </Transition>
            </n-flex>

            <n-flex vertical :size="10">
              <n-flex align="center" :size="6">
                <p class="text-(14px var(--hula-gray-700)) pl-4px">{{ plugin.title }}</p>

                <Transition>
                  <svg v-if="plugin.isAdd && plugin.state !== PluginEnum.BUILTIN" class="color-var(--hula-gray-700) size-14px">
                    <use href="#notOnTop"></use>
                  </svg>
                </Transition>
              </n-flex>

              <Transition mode="out-in">
                <n-flex
                  v-if="plugin.state === PluginEnum.UNINSTALLING"
                  class="relative rounded-22px bg-var(--hula-brand-primary) size-fit p-[4px_8px]">
                  <p class="text-(12px var(--hula-brand-primary) center)">
                    {{ t('home.plugins.status.uninstalling') }}
                  </p>
                </n-flex>

                <n-flex
                  v-else-if="plugin.state === PluginEnum.BUILTIN"
                  class="relative rounded-22px bg-var(--hula-brand-primary) size-fit p-[4px_8px]">
                  <p class="text-(12px var(--hula-gray-500) center)">{{ t('home.plugins.status.builtin') }}</p>
                </n-flex>

                <n-flex v-else class="relative rounded-22px bg-var(--hula-brand-primary) size-fit p-[4px_8px]">
                  <p class="text-(12px var(--hula-brand-primary) center)">{{ plugin.version }}</p>
                </n-flex>
              </Transition>
            </n-flex>
          </n-flex>

          <!-- 未安装和下载中状态 -->
          <n-flex
            v-if="plugin.state === PluginEnum.NOT_INSTALLED || plugin.state === PluginEnum.DOWNLOADING"
            vertical
            justify="center"
            align="center"
            :size="8"
            class="box bg-[--button-bg-color]">
            <!-- 在下载中进度条 -->
            <n-flex
              @click="handleState(plugin)"
              align="center"
              class="relative"
              :class="[plugin.state === PluginEnum.DOWNLOADING ? 'downloading' : 'size-full']">
              <div
                :style="{
                  width: plugin.state === PluginEnum.DOWNLOADING ? `${plugin.progress * 0.6}px` : 'auto'
                }"
                :class="[
                  plugin.progress < 100 ? 'rounded-l-0 rounded-r-0' : 'rounded-2px',
                  plugin.progress > 0 ? 'h-40px border-(1px solid transparent)' : 'h-40px'
                ]"
                v-if="plugin.state === PluginEnum.DOWNLOADING"
                class="bg-var(--hula-brand-primary)">
                <p class="absolute-center text-(12px var(--hula-brand-primary))">{{ plugin.progress }}%</p>
              </div>

              <p v-else class="text-(12px [--chat-text-color] center) w-full">
                {{ t('home.plugins.actions.install') }}
              </p>
            </n-flex>
          </n-flex>

          <!-- 卸载中 -->
          <n-spin v-if="plugin.state === PluginEnum.UNINSTALLING" :stroke="'var(--hula-brand-primary)'" :size="22" />

          <!-- 插件操作 -->
          <n-popover
            v-if="plugin.state === PluginEnum.INSTALLED || index === isCurrently"
            :show="isCurrently === index"
            class="popover-no-padding"
            :show-arrow="false"
            trigger="click"
            placement="bottom">
            <template #trigger>
              <svg @click.stop="isCurrently = index" class="size-22px rotate-90">
                <use href="#more"></use>
              </svg>
            </template>

            <div class="action-item">
              <div class="menu-list">
                <div v-if="!plugin.isAdd" @click="handleAdd(plugin)" class="menu-item">
                  <svg class="color-brand"><use href="#add"></use></svg>
                  <p class="text-brand">{{ t('home.plugins.actions.pin') }}</p>
                </div>
                <div v-else @click="handleDelete(plugin)" class="menu-item">
                  <svg class="color-brand"><use href="#reduce"></use></svg>
                  <p class="text-brand">{{ t('home.plugins.actions.unpin') }}</p>
                </div>
                <div @click="handleUnload(plugin)" class="menu-item">
                  <svg><use href="#delete"></use></svg>
                  <p>{{ t('home.plugins.actions.uninstall') }}</p>
                </div>
              </div>
            </div>
          </n-popover>
        </n-flex>
      </template>
    </FloatBlockList>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { cloneDeep } from 'es-toolkit'
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { PluginEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config'
import { usePluginsStore } from '@/stores/plugins'

// Local interface for plugin state management (extends base PluginItem)
interface LocalPluginItem {
  url: string
  isAdd?: boolean
  state?: PluginEnum
  progress?: number
  [key: string]: unknown
}

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const pluginsStore = usePluginsStore()
const pluginsList = usePluginsList()
const plugins = computed(() => pluginsStore.plugins)
const isCurrently = ref(-1)
const allPlugins = ref<LocalPluginItem[]>([])
const pluginsLists = ref<LocalPluginItem[]>(cloneDeep(pluginsList.value) as LocalPluginItem[])

// 同步插件状态
const syncPlugins = (list: LocalPluginItem[]) =>
  list.map((item: LocalPluginItem) => {
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

const handleState = (plugin: LocalPluginItem) => {
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

const handleUnload = (plugin: LocalPluginItem) => {
  plugin.state = PluginEnum.UNINSTALLING
  setTimeout(() => {
    handleDelete(plugin)
    plugin.state = PluginEnum.NOT_INSTALLED
    plugin.progress = 0
    pluginsStore.removePlugin(plugin)
  }, 2000)
}

const handleDelete = (p: LocalPluginItem) => {
  const plugin = plugins.value.find((i) => i.url === p.url)
  if (plugin) {
    setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: false })
      p.isAdd = false
      emitTo(appWindow.label, 'startResize')
    }, 300)
  }
}

const handleAdd = (p: LocalPluginItem) => {
  const plugin = plugins.value.find((i) => i.url === p.url)
  if (plugin) {
    setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: true })
      p.isAdd = true
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
    pluginsLists.value = cloneDeep(latest) as LocalPluginItem[]
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

.popover-no-padding {
  padding: 0;
}

.box {
  @apply relative select-none cursor-pointer size-fit w-60px h-40px rounded-8px overflow-hidden;
  transition: all 0.2s;
}

.downloading {
  width: 60px;
  background: var(--progress-bg);
}

.action-item {
  @include menu-item-style();
  left: -80px;
  @include menu-list();
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
