import { MatrixSpacesManager } from './spaces'

// Local type definitions for mock objects
interface MatrixClientLike {
  getRoom(roomId: string): unknown
  getRooms(): unknown[]
  on(event: string, handler: (...args: unknown[]) => void): void
  createRoom(options: unknown): Promise<unknown>
  sendStateEvent(roomId: string, eventType: string, content: unknown, stateKey?: string): Promise<unknown>
  getRoomHierarchy?(spaceId: string): Promise<unknown>
}

interface MockRoomChild {
  roomId: string
  content: {
    via?: string[]
    order?: string
    suggested?: boolean
  }
}

interface MockRoom {
  roomId: string
  name: string
  children: MockRoomChild[]
  currentState: {
    getStateEvents(type: string): unknown[]
  }
  getLiveTimeline(): {
    getEvents(): unknown[]
  }
  getJoinedMembers(): unknown[]
}

interface MockClient extends Omit<MatrixClientLike, 'getRoom' | 'getRooms'> {
  getRoom(id: string): MockRoom | null
  getRooms(): MockRoom[]
  on(event: string, handler: (...args: unknown[]) => void): void
  createRoom(options: { name?: string }): Promise<{ room_id: string }>
  sendStateEvent(roomId: string, eventType: string, content: unknown, stateKey?: string): Promise<void>
}

// Test harness interface for window object
interface SpacesTestHarness {
  client: MockClient
  manager: MatrixSpacesManager
  createSpace(name: string): Promise<string>
  insertChildOrdered(spaceId: string, childId: string): Promise<unknown[]>
  setSuggested(spaceId: string, childId: string, suggested: boolean): Promise<unknown[]>
}

declare global {
  interface Window {
    __spacesTest?: SpacesTestHarness
  }
}

function createMockClient(): MockClient {
  const rooms: Record<string, MockRoom> = {}
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  const mockClient: MockClient = {
    getRoom(id: string) {
      return rooms[id] || null
    },
    getRooms() {
      return Object.values(rooms)
    },
    on(ev: string, fn: (...args: unknown[]) => void) {
      listeners[ev] = listeners[ev] || []
      listeners[ev].push(fn)
    },
    createRoom(opts: { name?: string }) {
      const id = `!space_${Object.keys(rooms).length + 1}:mock`
      rooms[id] = {
        roomId: id,
        name: opts?.name || id,
        children: [],
        currentState: {
          getStateEvents(type: string) {
            if (type === 'm.space.child') {
              return rooms[id].children.map((c) => ({
                getStateKey: () => c.roomId,
                getContent: () => c.content
              }))
            }
            if (type === 'm.room.creation') return [{ getContent: () => ({ type: 'm.space' }) }]
            return []
          }
        },
        getLiveTimeline() {
          return { getEvents: () => [] }
        },
        getJoinedMembers() {
          return []
        }
      }
      listeners['Room']?.forEach((fn) => fn(rooms[id]))
      return Promise.resolve({ room_id: id })
    },
    sendStateEvent(spaceId: string, _type: string, content: unknown, childRoomId: string) {
      const room = rooms[spaceId]
      if (!room) return Promise.resolve()
      const idx = room.children.findIndex((c) => c.roomId === childRoomId)
      const entry: MockRoomChild = { roomId: childRoomId, content: content as MockRoomChild['content'] }
      if (idx === -1) room.children.push(entry)
      else room.children[idx] = entry
      listeners['RoomState.events']?.forEach((fn) => fn({ getRoom: () => room }))
      return Promise.resolve()
    },
    getRoomHierarchy(_id: string) {
      throw new Error('M_UNRECOGNIZED')
    }
  }

  return mockClient
}

export function setupSpacesTestHarness() {
  const client = createMockClient()
  // Cast client to unknown first to bypass strict MatrixClient type checking
  // This is acceptable for test harness as mock client implements required methods
  const mgr = new MatrixSpacesManager(client as unknown as ConstructorParameters<typeof MatrixSpacesManager>[0])

  // Test harness internal interface for accessing private methods
  interface MatrixSpacesManagerWithTests {
    getSpaceChildren(spaceId: string): Promise<unknown[]>
  }

  window.__spacesTest = {
    client,
    manager: mgr,
    async createSpace(name: string) {
      const s = await mgr.createSpace({ name })
      return s.id
    },
    async insertChildOrdered(spaceId: string, childId: string) {
      await mgr.insertChildWithOrder(spaceId, childId)
      const children = await (mgr as unknown as MatrixSpacesManagerWithTests).getSpaceChildren(spaceId)
      return children
    },
    async setSuggested(spaceId: string, childId: string, suggested: boolean) {
      await mgr.addChildToSpace(spaceId, childId, { suggested })
      const children = await (mgr as unknown as MatrixSpacesManagerWithTests).getSpaceChildren(spaceId)
      return children
    }
  }
}
