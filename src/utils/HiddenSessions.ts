const KEY = 'hula_hidden_sessions'

const load = (): Set<string> => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return new Set<string>()
    const arr = JSON.parse(raw) as string[]
    return new Set<string>(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set<string>()
  }
}

const save = (set: Set<string>) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(Array.from(set)))
    }
  } catch {}
}

const cache = load()

export const hiddenSessions = {
  add(roomId: string) {
    if (!roomId) return
    cache.add(roomId)
    save(cache)
  },
  remove(roomId: string) {
    if (!roomId) return
    cache.delete(roomId)
    save(cache)
  },
  isHidden(roomId: string) {
    return cache.has(roomId)
  },
  clear() {
    cache.clear()
    save(cache)
  },
  getAll(): string[] {
    return Array.from(cache)
  }
}
