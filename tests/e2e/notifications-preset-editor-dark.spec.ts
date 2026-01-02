import { test, expect } from '@playwright/test'

test.describe('Visual - Notifications Preset Editor (dark)', () => {
  test('open preset editor and capture dark', async ({ page }) => {
    await page.goto('/settings/notification')
    const btn = page.locator('[data-test="preset-editor-open"]').first()
    const count = await btn.count()
    if (!count) test.skip()
    await btn.click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'notifications-preset-editor-dark.png', timeout: 15000 })
  })
})
