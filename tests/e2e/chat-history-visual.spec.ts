import { test, expect } from '@playwright/test'

test.describe('Chat History Visual', () => {
  test('light theme snapshot with selectors', async ({ page }) => {
    await page.goto('/chat-history?roomId=!demo:server')
    const dateTag = page.locator('[data-test="history-date-tag"]').first()
    const msgItem = page.locator('[data-test="history-message-item"]').first()
    if ((await dateTag.count()) === 0 && (await msgItem.count()) === 0) {
      test.skip()
    }
    await expect(page).toHaveScreenshot({ name: 'chat-history-light.png', timeout: 15000 })
  })

  test('dark theme snapshot with selectors', async ({ page }) => {
    await page.goto('/chat-history?roomId=!demo:server')
    const dateTag = page.locator('[data-test="history-date-tag"]').first()
    const msgItem = page.locator('[data-test="history-message-item"]').first()
    if ((await dateTag.count()) === 0 && (await msgItem.count()) === 0) {
      test.skip()
    }
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'chat-history-dark.png', timeout: 15000 })
  })
})
