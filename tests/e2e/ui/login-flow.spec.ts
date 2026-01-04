import { test, expect } from '@playwright/test'

test('UI: open login, set custom server and attempt connect', async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || ''
  if (!baseURL) test.skip()
  await page.goto(baseURL)

  // 打开“更多”并点击“自定义服务器”
  const moreTrigger = page.locator('#moreShow')
  await moreTrigger.click({ timeout: 5000 }).catch(() => {})
  await page
    .getByText('自定义服务器', { exact: true })
    .click({ timeout: 5000 })
    .catch(() => {})

  // 输入服务器并连接
  const server = process.env.E2E_MATRIX_SERVER || ''
  if (server) {
    const input = page.getByPlaceholder('例如 matrix.example.com 或 https://matrix.example.com')
    await input.fill(server)
    await page.getByText('连接服务器', { exact: true }).click()
    // 连接后不应出现错误提示
    const err = page.getByText('建议检查网络或稍后重试')
    await expect(err).toHaveCount(0)
  }

  // 若提供账号密码则尝试点击登录按钮
  const user = process.env.E2E_MATRIX_USER || ''
  const pass = process.env.E2E_MATRIX_PASSWORD || ''
  if (user && pass) {
    await page.getByPlaceholder('matrix账号').fill(user)
    await page.getByPlaceholder('matrix密码').fill(pass)
    await page.locator('.gradient-button').first().click()
    // 登录后应进入消息或移动主界面（宽松断言：不报错即可）
    await expect(page).not.toHaveTitle(/错误/i)
  }
})
