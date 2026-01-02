import { test, expect } from '@playwright/test'

test('cache management page shows metrics and allows clear', async ({ page }) => {
  await page.goto('/home/settings/cache')
  await expect(page.getByText('缓存管理')).toBeVisible()
  await expect(page.getByText('指标')).toBeVisible()
  await page.getByRole('button', { name: '清理缩略图缓存' }).click()
  await page.getByRole('button', { name: '清理语音缓存' }).click()
})
