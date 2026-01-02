import { test, expect } from '@playwright/test'

test.describe('Settings - Notifications', () => {
  test('toggle first switch on notifications page', async ({ page }) => {
    await page.goto('/settings/notification')
    const switchEl = page.locator('.n-switch').first()
    await expect(switchEl).toBeVisible()
    const beforeClass = await switchEl.getAttribute('class')
    await switchEl.click()
    const afterClass = await switchEl.getAttribute('class')
    expect(beforeClass).not.toEqual(afterClass)
  })
})
