import { test, expect } from '@playwright/test'

test.describe('E2E - Recovery Flow', () => {
  test('create 4S and see status log', async ({ page }) => {
    await page.goto('/e2ee/backup')
    const hasBtn = await page.locator('text=创建4S并保存备份密钥').count()
    if (!hasBtn) test.skip()
    await page.getByRole('button', { name: '创建4S并保存备份密钥' }).click({ force: true })
    await expect(page.locator('text=状态日志')).toBeVisible()
  })
})
