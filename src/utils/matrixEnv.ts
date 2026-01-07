import { getHomeserverUrl } from '@/config/matrix-config'

/**
 * Vite 环境变量接口
 */
interface ViteEnv {
  VITE_MATRIX_SERVER_NAME?: string
  VITE_MATRIX_HOMESERVER?: string
  VITE_MATRIX_BASE_URL?: string
  VITE_MATRIX_ACCESS_TOKEN?: string
  VITE_MATRIX_USER_ID?: string
  [key: string]: string | undefined
}

/**
 * 获取 Matrix 服务器名称（域名）
 * 用于服务发现
 */
export function getMatrixServerName(): string {
  const env = (import.meta.env || {}) as ViteEnv
  const v = env.VITE_MATRIX_SERVER_NAME || ''
  return String(v).trim() || 'cjystx.top'
}

/**
 * 获取已发现的 homeserver URL
 * 注意：此函数返回缓存的 URL，如果未执行服务发现则返回空字符串
 * 推荐使用 getOrDiscoverHomeserver() 异步函数
 */
export function getMatrixBaseUrl(): string {
  // 优先使用已发现的 URL
  const discovered = getHomeserverUrl()
  if (discovered) return discovered

  // 注意：不再回退到 VITE_MATRIX_BASE_URL
  // 这样可以强制使用服务发现，确保通过 .well-known 获取正确的 homeserver
  // 如果需要直接指定 homeserver（不推荐），应该设置 VITE_MATRIX_HOMESERVER
  const env = (import.meta.env || {}) as ViteEnv
  const v = env.VITE_MATRIX_HOMESERVER || ''
  return String(v).trim()
}

/**
 * 获取 Matrix 认证令牌（仅用于开发测试）
 */
export function getMatrixTokens() {
  const env = (import.meta.env || {}) as ViteEnv
  const accessToken = String(env.VITE_MATRIX_ACCESS_TOKEN || '').trim()
  const userId = String(env.VITE_MATRIX_USER_ID || '').trim()
  return { accessToken, userId }
}
