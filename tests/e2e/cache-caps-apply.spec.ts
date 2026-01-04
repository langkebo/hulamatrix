import { test, expect } from '@playwright/test'

test('cache caps apply and indicators update', async ({ page }) => {
  await page.goto('/home/settings/cache')
  await expect(page.getByText('缓存管理')).toBeVisible()
  const thumbInput = page.getByText('MB（缩略图上限）').locator('..').locator('input')
  const audioInput = page.getByText('MB（语音上限）').locator('..').locator('input')
  await thumbInput.fill('100')
  await audioInput.fill('80')
  await page.getByRole('button', { name: '应用' }).click()
  await expect(page.getByText('缓存上限已更新')).toBeVisible()
})
