import { getVersion } from '@tauri-apps/api/app'
import { check } from '@tauri-apps/plugin-updater'
import { useSettingStore } from '@/stores/setting'
import { isMobile } from '@/utils/PlatformConstants'
import { logger } from '@/utils/logger'

/**
 * 检查更新
 */
export const useCheckUpdate = () => {
  const settingStore = useSettingStore()
  // 检查更新周期
  const CHECK_UPDATE_TIME = 30 * 60 * 1000
  // 在未登录情况下缩短检查周期
  const CHECK_UPDATE_LOGIN_TIME = 5 * 60 * 1000
  const isProduction = import.meta.env.PROD && !isMobile()
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

  /**
   * 检查更新
   * @param closeWin 需要关闭的窗口
   * @param initialCheck 是否是初始检查，默认为false。初始检查时只显示强制更新提示，不显示普通更新提示
   */
  const checkUpdate = async (_closeWin: string, initialCheck: boolean = false) => {
    if (!isTauri) return
    await check()
      .then(async (e) => {
        if (!e?.available) {
          return
        }

        const newVersion = e.version
        const newMajorVersion = newVersion.substring(0, newVersion.indexOf('.'))
        const newMiddleVersion = newVersion.substring(
          newVersion.indexOf('.') + 1,
          newVersion.lastIndexOf('.') === -1 ? newVersion.length : newVersion.lastIndexOf('.')
        )
        const currentVersion = await getVersion()
        const currentMajorVersion = currentVersion.substring(0, currentVersion.indexOf('.'))
        const currentMiddleVersion = currentVersion.substring(
          currentVersion.indexOf('.') + 1,
          currentVersion.lastIndexOf('.') === -1 ? currentVersion.length : currentVersion.lastIndexOf('.')
        )
        const requireForceUpdate =
          isProduction &&
          (newMajorVersion > currentMajorVersion ||
            (newMajorVersion === currentMajorVersion && newMiddleVersion > currentMiddleVersion))
        if (requireForceUpdate) {
          // Auto-update feature removed - DO_UPDATE event disabled
          // useMitt.emit(MittEnum.DO_UPDATE, { close: closeWin })
          logger.info('Update available but auto-update is disabled:', newVersion)
        } else if (newVersion !== currentVersion && settingStore.update?.dismiss !== newVersion && !initialCheck) {
          // Auto-update feature removed - CHECK_UPDATE event disabled
          // useMitt.emit(MittEnum.CHECK_UPDATE)
          logger.info('Update available but auto-update is disabled:', newVersion)
        }
      })
      .catch((error) => {
        logger.error('Check update failed', error, 'useCheckUpdate')
      })
  }

  return {
    checkUpdate,
    CHECK_UPDATE_TIME,
    CHECK_UPDATE_LOGIN_TIME
  }
}
