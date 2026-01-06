/**
 * Matrix Friends SDK 统一导出
 *
 * @module sdk/matrix-friends
 */

// ==================== 类型导出 ====================
export * from './types'

// ==================== 类导出 ====================
export { MatrixFriendsApiExtension } from './FriendsApiExtension'

// ==================== 工厂函数导出 ====================
export {
  createEnhancedMatrixClient,
  createClientFromToken,
  extendMatrixClient,
  isFriendsApiEnabled,
  type EnhancedMatrixClient,
  type EnhancedMatrixClientConfig
} from './factory'

// ==================== 工具函数导出 ====================
export * from './utils'

// ==================== 默认导出 ====================
import { MatrixFriendsApiExtension } from './FriendsApiExtension'
export default MatrixFriendsApiExtension
