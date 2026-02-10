import MatrixClientService from './MatrixClientService'
import type { Room } from 'matrix-js-sdk'
import { createServiceLogger } from '@/utils/Logger'

const logger = createServiceLogger('MatrixDataDeletionService')

interface DeleteOptions {
  deleteMessages: boolean
  deleteRooms: boolean
  deleteContacts: boolean
  deleteProfile: boolean
  deleteAccount: boolean
  startDate?: Date
  endDate?: Date
}

interface DeleteProgress {
  stage: string
  progress: number
  total: number
}

interface DeleteResult {
  success: boolean
  deletedItems: {
    messages: number
    rooms: number
    contacts: number
  }
  error?: string
}

class MatrixDataDeletionService {
  private static instance: MatrixDataDeletionService

  static getInstance(): MatrixDataDeletionService {
    if (!MatrixDataDeletionService.instance) {
      MatrixDataDeletionService.instance = new MatrixDataDeletionService()
    }
    return MatrixDataDeletionService.instance
  }

  private getClient() {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  async deleteData(
    options: DeleteOptions,
    progressCallback?: (progress: DeleteProgress) => void
  ): Promise<DeleteResult> {
    try {
      const client = this.getClient()
      if (!client) {
        return { success: false, deletedItems: { messages: 0, rooms: 0, contacts: 0 }, error: 'Client not initialized' }
      }

      const deletedItems = {
        messages: 0,
        rooms: 0,
        contacts: 0
      }

      if (options.deleteAccount) {
        progressCallback?.({ stage: 'deleting_account', progress: 0, total: 100 })
        await this.deleteAccount()
        progressCallback?.({ stage: 'completed', progress: 100, total: 100 })
        return { success: true, deletedItems }
      }

      if (options.deleteMessages) {
        progressCallback?.({ stage: 'deleting_messages', progress: 0, total: 100 })
        const deletedMessages = await this.deleteMessages(options.startDate, options.endDate, progressCallback)
        deletedItems.messages = deletedMessages
      }

      if (options.deleteRooms) {
        progressCallback?.({ stage: 'leaving_rooms', progress: 50, total: 100 })
        const deletedRooms = await this.deleteRooms()
        deletedItems.rooms = deletedRooms
      }

      if (options.deleteContacts) {
        progressCallback?.({ stage: 'deleting_contacts', progress: 75, total: 100 })
        const deletedContacts = await this.deleteContacts()
        deletedItems.contacts = deletedContacts
      }

      if (options.deleteProfile) {
        progressCallback?.({ stage: 'deleting_profile', progress: 90, total: 100 })
        await this.deleteProfile()
      }

      progressCallback?.({ stage: 'completed', progress: 100, total: 100 })

      return { success: true, deletedItems }
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error('Deletion failed:', error)
      }
      return {
        success: false,
        deletedItems: { messages: 0, rooms: 0, contacts: 0 },
        error: error instanceof Error ? error.message : 'Deletion failed'
      }
    }
  }

  private async deleteMessages(
    startDate?: Date,
    endDate?: Date,
    progressCallback?: (progress: DeleteProgress) => void
  ): Promise<number> {
    const client = this.getClient()
    if (!client) return 0

    try {
      const rooms = client.getRooms()
      let deletedCount = 0
      let totalMessages = 0
      let processedMessages = 0

      for (const room of rooms) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()
        totalMessages += events.length
      }

      for (const room of rooms) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()

        for (const event of events) {
          const eventDate = new Date(event.getTs() || 0)

          if (startDate && eventDate < startDate) {
            continue
          }

          if (endDate && eventDate > endDate) {
            continue
          }

          if (event.getType() !== 'm.room.message') {
            continue
          }

          if (event.getSender() === client.getUserId()) {
            try {
              await client.redactEvent(room.roomId, event.getId() || '')
              deletedCount++
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error('[MatrixDataDeletionService] Failed to delete message:', error)
              }
            }
          }

          processedMessages++

          if (progressCallback && totalMessages > 0) {
            const progress = (processedMessages / totalMessages) * 50
            progressCallback({
              stage: 'deleting_messages',
              progress: Math.round(progress),
              total: 100
            })
          }
        }
      }

      return deletedCount
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataDeletionService] Failed to delete messages:', error)
      }
      return 0
    }
  }

  private async deleteRooms(): Promise<number> {
    const client = this.getClient()
    if (!client) return 0

    try {
      const rooms = client.getRooms()
      let deletedCount = 0

      for (const room of rooms) {
        if (this.isDirectRoom(room)) {
          try {
            await client.leave(room.roomId)
            deletedCount++
          } catch (error) {
            if (import.meta.env.DEV) {
              logger.error('Failed to leave room:', error)
            }
          }
        }
      }

      return deletedCount
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataDeletionService] Failed to delete rooms:', error)
      }
      return 0
    }
  }

  private async deleteContacts(): Promise<number> {
    const client = this.getClient()
    if (!client) return 0

    try {
      const userId = client.getUserId()
      if (!userId) return 0

      const ignoredUsers = await client.getIgnoredUsers()
      let deletedCount = 0

      for (const ignoredUser of ignoredUsers) {
        try {
          const remainingUsers = ignoredUsers.filter((u) => u !== ignoredUser)
          await client.setIgnoredUsers(remainingUsers)
          deletedCount++
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.error('Failed to unignore user:', error)
          }
        }
      }

      return deletedCount
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataDeletionService] Failed to delete contacts:', error)
      }
      return 0
    }
  }

  private async deleteProfile(): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      await client.setDisplayName('')
      await client.setAvatarUrl('')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataDeletionService] Failed to delete profile:', error)
      }
    }
  }

  private async deleteAccount(): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      logger.warn('Account deletion requires server support')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixDataDeletionService] Failed to delete account:', error)
      }
      throw error
    }
  }

  private isDirectRoom(room: Room): boolean {
    return room.getType() === 'direct' || false
  }

  async getDeletionPreview(): Promise<{
    messages: number
    rooms: number
    contacts: number
  }> {
    const client = this.getClient()
    if (!client) {
      return { messages: 0, rooms: 0, contacts: 0 }
    }

    try {
      const rooms = client.getRooms()
      let messages = 0
      let roomCount = 0

      for (const room of rooms) {
        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()

        for (const event of events) {
          if (event.getType() === 'm.room.message' && event.getSender() === client.getUserId()) {
            messages++
          }
        }

        if (this.isDirectRoom(room)) {
          roomCount++
        }
      }

      const ignoredUsers = await client.getIgnoredUsers()
      const contacts = ignoredUsers.length

      return { messages, rooms: roomCount, contacts }
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error('Failed to get deletion preview:', error)
      }
      return { messages: 0, rooms: 0, contacts: 0 }
    }
  }
}

export default MatrixDataDeletionService
export type { DeleteOptions, DeleteProgress, DeleteResult }
