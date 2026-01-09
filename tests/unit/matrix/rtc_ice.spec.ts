import { describe, it, expect } from 'vitest'
import { mapTurnToIceServers, composeRTCConfiguration } from '@/integrations/matrix/rtcIce'

describe('rtc ice mapping', () => {
  it('maps turn to iceServers', () => {
    const turn = { uris: ['turn:a:3478?transport=udp', 'stun:b:3478'], username: 'u', password: 'p' }
    const ice = mapTurnToIceServers(turn as any)
    expect(ice.length).toBe(2)
    expect(ice[0].urls).toContain('turn:')
    expect(ice[0].username).toBe('u')
    expect(ice[0].credential).toBe('p')
  })
  it('compose configuration with fallback', () => {
    const cfg = composeRTCConfiguration(null, [{ urls: 'stun:c:3478' }])
    expect(cfg.iceServers?.length).toBe(1)
    expect(cfg.iceServers?.[0].urls).toContain('stun:')
  })
})
