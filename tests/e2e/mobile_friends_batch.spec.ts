import { test, expect } from '@playwright/test'

test.describe('移动端好友工作台批量审批', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/_synapse/client/friends**', async (route) => {
      const url = new URL(route.request().url())
      const action = url.searchParams.get('action')
      let body: any = {}
      if (action === 'categories') {
        body = { categories: [{ id: 'default', name: '默认' }] }
      } else if (action === 'list') {
        body = { friends: [] }
      } else if (action === 'pending_requests') {
        body = {
          requests: [
            { request_id: 'req1', requester_id: 'uA', target_id: 'me' },
            { request_id: 'req2', requester_id: 'uB', target_id: 'me' }
          ]
        }
      } else if (action === 'stats') {
        body = { accepted: 0 }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.addInitScript(() => {
      ;(window as any).__msgs = []
      ;(window as any).$message = {
        success: (t: any) => (window as any).__msgs.push(String(t || '')),
        error: (t: any) => (window as any).__msgs.push(String(t || '')),
        warning: (t: any) => (window as any).__msgs.push(String(t || '')),
        info: (t: any) => (window as any).__msgs.push(String(t || ''))
      }
    })
  })

  test('选择并批量接受', async ({ page }) => {
    await page.goto('/mobile/friends')
    await page.getByRole('button', { name: '待处理' }).click()
    await page.getByText('uA → me').click()
    await page.getByText('uB → me').click()
    await page.getByRole('button', { name: '批量接受' }).click()
    await page.waitForTimeout(200)
    const msgs = await page.evaluate(() => (window as any).__msgs)
    expect(msgs.join('\n')).toContain('已批量接受')
  })
})
