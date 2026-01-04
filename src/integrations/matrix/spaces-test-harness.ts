import { MatrixSpacesManager } from './spaces'

function createMockClient() {
  const rooms: Record<string, any> = {}
  const listeners: Record<string, ((...args: any[]) => void)[]> = {}
  return {
    getRoomHierarchy(_id: string) {
      throw new Error('M_UNRECOGNIZED')
    },
    on(ev: string, fn: (...args: any[]) => void) {
      listeners[ev] = listeners[ev] || []
      listeners[ev].push(fn)
    },
    createRoom(opts: any) {
      const id = `!space_${Object.keys(rooms).length + 1}:mock`
      rooms[id] = {
        roomId: id,
        name: opts?.name || id,
        children: [],
        currentState: {
          getStateEvents(type: string) {
            if (type === 'm.space.child') {
              return rooms[id].children.map((c: any) => ({ getStateKey: () => c.roomId, getContent: () => c.content }))
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
    sendStateEvent(spaceId: string, _type: string, content: any, childRoomId: string) {
      const room = rooms[spaceId]
      if (!room) return Promise.resolve()
      const idx = room.children.findIndex((c: any) => c.roomId === childRoomId)
      const entry = { roomId: childRoomId, content }
      if (idx === -1) room.children.push(entry)
      else room.children[idx] = entry
      listeners['RoomState.events']?.forEach((fn) => fn({ getRoom: () => room }))
      return Promise.resolve()
    },
    getRoom(id: string) {
      return rooms[id]
    },
    getRooms() {
      return Object.values(rooms)
    }
  }
}

export function setupSpacesTestHarness() {
  const client = createMockClient()
  const mgr = new MatrixSpacesManager(client as any)
  ;(window as any).__spacesTest = {
    client,
    manager: mgr,
    async createSpace(name: string) {
      const s = await mgr.createSpace({ name })
      return s.id
    },
    async insertChildOrdered(spaceId: string, childId: string) {
      await mgr.insertChildWithOrder(spaceId, childId)
      const children = await (mgr as any).getSpaceChildren(spaceId)
      return children
    },
    async setSuggested(spaceId: string, childId: string, suggested: boolean) {
      await mgr.addChildToSpace(spaceId, childId, { suggested })
      const children = await (mgr as any).getSpaceChildren(spaceId)
      return children
    }
  }
  return
}
