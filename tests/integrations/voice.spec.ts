import { describe, it, expect, vi } from 'vitest'
import * as clientMod from '@/integrations/matrix/client'
import { sendVoiceMessage } from '@/integrations/matrix/voice'

describe('voice message', () => {
  it('sendVoiceMessage uploads and sends event', async () => {
    const mockClient: any = {
      uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://s/u' }),
      sendEvent: vi.fn().mockResolvedValue({ event_id: '$evt' })
    }
    vi.spyOn(clientMod.matrixClientService as any, 'getClient').mockReturnValue(mockClient)
    const blob = new Blob(['data'], { type: 'audio/webm' })
    const id = await sendVoiceMessage('!room', blob, { duration: 1000 })
    expect(id).toBe('$evt')
    expect(mockClient.uploadContent).toHaveBeenCalled()
    expect(mockClient.sendEvent).toHaveBeenCalled()
  })
})
