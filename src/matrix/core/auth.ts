import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'

/**
 * 访问令牌结构
 * @property access_token 新的访问令牌
 * @property refresh_token 新的刷新令牌（可能旋转）
 * @property expires_in_ms 访问令牌剩余有效期（毫秒）
 */
export type AccessTokens = { access_token: string; refresh_token?: string; expires_in_ms?: number }

/**
 * 构建 SDK 所需的刷新令牌函数
 * @param baseUrl Matrix homeserver 基础地址
 * @returns 接收 `refreshToken`，调用 `/_matrix/client/v3/refresh` 并返回新令牌的异步函数
 */
export function buildTokenRefreshFunction(baseUrl: string) {
  return async (refreshToken: string): Promise<AccessTokens> => {
    const url = `${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/refresh`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    if (!res.ok) throw new Error('Token refresh failed')
    const data = await res.json()
    const tokens: AccessTokens = {
      access_token: data?.access_token,
      refresh_token: data?.refresh_token,
      expires_in_ms: data?.expires_in_ms
    }
    try {
      const newAccess = tokens.access_token
      const newRefresh = tokens.refresh_token || refreshToken
      await invoke(TauriCommand.UPDATE_TOKEN, { token: newAccess, refresh_token: newRefresh }).catch(() => {})
    } catch {}
    return tokens
  }
}
