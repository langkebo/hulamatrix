import { test as base, type Page, type BrowserContext, type Browser } from '@playwright/test'

export type { Page }

export interface TestFixtures {
  authenticatedContext: BrowserContext
  authenticatedPage: Page
  mobileContext: BrowserContext
  mobilePage: Page
}

export const test = base.extend<TestFixtures>({
  authenticatedContext: async (
    { context }: { context: BrowserContext },
    use: (context: BrowserContext) => Promise<void>
  ) => {
    const page = await context.newPage()
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('hula_auth_token', 'syt_ZTJldGVzdF8zNTA5MzA0Mg_GLpQIYKhXecwluHSNnbc_1YczaT')
      localStorage.setItem('hula_user_id', '@e2etest_35093042:cjystx.top')
      localStorage.setItem('hula_device_id', 'E2E_TEST_DEVICE')
    })
    await use(context)
    await page.close()
  },

  authenticatedPage: async (
    { authenticatedContext }: { authenticatedContext: BrowserContext },
    use: (page: Page) => Promise<void>
  ) => {
    const page = await authenticatedContext.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await use(page)
    await page.close()
  },

  mobileContext: async ({ browser }: { browser: Browser }, use: (context: BrowserContext) => Promise<void>) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone 14 Pro Max) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    })
    await use(context)
    await context.close()
  },

  mobilePage: async ({ mobileContext }: { mobileContext: BrowserContext }, use: (page: Page) => Promise<void>) => {
    const page = await mobileContext.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await use(page)
    await page.close()
  }
})

export { expect } from '@playwright/test'
