import { test, expect } from '@playwright/test'

test.describe('Visual - Notifications Page', () => {
  test('notifications page (desktop)', async ({ page }) => {
    await page.goto('/settings/notification')
    await expect(page).toHaveScreenshot({ name: 'notifications-page-desktop.png', timeout: 15000 })
  })
  test('notifications page (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/settings/notification')
    await expect(page).toHaveScreenshot({ name: 'notifications-page-mobile.png', timeout: 15000 })
  })
})
