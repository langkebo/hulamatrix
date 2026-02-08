import { test, expect, type Page } from '../fixtures/base.fixture'
import { SettingsPage } from '../pages/settings.page'

test.describe('Settings Page', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    settingsPage = new SettingsPage(authenticatedPage)
    await settingsPage.navigateToSettings()
  })

  test.describe('Settings Navigation', () => {
    test('should display settings panel', async () => {
      await settingsPage.expectSettingsPanelToBeVisible()
    })

    test('should have all settings sections', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="settings-appearance"]')).toBeVisible()
      await expect(page.locator('[data-test="settings-messages"]')).toBeVisible()
      await expect(page.locator('[data-test="settings-calls"]')).toBeVisible()
      await expect(page.locator('[data-test="settings-privacy"]')).toBeVisible()
      await expect(page.locator('[data-test="settings-accessibility"]')).toBeVisible()
    })
  })

  test.describe('Appearance Settings', () => {
    test('should display theme selector', async ({ page }: { page: Page }) => {
      await settingsPage.clickAppearanceSection()
      await expect(page.locator('[data-test="theme-select"]')).toBeVisible()
    })

    test('should display language selector', async ({ page }: { page: Page }) => {
      await settingsPage.clickAppearanceSection()
      await expect(page.locator('[data-test="language-select"]')).toBeVisible()
    })

    test('should display font size slider', async ({ page }: { page: Page }) => {
      await settingsPage.clickAppearanceSection()
      await expect(page.locator('[data-test="font-size-slider"]')).toBeVisible()
    })

    test('should change theme to light', async () => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.selectTheme('light')
      await settingsPage.saveSettings()
    })

    test('should change theme to dark', async () => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.selectTheme('dark')
      await settingsPage.saveSettings()
    })

    test('should change language', async () => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.selectLanguage('en-US')
      await settingsPage.saveSettings()
    })

    test('should adjust font size', async () => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.setFontSize(18)
      await settingsPage.saveSettings()
    })
  })

  test.describe('Message Settings', () => {
    test('should display auto-read toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickMessagesSection()
      await expect(page.locator('[data-test="auto-read-switch"]')).toBeVisible()
    })

    test('should display emoji panel toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickMessagesSection()
      await expect(page.locator('[data-test="emoji-panel-switch"]')).toBeVisible()
    })

    test('should toggle auto-read', async () => {
      await settingsPage.clickMessagesSection()
      const initialState = await settingsPage.isAutoReadEnabled()
      await settingsPage.toggleAutoRead()
      const newState = await settingsPage.isAutoReadEnabled()
      expect(newState).not.toBe(initialState)
    })

    test('should toggle emoji panel', async () => {
      await settingsPage.clickMessagesSection()
      const initialState = await settingsPage.isEmojiPanelEnabled()
      await settingsPage.toggleEmojiPanel()
      const newState = await settingsPage.isEmojiPanelEnabled()
      expect(newState).not.toBe(initialState)
    })
  })

  test.describe('Call Settings', () => {
    test('should display noise suppression toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickCallsSection()
      await expect(page.locator('[data-test="noise-suppression-switch"]')).toBeVisible()
    })

    test('should toggle noise suppression', async () => {
      await settingsPage.clickCallsSection()
      const initialState = await settingsPage.isNoiseSuppressionEnabled()
      await settingsPage.toggleNoiseSuppression()
      const newState = await settingsPage.isNoiseSuppressionEnabled()
      expect(newState).not.toBe(initialState)
    })
  })

  test.describe('Accessibility Settings', () => {
    test('should display screen reader toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickAccessibilitySection()
      await expect(page.locator('[data-test="screen-reader-switch"]')).toBeVisible()
    })

    test('should display high contrast toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickAccessibilitySection()
      await expect(page.locator('[data-test="high-contrast-switch"]')).toBeVisible()
    })

    test('should display reduce motion toggle', async ({ page }: { page: Page }) => {
      await settingsPage.clickAccessibilitySection()
      await expect(page.locator('[data-test="reduce-motion-switch"]')).toBeVisible()
    })

    test('should toggle screen reader', async () => {
      await settingsPage.clickAccessibilitySection()
      const initialState = await settingsPage.isScreenReaderEnabled()
      await settingsPage.toggleScreenReader()
      const newState = await settingsPage.isScreenReaderEnabled()
      expect(newState).not.toBe(initialState)
    })

    test('should toggle high contrast', async () => {
      await settingsPage.clickAccessibilitySection()
      const initialState = await settingsPage.isHighContrastEnabled()
      await settingsPage.toggleHighContrast()
      const newState = await settingsPage.isHighContrastEnabled()
      expect(newState).not.toBe(initialState)
    })

    test('should toggle reduce motion', async () => {
      await settingsPage.clickAccessibilitySection()
      const initialState = await settingsPage.isReduceMotionEnabled()
      await settingsPage.toggleReduceMotion()
      const newState = await settingsPage.isReduceMotionEnabled()
      expect(newState).not.toBe(initialState)
    })
  })

  test.describe('Settings Actions', () => {
    test('should have save button', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="save-settings-button"]')).toBeVisible()
    })

    test('should have reset button', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="reset-settings-button"]')).toBeVisible()
    })

    test('should save settings', async ({ page }: { page: Page }) => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.selectTheme('dark')
      await settingsPage.saveSettings()
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
    })

    test('should reset settings to defaults', async ({ page }: { page: Page }) => {
      await settingsPage.clickAppearanceSection()
      await settingsPage.selectTheme('light')
      await settingsPage.resetToDefaults()
      await page.waitForTimeout(500)
    })
  })
})

test.describe('Mobile Settings', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ mobilePage }: { mobilePage: Page }) => {
    settingsPage = new SettingsPage(mobilePage)
    await settingsPage.navigateToSettings()
  })

  test('should display settings panel on mobile', async () => {
    await settingsPage.expectSettingsPanelToBeVisible()
  })

  test('should navigate through settings sections on mobile', async ({ page }: { page: Page }) => {
    await expect(page.locator('[data-test="settings-appearance"]')).toBeVisible()
    await page.locator('[data-test="settings-appearance"]').click()
    await expect(page.locator('[data-test="theme-select"]')).toBeVisible()
  })
})
