/**
 * Call Recording Storage Utility
 * Handles persistent storage and playback of call recordings
 */

import { logger } from '@/utils/logger'

export interface CallRecording {
  /** Unique recording ID */
  id: string
  /** Room ID where the call happened */
  roomId: string
  /** Room name (if available) */
  roomName?: string
  /** Call type: 'voice' or 'video' */
  callType: 'voice' | 'video' | 'group_voice' | 'group_video'
  /** Recording start time */
  startTime: number
  /** Recording end time */
  endTime: number
  /** Recording duration in seconds */
  duration: number
  /** Recording blob URL */
  blobUrl: string
  /** Recording file size in bytes */
  size: number
  /** Recording MIME type */
  mimeType: string
  /** Participant user IDs */
  participants?: string[]
  /** Whether recording is encrypted */
  encrypted: boolean
  /** Recording tags */
  tags?: string[]
  /** Notes */
  notes?: string
}

export interface CallRecordingMetadata {
  /** Total recordings count */
  totalCount: number
  /** Total storage used in bytes */
  totalStorage: number
  /** Recordings by room */
  byRoom: Record<string, number>
  /** Recordings by type */
  byType: Record<string, number>
}

const STORAGE_KEY = 'hula_call_recordings'
const MAX_RECORDINGS = 100
const MAX_STORAGE_BYTES = 1024 * 1024 * 1024 // 1GB

class CallRecordingStorage {
  private recordings: Map<string, CallRecording> = new Map()

  /**
   * Initialize storage from localStorage
   */
  async initialize(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as CallRecording[]
        for (const recording of data) {
          // Verify blob URL is still valid
          if (await this.verifyBlobUrl(recording.blobUrl)) {
            this.recordings.set(recording.id, recording)
          }
        }
        logger.info('[CallRecordingStorage] Loaded recordings', {
          count: this.recordings.size
        })
      }
    } catch (error) {
      logger.error('[CallRecordingStorage] Failed to initialize:', error)
    }
  }

  /**
   * Verify blob URL is still valid
   */
  private async verifyBlobUrl(blobUrl: string): Promise<boolean> {
    try {
      const response = await fetch(blobUrl, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Save a recording
   */
  async saveRecording(recording: Omit<CallRecording, 'id'>): Promise<CallRecording> {
    try {
      // Check storage limits
      const metadata = this.getMetadata()
      if (metadata.totalCount >= MAX_RECORDINGS) {
        throw new Error('Maximum recordings limit reached')
      }

      // Generate unique ID
      const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newRecording: CallRecording = {
        ...recording,
        id
      }

      // Add to storage
      this.recordings.set(id, newRecording)

      // Persist to localStorage
      await this.persist()

      logger.info('[CallRecordingStorage] Recording saved', { id })
      return newRecording
    } catch (error) {
      logger.error('[CallRecordingStorage] Failed to save recording:', error)
      throw error
    }
  }

  /**
   * Get recording by ID
   */
  getRecording(id: string): CallRecording | undefined {
    return this.recordings.get(id)
  }

  /**
   * Get all recordings
   */
  getAllRecordings(): CallRecording[] {
    return Array.from(this.recordings.values()).sort((a, b) => b.startTime - a.startTime)
  }

  /**
   * Get recordings by room
   */
  getRecordingsByRoom(roomId: string): CallRecording[] {
    return this.getAllRecordings().filter((r) => r.roomId === roomId)
  }

  /**
   * Get recordings by type
   */
  getRecordingsByType(callType: CallRecording['callType']): CallRecording[] {
    return this.getAllRecordings().filter((r) => r.callType === callType)
  }

  /**
   * Get recordings by date range
   */
  getRecordingsByDateRange(start: number, end: number): CallRecording[] {
    return this.getAllRecordings().filter((r) => r.startTime >= start && r.startTime <= end)
  }

  /**
   * Search recordings
   */
  searchRecordings(query: string): CallRecording[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllRecordings().filter(
      (r) =>
        r.roomName?.toLowerCase().includes(lowerQuery) ||
        r.notes?.toLowerCase().includes(lowerQuery) ||
        r.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Update recording notes
   */
  async updateRecordingNotes(id: string, notes: string): Promise<void> {
    const recording = this.recordings.get(id)
    if (!recording) {
      throw new Error('Recording not found')
    }

    recording.notes = notes
    await this.persist()
  }

  /**
   * Add tag to recording
   */
  async addTag(id: string, tag: string): Promise<void> {
    const recording = this.recordings.get(id)
    if (!recording) {
      throw new Error('Recording not found')
    }

    if (!recording.tags) {
      recording.tags = []
    }

    if (!recording.tags.includes(tag)) {
      recording.tags.push(tag)
      await this.persist()
    }
  }

  /**
   * Remove tag from recording
   */
  async removeTag(id: string, tag: string): Promise<void> {
    const recording = this.recordings.get(id)
    if (!recording) {
      throw new Error('Recording not found')
    }

    if (recording.tags) {
      recording.tags = recording.tags.filter((t) => t !== tag)
      await this.persist()
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(id: string): Promise<void> {
    const recording = this.recordings.get(id)
    if (!recording) {
      throw new Error('Recording not found')
    }

    // Revoke blob URL to free memory
    try {
      URL.revokeObjectURL(recording.blobUrl)
    } catch (error) {
      logger.warn('[CallRecordingStorage] Failed to revoke blob URL:', error)
    }

    this.recordings.delete(id)
    await this.persist()

    logger.info('[CallRecordingStorage] Recording deleted', { id })
  }

  /**
   * Delete multiple recordings
   */
  async deleteRecordings(ids: string[]): Promise<void> {
    for (const id of ids) {
      const recording = this.recordings.get(id)
      if (recording) {
        try {
          URL.revokeObjectURL(recording.blobUrl)
        } catch (error) {
          logger.warn('[CallRecordingStorage] Failed to revoke blob URL:', error)
        }
        this.recordings.delete(id)
      }
    }
    await this.persist()

    logger.info('[CallRecordingStorage] Recordings deleted', { count: ids.length })
  }

  /**
   * Delete all recordings
   */
  async deleteAllRecordings(): Promise<void> {
    for (const recording of this.recordings.values()) {
      try {
        URL.revokeObjectURL(recording.blobUrl)
      } catch (error) {
        logger.warn('[CallRecordingStorage] Failed to revoke blob URL:', error)
      }
    }

    this.recordings.clear()
    await this.persist()

    logger.info('[CallRecordingStorage] All recordings deleted')
  }

  /**
   * Export recording as file
   */
  exportRecording(recording: CallRecording, filename?: string): void {
    const link = document.createElement('a')
    link.href = recording.blobUrl
    link.download =
      filename ||
      `${recording.callType}_recording_${new Date(recording.startTime).toISOString()}.${this.getFileExtension(recording.mimeType)}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    logger.info('[CallRecordingStorage] Recording exported', { id: recording.id })
  }

  /**
   * Get recording metadata
   */
  getMetadata(): CallRecordingMetadata {
    const recordings = this.getAllRecordings()

    const byRoom: Record<string, number> = {}
    const byType: Record<string, number> = {}
    let totalStorage = 0

    for (const recording of recordings) {
      // Count by room
      byRoom[recording.roomId] = (byRoom[recording.roomId] || 0) + 1

      // Count by type
      byType[recording.callType] = (byType[recording.callType] || 0) + 1

      // Sum storage
      totalStorage += recording.size
    }

    return {
      totalCount: recordings.length,
      totalStorage,
      byRoom,
      byType
    }
  }

  /**
   * Get storage usage percentage
   */
  getStorageUsage(): number {
    const metadata = this.getMetadata()
    return (metadata.totalStorage / MAX_STORAGE_BYTES) * 100
  }

  /**
   * Clean up old recordings if storage is full
   */
  async cleanupOldRecordings(): Promise<void> {
    const storageUsage = this.getStorageUsage()

    if (storageUsage < 90) {
      return // Only cleanup if above 90%
    }

    logger.info('[CallRecordingStorage] Cleaning up old recordings')

    // Sort by date (oldest first)
    const sortedRecordings = this.getAllRecordings().sort((a, b) => a.startTime - b.startTime)

    // Remove oldest recordings until under 80% capacity
    const targetBytes = MAX_STORAGE_BYTES * 0.8
    let currentBytes = this.getMetadata().totalStorage

    for (const recording of sortedRecordings) {
      if (currentBytes <= targetBytes) {
        break
      }

      try {
        URL.revokeObjectURL(recording.blobUrl)
        this.recordings.delete(recording.id)
        currentBytes -= recording.size
      } catch (error) {
        logger.warn('[CallRecordingStorage] Failed to delete old recording:', error)
      }
    }

    await this.persist()

    logger.info('[CallRecordingStorage] Cleanup completed', {
      removed: sortedRecordings.length - this.recordings.size
    })
  }

  /**
   * Persist recordings to localStorage
   */
  private async persist(): Promise<void> {
    try {
      const data = Array.from(this.recordings.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      // If localStorage is full, clean up old recordings
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.warn('[CallRecordingStorage] localStorage quota exceeded, cleaning up')
        await this.cleanupOldRecordings()
        // Retry persist
        const data = Array.from(this.recordings.values())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } else {
        throw error
      }
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'video/webm': 'webm',
      'video/mp4': 'mp4'
    }

    return extensions[mimeType] || 'webm'
  }

  /**
   * Convert Blob to base64 for cloud backup
   */
  async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        // Remove data URL prefix
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Convert base64 to Blob
   */
  base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64)
    const byteArrays = []

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)
      const byteNumbers = new Array(slice.length)

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }

    return new Blob(byteArrays, { type: mimeType })
  }
}

// Create singleton instance
const callRecordingStorage = new CallRecordingStorage()

// Initialize on load
callRecordingStorage.initialize().catch((error) => {
  logger.error('[CallRecordingStorage] Initialization failed:', error)
})

export default callRecordingStorage
export { CallRecordingStorage }
