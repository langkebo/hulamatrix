import { test, expect } from '@playwright/test'

test.describe('Visual - Devices Verify Steps', () => {
  test('SAS init (desktop)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const btn = page.locator('text=验证').first()
    if ((await btn.count()) === 0) test.skip()
    await btn.click()
    await page.locator('text=SAS 验证').click()
    await expect(page).toHaveScreenshot({ name: 'devices-verify-sas-init-desktop.png', timeout: 15000 })
  })

  test('QR init (desktop)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const btn = page.locator('text=验证').first()
    if ((await btn.count()) === 0) test.skip()
    await btn.click()
    await page.locator('text=二维码验证').click()
    await expect(page).toHaveScreenshot({ name: 'devices-verify-qr-init-desktop.png', timeout: 15000 })
  })

  test('SAS init (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/e2ee/devices')
    const btn = page.locator('text=验证').first()
    if ((await btn.count()) === 0) test.skip()
    await btn.click()
    await page.locator('text=SAS 验证').click()
    await expect(page).toHaveScreenshot({ name: 'devices-verify-sas-init-mobile.png', timeout: 15000 })
  })

  test('QR init (dark)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const btn = page.locator('text=验证').first()
    if ((await btn.count()) === 0) test.skip()
    await btn.click()
    await page.locator('text=二维码验证').click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'devices-verify-qr-init-dark.png', timeout: 15000 })
  })
})
