import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS === 'true'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'e2e-report' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: HEADLESS }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], headless: HEADLESS }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], headless: HEADLESS }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], headless: HEADLESS }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'], headless: HEADLESS }
    }
  ],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2
    }
  }
})
