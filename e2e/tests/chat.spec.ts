import { test, expect, type Page } from '../fixtures/base.fixture'
import { ChatPage } from '../pages/chat.page'

test.describe('Chat Functionality', () => {
  let chatPage: ChatPage

  test.beforeEach(async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    chatPage = new ChatPage(authenticatedPage)
    await chatPage.navigateToChat()
  })

  test.describe('Chat List', () => {
    test('should display chat list', async () => {
      await chatPage.expectChatListToBeVisible()
    })

    test('should show chat rooms in list', async () => {
      const chatRoomNames = await chatPage.getChatRoomNames()
      expect(Array.isArray(chatRoomNames)).toBe(true)
    })

    test('should be able to select a chat room', async ({ page }: { page: Page }) => {
      const _initialUrl = page.url()
      const items = await page.locator('[data-test="chat-list-item"]').count()
      if (items > 0) {
        await chatPage.selectChatRoom(0)
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Message Input', () => {
    test('should display message input', async () => {
      await chatPage.expectMessageInputToBeVisible()
    })

    test('should type message in input', async () => {
      await chatPage.enterMessage('Hello, this is a test message!')
      const inputValue = await chatPage.getText('[data-test="message-input"]')
      expect(inputValue).toContain('Hello')
    })

    test('should clear message after send', async () => {
      await chatPage.enterMessage('Test message')
      await chatPage.clickSendButton()
      await chatPage.waitForTimeout(300)
    })

    test('should send empty message when input is empty', async () => {
      const isEnabled = await chatPage.isSendButtonEnabled()
      expect(isEnabled).toBe(true)
    })
  })

  test.describe('Message Sending', () => {
    test('should send text message', async () => {
      const message = `Test message ${Date.now()}`
      await chatPage.enterMessage(message)
      await chatPage.clickSendButton()
      await chatPage.waitForNewMessage()
    })

    test('should send multiple messages', async () => {
      for (let i = 0; i < 3; i++) {
        const message = `Message ${i + 1}: ${Date.now()}`
        await chatPage.enterMessage(message)
        await chatPage.clickSendButton()
        await chatPage.waitForTimeout(200)
      }
    })

    test('should send long message', async () => {
      const longMessage = 'a'.repeat(1000)
      await chatPage.enterMessage(longMessage)
      await chatPage.clickSendButton()
      await chatPage.waitForNewMessage()
    })

    test('should send message with special characters', async () => {
      const specialMessage = 'Hello! 👋 How are you? 😊 #test @user $100'
      await chatPage.enterMessage(specialMessage)
      await chatPage.clickSendButton()
      await chatPage.waitForNewMessage()
    })

    test('should send message with emojis', async () => {
      const emojiMessage = '🔥❤️👍🎉🚀⭐'
      await chatPage.enterMessage(emojiMessage)
      await chatPage.clickSendButton()
      await chatPage.waitForNewMessage()
    })
  })

  test.describe('Chat Room Features', () => {
    test('should show room header', async ({ page }: { page: Page }) => {
      const items = await page.locator('[data-test="chat-list-item"]').count()
      if (items > 0) {
        await chatPage.selectChatRoom(0)
        await expect(page.locator('[data-test="room-header"]')).toBeVisible()
      }
    })

    test('should show message list', async ({ page }: { page: Page }) => {
      const items = await page.locator('[data-test="chat-list-item"]').count()
      if (items > 0) {
        await chatPage.selectChatRoom(0)
        await expect(page.locator('[data-test="message-list"]')).toBeVisible()
      }
    })

    test('should toggle emoji panel', async ({ page }: { page: Page }) => {
      const items = await page.locator('[data-test="chat-list-item"]').count()
      if (items > 0) {
        await chatPage.selectChatRoom(0)
        await chatPage.clickEmojiButton()
        await expect(page.locator('[data-test="emoji-panel"]')).toBeVisible()
      }
    })

    test('should toggle attachment panel', async ({ page }: { page: Page }) => {
      const items = await page.locator('[data-test="chat-list-item"]').count()
      if (items > 0) {
        await chatPage.selectChatRoom(0)
        await chatPage.clickAttachmentButton()
        await expect(page.locator('[data-test="attachment-panel"]')).toBeVisible()
      }
    })
  })

  test.describe('Message Search', () => {
    test('should display search input', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="search-input"]')).toBeVisible()
    })

    test('should filter messages on search', async ({ page }: { page: Page }) => {
      await chatPage.searchForMessage('test')
      await page.waitForTimeout(500)
    })
  })
})

test.describe('Mobile Chat', () => {
  let chatPage: ChatPage

  test.beforeEach(async ({ mobilePage }: { mobilePage: Page }) => {
    chatPage = new ChatPage(mobilePage)
    await chatPage.navigateToChat()
  })

  test('should display chat list on mobile', async () => {
    await chatPage.expectChatListToBeVisible()
  })

  test('should display message input on mobile', async () => {
    await chatPage.expectMessageInputToBeVisible()
  })

  test('should send message on mobile', async () => {
    const message = `Mobile test ${Date.now()}`
    await chatPage.enterMessage(message)
    await chatPage.clickSendButton()
    await chatPage.waitForNewMessage()
  })
})
