import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { ConfigType } from '@/services/types'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'

/** Default configuration values */
const DEFAULT_CONFIG: ConfigType = {
  logo: '',
  name: '',
  qiNiu: {
    ossDomain: '',
    fragmentSize: '4',
    turnSharSize: '100'
  },
  roomGroupId: ''
}

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<ConfigType>(DEFAULT_CONFIG)

  /** 初始化配置 */
  const initConfig = async () => {
    const res = (await requestWithFallback({
      url: 'init_config'
    })) as ConfigType
    config.value = { ...DEFAULT_CONFIG, ...res }
  }

  /** 获取七牛配置 */
  const getQiNiuConfig = () => config.value.qiNiu

  return { config, initConfig, getQiNiuConfig }
})
