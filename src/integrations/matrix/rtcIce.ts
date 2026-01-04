export type TurnServer = { uris: string[]; username: string; password: string; ttl?: number }

export function mapTurnToIceServers(turn: TurnServer | null): RTCIceServer[] {
  if (!turn || !Array.isArray(turn.uris)) return []
  return turn.uris.map((u) => ({ urls: u, username: turn.username, credential: turn.password }))
}

/**
 * 从环境变量读取自定义 STUN/TURN 服务器配置
 * 支持以下环境变量：
 * - VITE_RTC_STUN_SERVERS: STUN 服务器列表，逗号分隔 (e.g., "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
 * - VITE_RTC_TURN_SERVERS: TURN 服务器列表，逗号分隔 (e.g., "turn:turn.example.com:3478")
 * - VITE_RTC_TURN_USERNAME: TURN 服务器用户名
 * - VITE_RTC_TURN_PASSWORD: TURN 服务器密码
 */
function loadIceServersFromEnv(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = []

  // Load STUN servers from environment
  const stunServersEnv = import.meta.env.VITE_RTC_STUN_SERVERS
  if (stunServersEnv) {
    const stunUrls = stunServersEnv.split(',').map((s: string) => s.trim())
    iceServers.push(...stunUrls.map((url: string) => ({ urls: url })))
  }

  // Load TURN servers from environment
  const turnServersEnv = import.meta.env.VITE_RTC_TURN_SERVERS
  const turnUsername = import.meta.env.VITE_RTC_TURN_USERNAME
  const turnPassword = import.meta.env.VITE_RTC_TURN_PASSWORD

  if (turnServersEnv && turnUsername && turnPassword) {
    const turnUrls = turnServersEnv.split(',').map((s: string) => s.trim())
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnPassword
    })
  }

  return iceServers
}

export function composeRTCConfiguration(turn: TurnServer | null, fallback?: RTCIceServer[]): RTCConfiguration {
  const iceServers = [
    ...loadIceServersFromEnv(), // Load from environment variables first
    ...mapTurnToIceServers(turn), // Then dynamic TURN server
    ...(fallback || []) // Finally fallback servers
  ]

  // Remove duplicates based on URLs
  const uniqueIceServers = iceServers.filter(
    (server, index, self) => index === self.findIndex((s) => JSON.stringify(s.urls) === JSON.stringify(server.urls))
  )

  return { iceServers: uniqueIceServers, iceTransportPolicy: 'all' }
}
