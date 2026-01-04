import { test, expect } from '@playwright/test'

test.describe('Settings - Notification Keywords', () => {
  test('add and remove keyword', async ({ page }) => {
    await page.goto('/settings/notification')
    await expect(page.locator('text=提及&关键字')).toBeVisible()
    await page.fill('input[placeholder="关键字"]', 'matrix')
    await page.click('text=添加')
    await expect(page.locator('.n-tag:has-text("matrix")')).toBeVisible()
    await page.click('.n-tag:has-text("matrix") .n-tag__close')
    await expect(page.locator('.n-tag:has-text("matrix")')).toHaveCount(0)
  })
})
