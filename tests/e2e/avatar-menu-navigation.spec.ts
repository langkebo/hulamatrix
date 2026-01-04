import { test, expect } from '@playwright/test'

test.describe('Avatar Menu Navigation (multi targets)', () => {
  test('to notification', async ({ page }) => {
    await page.goto('/home')
    const avatar = page.locator('.n-avatar').first()
    await avatar.click()
    await page.locator('text=通知').click()
    await expect(page).toHaveURL(/\/settings\/notification$/)
  })
  test('to privacy (backup)', async ({ page }) => {
    await page.goto('/home')
    const avatar = page.locator('.n-avatar').first()
    await avatar.click()
    await page.locator('text=隐私安全').click()
    await expect(page).toHaveURL(/\/e2ee\/backup$/)
  })
  test('settings dark', async ({ page }) => {
    await page.goto('/home')
    const avatar = page.locator('.n-avatar').first()
    await avatar.click()
    await page.locator('text=所有设置').click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'settings-panel-dark.png', timeout: 15000 })
  })
})
