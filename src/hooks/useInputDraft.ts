import { cache } from '@/utils/IndexedDBCache'
import { useDebounceFn } from '@vueuse/core'

const DRAFT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

export interface DraftInfo {
  content: string
  reply?: {
    key: string
    content: string
    accountName: string
  }
  timestamp: number
}

const _getDraftKey = (roomId: string): string => `draft_${roomId}`

export function useInputDraft() {
  const saveDraft = useDebounceFn(async (roomId: string, content: string, reply?: DraftInfo['reply']) => {
    if (!roomId) return

    try {
      if (!content.trim() && !reply) {
        await cache.inputDrafts.delete(roomId)
        return
      }

      await cache.inputDrafts.set(
        roomId,
        JSON.stringify({
          content,
          reply,
          timestamp: Date.now()
        }),
        DRAFT_CACHE_TTL
      )
    } catch (error) {
      console.error('[InputDraft] Failed to save draft:', error)
    }
  }, 300)

  const loadDraft = async (roomId: string): Promise<DraftInfo | null> => {
    if (!roomId) return null

    try {
      const draft = await cache.inputDrafts.get(roomId)
      if (!draft) return null

      const parsed = JSON.parse(draft)
      return {
        content: parsed.content,
        reply: parsed.reply,
        timestamp: parsed.timestamp
      }
    } catch (error) {
      console.error('[InputDraft] Failed to load draft:', error)
      return null
    }
  }

  const clearDraft = async (roomId: string): Promise<void> => {
    if (!roomId) return

    try {
      await cache.inputDrafts.delete(roomId)
    } catch (error) {
      console.error('[InputDraft] Failed to clear draft:', error)
    }
  }

  const clearAllDrafts = async (): Promise<void> => {
    try {
      await cache.inputDrafts.clear()
    } catch (error) {
      console.error('[InputDraft] Failed to clear all drafts:', error)
    }
  }

  const getAllDrafts = async (): Promise<{ roomId: string; info: DraftInfo }[]> => {
    try {
      const drafts = await cache.inputDrafts.getAll()
      return drafts.map((draft) => ({
        roomId: draft.key,
        info: {
          content: draft.content,
          reply: undefined,
          timestamp: draft.timestamp
        }
      }))
    } catch (error) {
      console.error('[InputDraft] Failed to get all drafts:', error)
      return []
    }
  }

  const hasDraft = async (roomId: string): Promise<boolean> => {
    if (!roomId) return false

    try {
      const draft = await cache.inputDrafts.get(roomId)
      return !!draft && draft.trim().length > 0
    } catch (error) {
      console.error('[InputDraft] Failed to check draft:', error)
      return false
    }
  }

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    clearAllDrafts,
    getAllDrafts,
    hasDraft
  }
}
