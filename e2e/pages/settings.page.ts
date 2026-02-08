import { type Dialog } from '@playwright/test'
import { BasePage } from './base.page'

export class SettingsPage extends BasePage {
  private readonly settingsPanel = '[data-test="settings-panel"]'
  private readonly appearanceSection = '[data-test="settings-appearance"]'
  private readonly messagesSection = '[data-test="settings-messages"]'
  private readonly callsSection = '[data-test="settings-calls"]'
  private readonly privacySection = '[data-test="settings-privacy"]'
  private readonly accessibilitySection = '[data-test="settings-accessibility"]'
  private readonly themeSelect = '[data-test="theme-select"]'
  private readonly languageSelect = '[data-test="language-select"]'
  private readonly fontSizeSlider = '[data-test="font-size-slider"]'
  private readonly autoReadSwitch = '[data-test="auto-read-switch"]'
  private readonly emojiPanelSwitch = '[data-test="emoji-panel-switch"]'
  private readonly noiseSuppressionSwitch = '[data-test="noise-suppression-switch"]'
  private readonly screenReaderSwitch = '[data-test="screen-reader-switch"]'
  private readonly highContrastSwitch = '[data-test="high-contrast-switch"]'
  private readonly reduceMotionSwitch = '[data-test="reduce-motion-switch"]'
  private readonly saveButton = '[data-test="save-settings-button"]'
  private readonly resetButton = '[data-test="reset-settings-button"]'
  private readonly exportDataButton = '[data-test="export-data-button"]'
  private readonly deleteAccountButton = '[data-test="delete-account-button"]'
  private readonly dataExportModal = '[data-test="data-export-modal"]'
  private readonly dataExportComplete = '[data-test="export-complete"]'

  async navigateToSettings(): Promise<void> {
    await this.navigateTo('/settings')
  }

  async clickAppearanceSection(): Promise<void> {
    await this.click(this.appearanceSection)
  }

  async clickMessagesSection(): Promise<void> {
    await this.click(this.messagesSection)
  }

  async clickCallsSection(): Promise<void> {
    await this.click(this.callsSection)
  }

  async clickPrivacySection(): Promise<void> {
    await this.click(this.privacySection)
  }

  async clickAccessibilitySection(): Promise<void> {
    await this.click(this.accessibilitySection)
  }

  async selectTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.page.locator(`${this.themeSelect} option[value="${theme}"]`).click()
  }

  async selectLanguage(language: string): Promise<void> {
    await this.page.locator(`${this.languageSelect} option[value="${language}"]`).click()
  }

  async setFontSize(size: number): Promise<void> {
    await this.page.locator(this.fontSizeSlider).fill(size.toString())
  }

  async toggleAutoRead(): Promise<void> {
    await this.click(this.autoReadSwitch)
  }

  async toggleEmojiPanel(): Promise<void> {
    await this.click(this.emojiPanelSwitch)
  }

  async toggleNoiseSuppression(): Promise<void> {
    await this.click(this.noiseSuppressionSwitch)
  }

  async toggleScreenReader(): Promise<void> {
    await this.click(this.screenReaderSwitch)
  }

  async toggleHighContrast(): Promise<void> {
    await this.click(this.highContrastSwitch)
  }

  async toggleReduceMotion(): Promise<void> {
    await this.click(this.reduceMotionSwitch)
  }

  async clickSaveButton(): Promise<void> {
    await this.click(this.saveButton)
  }

  async clickResetButton(): Promise<void> {
    await this.click(this.resetButton)
  }

  async clickExportDataButton(): Promise<void> {
    await this.click(this.exportDataButton)
  }

  async clickDeleteAccountButton(): Promise<void> {
    await this.click(this.deleteAccountButton)
  }

  async getCurrentTheme(): Promise<string> {
    return await this.page.locator(this.themeSelect).inputValue()
  }

  async getCurrentLanguage(): Promise<string> {
    return await this.page.locator(this.languageSelect).inputValue()
  }

  async isAutoReadEnabled(): Promise<boolean> {
    return await this.page.locator(this.autoReadSwitch).isChecked()
  }

  async isEmojiPanelEnabled(): Promise<boolean> {
    return await this.page.locator(this.emojiPanelSwitch).isChecked()
  }

  async isNoiseSuppressionEnabled(): Promise<boolean> {
    return await this.page.locator(this.noiseSuppressionSwitch).isChecked()
  }

  async isScreenReaderEnabled(): Promise<boolean> {
    return await this.page.locator(this.screenReaderSwitch).isChecked()
  }

  async isHighContrastEnabled(): Promise<boolean> {
    return await this.page.locator(this.highContrastSwitch).isChecked()
  }

  async isReduceMotionEnabled(): Promise<boolean> {
    return await this.page.locator(this.reduceMotionSwitch).isChecked()
  }

  async expectSettingsPanelToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.settingsPanel, 'Settings panel should be visible')
  }

  async expectSaveButtonToBeEnabled(): Promise<void> {
    await this.expectToBeEnabled(this.saveButton)
  }

  async expectDataExportModalToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.dataExportModal)
  }

  async waitForExportComplete(timeout?: number): Promise<void> {
    await this.page.waitForSelector(this.dataExportComplete, { timeout: timeout ?? 60000 })
  }

  async saveSettings(): Promise<void> {
    await this.clickSaveButton()
    await this.waitForTimeout(500)
  }

  async resetToDefaults(): Promise<void> {
    await this.clickResetButton()
    await this.page.on('dialog', async (dialog: Dialog) => {
      await dialog.accept()
    })
  }

  async exportUserData(): Promise<void> {
    await this.clickExportDataButton()
    await this.expectDataExportModalToBeVisible()
    await this.waitForExportComplete()
  }
}
