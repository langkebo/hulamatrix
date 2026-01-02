import { test, expect } from '@playwright/test'

test('mobile approvals list route is reachable', async ({ page }) => {
  await page.goto('/mobile/mobileMy/myMessages')
  await expect(page.locator('text=申请')).toBeVisible({ timeout: 10000 })
})
