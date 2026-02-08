import { type Page, type Locator, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'

export abstract class BasePage {
  protected page: Page
  protected baseUrl: string

  constructor(page: Page) {
    this.page = page
    this.baseUrl = BASE_URL
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`)
    await this.page.waitForLoadState('networkidle')
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url()
  }

  async waitForSelector(selector: string, _options?: { timeout?: number }): Promise<Locator> {
    return this.page.locator(selector).first()
  }

  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.page
      .locator(selector)
      .first()
      .click({ timeout: options?.timeout ?? 10000 })
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().fill(value)
  }

  async type(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().type(value)
  }

  async getText(selector: string): Promise<string> {
    return this.page.locator(selector).first().textContent() ?? ''
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).first().isVisible()
  }

  async isEnabled(selector: string): Promise<boolean> {
    return await this.page.locator(selector).first().isEnabled()
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms)
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true })
  }

  protected async expectToBeVisible(selector: string, message?: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeVisible({ message })
  }

  protected async expectToHaveText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toHaveText(text)
  }

  protected async expectToContainText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toContainText(text)
  }

  protected async expectToBeDisabled(selector: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeDisabled()
  }

  protected async expectToBeEnabled(selector: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeEnabled()
  }
}
