import { describe, it, expect, vi } from 'vitest'

vi.mock('@/integrations/matrix/client', () => {
  const client = {
    getRooms: vi.fn(() => []),
    createRoom: vi.fn(async () => ({ room_id: '!dm:example.org' }))
  }
  return { matrixClientService: { getClient: vi.fn(() => client) } }
})

describe('matrix dm creation', () => {
  it('getOrCreateDirectRoom returns created room id', async () => {
    const { getOrCreateDirectRoom } = await import('@/integrations/matrix/contacts')
    const id = await getOrCreateDirectRoom('@alice:example.org')
    expect(id).toBe('!dm:example.org')
  })
})
