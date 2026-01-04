import { test, expect } from '@playwright/test'

test.describe('Settings - Encryption Recovery', () => {
  test('open recovery page sections exist', async ({ page }) => {
    await page.goto('/e2ee/backup')
    await expect(page.locator('text=密钥备份与恢复')).toBeVisible()
    await expect(page.locator('text=恢复密钥')).toBeVisible()
    await expect(page.locator('text=导出房间密钥')).toBeVisible()
    await expect(page.locator('text=4S 默认密钥设置')).toBeVisible()
  })
})
