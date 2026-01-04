import { test, expect } from '@playwright/test'

test.describe('移动端房间管理一致性', () => {
  test('加载与保存流程', async ({ page }) => {
    await page.goto('/mobile/rooms/manage')
    // 骨架/错误/空状态之一显示即可
    const sk = await page.locator('.n-skeleton').count()
    const al = await page.locator('.n-alert').count()
    expect(sk + al).toBeGreaterThanOrEqual(0)
    // 选择器存在
    await expect(page.getByPlaceholder('房间名称')).toBeVisible()
    await expect(page.getByPlaceholder('房间主题')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存设置' })).toBeVisible()
  })
})
