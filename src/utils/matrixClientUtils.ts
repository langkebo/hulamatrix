/**
 * Type-safe utilities for accessing Matrix client methods
 * The underlying client is from matrix-js-sdk but typed as Record<string, unknown>
 * in the module declarations for flexibility. These utilities provide safe access.
 */

/**
 * Matrix client interface with commonly used methods
 */
interface MatrixClientMethods {
  mxcUrlToHttp?: (mxcUrl: string, width?: number, height?: number, resizeMethod?: string) => string
  getProfileInfo?: (userId: string) => Promise<{ avatar_url?: string; displayname?: string } | null>
  setDisplayName?: (displayName: string) => Promise<void>
  setAvatarUrl?: (mxcUrl: string) => Promise<void>
  getUserId?: () => string
  getRoom?: (roomId: string) => Record<string, unknown> | null
  sendMessage?: (roomId: string, content: Record<string, unknown>, type?: string) => Promise<string>
  getPublicRooms?: () => Promise<{ chunk?: Array<{ room_id: string; name?: string; topic?: string }> }>
  joinRoom?: (roomId: string) => Promise<Record<string, unknown>>
  setRoomTag?: (roomId: string, tagName: string, metadata: Record<string, unknown>) => Promise<void>
  deleteRoomTag?: (roomId: string, tagName: string) => Promise<void>
  searchRoomMessages?: (
    searchTerm: string,
    options: {
      rooms?: string[]
      limit?: number
      order?: 'recent' | 'relevance'
    }
  ) => Promise<{
    results?: Array<{
      event?: Record<string, unknown>
      room_id?: string
      rank?: number
    }>
  }>
  crypto?: {
    decryptEvent?: (event: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

/**
 * Type guard to check if the client has a specific method
 */
function hasMethod<T extends keyof MatrixClientMethods>(
  client: Record<string, unknown> | null,
  method: T
): client is Record<string, unknown> & Required<Pick<MatrixClientMethods, T>> {
  return client !== null && typeof client[method] === 'function'
}

/**
 * Safely convert mxc:// URL to http(s):// URL
 */
export function mxcUrlToHttp(
  client: Record<string, unknown> | null,
  mxcUrl: string,
  width?: number,
  height?: number,
  resizeMethod?: string
): string | null {
  if (!hasMethod(client, 'mxcUrlToHttp')) return null
  return client.mxcUrlToHttp(mxcUrl, width, height, resizeMethod)
}

/**
 * Safely get user profile info
 */
export async function getProfileInfo(
  client: Record<string, unknown> | null,
  userId: string
): Promise<{ avatar_url?: string; displayname?: string } | null> {
  if (!hasMethod(client, 'getProfileInfo')) return null
  return client.getProfileInfo(userId)
}

/**
 * Safely get current user ID
 */
export function getUserId(client: Record<string, unknown> | null): string | null {
  if (!hasMethod(client, 'getUserId')) return null
  return client.getUserId()
}

/**
 * Safely get a room
 */
export function getRoom(client: Record<string, unknown> | null, roomId: string): Record<string, unknown> | null {
  if (!hasMethod(client, 'getRoom')) return null
  return client.getRoom(roomId)
}

/**
 * Safely send a message
 */
export async function sendMessage(
  client: Record<string, unknown> | null,
  roomId: string,
  content: Record<string, unknown>,
  type = 'm.room.message'
): Promise<string | null> {
  if (!hasMethod(client, 'sendMessage')) return null
  return client.sendMessage(roomId, content, type)
}

/**
 * Safely get public rooms
 */
export async function getPublicRooms(
  client: Record<string, unknown> | null
): Promise<Array<{ room_id: string; name?: string; topic?: string }> | null> {
  if (!hasMethod(client, 'getPublicRooms')) return null
  const result = await client.getPublicRooms()
  return result?.chunk || null
}

/**
 * Safely join a room
 */
export async function joinRoom(
  client: Record<string, unknown> | null,
  roomId: string
): Promise<Record<string, unknown> | null> {
  if (!hasMethod(client, 'joinRoom')) return null
  return client.joinRoom(roomId)
}

/**
 * Safely set room tag
 */
export async function setRoomTag(
  client: Record<string, unknown> | null,
  roomId: string,
  tagName: string,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!hasMethod(client, 'setRoomTag')) return
  return client.setRoomTag(roomId, tagName, metadata)
}

/**
 * Safely delete room tag
 */
export async function deleteRoomTag(
  client: Record<string, unknown> | null,
  roomId: string,
  tagName: string
): Promise<void> {
  if (!hasMethod(client, 'deleteRoomTag')) return
  return client.deleteRoomTag(roomId, tagName)
}

/**
 * Safely search room messages
 */
export async function searchRoomMessages(
  client: Record<string, unknown> | null,
  searchTerm: string,
  options: {
    rooms?: string[]
    limit?: number
    order?: 'recent' | 'relevance'
  }
): Promise<Array<{ event?: Record<string, unknown>; room_id?: string; rank?: number }> | null> {
  if (!hasMethod(client, 'searchRoomMessages')) return null
  const result = await client.searchRoomMessages(searchTerm, options)
  return result?.results || null
}

/**
 * Safely decrypt an event
 */
export async function decryptEvent(
  client: Record<string, unknown> | null,
  event: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const crypto = client?.crypto as Record<string, unknown> | undefined
  if (crypto && typeof crypto.decryptEvent === 'function') {
    return (crypto.decryptEvent as (event: Record<string, unknown>) => Promise<Record<string, unknown>>)(event)
  }
  return null
}

/**
 * Type guard to check if a value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Safely set user display name
 */
export async function setDisplayName(client: Record<string, unknown> | null, displayName: string): Promise<void> {
  if (!hasMethod(client, 'setDisplayName')) {
    throw new Error('setDisplayName method not available on client')
  }
  return client.setDisplayName(displayName)
}

/**
 * Safely set user avatar URL
 */
export async function setAvatarUrl(client: Record<string, unknown> | null, mxcUrl: string): Promise<void> {
  if (!hasMethod(client, 'setAvatarUrl')) {
    throw new Error('setAvatarUrl method not available on client')
  }
  return client.setAvatarUrl(mxcUrl)
}
