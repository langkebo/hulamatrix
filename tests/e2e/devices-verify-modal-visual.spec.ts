import { test, expect } from '@playwright/test'

test.describe('Visual - Devices Verify Modal', () => {
  test('open verify modal and capture (dark)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const btn = page.locator('text=验证').first()
    const count = await btn.count()
    if (!count) test.skip()
    await btn.click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'devices-verify-modal-dark.png', timeout: 15000 })
  })
})
