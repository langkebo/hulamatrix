import { describe, it, expect, vi } from 'vitest'
import * as clientMod from '@/integrations/matrix/client'
import { createThreadReply } from '@/integrations/matrix/threads'

describe('threads', () => {
  it('createThreadReply builds thread relation', async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: '$thread' })
    vi.spyOn(clientMod.matrixClientService as any, 'getClient').mockReturnValue({ sendEvent })
    const id = await createThreadReply('!room', '$root', 'reply')
    expect(id).toBe('$thread')
    const args = sendEvent.mock.calls[0][2]
    expect(args['m.relates_to']?.rel_type).toBe('m.thread')
    expect(args['m.relates_to']?.event_id).toBe('$root')
  })
})
