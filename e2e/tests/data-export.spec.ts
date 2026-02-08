import { test, expect, type Page } from '../fixtures/base.fixture'
import { SettingsPage } from '../pages/settings.page'
import { ChatPage } from '../pages/chat.page'

test.describe('Data Export', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    settingsPage = new SettingsPage(authenticatedPage)
    await settingsPage.navigateToSettings()
  })

  test.describe('Export Data Page', () => {
    test('should display export data button', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="export-data-button"]')).toBeVisible()
    })

    test('should open export modal when clicking export button', async () => {
      await settingsPage.clickExportDataButton()
      await settingsPage.expectDataExportModalToBeVisible()
    })

    test('should show export options in modal', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await expect(page.locator('[data-test="export-include-messages"]')).toBeVisible()
      await expect(page.locator('[data-test="export-include-rooms"]')).toBeVisible()
      await expect(page.locator('[data-test="export-include-contacts"]')).toBeVisible()
      await expect(page.locator('[data-test="export-include-profile"]')).toBeVisible()
    })

    test('should allow selecting export options', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-include-messages"]').click()
      await page.locator('[data-test="export-include-rooms"]').click()
    })

    test('should show progress during export', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await expect(page.locator('[data-test="export-progress"]')).toBeVisible()
    })

    test('should complete export successfully', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await settingsPage.waitForExportComplete(60000)
      await expect(page.locator('[data-test="export-complete"]')).toBeVisible()
    })

    test('should have download button after export', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await settingsPage.waitForExportComplete(60000)
      await expect(page.locator('[data-test="download-export-button"]')).toBeVisible()
    })
  })

  test.describe('Export Formats', () => {
    test('should support JSON export format', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-format-select"]').selectOption('json')
    })

    test('should support ZIP export format', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-format-select"]').selectOption('zip')
    })
  })

  test.describe('Export Date Range', () => {
    test('should allow setting start date', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-start-date"]').fill('2024-01-01')
    })

    test('should allow setting end date', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-end-date"]').fill('2024-12-31')
    })

    test('should validate date range', async ({ page }: { page: Page }) => {
      await settingsPage.clickExportDataButton()
      await page.locator('[data-test="export-start-date"]').fill('2024-12-31')
      await page.locator('[data-test="export-end-date"]').fill('2024-01-01')
      await page.locator('[data-test="start-export-button"]').click()
      await expect(page.locator('[data-test="date-error"]')).toBeVisible()
    })
  })
})

test.describe('Data Deletion', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    settingsPage = new SettingsPage(authenticatedPage)
    await settingsPage.navigateToSettings()
  })

  test.describe('Delete Account', () => {
    test('should display delete account button', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="delete-account-button"]')).toBeVisible()
    })

    test('should require confirmation before deletion', async ({ page }: { page: Page }) => {
      await settingsPage.clickDeleteAccountButton()
      await expect(page.locator('[data-test="delete-confirmation-modal"]')).toBeVisible()
      await expect(page.locator('[data-test="confirm-delete-button"]')).toBeDisabled()
    })

    test('should require typing username to confirm', async ({ page }: { page: Page }) => {
      await settingsPage.clickDeleteAccountButton()
      await page.locator('[data-test="confirm-username-input"]').fill('@e2etest_35093042:cjystx.top')
      await expect(page.locator('[data-test="confirm-delete-button"]')).toBeEnabled()
    })
  })
})

test.describe('Message Export', () => {
  let chatPage: ChatPage

  test.beforeEach(async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    chatPage = new ChatPage(authenticatedPage)
    await chatPage.navigateToChat()
  })

  test.describe('Export Messages from Chat', () => {
    test('should have export option in chat', async ({ page }: { page: Page }) => {
      await chatPage.clickSettingsButton()
      await expect(page.locator('[data-test="export-chat-button"]')).toBeVisible()
    })

    test('should export single chat', async ({ page }: { page: Page }) => {
      await chatPage.clickSettingsButton()
      await page.locator('[data-test="export-chat-button"]').click()
      await page.locator('[data-test="export-current-chat"]').click()
      await page.waitForSelector('[data-test="export-complete"]', { timeout: 30000 })
    })

    test('should export all chats', async ({ page }: { page: Page }) => {
      await chatPage.clickSettingsButton()
      await page.locator('[data-test="export-chat-button"]').click()
      await page.locator('[data-test="export-all-chats"]').click()
      await page.waitForSelector('[data-test="export-complete"]', { timeout: 60000 })
    })
  })
})

test.describe('Import Data', () => {
  test.describe('Import Page', () => {
    test('should have import data option', async ({ page }: { page: Page }) => {
      await page.goto('/settings/data')
      await expect(page.locator('[data-test="import-data-button"]')).toBeVisible()
    })

    test('should show file upload for import', async ({ page }: { page: Page }) => {
      await page.goto('/settings/data')
      await page.locator('[data-test="import-data-button"]').click()
      await expect(page.locator('[data-test="file-upload-input"]')).toBeVisible()
    })

    test('should validate imported file', async ({ page }: { page: Page }) => {
      await page.goto('/settings/data')
      await page.locator('[data-test="import-data-button"]').click()
      const fileInput = page.locator('[data-test="file-upload-input"]')
      await fileInput.setInputFiles({
        name: 'test-export.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from('mock file content')
      })
      await expect(page.locator('[data-test="import-validation"]')).toBeVisible()
    })
  })
})
