import { AutoDiscovery } from 'matrix-js-sdk'
// import { createClient } from 'matrix-js-sdk' // 保留备用

export type DiscoveryResult = {
  homeserverUrl: string
  capabilities?: {
    versions?: string[]
    capabilities?: Record<string, unknown>
  }
}

// Type for AutoDiscovery result
type AutoDiscoveryResult = {
  'm.homeserver'?: { base_url: string }
  homeserver?: { base_url: string }
}

/**
 * 执行完整的 Matrix 服务发现流程
 * @param serverName 输入的服务器名（域名或 URL）
 * @returns 发现结果，包含 homeserver 基础地址与能力信息
 */
export async function performAutoDiscovery(serverName: string): Promise<DiscoveryResult> {
  const target = serverName.replace(/^https?:\/\//, '')

  // 1) SDK 自动发现
  const result = (await AutoDiscovery.findClientConfig(target)) as AutoDiscoveryResult
  let hs = result['m.homeserver']?.base_url || result?.homeserver?.base_url

  // 2) 手动读取 .well-known 作为回退
  if (!hs) {
    const candidates = [`https://${target}/.well-known/matrix/client`]
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { method: 'GET' })
        if (resp.ok) {
          const js = (await resp.json().catch(() => null)) as AutoDiscoveryResult | null
          hs = js?.['m.homeserver']?.['base_url'] || js?.homeserver?.base_url || hs
          if (hs) break
        }
      } catch {}
    }
  }

  const picked = await pickReachableBaseUrl(hs || `https://${target}`)
  hs = picked
  if (!hs) throw new Error('无法发现 Matrix 服务器')

  const capabilities = await gatherCapabilities(hs)
  return { homeserverUrl: hs, capabilities }
}

/**
 * 安全的服务发现流程，返回可用的 homeserver 地址，失败时抛出带有上下文的错误
 * @param serverName 输入的服务器名（域名或 URL）
 * @returns 发现结果
 */
export async function safeAutoDiscovery(serverName: string): Promise<DiscoveryResult> {
  try {
    return await performAutoDiscovery(serverName)
  } catch (error) {
    const e = error instanceof Error ? error.message : String(error)
    throw new Error(`服务发现失败: ${e}`)
  }
}

async function testVersions(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const resp = await fetch(`${url.replace(/\/$/, '')}/_matrix/client/versions`, {
      method: 'GET',
      signal: controller.signal
    })
    return resp.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function pickReachableBaseUrl(hs: string): Promise<string> {
  const trimmed = hs.replace(/\/$/, '')
  const host = trimmed.replace(/^https?:\/\//, '')
  const candidates = /^https:/.test(trimmed)
    ? [trimmed, `https://${host}`]
    : /^http:/.test(trimmed)
      ? [`https://${host}`, trimmed]
      : [`https://${host}`, `https://${host}`]
  for (const c of candidates) {
    const ok = await testVersions(c)
    if (ok) return c
  }
  throw new Error(`无法连接到发现的 homeserver: ${trimmed}`)
}

async function gatherCapabilities(hs: string): Promise<DiscoveryResult['capabilities']> {
  const base = hs.replace(/\/$/, '')
  const caps: DiscoveryResult['capabilities'] = {}
  try {
    const resp = await fetch(`${base}/_matrix/client/versions`, { method: 'GET' })
    if (resp.ok) {
      caps.versions = await resp.json().catch(() => null)
    }
  } catch {}
  try {
    const resp2 = await fetch(`${base}/_matrix/client/v3/capabilities`, { method: 'GET' })
    if (resp2.ok) {
      caps.capabilities = await resp2.json().catch(() => null)
    }
  } catch {}
  return caps
}

/**
 * 周期性轮询 .well-known 配置变化
 * @param client 已初始化的 Matrix 客户端
 * @param intervalMs 轮询间隔（毫秒）
 */
export function pollWellKnownUpdates(
  client: { pollForWellKnownChanges?: () => Promise<void> },
  intervalMs: number = 300000
): void {
  try {
    setInterval(
      async () => {
        try {
          await client.pollForWellKnownChanges?.()
        } catch {}
      },
      Math.max(60000, intervalMs)
    )
  } catch {}
}
