/**
 * Matrix Announcement Service
 *
 * Implements announcement functionality using Matrix state events.
 * Announcements are stored as room state events with custom event type.
 */

import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'

// Custom event type for announcements
const ANNOUNCEMENT_EVENT_TYPE = 'im.hula.announcement'

export interface Announcement {
  id: string
  roomId: string
  content: string
  top?: boolean
  createTime?: number
  updateTime?: number
  creatorId?: string
}

/**
 * Get announcement detail by ID
 * @param params.roomId Room ID
 * @param params.announcementId Announcement ID (event ID)
 */
export async function getAnnouncementDetail(params: {
  roomId: string
  announcementId: string
}): Promise<Announcement | null> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[matrixAnnouncementService] No Matrix client available')
      return null
    }

    const getRoom = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoom?.call(client, params.roomId)
    if (!room) {
      logger.warn('[matrixAnnouncementService] Room not found:', params.roomId)
      return null
    }

    // Type assertion for room with roomState
    const roomWithState = room as {
      roomState?: {
        getStateEvent: (eventType: string, stateKey: string) => unknown
      }
    }

    // Get the state event for the announcement
    const stateEvent = roomWithState.roomState?.getStateEvent(ANNOUNCEMENT_EVENT_TYPE, params.announcementId)

    if (!stateEvent) {
      logger.warn('[matrixAnnouncementService] Announcement not found:', params.announcementId)
      return null
    }

    // Type assertion for state event methods
    const matrixEvent = stateEvent as {
      getId: () => string | undefined
      getContent: () => Record<string, unknown>
      getOriginServerTs: () => number
      getSender: () => string
    }

    const content = matrixEvent.getContent()

    return {
      id: matrixEvent.getId() || params.announcementId,
      roomId: params.roomId,
      content: (content.content as string) || '',
      top: (content.top as boolean) || false,
      createTime: (content.createTime as number) || matrixEvent.getOriginServerTs(),
      updateTime: (content.updateTime as number) || matrixEvent.getOriginServerTs(),
      creatorId: matrixEvent.getSender()
    }
  } catch (error) {
    logger.error('[matrixAnnouncementService] getAnnouncementDetail failed:', error)
    return null
  }
}

/**
 * Create a new announcement
 * @param params Announcement data
 */
export async function pushAnnouncement(params: {
  roomId: string
  content: string
  top?: boolean
  id?: string
}): Promise<string | null> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[matrixAnnouncementService] No Matrix client available')
      return null
    }

    const getRoom = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoom?.call(client, params.roomId)
    if (!room) {
      logger.warn('[matrixAnnouncementService] Room not found:', params.roomId)
      return null
    }

    const announcementId = params.id || `announcement_${Date.now()}`

    // Send state event for the announcement
    const sendStateEvent = client.sendStateEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
      stateKey: string
    ) => Promise<unknown>
    await sendStateEvent.call(
      client,
      params.roomId,
      ANNOUNCEMENT_EVENT_TYPE,
      {
        content: params.content,
        top: params.top || false,
        createTime: Date.now(),
        updateTime: Date.now()
      },
      announcementId
    )

    logger.info('[matrixAnnouncementService] Announcement created:', announcementId)
    return announcementId
  } catch (error) {
    logger.error('[matrixAnnouncementService] pushAnnouncement failed:', error)
    return null
  }
}

/**
 * Edit an existing announcement
 * @param params Announcement data with id
 */
export async function editAnnouncement(params: {
  roomId: string
  id: string
  content: string
  top?: boolean
}): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[matrixAnnouncementService] No Matrix client available')
      return false
    }

    const getRoom = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoom?.call(client, params.roomId)
    if (!room) {
      logger.warn('[matrixAnnouncementService] Room not found:', params.roomId)
      return false
    }

    // Get existing announcement to preserve createTime
    const existing = await getAnnouncementDetail({
      roomId: params.roomId,
      announcementId: params.id
    })

    // Update state event for the announcement
    const sendStateEvent = client.sendStateEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
      stateKey: string
    ) => Promise<unknown>
    await sendStateEvent.call(
      client,
      params.roomId,
      ANNOUNCEMENT_EVENT_TYPE,
      {
        content: params.content,
        top: params.top || false,
        createTime: existing?.createTime || Date.now(),
        updateTime: Date.now()
      },
      params.id
    )

    logger.info('[matrixAnnouncementService] Announcement edited:', params.id)
    return true
  } catch (error) {
    logger.error('[matrixAnnouncementService] editAnnouncement failed:', error)
    return false
  }
}

/**
 * Get all announcements for a room
 * @param roomId Room ID
 */
export async function getAnnouncementList(roomId: string): Promise<Announcement[]> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[matrixAnnouncementService] No Matrix client available')
      return []
    }

    const getRoom = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoom?.call(client, roomId)
    if (!room) {
      logger.warn('[matrixAnnouncementService] Room not found:', roomId)
      return []
    }

    // Type assertion for room with roomState
    const roomWithState = room as {
      roomState?: {
        getStateEvents: (eventType: string) => unknown[]
      }
    }

    // Get all state events for announcements
    const stateEvents = roomWithState.roomState?.getStateEvents(ANNOUNCEMENT_EVENT_TYPE) || []

    const announcements: Announcement[] = stateEvents.map((event: unknown) => {
      // Matrix SDK types are complex, using unknown with type assertions
      const matrixEvent = event as {
        getStateKey: () => string | null
        getId: () => string | undefined
        getContent: () => Record<string, unknown>
        getOriginServerTs: () => number
        getSender: () => string
      }
      const content = matrixEvent.getContent()
      return {
        id: matrixEvent.getStateKey() || '',
        roomId,
        content: (content.content as string) || '',
        top: (content.top as boolean) || false,
        createTime: (content.createTime as number) || matrixEvent.getOriginServerTs(),
        updateTime: (content.updateTime as number) || matrixEvent.getOriginServerTs(),
        creatorId: matrixEvent.getSender()
      }
    })

    // Sort: top first, then by createTime desc
    return announcements.sort((a, b) => {
      if (a.top && !b.top) return -1
      if (!a.top && b.top) return 1
      return (b.createTime || 0) - (a.createTime || 0)
    })
  } catch (error) {
    logger.error('[matrixAnnouncementService] getAnnouncementList failed:', error)
    return []
  }
}

/**
 * Delete an announcement
 * @param params Room and announcement ID
 */
export async function deleteAnnouncement(params: { roomId: string; announcementId: string }): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[matrixAnnouncementService] No Matrix client available')
      return false
    }

    // Send empty state event to delete
    const sendStateEvent = client.sendStateEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
      stateKey: string
    ) => Promise<unknown>
    await sendStateEvent.call(client, params.roomId, ANNOUNCEMENT_EVENT_TYPE, {}, params.announcementId)

    logger.info('[matrixAnnouncementService] Announcement deleted:', params.announcementId)
    return true
  } catch (error) {
    logger.error('[matrixAnnouncementService] deleteAnnouncement failed:', error)
    return false
  }
}
