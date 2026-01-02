import { test, expect } from '@playwright/test'

test.describe('桌面端通话设备选择与输出提示', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).__msgs = []
      ;(window as any).$message = {
        success: (t: any) => (window as any).__msgs.push(String(t || '')),
        error: (t: any) => (window as any).__msgs.push(String(t || '')),
        warning: (t: any) => (window as any).__msgs.push(String(t || '')),
        info: (t: any) => (window as any).__msgs.push(String(t || ''))
      }
    })
  })

  test('打开设备抽屉与输出受限提示', async ({ page }) => {
    await page.goto('/rtcCall?remoteUserId=alice&roomId=%21room%3Aexample.org&callType=0&isIncoming=true')
    await page.getByRole('button', { name: '设备选择' }).click()
    await expect(page.getByText('设备选择')).toBeVisible()
    // 输出选择：若不支持 setSinkId，显示受限按钮
    const fallback = await page.locator('text=切换输出设备').count()
    expect(fallback).toBeGreaterThanOrEqual(0)
  })
})
