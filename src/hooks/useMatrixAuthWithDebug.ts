/**
 * 增强的 Matrix 认证 Hook，包含调试功能
 *
 * @deprecated 此 Hook 已合并到 useMatrixAuth.ts
 * 请使用 `useMatrixAuth({ enableDebug: true })` 代替
 *
 * 迁移指南：
 * - 旧方式: `const { loginMatrix } = useMatrixAuthWithDebug({ enableDebug: true })`
 * - 新方式: `const { loginMatrix } = useMatrixAuth({ enableDebug: true })`
 *
 * 所有功能已整合到 `useMatrixAuth`，包括：
 * - enableDebug - 启用调试模式
 * - loginTimeout - 登录超时
 * - maxRetries - 最大重试次数
 * - verboseLogging - 详细日志
 * - testServerConnection - 测试服务器连接
 */

import { useMatrixAuth } from './useMatrixAuth'
import { logger } from '@/utils/logger'

interface MatrixLoginOptions {
  enableDebug?: boolean
  timeout?: number
}

/**
 * @deprecated 使用 useMatrixAuth 代替
 */
export const useMatrixAuthWithDebug = (options: MatrixLoginOptions = {}) => {
  // 显示废弃警告
  logger.warn('[useMatrixAuthWithDebug] 已废弃，请使用 useMatrixAuth')

  // 返回新的 useMatrixAuth，转换选项格式
  return useMatrixAuth({
    enableDebug: options.enableDebug,
    loginTimeout: options.timeout,
    // 保留默认值
    maxRetries: 2,
    verboseLogging: false
  })
}
