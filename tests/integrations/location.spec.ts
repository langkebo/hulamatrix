import { describe, it, expect, vi } from 'vitest'
import * as clientMod from '@/integrations/matrix/client'
import { shareLocation } from '@/integrations/matrix/location'

describe('location', () => {
  it('shareLocation sends MSC3488 content', async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: '$loc' })
    vi.spyOn(clientMod.matrixClientService as any, 'getClient').mockReturnValue({ sendEvent })
    const coords = {
      latitude: 1,
      longitude: 2,
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    } as any
    const id = await shareLocation('!room', coords)
    expect(id).toBe('$loc')
    const content = sendEvent.mock.calls[0][2]
    expect(content['org.matrix.msc3488.location']?.uri).toContain('geo:')
  })
})
