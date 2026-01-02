import { test, expect } from '@playwright/test'

test.describe('RTC 演示页', () => {
  test('获取 TURN 并创建 Peer', async ({ page }) => {
    await page.goto('/demo/rtc')
    await page.getByRole('button', { name: '获取 TURN 配置' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '创建本地 Peer 以校验 ICE' }).click()
    await page.waitForTimeout(300)
    const hasInfo = await page.locator('text=Peer 已创建').count()
    expect(hasInfo).toBeGreaterThan(0)
  })
})
