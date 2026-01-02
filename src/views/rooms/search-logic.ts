export type SearchMode = 'exact' | 'fuzzy'
export type SortBy = 'created' | 'name'

export interface SearchCriteria {
  query: string
  mode: SearchMode
  sortBy: SortBy
  filter: string[]
}

export interface RoomRow {
  id: string
  name: string
  created: number
  joined: boolean
  public: boolean
  joinRule?: string
  unread?: number
}

// Matrix client interface for room search
interface MatrixClientLike {
  getRooms?: () => MatrixRoomLike[]
}

interface MatrixRoomLike {
  roomId: string
  name?: string
  getDefaultRoomName?: () => string
  getCreatedAt?: () => number
  getLastLiveTimestamp?: () => number
  getMyMembership?: () => string
  getJoinRule?: () => string
  getUnreadNotificationCount?: (type: string) => number
}

export function mapRooms(client: MatrixClientLike | null | undefined): RoomRow[] {
  const rooms = client?.getRooms?.() || []
  return rooms.map((r: MatrixRoomLike) => ({
    id: r.roomId,
    name: r.name || r.getDefaultRoomName?.() || r.roomId,
    created: r.getCreatedAt?.() || r.getLastLiveTimestamp?.() || Date.now(),
    joined: r.getMyMembership?.() === 'join',
    public: r.getJoinRule?.() === 'public',
    joinRule: r.getJoinRule?.(),
    unread: r.getUnreadNotificationCount?.('total') || 0
  }))
}

export function searchRooms(rows: RoomRow[], criteria: SearchCriteria): RoomRow[] {
  const q = (criteria.query || '').trim().toLowerCase()
  const mode = criteria.mode
  const filtered = rows.filter((row) => {
    const match =
      !q ||
      (mode === 'exact'
        ? String(row.name).toLowerCase() === q || String(row.id).toLowerCase() === q
        : String(row.name).toLowerCase().includes(q) || String(row.id).toLowerCase().includes(q))
    const f = criteria.filter || []
    const okPublic = !f.includes('public') || row.public
    const okJoined = !f.includes('joined') || row.joined
    const ruleFilters = f.filter((v) => v.startsWith('rule:')).map((v) => v.split(':')[1])
    const okRule = ruleFilters.length === 0 || ruleFilters.includes(String(row.joinRule))
    const okUnread = !f.includes('unread') || Number(row.unread) > 0
    return match && okPublic && okJoined && okRule && okUnread
  })
  const sorted = filtered.sort((a, b) =>
    criteria.sortBy === 'created' ? b.created - a.created : String(a.name).localeCompare(String(b.name))
  )
  return sorted
}
