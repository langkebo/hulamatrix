import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { ConfigType } from '@/services/types'
import { logger } from '@/utils/logger'

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

  /**
   * 初始化配置
   * init_config WebSocket API 已移除
   * Matrix 配置通过 Account Data API 或本地存储管理
   */
  const initConfig = async () => {
    // 配置初始化已移除 - 不再从老后端获取配置
    // Matrix 配置通过以下方式管理:
    // 1. 本地存储 (localStorage/IndexedDB)
    // 2. Matrix Account Data API
    // 3. 环境变量
    logger.warn('[ConfigStore] initConfig called, but init_config API removed')
  }

  /** 获取七牛配置（已废弃） */
  const getQiNiuConfig = () => {
    logger.warn('[ConfigStore] getQiNiuConfig called, but Qiniu is deprecated')
    return config.value.qiNiu
  }

  return { config, initConfig, getQiNiuConfig }
})
