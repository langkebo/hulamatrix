/**
 * Matrix 账户状态检查服务
 * 用于检查用户是否已有 Matrix 账户，并提供注册建议
 */

import { logger } from '@/utils/logger'

// 带超时的 fetch 封装（本地实现）
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

export interface MatrixAccountStatus {
  exists: boolean
  suggestedAction: 'login' | 'register' | 'none'
  reason?: string
}

export interface AccountCheckResult {
  username: string
  exists: boolean
  suggestedAction: 'login' | 'register' | 'none'
  canRegister: boolean
  registrationFlows?: string[]
}

/**
 * 检查 Matrix 账户是否存在
 * 通过查询用户的 profile 来判断
 */
export async function checkMatrixAccountExists(baseUrl: string, username: string): Promise<boolean> {
  if (!baseUrl) {
    logger.warn('[MatrixAccountCheck] No base URL provided')
    return false
  }

  // 规范化用户名格式
  const normalizedUsername = username.startsWith('@') ? username : `@${username}`

  try {
    // 尝试查询用户 profile
    const url = `${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/profile/${encodeURIComponent(normalizedUsername)}`

    const response = await fetchWithTimeout(url, { method: 'GET' }, 5000)

    // 如果返回 200 OK，用户存在
    // 如果返回 404 NOT FOUND，用户不存在
    // 其他状态码视为检查失败
    return response.ok
  } catch (e) {
    logger.debug('[MatrixAccountCheck] Profile check failed:', e)
    return false
  }
}

/**
 * 检查用户名是否可用于注册
 */
export async function checkUsernameAvailability(baseUrl: string, username: string): Promise<boolean> {
  if (!baseUrl) {
    logger.warn('[MatrixAccountCheck] No base URL provided')
    return false
  }

  // 只使用 localpart（去掉 @ 和 :server 部分）
  const localpart = username.startsWith('@') ? username.split(':')[0].slice(1) : username.split(':')[0]

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/register/available?username=${encodeURIComponent(localpart)}`

    const response = await fetchWithTimeout(url, { method: 'GET' }, 5000)

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.available === true
  } catch (e) {
    logger.debug('[MatrixAccountCheck] Availability check failed:', e)
    return false
  }
}

/**
 * 获取支持的注册流程
 */
export async function getRegistrationFlows(baseUrl: string): Promise<string[]> {
  if (!baseUrl) {
    return []
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/register`

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      },
      5000
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const flows = data?.flows || []

    return flows.map((f: { type?: string }) => f?.type).filter(Boolean)
  } catch (e) {
    logger.debug('[MatrixAccountCheck] Failed to get registration flows:', e)
    return []
  }
}

/**
 * 综合检查 Matrix 账户状态
 * 返回建议的操作（登录或注册）
 */
export async function checkMatrixAccountStatus(baseUrl: string, username: string): Promise<AccountCheckResult> {
  logger.info('[MatrixAccountCheck] Checking account status for:', username)

  // 1. 检查账户是否存在
  const exists = await checkMatrixAccountExists(baseUrl, username)

  // 2. 检查用户名是否可用于注册
  const canRegister = await checkUsernameAvailability(baseUrl, username)

  // 3. 获取注册流程
  const registrationFlows = await getRegistrationFlows(baseUrl)

  // 4. 确定建议的操作
  let suggestedAction: 'login' | 'register' | 'none'

  if (exists) {
    suggestedAction = 'login'
    logger.info('[MatrixAccountCheck] Account exists, suggest login')
  } else if (canRegister && registrationFlows.length > 0) {
    suggestedAction = 'register'
    logger.info('[MatrixAccountCheck] Username available, suggest register')
  } else {
    suggestedAction = 'none'
    logger.warn('[MatrixAccountCheck] Cannot determine action')
  }

  return {
    username,
    exists,
    suggestedAction,
    canRegister,
    registrationFlows
  }
}

/**
 * 为登录流程提供 Matrix 账户检查
 * 在用户输入用户名后自动检查
 */
export async function suggestActionForLogin(baseUrl: string, username: string): Promise<MatrixAccountStatus> {
  try {
    const result = await checkMatrixAccountStatus(baseUrl, username)

    let reason: string | undefined

    if (result.suggestedAction === 'login') {
      reason = '检测到您已有 Matrix 账户，将直接登录'
    } else if (result.suggestedAction === 'register') {
      reason = '检测到您还没有 Matrix 账户，建议先注册'
    } else {
      reason = '无法连接到 Matrix 服务器'
    }

    return {
      exists: result.exists,
      suggestedAction: result.suggestedAction,
      reason
    }
  } catch (e) {
    logger.error('[MatrixAccountCheck] Failed to check account status:', e)
    return {
      exists: false,
      suggestedAction: 'none',
      reason: '账户状态检查失败，请稍后重试'
    }
  }
}

/**
 * 生成友好的错误消息
 */
export function getLoginErrorMessage(errCode: string | null, hasMatrixAccount: boolean | null): string {
  const messages: Record<string, string> = {
    M_FORBIDDEN: hasMatrixAccount
      ? '用户名或密码错误，请检查后重试'
      : '用户名或密码错误。如果您还没有 Matrix 账户，请先注册。',
    M_INVALID_USERNAME: '用户名格式错误，应为 @用户名:服务器 格式',
    TIMEOUT: '登录超时，请检查网络连接后重试',
    NETWORK: 'Matrix 服务器不可用，请检查网络连接或联系管理员',
    M_LIMIT_EXCEEDED: '登录尝试次数过多，请稍后重试'
  }

  return messages[errCode || ''] || '登录失败，请稍后重试'
}
