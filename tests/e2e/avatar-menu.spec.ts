import { test, expect } from '@playwright/test'

test.describe('Avatar Menu Navigation', () => {
  test('open menu and go to settings', async ({ page }) => {
    await page.goto('/home')
    const avatar = page.locator('.n-avatar').first()
    await expect(avatar).toBeVisible()
    await avatar.click()
    await page.locator('text=所有设置').click()
    await expect(page).toHaveURL(/\/settings$/)
  })
})
