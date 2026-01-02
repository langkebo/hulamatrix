import { test, expect } from '@playwright/test'

test.describe('Visual - Settings Notifications', () => {
  test('notifications page baseline', async ({ page }) => {
    await page.goto('/settings/notification')
    await expect(page).toHaveScreenshot('notifications-baseline.png', {
      fullPage: false,
      maxDiffPixels: 100
    })
  })
})
