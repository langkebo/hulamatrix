import { test, expect } from '@playwright/test'

test('app loads and renders root', async ({ page }) => {
  await page.goto('/')
  const app = page.locator('#app')
  await expect(app).toBeVisible()
})

test('feature flags panel exists', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByText('Matrix Feature Flags')
  await expect(panel).toBeVisible()
})

test('copy feature flags summary', async ({ page }) => {
  await page.goto('/')
  const btn = page.getByRole('button', { name: '复制摘要' })
  await btn.click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text.length).toBeGreaterThan(0)
})
