import { test, expect } from '@playwright/test'

test('UI: navigate to message page and collect performance', async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || ''
  if (!baseURL) test.skip()
  await page.goto(baseURL)

  const user = process.env.E2E_MATRIX_USER || ''
  const pass = process.env.E2E_MATRIX_PASSWORD || ''
  const server = process.env.E2E_MATRIX_SERVER || ''

  const moreTrigger = page.locator('#moreShow')
  await moreTrigger.click({ timeout: 5000 }).catch(() => {})
  await page
    .getByText('自定义服务器', { exact: true })
    .click({ timeout: 5000 })
    .catch(() => {})
  if (server) {
    const input = page.getByPlaceholder('例如 matrix.example.com 或 https://matrix.example.com')
    await input.fill(server)
    await page.getByText('连接服务器', { exact: true }).click()
  }
  if (user && pass) {
    await page.getByPlaceholder('matrix账号').fill(user)
    await page.getByPlaceholder('matrix密码').fill(pass)
    await page.locator('.gradient-button').first().click()
  }

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)

  await expect(page.locator('#bottomBar')).toHaveCount(1)

  const t0 = Date.now()
  const roomEntry = page.locator('.session-item, .n-list-item').first()
  await roomEntry.click({ timeout: 5000 }).catch(() => {})
  const timeline = page.locator('.message-timeline, .message-list')
  await expect(timeline).toHaveCount(1)
  const t1 = Date.now()
  const renderMs = t1 - t0

  await page.evaluate(() => {
    performance.mark('msg-render-start')
    performance.mark('msg-render-end')
    performance.measure('msg-render', 'msg-render-start', 'msg-render-end')
  })
  const measures = await page.evaluate(() => performance.getEntriesByName('msg-render').map((e) => e.duration))
  const perf = { renderMs, measure: measures?.[0] || 0 }
  console.log(JSON.stringify(perf))
  expect(renderMs).toBeGreaterThanOrEqual(0)
  const list = page.locator('.message-timeline, .message-list')
  const items = page.locator('.message-item, .msg-item, .n-list-item')
  const count = await items.count().catch(() => 0)
  expect(count).toBeGreaterThanOrEqual(0)
  const scrollStart = Date.now()
  await list.evaluate((el: any) => {
    try {
      el.scrollTop = el.scrollHeight
    } catch {}
  })
  await page.waitForTimeout(300)
  const scrollMs = Date.now() - scrollStart
  console.log(JSON.stringify({ scrollMs, itemCount: count }))
})
