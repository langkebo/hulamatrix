import { describe, it, expect } from 'vitest'
import { MatrixSpacesManager } from '@/integrations/matrix/spaces'

function createMockClient() {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {}
  return {
    on(ev: string, fn: (...args: any[]) => void) {
      listeners[ev] = listeners[ev] || []
      listeners[ev].push(fn)
    },
    getRoomHierarchy() {
      throw new Error('M_UNRECOGNIZED')
    },
    getRoom(_id: string) {
      return {
        roomId: _id,
        name: _id,
        currentState: {
          getStateEvents(_type: string) {
            return []
          }
        },
        getJoinedMembers() {
          return []
        }
      }
    },
    getRooms() {
      return []
    }
  } as any
}

describe('MatrixSpacesManager', () => {
  it('falls back when hierarchy API not supported', async () => {
    const client = createMockClient()
    const mgr = new MatrixSpacesManager(client)
    const res = await (mgr as any).getSpaceHierarchy('!space:example')
    expect(res).toHaveProperty('children')
    expect(Array.isArray(res.children)).toBe(true)
  })
})
