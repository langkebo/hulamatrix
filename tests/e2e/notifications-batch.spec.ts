import { test, expect } from '@playwright/test'

test.describe('Settings - Notification Batch', () => {
  test('batch set with progress and result stats', async ({ page }) => {
    await page.goto('/settings/notification?test=1')
    const list = page.locator('.n-flex > .n-scrollbar').first()
    await expect(list).toBeVisible()
    const firstCheckbox = page.locator('.n-checkbox').first()
    await firstCheckbox.click()
    const batchAllow = page.locator('[data-test="batch-allow"]').first()
    await batchAllow.click()
    const progressBar = page.locator('.n-progress')
    await expect(progressBar).toBeVisible()
    await expect(page.locator('text=正在处理')).toBeVisible()
  })
})
