import type { PluginItem } from '@/types'
import { onBeforeMount, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { PluginEnum, StoresEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config'

export const usePluginsStore = defineStore(
  StoresEnum.PLUGINS,
  () => {
    const pluginsList = usePluginsList()
    /** 插件内容 */
    const plugins = ref<PluginItem[]>(pluginsList.value.filter((p) => p.state === PluginEnum.BUILTIN))
    /** 插件查看模式 */
    const viewMode = ref<string>('card')

    /**
     * 设置插件
     * @param newPlugin 插件数据
     */
    const addPlugin = (newPlugin: PluginItem) => {
      const index = plugins.value.findIndex((i) => i.url === newPlugin.url)
      index === -1 && plugins.value.push(newPlugin)
    }

    /**
     * 删除插件
     * @param p 插件数据
     */
    const removePlugin = (p: PluginItem) => {
      const index = plugins.value.findIndex((i) => i.url === p.url)
      plugins.value.splice(index, 1)
    }

    /**
     * 更新插件状态
     * @param p 插件
     */
    const updatePlugin = (p: PluginItem) => {
      const index = plugins.value.findIndex((i) => i.url === p.url)
      index !== -1 && (plugins.value[index] = p)
    }

    const syncPluginsWithLocale = (latest: PluginItem[]) => {
      plugins.value = plugins.value.map((plugin) => {
        const updated = latest.find((p) => p.url === plugin.url)
        if (!updated) return plugin
        const next: PluginItem = {
          ...plugin,
          title: updated.title
        }
        if (updated.shortTitle !== undefined) {
          next.shortTitle = updated.shortTitle
        }
        return next
      })
    }

    watch(pluginsList, (latest) => syncPluginsWithLocale(latest as PluginItem[]), { immediate: true })

    onBeforeMount(() => {
      // 读取本地存储的插件数据
      if (localStorage.getItem(StoresEnum.PLUGINS)) {
        plugins.value = []
        const cachedData = JSON.parse(localStorage.getItem(StoresEnum.PLUGINS)!)
        cachedData['plugins']?.forEach((item: PluginItem) => plugins.value.push(item))
        syncPluginsWithLocale(pluginsList.value)
        // 迁移：将历史的"动态/社区"插件改为房间管理入口
        let migrated = false
        plugins.value = plugins.value.map((p) => {
          if (p.url === 'dynamic' || p.icon === 'fire') {
            migrated = true
            return {
              ...p,
              url: 'spaces',
              icon: 'rectangle-small',
              iconAction: 'rectangle-small',
              title: '空间',
              shortTitle: '空间',
              window: undefined
            } as PluginItem
          }
          return p
        })
        if (migrated) {
          try {
            const cached = JSON.parse(localStorage.getItem(StoresEnum.PLUGINS)!)
            cached.plugins = plugins.value
            localStorage.setItem(StoresEnum.PLUGINS, JSON.stringify(cached))
          } catch {}
        }
      }
    })

    return {
      plugins,
      viewMode,
      addPlugin,
      removePlugin,
      updatePlugin
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
