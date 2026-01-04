import { matrixClientService } from './client'

interface MatrixClientLike {
  getAccountData?(type: string): { getContent?(): Record<string, unknown> } | undefined
  getPresenceList?(): Promise<Array<{ user_id?: string; presence?: string }> | undefined>
  [key: string]: unknown
}

const keyOf = (uid: string) => `matrix-friends-tags:${uid}`

export function getAllTags(): string[] {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('matrix-friends-tags:'))
    const set = new Set<string>()
    for (const k of keys) {
      const raw = localStorage.getItem(k) || '[]'
      const arr = JSON.parse(raw) as string[]
      arr.forEach((t) => set.add(t))
    }
    return Array.from(set)
  } catch {
    return []
  }
}

export function getUserTags(userId: string): string[] {
  try {
    const raw = localStorage.getItem(keyOf(userId)) || '[]'
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function setUserTags(userId: string, tags: string[]): void {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(Array.from(new Set(tags))))
  } catch {}
}

export function addTag(userId: string, tag: string): void {
  const base = getUserTags(userId)
  if (!base.includes(tag)) base.push(tag)
  setUserTags(userId, base)
}

export function removeTag(userId: string, tag: string): void {
  const base = getUserTags(userId).filter((t) => t !== tag)
  setUserTags(userId, base)
}

export async function listFriendsByTag(
  tag: string
): Promise<Array<{ userId: string; tags: string[]; presence?: string }>> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return []
  const res: Array<{ userId: string; tags: string[]; presence?: string }> = []
  try {
    const ev = client.getAccountData?.('m.direct')
    const getContentFn = ev?.getContent as (() => Record<string, unknown>) | undefined
    const mapping = getContentFn?.() || (ev as Record<string, unknown>) || {}
    Object.keys(mapping || {}).forEach((uid) => {
      const tags = getUserTags(uid)
      if (tags.includes(tag)) res.push({ userId: uid, tags })
    })
  } catch {}
  try {
    const getPresenceListFn = client.getPresenceList as
      | (() => Promise<Array<{ user_id?: string; presence?: string }> | undefined>)
      | undefined
    const devices = await getPresenceListFn?.()
    const presenceMap: Record<string, string> = {}
    if (Array.isArray(devices)) {
      devices.forEach((p: { user_id?: string; presence?: string }) => {
        if (p?.user_id) presenceMap[p.user_id] = p?.presence || 'offline'
      })
    }
    res.forEach((r) => {
      r.presence = presenceMap[r.userId] || 'offline'
    })
  } catch {}
  return res
}
