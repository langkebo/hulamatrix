import { test, expect } from '@playwright/test'

test.describe('Devices Verify Steps via data-test selectors', () => {
  test('SAS flow buttons', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const open = page.locator('text=验证').first()
    if ((await open.count()) === 0) test.skip()
    await open.click()
    const sasStart = page.locator('[data-test="sas-start"]')
    await expect(sasStart).toBeVisible()
    await sasStart.click()
    const sasConfirm = page.locator('[data-test="sas-confirm"]')
    const sasCancel = page.locator('[data-test="sas-cancel"]')
    await expect(page).toHaveScreenshot({ name: 'verify-sas-flow.png', timeout: 15000 })
    if (await sasConfirm.count()) await sasConfirm.click()
    else if (await sasCancel.count()) await sasCancel.click()
  })

  test('QR flow buttons (dark)', async ({ page }) => {
    await page.goto('/e2ee/devices')
    const open = page.locator('text=验证').first()
    if ((await open.count()) === 0) test.skip()
    await open.click()
    const qrStart = page.locator('[data-test="qr-start"]')
    await expect(qrStart).toBeVisible()
    await qrStart.click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page).toHaveScreenshot({ name: 'verify-qr-flow-dark.png', timeout: 15000 })
    const qrConfirm = page.locator('[data-test="qr-confirm"]')
    const qrCancel = page.locator('[data-test="qr-cancel"]')
    if (await qrConfirm.count()) await qrConfirm.click()
    else if (await qrCancel.count()) await qrCancel.click()
  })
})
