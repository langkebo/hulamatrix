import { describe, it, expect, vi } from 'vitest'
import { getPowerLevels, setPowerLevels } from '@/integrations/matrix/powerLevels'
import { matrixClientService } from '@/integrations/matrix/client'

describe('power levels', () => {
  it('get power levels from state event', async () => {
    const ev = { getContent: () => ({ users_default: 0, invite: 0 }) }
    const room = { currentState: { getStateEvents: () => ev } }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({ getRoom: () => room } as any)
    const pl = await getPowerLevels('!room:id')
    expect(pl.users_default).toBe(0)
  })
  it('set power levels sends state', async () => {
    const sendStateEvent = vi.fn()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({ sendStateEvent } as any)
    await setPowerLevels('!room:id', { users_default: 50 })
    expect(sendStateEvent).toHaveBeenCalledWith('!room:id', 'm.room.power_levels', { users_default: 50 }, '')
  })
})
