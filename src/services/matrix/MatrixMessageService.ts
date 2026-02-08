import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'

export interface RichTextContent {
  body: string
  format: 'org.matrix.custom.html' | 'plain'
  formattedBody?: string
}

export interface MessageSearchResult {
  eventId: string
  roomId: string
  content: any
  sender: string
  timestamp: number
  highlights: string[]
}

export interface SearchOptions {
  query: string
  roomId?: string
  limit?: number
  before?: string
  after?: string
}

export interface BatchMessageOperation {
  operation: 'delete' | 'forward' | 'favorite' | 'mark_read' | 'unfavorite'
  eventIds: string[]
  targetRoomId?: string
}

export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: string
}

export interface FavoriteMessage {
  eventId: string
  roomId: string
  content: any
  sender: string
  timestamp: number
  addedAt: number
}

export interface TranslationConfig {
  enabled: boolean
  autoTranslate: boolean
  sourceLang: string
  targetLang: string
  translateAPI: string
}

class MatrixMessageService {
  private static instance: MatrixMessageService
  private favorites: Map<string, FavoriteMessage> = new Map()
  private messageListeners: Map<string, ((data: any) => void)[]> = new Map()

  private _favorites: Ref<FavoriteMessage[]> = ref([])
  private _translationConfig: Ref<TranslationConfig> = ref({
    enabled: false,
    autoTranslate: false,
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    translateAPI: 'google'
  })
  private _searchResults: Ref<MessageSearchResult[]> = ref([])
  private _isSearching: Ref<boolean> = ref(false)
  private _isTranslating: Ref<boolean> = ref(false)

  private constructor() {}

  static getInstance(): MatrixMessageService {
    if (!MatrixMessageService.instance) {
      MatrixMessageService.instance = new MatrixMessageService()
    }
    return MatrixMessageService.instance
  }

  get favoritesList(): Ref<FavoriteMessage[]> {
    return this._favorites
  }

  get translationConfig(): Ref<TranslationConfig> {
    return this._translationConfig
  }

  get searchResults(): Ref<MessageSearchResult[]> {
    return this._searchResults
  }

  get isSearching(): Ref<boolean> {
    return this._isSearching
  }

  get isTranslating(): Ref<boolean> {
    return this._isTranslating
  }

  async sendRichTextMessage(roomId: string, content: RichTextContent, threadId?: string): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const eventContent = {
        msgtype: 'm.text',
        body: content.body,
        format: content.format,
        formatted_body: content.formattedBody
      }

      const thread = threadId || null
      const response = await (client as any).sendEvent(roomId, thread, 'm.room.message', eventContent)
      this.notifyListeners('messageSent', { roomId, eventId: response.event_id })
      return response.event_id
    } catch (error) {
      console.error('Failed to send rich text message:', error)
      throw error
    }
  }

  async sendMarkdownMessage(roomId: string, markdown: string, threadId?: string): Promise<string> {
    const formattedBody = this.convertMarkdownToHtml(markdown)

    return this.sendRichTextMessage(
      roomId,
      {
        body: markdown,
        format: 'org.matrix.custom.html',
        formattedBody
      },
      threadId
    )
  }

  private convertMarkdownToHtml(markdown: string): string {
    const html = markdown
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/\n/g, '<br>')

    return html
  }

  async searchMessages(options: SearchOptions): Promise<MessageSearchResult[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    this._isSearching.value = true

    try {
      const searchOpts: any = {
        query: options.query,
        limit: options.limit || 50
      }

      if (options.roomId) {
        searchOpts.room_id = options.roomId
      }

      if (options.before) {
        searchOpts.before = options.before
      }

      if (options.after) {
        searchOpts.after = options.after
      }

      const response = await (client as any).searchMessageText(searchOpts)

      const results: MessageSearchResult[] =
        response.search_categories?.room_events?.results?.map((result: any) => ({
          eventId: result.result.event_id,
          roomId: result.result.room_id,
          content: result.result.content,
          sender: result.result.sender,
          timestamp: result.result.origin_server_ts,
          highlights: result.highlights || []
        })) || []

      this._searchResults.value = results
      this.notifyListeners('searchComplete', { count: results.length })

      return results
    } catch (error) {
      console.error('Failed to search messages:', error)
      return []
    } finally {
      this._isSearching.value = false
    }
  }

  async translateMessage(text: string, sourceLang?: string, targetLang?: string): Promise<TranslationResult> {
    const config = this._translationConfig.value
    const target = targetLang || config.targetLang

    if (!config.enabled) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang: sourceLang || 'unknown',
        targetLang: target
      }
    }

    this._isTranslating.value = true

    try {
      const translatedText = await this.callTranslationAPI(text, sourceLang, target)

      return {
        originalText: text,
        translatedText,
        sourceLang: sourceLang || 'auto',
        targetLang: target
      }
    } catch (error) {
      console.error('Failed to translate message:', error)
      return {
        originalText: text,
        translatedText: text,
        sourceLang: sourceLang || 'unknown',
        targetLang: target
      }
    } finally {
      this._isTranslating.value = false
    }
  }

  private async callTranslationAPI(text: string, _sourceLang?: string, targetLang?: string): Promise<string> {
    const config = this._translationConfig.value
    const target = targetLang || config.targetLang

    switch (config.translateAPI) {
      case 'google':
        return this.googleTranslate(text, target)
      case 'baidu':
        return this.baiduTranslate(text, target)
      case 'deepl':
        return this.deeplTranslate(text, target)
      default:
        return text
    }
  }

  private async googleTranslate(text: string, _targetLang: string): Promise<string> {
    try {
      const config = this._translationConfig.value
      const target = _targetLang || config.targetLang

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`

      const response = await fetch(url)
      const data = await response.json()

      if (data[0] && data[0][0]) {
        return data[0][0][0]
      }
      return text
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Google translation failed:', error)
      }
      return text
    }
  }

  private async baiduTranslate(text: string, _targetLang: string): Promise<string> {
    if (import.meta.env.DEV) {
      console.warn('[MatrixMessageService] Baidu translation requires API key configuration')
    }
    return text
  }

  private async deeplTranslate(text: string, _targetLang: string): Promise<string> {
    if (import.meta.env.DEV) {
      console.warn('[MatrixMessageService] DeepL translation requires API key configuration')
    }
    return text
  }

  async translateMessageEvent(roomId: string, eventId: string, targetLang?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    const timeline = room.getLiveTimeline()
    const event = timeline?.getEvents()?.find((e) => e.getId() === eventId)
    if (!event) return

    const content = event.getContent()
    if (!content?.body) return

    const result = await this.translateMessage(content.body as string, undefined, targetLang)

    const translatedContent = {
      ...content,
      'm.translations': {
        [targetLang || this._translationConfig.value.targetLang]: {
          original_body: content.body,
          translated_body: result.translatedText
        }
      }
    }

    await (client as any).sendEvent(roomId, null, 'm.room.message', translatedContent)
  }

  async batchOperation(operation: BatchMessageOperation): Promise<{ success: boolean; errors: string[] }> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return { success: false, errors: ['Matrix client not initialized'] }
    }

    const errors: string[] = []

    switch (operation.operation) {
      case 'delete':
        for (const eventId of operation.eventIds) {
          try {
            const targetRoom = operation.targetRoomId || ''
            await client.redactEvent(targetRoom, eventId)
          } catch (_error) {
            errors.push(`Failed to delete event ${eventId}`)
          }
        }
        break

      case 'forward':
        if (!operation.targetRoomId) {
          errors.push('Target room ID is required for forward operation')
          break
        }
        for (const eventId of operation.eventIds) {
          try {
            const room = client.getRoom(operation.targetRoomId!)
            if (!room) continue

            const timeline = room.getLiveTimeline()
            const event = timeline?.getEvents()?.find((e) => e.getId() === eventId)
            if (!event) continue

            const content = event.getContent()
            await (client as any).sendEvent(operation.targetRoomId!, null, content.msgtype || 'm.room.message', content)
          } catch (_error) {
            errors.push(`Failed to forward event ${eventId}`)
          }
        }
        break

      case 'favorite':
        {
          const rooms = client.getRooms()
          for (const eventId of operation.eventIds) {
            try {
              for (const room of rooms) {
                const timeline = room.getLiveTimeline()
                const event = timeline?.getEvents()?.find((e) => e.getId() === eventId)
                if (event) {
                  await this.addToFavorites({
                    eventId,
                    roomId: event.getRoomId() || '',
                    content: event.getContent(),
                    sender: event.getSender() || '',
                    timestamp: event.getTs(),
                    addedAt: Date.now()
                  })
                  break
                }
              }
            } catch (_error) {
              errors.push(`Failed to favorite event ${eventId}`)
            }
          }
        }
        break

      case 'unfavorite':
        for (const eventId of operation.eventIds) {
          this.favorites.delete(eventId)
        }
        this.updateFavoritesList()
        break

      case 'mark_read':
        for (const eventId of operation.eventIds) {
          try {
            const targetRoom = operation.targetRoomId || ''
            const room = client.getRoom(targetRoom)
            if (room) {
              const timeline = room.getLiveTimeline()
              const event = timeline?.getEvents()?.find((e) => e.getId() === eventId)
              if (event) {
                await client.sendReadReceipt(event)
              }
            }
          } catch (_error) {
            errors.push(`Failed to mark read event ${eventId}`)
          }
        }
        break
    }

    this.notifyListeners('batchOperationComplete', { operation: operation.operation, errors })
    return { success: errors.length === 0, errors }
  }

  async addToFavorites(message: FavoriteMessage): Promise<void> {
    this.favorites.set(message.eventId, message)
    this.updateFavoritesList()
    this.notifyListeners('favoriteAdded', { eventId: message.eventId })
  }

  async removeFromFavorites(eventId: string): Promise<void> {
    this.favorites.delete(eventId)
    this.updateFavoritesList()
    this.notifyListeners('favoriteRemoved', { eventId })
  }

  private updateFavoritesList(): void {
    this._favorites.value = Array.from(this.favorites.values()).sort((a, b) => b.addedAt - a.addedAt)
  }

  getFavorites(): FavoriteMessage[] {
    return this._favorites.value
  }

  isFavorite(eventId: string): boolean {
    return this.favorites.has(eventId)
  }

  updateTranslationConfig(config: Partial<TranslationConfig>): void {
    this._translationConfig.value = { ...this._translationConfig.value, ...config }
  }

  async editMessage(roomId: string, eventId: string, newContent: RichTextContent): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const editContent = {
      'm.new_content': {
        msgtype: 'm.text',
        body: newContent.body,
        format: newContent.format,
        formatted_body: newContent.formattedBody
      },
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: eventId
      }
    }

    await (client as any).sendEvent(roomId, null, 'm.room.message', editContent)
    this.notifyListeners('messageEdited', { roomId, eventId })
  }

  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await client.redactEvent(roomId, eventId, reason)
    this.notifyListeners('messageDeleted', { roomId, eventId })
  }

  async replyToMessage(
    roomId: string,
    replyToEventId: string,
    content: RichTextContent,
    threadId?: string
  ): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error('Room not found')
    }

    const replyContent = {
      msgtype: 'm.text',
      body: content.body,
      format: content.format,
      formatted_body: content.formattedBody,
      'm.relates_to': {
        rel_type: 'm.thread',
        'm.in_reply_to': {
          event_id: replyToEventId
        }
      }
    }

    const thread = threadId || null
    const response = await (client as any).sendEvent(roomId, thread, 'm.room.message', replyContent)
    return response.event_id
  }

  async reactToMessage(roomId: string, eventId: string, emoji: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const reactionContent = {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: eventId,
        key: emoji
      }
    }

    await (client as any).sendEvent(roomId, null, 'm.reaction', reactionContent)
    this.notifyListeners('reactionAdded', { roomId, eventId, emoji })
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.messageListeners.has(event)) {
      this.messageListeners.set(event, [])
    }
    this.messageListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.messageListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this.messageListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(data))
    }
  }

  destroy(): void {
    this.messageListeners.clear()
    this.favorites.clear()
    this._favorites.value = []
    this._searchResults.value = []
  }
}

export default MatrixMessageService
