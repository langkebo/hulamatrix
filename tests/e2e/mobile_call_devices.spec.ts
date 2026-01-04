import { test, expect } from '@playwright/test'

test.describe('移动端通话设备选择与权限提示', () => {
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

  test('打开设备抽屉并权限检测提示', async ({ page }) => {
    await page.goto('/mobile/rtcCall?remoteUserId=alice&roomId=%21room%3Aexample.org&callType=1&isIncoming=true')
    // 打开设备抽屉
    await page.locator('use[href="#settings"]').first().click()
    await expect(page.getByText('设备选择')).toBeVisible()
    await expect(page.locator('[data-test-id="audio-select"]')).toBeVisible()
    await expect(page.locator('[data-test-id="video-select"]')).toBeVisible()
    // 模拟权限拒绝并点击检测
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = (() => Promise.reject(new Error('denied'))) as any
    })
    await page.locator('[data-test-id="perm-check"]').click()
    await page.waitForTimeout(200)
    const msgs = await page.evaluate(() => (window as any).__msgs)
    expect(msgs.join('\n')).toContain('请授予麦克风/摄像头权限')
  })
})
