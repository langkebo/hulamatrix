import { computed } from 'vue'
import { defineStore } from 'pinia'
import { PluginEnum, StoresEnum } from '@/enums'
import { useI18n } from 'vue-i18n'

/** Menu item configuration */
interface MenuItem {
  url: string
  icon: string
  iconAction?: string
  state?: PluginEnum
  isAdd?: boolean
  dot?: boolean
  progress?: number
  miniShow?: boolean
  title?: string
  shortTitle?: string
  badge?: number | { count?: number; dot?: boolean }
  window?: { resizable?: boolean }
  size?: unknown
  tip?: string
  id?: string
  label?: string
}

export const useMenuTopStore = defineStore(
  StoresEnum.MENUTOP,
  () => {
    const { t } = useI18n()
    // 初始配置，文案由 i18n 动态注入，确保语言切换实时更新
    const baseMenuTop: MenuItem[] = [
      {
        url: 'message',
        icon: 'message',
        iconAction: 'message-action',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      },
      {
        url: 'friendsList',
        icon: 'avatar',
        iconAction: 'avatar-action',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      }
    ]

    const menuTop = computed<MenuItem[]>(() => [
      {
        ...baseMenuTop[0],
        title: t('home.action.message'),
        shortTitle: t('home.action.message_short_title')
      },
      {
        ...baseMenuTop[1],
        title: t('home.action.contact'),
        shortTitle: t('home.action.contact_short_title')
      }
    ])

    return {
      menuTop
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
