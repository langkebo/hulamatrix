import { matrixClientService } from '@/matrix/core/client'

interface MatrixClientLike {
  getRoom?(roomId: string): { getJoinedMembers?(): unknown[]; getMembers?(): unknown[] } | undefined
  [key: string]: unknown
}

export async function listJoinedMembers(roomId: string): Promise<Array<{ userId: string; name?: string }>> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return []
  const getRoomFn = client.getRoom as
    | ((roomId: string) => { getJoinedMembers?(): unknown[]; getMembers?(): unknown[] } | undefined)
    | undefined
  const room = getRoomFn?.(roomId)
  const members = (room?.getJoinedMembers?.() || room?.getMembers?.() || []) as unknown[]
  return members.map((m: unknown) => {
    const member = m as { userId?: string; user?: { userId?: string; displayName?: string }; name?: string }
    const result: { userId: string; name?: string } = {
      userId: member?.userId || member?.user?.userId || ''
    }
    const displayName = member?.name ?? member?.user?.displayName
    if (displayName !== undefined) {
      result.name = displayName
    }
    return result
  })
}
