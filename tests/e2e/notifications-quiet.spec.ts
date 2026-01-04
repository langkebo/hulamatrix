import { test, expect } from '@playwright/test'

test.describe('Settings - Quiet Hours', () => {
  test('enable quiet hours and set time', async ({ page }) => {
    await page.goto('/settings/notification')
    await expect(page.locator('text=静默时段')).toBeVisible()
    const quietSwitch = page.locator('.n-switch').nth(1)
    const before = await quietSwitch.getAttribute('class')
    await quietSwitch.click()
    const after = await quietSwitch.getAttribute('class')
    expect(before).not.toEqual(after)
    await page.fill('input[placeholder="HH:mm"]', '21:30')
    await page.fill('input[placeholder="HH:mm"]').nth(1).fill('07:30')
  })
})
