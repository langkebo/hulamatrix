import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import MatrixMessageService from '../../src/services/matrix/MatrixMessageService'
import MatrixClientService from '../../src/services/matrix/MatrixClientService'

const createMockClient = () => ({
  sendEvent: vi.fn().mockResolvedValue({ event_id: '$event_id' }),
  redactEvent: vi.fn().mockResolvedValue(undefined),
  searchMessageText: vi.fn().mockResolvedValue({
    search_categories: {
      room_events: {
        results: []
      }
    }
  }),
  getRoom: vi.fn(() => ({
    getLiveTimeline: () => ({
      getEvents: () => []
    })
  })),
  getRooms: vi.fn(() => []),
  sendReadReceipt: vi.fn().mockResolvedValue(undefined)
})

describe('MatrixMessageService', () => {
  let messageService: MatrixMessageService
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    vi.clearAllMocks()
    messageService = MatrixMessageService.getInstance()
    mockClient = createMockClient()

    vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
      getClient: () => mockClient
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('消息发送', () => {
    it('应该发送富文本消息', async () => {
      const content = {
        body: '测试消息',
        format: 'org.matrix.custom.html' as const,
        formattedBody: '<p>测试消息</p>'
      }

      const eventId = await messageService.sendRichTextMessage('!room:example.com', content)

      expect(eventId).toBe('$event_id')
    })

    it('应该发送Markdown消息', async () => {
      const markdown = '# 标题\n**粗体** *斜体*'
      const eventId = await messageService.sendMarkdownMessage('!room:example.com', markdown)

      expect(eventId).toBe('$event_id')
    })

    it('应该支持线程消息', async () => {
      const content = {
        body: '线程消息',
        format: 'plain' as const
      }

      const eventId = await messageService.sendRichTextMessage('!room:example.com', content, '!thread:example.com')

      expect(eventId).toBe('$event_id')
    })
  })

  describe('消息编辑', () => {
    it('应该编辑消息', async () => {
      const newContent = {
        body: '编辑后的消息',
        format: 'plain' as const
      }

      await messageService.editMessage('!room:example.com', '$event_id', newContent)

      expect(mockClient.sendEvent).toHaveBeenCalled()
    })

    it('应该支持富文本编辑', async () => {
      const newContent = {
        body: '编辑后的消息',
        format: 'org.matrix.custom.html' as const,
        formattedBody: '<p>编辑后的消息</p>'
      }

      await messageService.editMessage('!room:example.com', '$event_id', newContent)

      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        null,
        'm.room.message',
        expect.objectContaining({
          'm.new_content': expect.objectContaining({
            format: 'org.matrix.custom.html'
          })
        })
      )
    })
  })

  describe('消息删除', () => {
    it('应该删除消息', async () => {
      await messageService.deleteMessage('!room:example.com', '$event_id')

      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room:example.com', '$event_id', undefined)
    })

    it('应该支持删除原因', async () => {
      const reason = '消息不当'
      await messageService.deleteMessage('!room:example.com', '$event_id', reason)

      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room:example.com', '$event_id', reason)
    })
  })

  describe('消息回复', () => {
    it('应该回复消息', async () => {
      const content = {
        body: '回复内容',
        format: 'plain' as const
      }

      const eventId = await messageService.replyToMessage('!room:example.com', '$reply_id', content)

      expect(eventId).toBe('$event_id')
    })

    it('应该支持线程回复', async () => {
      const content = {
        body: '线程回复',
        format: 'plain' as const
      }

      const eventId = await messageService.replyToMessage(
        '!room:example.com',
        '$reply_id',
        content,
        '!thread:example.com'
      )

      expect(eventId).toBe('$event_id')
    })
  })

  describe('消息搜索', () => {
    it('应该搜索消息', async () => {
      const results = await messageService.searchMessages({
        query: '搜索关键词'
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('应该支持房间过滤', async () => {
      const results = await messageService.searchMessages({
        query: '搜索关键词',
        roomId: '!room:example.com'
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('应该支持结果限制', async () => {
      const results = await messageService.searchMessages({
        query: '搜索关键词',
        limit: 20
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('应该支持分页', async () => {
      const results = await messageService.searchMessages({
        query: '搜索关键词',
        before: '$before_event',
        after: '$after_event'
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('应该设置搜索状态', () => {
      expect(messageService.isSearching.value).toBe(false)

      messageService.searchMessages({ query: 'test' })

      expect(messageService.isSearching.value).toBe(true)
    })
  })

  describe('消息翻译', () => {
    it('应该翻译消息', async () => {
      const result = await messageService.translateMessage('Hello', 'en', 'zh-CN')

      expect(result).toHaveProperty('originalText')
      expect(result).toHaveProperty('translatedText')
      expect(result).toHaveProperty('sourceLang')
      expect(result).toHaveProperty('targetLang')
    })

    it('应该支持自动语言检测', async () => {
      const result = await messageService.translateMessage('Hello')

      expect(result.sourceLang).toBe('unknown')
    })

    it('应该使用默认目标语言', async () => {
      const result = await messageService.translateMessage('Hello')

      expect(result.targetLang).toBe('zh-CN')
    })

    it('应该设置翻译状态', async () => {
      expect(messageService.isTranslating.value).toBe(false)

      await messageService.translateMessage('test')

      expect(messageService.isTranslating.value).toBe(false)
    })

    it('应该翻译消息事件', async () => {
      ;(mockClient.getRoom as any).mockReturnValue({
        getLiveTimeline: () => ({
          getEvents: () => [
            {
              getId: () => '$event_id',
              getContent: () => ({ body: 'Hello' })
            }
          ]
        })
      })

      await messageService.translateMessageEvent('!room:example.com', '$event_id', 'zh-CN')

      expect(mockClient.sendEvent).toHaveBeenCalled()
    })
  })

  describe('批量操作', () => {
    it('应该批量删除消息', async () => {
      const result = await messageService.batchOperation({
        operation: 'delete',
        eventIds: ['$event1', '$event2']
      })

      expect(result.success).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('应该批量转发消息', async () => {
      const result = await messageService.batchOperation({
        operation: 'forward',
        eventIds: ['$event1', '$event2'],
        targetRoomId: '!target:example.com'
      })

      expect(result.success).toBe(true)
    })

    it('应该批量收藏消息', async () => {
      const result = await messageService.batchOperation({
        operation: 'favorite',
        eventIds: ['$event1', '$event2']
      })

      expect(result.success).toBe(true)
    })

    it('应该批量标记已读', async () => {
      const result = await messageService.batchOperation({
        operation: 'mark_read',
        eventIds: ['$event1', '$event2']
      })

      expect(result.success).toBe(true)
    })

    it('应该批量取消收藏', async () => {
      const result = await messageService.batchOperation({
        operation: 'unfavorite',
        eventIds: ['$event1', '$event2']
      })

      expect(result.success).toBe(true)
    })

    it('应该处理操作错误', async () => {
      mockClient.redactEvent.mockRejectedValue(new Error('删除失败'))

      const result = await messageService.batchOperation({
        operation: 'delete',
        eventIds: ['$event1', '$event2']
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('收藏管理', () => {
    it('应该添加收藏', async () => {
      const favorite = {
        eventId: '$event_id',
        roomId: '!room:example.com',
        content: { body: '收藏的消息' },
        sender: '@user:example.com',
        timestamp: Date.now(),
        addedAt: Date.now()
      }

      await messageService.addToFavorites(favorite)

      expect(messageService.isFavorite('$event_id')).toBe(true)
    })

    it('应该移除收藏', async () => {
      await messageService.addToFavorites({
        eventId: '$event_id',
        roomId: '!room:example.com',
        content: {},
        sender: '@user:example.com',
        timestamp: Date.now(),
        addedAt: Date.now()
      })

      await messageService.removeFromFavorites('$event_id')

      expect(messageService.isFavorite('$event_id')).toBe(false)
    })

    it('应该获取收藏列表', () => {
      const favorites = messageService.getFavorites()

      expect(Array.isArray(favorites)).toBe(true)
    })

    it('应该按时间排序收藏', async () => {
      const favorite1 = {
        eventId: '$event1',
        roomId: '!room:example.com',
        content: {},
        sender: '@user:example.com',
        timestamp: Date.now(),
        addedAt: Date.now() - 1000
      }

      const favorite2 = {
        eventId: '$event2',
        roomId: '!room:example.com',
        content: {},
        sender: '@user:example.com',
        timestamp: Date.now(),
        addedAt: Date.now()
      }

      await messageService.addToFavorites(favorite1)
      await messageService.addToFavorites(favorite2)

      const favorites = messageService.getFavorites()

      expect(favorites[0].eventId).toBe('$event2')
      expect(favorites[1].eventId).toBe('$event1')
    })
  })

  describe('翻译配置', () => {
    it('应该更新翻译配置', () => {
      const newConfig = {
        enabled: true,
        autoTranslate: true,
        targetLang: 'en'
      }

      messageService.updateTranslationConfig(newConfig)

      expect(messageService.translationConfig.value.enabled).toBe(true)
      expect(messageService.translationConfig.value.autoTranslate).toBe(true)
      expect(messageService.translationConfig.value.targetLang).toBe('en')
    })

    it('应该保留未修改的配置', () => {
      const originalSourceLang = messageService.translationConfig.value.sourceLang

      messageService.updateTranslationConfig({ targetLang: 'en' })

      expect(messageService.translationConfig.value.sourceLang).toBe(originalSourceLang)
    })

    it('应该获取翻译配置', () => {
      const config = messageService.translationConfig.value

      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('autoTranslate')
      expect(config).toHaveProperty('sourceLang')
      expect(config).toHaveProperty('targetLang')
      expect(config).toHaveProperty('translateAPI')
    })
  })

  describe('事件监听', () => {
    it('应该支持事件监听', () => {
      const listener = vi.fn()
      const messageServiceInstance = messageService as any
      messageServiceInstance.on('messageSent', listener)

      const listeners = messageServiceInstance.messageListeners.get('messageSent')
      expect(listeners).toContain(listener)
    })

    it('应该支持事件取消监听', () => {
      const listener = vi.fn()
      const messageServiceInstance = messageService as any
      messageServiceInstance.on('messageSent', listener)
      messageServiceInstance.off('messageSent', listener)

      const listeners = messageServiceInstance.messageListeners.get('messageSent')
      expect(listeners).not.toContain(listener)
    })

    it('应该触发事件', () => {
      const listener = vi.fn()
      const messageServiceInstance = messageService as any
      messageServiceInstance.on('messageSent', listener)
      messageServiceInstance.notifyListeners('messageSent', { roomId: '!room:example.com', eventId: '$event_id' })

      expect(listener).toHaveBeenCalledWith({ roomId: '!room:example.com', eventId: '$event_id' })
    })
  })

  describe('Markdown转换', () => {
    it('应该转换标题', () => {
      const markdown = '# 标题1\n## 标题2\n### 标题3'
      const html = messageService['convertMarkdownToHtml'](markdown)

      expect(html).toContain('<h1>标题1</h1>')
      expect(html).toContain('<h2>标题2</h2>')
      expect(html).toContain('<h3>标题3</h3>')
    })

    it('应该转换粗体和斜体', () => {
      const markdown = '**粗体** *斜体*'
      const html = messageService['convertMarkdownToHtml'](markdown)

      expect(html).toContain('<strong>粗体</strong>')
      expect(html).toContain('<em>斜体</em>')
    })

    it('应该转换链接', () => {
      const markdown = '[链接文本](https://example.com)'
      const html = messageService['convertMarkdownToHtml'](markdown)

      expect(html).toContain('<a href="https://example.com">链接文本</a>')
    })

    it('应该转换删除线', () => {
      const markdown = '~~删除线~~'
      const html = messageService['convertMarkdownToHtml'](markdown)

      expect(html).toContain('<del>删除线</del>')
    })

    it('应该转换代码块', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const html = messageService['convertMarkdownToHtml'](markdown)

      expect(html).toContain('<pre><code>')
      expect(html).toContain('</code></pre>')
    })
  })
})
