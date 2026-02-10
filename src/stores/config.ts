import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { ConfigType } from '@/services/types'
import { SystemConfigApi } from '@/services/api'

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<ConfigType>({} as any)

  /** 初始化配置 */
  const initConfig = async () => {
    const res = await SystemConfigApi.initConfig()
    config.value = res.data as ConfigType
  }

  /** 获取七牛配置 */
  const getQiNiuConfig = () => config.value.qiNiu

  return { config, initConfig, getQiNiuConfig }
})
