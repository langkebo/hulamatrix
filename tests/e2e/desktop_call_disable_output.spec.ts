import { test, expect } from '@playwright/test'

test.describe('桌面端输出设备选择禁用策略', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const makeEvents = (clicks: number, fails: number) => {
        const arr: any[] = []
        for (let i = 0; i < clicks; i++) arr.push({ name: 'output-select-click', ts: Date.now() - 1000 * i })
        for (let i = 0; i < fails; i++) arr.push({ name: 'output-select-failed', ts: Date.now() - 2000 * i })
        localStorage.setItem('__metrics__', JSON.stringify(arr))
      }
      makeEvents(30, 24) // 80% 失败率，满足策略
    })
  })

  test('禁用输出选择并提示', async ({ page }) => {
    await page.goto('/rtcCall?remoteUserId=alice&roomId=%21room%3Aexample.org&callType=0&isIncoming=true')
    await page.getByRole('button', { name: '设备选择' }).click()
    // 不显示输出选择下拉
    const selectCount = await page.locator('[data-test-id="output-select"]').count()
    expect(selectCount).toBe(0)
    // 显示禁用提示
    await expect(page.getByText('已临时禁用输出设备选择')).toBeVisible()
  })
})
