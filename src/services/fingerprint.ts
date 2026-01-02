// @fingerprintjs/fingerprintjs已移除，暂时禁用指纹识别功能
// import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { getOSType } from '@/utils/PlatformConstants'
import { logger } from '@/utils/logger'

//

// 创建 Worker 实例
//

// 添加一个 Promise 来追踪正在进行的指纹生成
//

/**
 * 获取性能优化的跨平台设备指纹
 */
export const getEnhancedFingerprint = async (): Promise<string> => {
  // @fingerprintjs/fingerprintjs已移除，返回简单标识
  logger.warn('[fingerprint] FingerprintJS disabled due to dependency removal')

  // 生成简单的设备标识作为替代
  const deviceInfo = {
    platform: getOSType(),
    userAgent: navigator.userAgent.substring(0, 50),
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  // 生成简单的hash作为指纹
  const fingerprint = btoa(JSON.stringify(deviceInfo))
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 16)
  return fingerprint
}
