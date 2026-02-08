import { BasePage } from './base.page'

export class ChatPage extends BasePage {
  private readonly chatList = '[data-test="chat-list"]'
  private readonly chatListItems = '[data-test="chat-list-item"]'
  private readonly chatRoom = '[data-test="chat-room"]'
  private readonly messageInput = '[data-test="message-input"]'
  private readonly sendButton = '[data-test="send-button"]'
  private readonly roomName = '[data-test="room-name"]'
  private readonly messageItems = '[data-test="message-item"]'
  private readonly emojiButton = '[data-test="emoji-button"]'
  private readonly attachmentButton = '[data-test="attachment-button"]'
  private readonly settingsButton = '[data-test="settings-button"]'
  private readonly backButton = '[data-test="back-button"]'
  private readonly typingIndicator = '[data-test="typing-indicator"]'
  private readonly searchInput = '[data-test="search-input"]'
  private readonly searchResults = '[data-test="search-results"]'

  async navigateToChat(): Promise<void> {
    await this.navigateTo('/chat')
  }

  async navigateToRoom(roomId: string): Promise<void> {
    await this.navigateTo(`/chat/${roomId}`)
  }

  async selectChatRoom(index: number): Promise<void> {
    await this.page.locator(this.chatListItems).nth(index).click()
  }

  async getChatRoomNames(): Promise<string[]> {
    return await this.page.locator(`${this.chatListItems} ${this.roomName}`).allTextContents()
  }

  async enterMessage(message: string): Promise<void> {
    await this.fill(this.messageInput, message)
  }

  async typeMessage(message: string): Promise<void> {
    await this.type(this.messageInput, message)
  }

  async clickSendButton(): Promise<void> {
    await this.click(this.sendButton)
  }

  async clickEmojiButton(): Promise<void> {
    await this.click(this.emojiButton)
  }

  async clickAttachmentButton(): Promise<void> {
    await this.click(this.attachmentButton)
  }

  async clickSettingsButton(): Promise<void> {
    await this.click(this.settingsButton)
  }

  async clickBackButton(): Promise<void> {
    await this.click(this.backButton)
  }

  async getMessageCount(): Promise<number> {
    return await this.page.locator(this.messageItems).count()
  }

  async getLastMessage(): Promise<string> {
    const messages = await this.page.locator(this.messageItems).all()
    return messages[messages.length - 1].textContent() ?? ''
  }

  async getLastMessageText(): Promise<string> {
    return (await this.page.locator(`${this.messageItems}:last-child .message-content`).textContent()) ?? ''
  }

  async isTypingIndicatorVisible(): Promise<boolean> {
    return await this.isVisible(this.typingIndicator)
  }

  async isMessageInputVisible(): Promise<boolean> {
    return await this.isVisible(this.messageInput)
  }

  async isSendButtonEnabled(): Promise<boolean> {
    return await this.isEnabled(this.sendButton)
  }

  async expectChatListToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.chatList, 'Chat list should be visible')
  }

  async expectChatRoomToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.chatRoom, 'Chat room should be visible')
  }

  async expectMessageInputToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.messageInput, 'Message input should be visible')
  }

  async sendMessage(message: string): Promise<void> {
    await this.enterMessage(message)
    await this.clickSendButton()
  }

  async waitForNewMessage(timeout?: number): Promise<void> {
    const initialCount = await this.getMessageCount()
    await this.page.waitForFunction(
      (selector: string, count: number) => {
        return document.querySelectorAll(selector).length > count
      },
      { timeout: timeout ?? 10000 },
      this.messageItems,
      initialCount
    )
  }

  async searchForMessage(query: string): Promise<void> {
    await this.fill(this.searchInput, query)
    await this.waitForTimeout(500)
  }

  async getSearchResults(): Promise<string[]> {
    return await this.page.locator(this.searchResults).allTextContents()
  }
}
