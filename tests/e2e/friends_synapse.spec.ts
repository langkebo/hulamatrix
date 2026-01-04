import { test, expect } from '@playwright/test'

test.describe('Synapse 好友工作台', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/_synapse/client/friends**', async (route) => {
      const url = new URL(route.request().url())
      const action = url.searchParams.get('action')
      let body: any = {}
      if (action === 'categories') {
        body = {
          categories: [
            { id: 'default', name: '默认' },
            { id: 'work', name: '工作' }
          ]
        }
      } else if (action === 'list') {
        body = {
          friends: [
            { user_id: 'alice', category_id: 'default' },
            { user_id: 'bob', category_id: 'work' }
          ]
        }
      } else if (action === 'pending_requests') {
        body = { requests: [{ request_id: 'req1', requester_id: 'charlie', target_id: 'alice' }] }
      } else if (action === 'stats') {
        body = { accepted: 2, groups: 2 }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
  })

  test('刷新并展示分组与待处理', async ({ page }) => {
    await page.goto('/synapse/friends')
    await page.getByRole('button', { name: '刷新' }).click()
    await page.waitForTimeout(200)
    // 检查分类标题渲染
    await expect(page.getByText('默认')).toBeVisible()
    await expect(page.getByText('工作')).toBeVisible()
    // 检查待处理列表
    await expect(page.getByText('charlie → alice')).toBeVisible()
  })
})
