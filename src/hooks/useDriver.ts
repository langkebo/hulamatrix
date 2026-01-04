import { logger } from '@/utils/logger'
// driver.js依赖已移除，暂时禁用用户引导功能
//
//
// import 'driver.js/dist/driver.css'
// import '@/styles/scss/global/driver.scss'

/**
 * Driver.js 步骤配置接口
 */
export interface DriverStepConfig {
  element: string
  /** 是否禁用被聚焦元素的交互（步骤级别配置，会覆盖全局配置） */
  disableActiveInteraction?: boolean
  popover?: {
    title?: string
    description?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    onNextClick?: () => void
    onPrevClick?: () => void
    onCloseClick?: () => void
    onDestroyed?: () => void
  }
}

/**
 * Driver.js 配置选项接口
 */
export interface DriverConfig {
  nextBtnText?: string
  prevBtnText?: string
  doneBtnText?: string
  showButtons?: Array<'next' | 'previous' | 'close'>
  showProgress?: boolean
  allowClose?: boolean
  popoverClass?: string
  progressText?: string
  /** 是否禁用被聚焦元素的交互（点击事件等） */
  disableActiveInteraction?: boolean
}

/**
 * useDriver hooks 返回值接口
 */
export interface UseDriverReturn {
  /** Driver 实例 (null since driver.js is disabled) */
  driverInstance: unknown
  /** 开始引导 */
  startTour: () => void
  /** 停止引导 */
  stopTour: () => void
  /** 移动到下一步 */
  moveNext: () => void
  /** 移动到上一步 */
  movePrevious: () => void
  /** 移动到指定步骤 */
  moveTo: (stepIndex: number) => void
  /** 重新初始化引导 */
  reinitialize: (newSteps: DriverStepConfig[], newConfig?: Partial<DriverConfig>) => void
}

/**
 * Driver.js 引导功能 hooks
 * @param steps 引导步骤配置数组
 * @param config 可选的 Driver 配置
 * @returns useDriver 返回值对象
 */
export const useDriver = (_steps: DriverStepConfig[] = [], _config: DriverConfig = {}): UseDriverReturn => {
  // driver.js已禁用，返回空实现
  // 强制禁用引导功能
  logger.debug('[useDriver] Driver.js已禁用，用户引导功能暂时不可用')

  // 空实现
  const emptyMethod = () => {
    // 静默调用，不输出日志
  }

  const emptyMethods: UseDriverReturn = {
    driverInstance: null,
    startTour: emptyMethod,
    stopTour: emptyMethod,
    moveNext: emptyMethod,
    movePrevious: emptyMethod,
    moveTo: emptyMethod,
    reinitialize: emptyMethod
  }

  return emptyMethods
}
