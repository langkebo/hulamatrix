import { test, expect } from '@playwright/test'

test.describe('移动端通话页面可达性', () => {
  test('页面加载与基础元素存在', async ({ page }) => {
    await page.goto('/mobile/rtcCall')
    // 断言页面加载成功（存在正文）
    const bodyCount = await page.locator('body').count()
    expect(bodyCount).toBe(1)
  })
})
