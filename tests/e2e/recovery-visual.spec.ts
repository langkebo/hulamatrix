import { test, expect } from '@playwright/test'

test.describe('Visual - Settings Recovery', () => {
  test('recovery page baseline', async ({ page }) => {
    await page.goto('/e2ee/backup')
    await expect(page).toHaveScreenshot('recovery-baseline.png', {
      fullPage: false,
      maxDiffPixels: 100
    })
  })
})
