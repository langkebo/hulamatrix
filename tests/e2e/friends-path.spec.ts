import { test, expect } from '@playwright/test'

test('mobile friends path exists and tab navigates to /mobile/mobileFriends', async ({ page }) => {
  await page.goto('/mobile/home')
  const contactsTab = page.locator('text=联系人')
  await expect(contactsTab).toBeVisible()
  await contactsTab.click()
  await expect(page).toHaveURL(/\/mobile\/mobileFriends/)
})
