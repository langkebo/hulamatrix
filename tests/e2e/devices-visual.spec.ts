import { test, expect } from '@playwright/test'

test.describe('Visual - Devices Verification Area', () => {
  test('devices page status area (desktop)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    await expect(page).toHaveScreenshot({ name: 'devices-page-desktop.png', timeout: 15000 })
  })
  test('devices page status area (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/e2ee/devices')
    await expect(page).toHaveScreenshot({ name: 'devices-page-mobile.png', timeout: 15000 })
  })
})
