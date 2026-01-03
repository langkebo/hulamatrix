<template>
  <div ref="actionList" class="flex-1 mt-20px flex-col-x-center justify-between" data-tauri-drag-region>
    <!-- 上部分操作栏 -->
    <header ref="header" class="flex-col-x-center gap-10px color-[--left-icon-color]">
      <div
        v-for="(item, index) in menuTopProcessed"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, { resizable: !!item.window?.resizable })"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} 已打开</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <!-- 消息提示 -->
        <n-badge
          v-if="item.url === 'message'"
          :max="99"
          :value="unReadMark.newMsgUnreadCount"
          :show="unReadMark.newMsgUnreadCount > 0">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <!-- 好友提示 -->
        <n-badge v-if="item.url === 'friendsList'" :max="99" :value="unreadApplyCount" :show="unreadApplyCount > 0">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-(10px center)">
          {{ item.shortTitle }}
        </p>
      </div>

      <div
        v-for="(item, index) in noMiniShowPlugins"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, { resizable: !!item.window?.resizable })"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="typeof item.badge === 'object' ? (item.badge?.count ?? 0) : (item.badge ?? 0)">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} 已打开</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="typeof item.badge === 'object' ? (item.badge?.count ?? 0) : (item.badge ?? 0)" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <n-badge
          v-else
          :max="99"
          :value="getBadgeValue(item.badge)"
          :show="getBadgeValue(item.badge) > 0">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-(10px center)">
          {{ item.shortTitle }}
        </p>
        <!-- 创建空间按钮：放在房间按钮下方，仅悬停显示文案 -->
        <div v-if="item.url === 'rooms' || item.title === '房间'" class="top-action flex-col-center p-[6px_8px]">
          <n-tooltip trigger="hover" placement="right">
            <template #trigger>
              <svg class="size-22px" @click.stop="emitCreateSpace">
                <use href="#plus"></use>
              </svg>
            </template>
            <span>创建空间</span>
          </n-tooltip>
        </div>
      </div>

      <!-- (独立)菜单选项 -->
      <div
        :class="showMode === ShowModeEnum.ICON ? 'top-action p-[6px_8px]' : 'top-action w-46px py-4px flex-col-center'">
        <n-popover
          style="padding: 8px; margin-left: 4px; background: var(--bg-setting-item)"
          :show-arrow="false"
          trigger="hover"
          placement="right">
          <template #trigger>
            <svg class="size-22px">
              <use href="#menu"></use>
            </svg>
          </template>
          <div v-if="miniShowPlugins.length">
            <n-flex
              v-for="(item, index) in miniShowPlugins"
              :key="'excess-' + index"
              @click="pageJumps(item.url, item.title, item.size, { resizable: !!item.window?.resizable })"
              class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
              :size="5">
              <svg class="size-16px" @click="tipShow = false">
                <use :href="`#${item.icon}`"></use>
              </svg>
              {{ item.title }}
            </n-flex>
          </div>
          <n-flex
            @click="menuShow = true"
            class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
            :size="5">
            <svg class="size-16px">
              <use href="#settings"></use>
            </svg>
            <!-- <span class="select-none">插件管理</span> -->
            {{ t('home.action.plugin_manage') }}
          </n-flex>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-(10px center)">{{ t('home.action.plugin') }}</p>
      </div>
    </header>

    <!-- 下部分操作栏 -->
    <footer class="flex-col-x-center mt-10px gap-10px color-[--left-icon-color] select-none">
      <div
        v-for="(item, index) in itemsBottom"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'bottom-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, getWindowConfig(item.window))"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="getBadgeValue(item.badge)">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} 已打开</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="getBadgeValue(item.badge)">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="tipShow = false" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <n-badge v-else :max="99" :value="getBadgeValue(item.badge)">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="menu-text text-(10px center)">
          {{ item.shortTitle }}
        </p>
      </div>

      <!--  更多选项面板  -->
      <div :title="t('home.action.more')" :class="{ 'bottom-action py-4px': showMode === ShowModeEnum.TEXT }">
        <n-popover
          v-model:show="settingShow"
          style="padding: 0; background: transparent; user-select: none"
          :show-arrow="false"
          trigger="click">
          <template #trigger>
            <svg
              :class="[
                { 'color-[--left-active-hover]': settingShow },
                showMode === ShowModeEnum.ICON ? 'more p-[6px_8px]' : 'w-46px'
              ]"
              class="size-22px relative"
              @click="settingShow = !settingShow">
              <use :href="settingShow ? '#hamburger-button-action' : '#hamburger-button'"></use>
            </svg>
          </template>
          <div class="setting-item">
            <div class="menu-list">
              <div v-for="(item, index) in moreList" :key="index">
                <div class="menu-item" @click="() => item.click()">
                  <svg>
                    <use :href="`#${item.icon}`"></use>
                  </svg>
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-(10px center)">{{ t('home.action.more') }}</p>
      </div>
    </footer>
  </div>

  <DefinePlugins v-model="menuShow" />
</template>
<script setup lang="ts">
import { TIME_INTERVALS } from '@/constants'
import { ref, computed, watch, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { PluginEnum, ShowModeEnum } from '@/enums'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useGlobalStore } from '@/stores/global'
// 迁移: useMenuTopStore → useMenuTopStoreCompat (兼容层)
import { useMenuTopStoreCompat as useMenuTopStore, type MenuTopItem } from '@/stores/compatibility'
import { usePluginsStore } from '@/stores/plugins'
import { useSettingStore } from '@/stores/setting'
// REMOVED: useFeedStore - Moments/Feed feature removed (custom backend no longer supported)
import { useItemsBottom, useMoreList } from '@/layout/left/config'
import { leftHook } from '@/layout/left/hook'
import DefinePlugins from './definePlugins/index.vue'
import { useI18n } from 'vue-i18n'
import type { PluginBadge, PluginItem, PluginWindowConfig } from '@/types'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'

// WebWindowLike interface for cross-platform compatibility
interface WebWindowLike {
  label: string
  listen?: () => UnlistenFn | Promise<UnlistenFn>
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const appWindow = isTauri
  ? WebviewWindow.getCurrent()
  : ({ label: 'web', listen: async () => () => {} } as WebWindowLike)
const { addListener } = useTauriListener()
const globalStore = useGlobalStore()
const pluginsStore = usePluginsStore()
// REMOVED: feedStore - Moments/Feed feature removed
const showMode = computed(() => useSettingStore().showMode)
const menuTop = computed(() => useMenuTopStore().menuTop)
const menuTopProcessed = computed(() => {
  return (menuTop.value || []).map((i: MenuTopItem) => {
    const badgeVal = typeof i.badge === 'object' && i.badge ? ((i.badge as PluginBadge).count ?? 0) : (i.badge ?? 0)
    const dotVal = i.dot ?? (typeof i.badge === 'object' && i.badge ? ((i.badge as PluginBadge).dot ?? false) : false)
    return {
      badge: badgeVal,
      tip: '',
      dot: dotVal,
      shortTitle: i.shortTitle ?? i.title,
      window: { resizable: false },
      size: undefined,
      icon: i.icon,
      iconAction: i.iconAction,
      title: i.title,
      url: i.url,
      state: i.state
    }
  })
})
const itemsBottom = useItemsBottom()
const plugins = computed(() => pluginsStore.plugins)
// REMOVED: unreadCount - Moments/Feed feature removed
const { t } = useI18n()
const unReadMark = computed(() => globalStore.unReadMark)
// const headerRef = useTemplateRef('header')
// const actionListRef = useTemplateRef('actionList')
//const { } = toRefs(getCurrentInstance) // 所有菜单的外层div
const menuShow = ref(false)
const moreList = useMoreList()
// 显示在菜单的插件
const activePlugins = computed(() => {
  return plugins.value.filter((i: PluginItem) => i.isAdd)
})
// 显示在菜单外的插件
const noMiniShowPlugins = computed(() => {
  return activePlugins.value.filter((i: PluginItem) => !i.miniShow)
})
// 显示在菜单内的插件
const miniShowPlugins = computed(() => {
  return activePlugins.value.filter((i: PluginItem) => i.miniShow)
})
const { activeUrl, openWindowsList, settingShow, tipShow, pageJumps } = leftHook()
const emitCreateSpace = () => {
  useMitt.emit(MittEnum.SHOW_CREATE_SPACE_MODAL)
}

/** 获取徽章数值 */
const getBadgeValue = (badge: number | string | PluginBadge | undefined): number => {
  if (typeof badge === 'object') {
    return badge.count ?? 0
  }
  return typeof badge === 'number' ? badge : 0
}

/** 获取窗口配置 */
const getWindowConfig = (window?: PluginWindowConfig): { resizable: boolean } | undefined => {
  if (!window) return undefined
  return { resizable: window.resizable ?? false }
}

const handleTipShow = (item: { dot?: boolean; url: string }) => {
  tipShow.value = false
  item.dot = false
}

const unreadApplyCount = computed(() => {
  return globalStore.unReadMark.newFriendUnreadCount + globalStore.unReadMark.newGroupUnreadCount
})

const startResize = () => {
  window.dispatchEvent(new Event('resize'))
}

const handleResize = async (e: Event) => {
  const windowHeight = (e.target as Window).innerHeight
  const menuDivHeight = showMode.value === ShowModeEnum.TEXT ? 46 : 34
  const spaceHeight = 10
  const newMenuHeight = menuDivHeight + spaceHeight
  const headerTopHeight = 120
  const bottomPadding = 15
  const randomHeight = 3 // 插件菜单的高度比其他菜单高2.66666666667
  const staticMenuNum = 2
  const menuNum = Math.floor(
    (windowHeight -
      (menuTop.value.length + noMiniShowPlugins.value.length + itemsBottom.value.length + staticMenuNum) *
        menuDivHeight -
      (menuTop.value.length + noMiniShowPlugins.value.length + itemsBottom.value.length + staticMenuNum - 1) *
        spaceHeight -
      headerTopHeight -
      bottomPadding -
      randomHeight) /
      newMenuHeight
  )
  if (menuNum < 0) {
    noMiniShowPlugins.value.map((i, index) => {
      if (index >= noMiniShowPlugins.value.length + menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: true })
      }
    })
  } else if (menuNum >= 0 && miniShowPlugins.value.length > 0) {
    miniShowPlugins.value.map((i, index) => {
      if (index < menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: false })
      }
    })
  }
}

/** 调整主界面高度 */
const setHomeHeight = () => {
  if (!isTauri) return
  invoke('set_height', { height: showMode.value === ShowModeEnum.TEXT ? 505 : 423 })
}

// REMOVED: Watch for feed unreadCount - Moments/Feed feature removed (custom backend no longer supported)

onMounted(async () => {
  // 初始化窗口高度
  setHomeHeight()

  // 监听窗口大小变化事件，处理菜单收起
  window.addEventListener('resize', handleResize)

  // 触发一次resize事件，调整插件菜单的显示
  startResize()

  // 监听自定义事件，处理设置中菜单显示模式切换和添加插件后，导致高度变化，需重新调整插件菜单显示
  if (isTauri) {
    const listenFn = appWindow.listen
    if (listenFn) {
      await addListener(
        Promise.resolve(
          listenFn('startResize', () => {
            startResize()
          })
        ),
        'startResize'
      )
    }
  }

  if (tipShow.value) {
    menuTop.value.forEach((item: MenuTopItem) => {
      if (item.state !== String(PluginEnum.BUILTIN)) {
        item.dot = true
      }
    })
  }
  /** 十秒后关闭提示 */
  setTimeout(() => {
    tipShow.value = false
  }, TIME_INTERVALS.MESSAGE_RETRY_DELAY)
})
</script>
<style lang="scss" scoped>
@use '../style';

.setting-item {
  left: 24px;
  bottom: -40px;
}
</style>
