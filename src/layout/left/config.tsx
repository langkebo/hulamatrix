import type { MenuItem, PluginItem } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MittEnum, ModalEnum, PluginEnum } from '@/enums'
import { useLogin } from '@/hooks/useLogin'
import { useMitt } from '@/hooks/useMitt'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { leftHook } from './hook'

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
  const { logout, resetLoginState } = useLogin()
  const { pageJumps } = leftHook()

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
      click: () => {
        // ✅ 使用路由导航而不是创建新窗口
        pageJumps('settings')
      }
    },
    {
      label: t('menu.about'),
      icon: 'info',
      click: () => {
        // ✅ 使用路由导航而不是创建新窗口
        pageJumps('about')
      }
    },
    {
      label: t('menu.sign_out'),
      icon: 'power',
      click: async () => {
        try {
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
