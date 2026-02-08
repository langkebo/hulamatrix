import MatrixClientService from './MatrixClientService'
import JSZip from 'jszip'
import { EventType, EventTimeline } from '@/lib/matrix-sdk'

interface ExportOptions {
  includeMessages: boolean
  includeRooms: boolean
  includeContacts: boolean
  includeProfile: boolean
  startDate?: Date
  endDate?: Date
  chunkSize?: number
}

interface ExportProgress {
  stage: string
  progress: number
  total: number
  currentItem?: number
  totalItems?: number
}

interface ExportResult {
  success: boolean
  blob?: Blob
  filename?: string
  error?: string
}

const DEFAULT_CHUNK_SIZE = 100
const MAX_EXPORT_ITEMS = 10000

class MatrixDataExportService {
  private static instance: MatrixDataExportService
  private abortController: AbortController | null = null

  static getInstance(): MatrixDataExportService {
    if (!MatrixDataExportService.instance) {
      MatrixDataExportService.instance = new MatrixDataExportService()
    }
    return MatrixDataExportService.instance
  }

  private getClient() {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  cancelExport(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async exportData(
    options: ExportOptions,
    progressCallback?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    this.abortController = new AbortController()
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE

    try {
      const client = this.getClient()
      if (!client) {
        return { success: false, error: 'Client not initialized' }
      }

      if (this.abortController.signal.aborted) {
        return { success: false, error: 'Export cancelled' }
      }

      const zip = new JSZip()
      const userId = client.getUserId()
      if (!userId) {
        return { success: false, error: 'User not logged in' }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `hula-export-${userId}-${timestamp}.zip`

      progressCallback?.({ stage: 'exporting_profile', progress: 0, total: 100 })

      if (options.includeProfile) {
        await this.exportProfile(zip, userId)
      }

      if (this.abortController.signal.aborted) {
        return { success: false, error: 'Export cancelled' }
      }

      progressCallback?.({ stage: 'exporting_rooms', progress: 20, total: 100 })

      if (options.includeRooms) {
        await this.exportRooms(zip, options.startDate, options.endDate)
      }

      if (this.abortController.signal.aborted) {
        return { success: false, error: 'Export cancelled' }
      }

      progressCallback?.({ stage: 'exporting_messages', progress: 40, total: 100 })

      if (options.includeMessages) {
        await this.exportMessagesChunked(zip, options.startDate, options.endDate, chunkSize, progressCallback)
      }

      if (this.abortController.signal.aborted) {
        return { success: false, error: 'Export cancelled' }
      }

      progressCallback?.({ stage: 'exporting_contacts', progress: 85, total: 100 })

      if (options.includeContacts) {
        await this.exportContacts(zip)
      }

      if (this.abortController.signal.aborted) {
        return { success: false, error: 'Export cancelled' }
      }

      progressCallback?.({ stage: 'creating_archive', progress: 95, total: 100 })

      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        if (progressCallback) {
          progressCallback({
            stage: 'compressing',
            progress: 95 + metadata.percent / 20,
            total: 100
          })
        }
      })

      this.abortController = null
      progressCallback?.({ stage: 'completed', progress: 100, total: 100 })

      return { success: true, blob: content, filename }
    } catch (error) {
      this.abortController = null
      if (import.meta.env.DEV) {
        console.error('[MatrixDataExportService] Export failed:', error)
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  private async exportProfile(zip: JSZip, userId: string): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      const user = client.getUser(userId)
      const profileData = {
        userId,
        displayName: user?.displayName || '',
        avatarUrl: user?.avatarUrl || '',
        exportedAt: new Date().toISOString()
      }

      zip.file('profile.json', JSON.stringify(profileData, null, 2))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataExportService] Failed to export profile:', error)
      }
    }
  }

  private async exportRooms(zip: JSZip, startDate?: Date, endDate?: Date): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      const rooms = client.getRooms()
      const roomsData: Record<string, any>[] = []

      for (const room of rooms) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()
        const creationTs = events.length > 0 ? events[0].getTs() : Date.now()
        if (startDate && creationTs < startDate.getTime()) continue
        if (endDate && creationTs > endDate.getTime()) continue

        const state = timeline.getState(EventTimeline.FORWARDS)
        const topicEvent = state?.getStateEvents(EventType.RoomTopic)?.[0]
        const topic = topicEvent?.getContent()?.topic || ''

        roomsData.push({
          roomId: room.roomId,
          name: room.name || room.roomId,
          topic,
          isDirect: room.getType() === 'direct',
          memberCount: room.getJoinedMemberCount(),
          createdAt: creationTs,
          tags: room.tags || {}
        })

        if (roomsData.length >= MAX_EXPORT_ITEMS) break
      }

      zip.file('rooms.json', JSON.stringify(roomsData, null, 2))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataExportService] Failed to export rooms:', error)
      }
    }
  }

  private async exportMessagesChunked(
    zip: JSZip,
    startDate?: Date,
    endDate?: Date,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    progressCallback?: (progress: ExportProgress) => void
  ): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      const rooms = client.getRooms()
      let totalMessages = 0
      let processedMessages = 0
      const filteredRooms: Array<{
        roomId: string
        name: string | undefined
        events: any[]
      }> = []

      for (const room of rooms) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()

        const filteredEvents = events.filter((event) => {
          const ts = event.getTs() || 0
          const eventDate = new Date(ts)
          if (startDate && eventDate < startDate) return false
          if (endDate && eventDate > endDate) return false
          return event.getType() === 'm.room.message'
        })

        totalMessages += filteredEvents.length

        if (filteredEvents.length > 0) {
          filteredRooms.push({
            roomId: room.roomId,
            name: room.name,
            events: filteredEvents
          })
        }

        if (totalMessages >= MAX_EXPORT_ITEMS) break
      }

      if (totalMessages === 0) {
        zip.file('messages.json', JSON.stringify([], null, 2))
        return
      }

      progressCallback?.({
        stage: 'exporting_messages',
        progress: 40,
        total: 100,
        currentItem: 0,
        totalItems: totalMessages
      })

      const messagesData: any[] = []
      let currentChunk: any[] = []

      for (const room of filteredRooms) {
        for (const event of room.events) {
          const ts = event.getTs() || 0

          currentChunk.push({
            eventId: event.getId(),
            roomId: room.roomId,
            roomName: room.name || room.roomId,
            sender: event.getSender(),
            content: event.getContent(),
            timestamp: ts,
            date: new Date(ts).toISOString()
          })

          processedMessages++

          if (currentChunk.length >= chunkSize) {
            messagesData.push(...currentChunk)
            currentChunk = []

            const progress = 40 + (processedMessages / totalMessages) * 45
            progressCallback?.({
              stage: 'exporting_messages',
              progress: Math.round(progress),
              total: 100,
              currentItem: processedMessages,
              totalItems: totalMessages
            })

            await this.yieldToEventLoop()
          }
        }
      }

      if (currentChunk.length > 0) {
        messagesData.push(...currentChunk)
      }

      progressCallback?.({
        stage: 'exporting_messages',
        progress: 85,
        total: 100,
        currentItem: totalMessages,
        totalItems: totalMessages
      })

      zip.file('messages.json', JSON.stringify(messagesData, null, 2))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataExportService] Failed to export messages:', error)
      }
    }
  }

  private async yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0))
  }

  private async exportContacts(zip: JSZip): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      const contactsData = []
      const userId = client.getUserId()
      if (!userId) return

      const users = await client.getUsers()

      for (const user of users) {
        if (user.userId === userId) continue

        contactsData.push({
          userId: user.userId,
          displayName: user.displayName || user.userId,
          avatarUrl: user.avatarUrl || '',
          lastActive: user.lastActiveAgo ? Date.now() - user.lastActiveAgo : null
        })

        if (contactsData.length >= MAX_EXPORT_ITEMS) break
      }

      zip.file('contacts.json', JSON.stringify(contactsData, null, 2))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataExportService] Failed to export contacts:', error)
      }
    }
  }

  async downloadExport(result: ExportResult): Promise<void> {
    if (!result.success || !result.blob || !result.filename) {
      throw new Error('Invalid export result')
    }

    const url = URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export default MatrixDataExportService
export type { ExportOptions, ExportProgress, ExportResult }
