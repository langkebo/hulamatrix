import type { MenuItem, PluginItem } from '@/types'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { MittEnum, ModalEnum, PluginEnum } from '@/enums'
import { useLogin } from '@/hooks/useLogin'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import { useSettingStore } from '@/stores/setting'
import * as ImRequestUtils from '@/utils/ImRequestUtils'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

/**
 * 这里的顶部的操作栏使用pinia写入了localstorage中
 */

/** 下半部分操作栏配置 */
const baseItemsBottom: PluginItem[] = [
  {
    url: 'fileManager',
    icon: 'file',
    iconAction: 'file-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: false
    }
  },
  {
    url: 'mail',
    icon: 'collect',
    iconAction: 'collect-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: true
    }
  }
]

const useItemsBottom = () =>
  (() => {
    const { t } = useI18n()
    return computed<PluginItem[]>(() => [
      {
        ...baseItemsBottom[0]!,
        title: t('home.action.file_manager'),
        shortTitle: t('home.action.file_manager_short_title')
      },
      {
        ...baseItemsBottom[1]!,
        title: t('home.action.favorite'),
        shortTitle: t('home.action.favorite_short_title')
      }
    ])
  })()

/** 设置列表菜单项 */
const useMoreList = () => {
  const { t } = useI18n()
  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const { login } = storeToRefs(settingStore)
  const { logout, resetLoginState } = useLogin()

  return computed<MenuItem[]>(() => [
    {
      label: t('menu.lock_screen'),
      icon: 'lock',
      click: () => {
        useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
          type: ModalEnum.LOCK_SCREEN
        })
      }
    },
    {
      label: t('menu.settings'),
      icon: 'settings',
      click: async () => {
        await createWebviewWindow('设置', 'settings', 840, 840)
      }
    },
    {
      label: t('menu.about'),
      icon: 'info',
      click: async () => {
        await createWebviewWindow('关于', 'about', 360, 480)
      }
    },
    {
      label: t('menu.sign_out'),
      icon: 'power',
      click: async () => {
        try {
          await ImRequestUtils.logout({ autoLogin: login.value.autoLogin })
          await resetLoginState()
          await logout()
        } catch (error) {
          logger.error('退出登录失败:', error)
          msg.error('退出登录失败，请重试')
        }
      }
    }
  ])
}

/** 插件列表 */
const basePluginsList: PluginItem[] = [
  {
    url: 'rooms/manage',
    icon: 'rectangle-small',
    iconAction: 'rectangle-small',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    size: {
      width: 600,
      height: 800
    },
    window: undefined,
    miniShow: false
  }
]

const usePluginsList = () =>
  (() => {
    return computed<PluginItem[]>(() => [
      {
        ...basePluginsList[0]!,
        title: '房间',
        shortTitle: '房间'
      }
    ])
  })()

export { useItemsBottom, useMoreList, usePluginsList }
