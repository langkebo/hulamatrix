import { BasePage } from './base.page'

export class LoginPage extends BasePage {
  private readonly usernameInput = '[data-test="username-input"]'
  private readonly passwordInput = '[data-test="password-input"]'
  private readonly loginButton = '[data-test="login-button"]'
  private readonly registerLink = '[data-test="register-link"]'
  private readonly forgotPasswordLink = '[data-test="forgot-password-link"]'
  private readonly errorMessage = '[data-test="error-message"]'
  private readonly loadingSpinner = '[data-test="loading-spinner"]'
  private readonly homeserverInput = '[data-test="homeserver-input"]'

  async navigateToLogin(): Promise<void> {
    await this.navigateTo('/login')
  }

  async navigateToRegister(): Promise<void> {
    await this.navigateTo('/register')
  }

  async enterUsername(username: string): Promise<void> {
    await this.fill(this.usernameInput, username)
  }

  async enterPassword(password: string): Promise<void> {
    await this.fill(this.passwordInput, password)
  }

  async enterHomeserver(homeserver: string): Promise<void> {
    await this.fill(this.homeserverInput, homeserver)
  }

  async clickLoginButton(): Promise<void> {
    await this.click(this.loginButton)
  }

  async clickRegisterLink(): Promise<void> {
    await this.click(this.registerLink)
  }

  async clickForgotPasswordLink(): Promise<void> {
    await this.click(this.forgotPasswordLink)
  }

  async getErrorMessage(): Promise<string> {
    return await this.getText(this.errorMessage)
  }

  async isLoading(): Promise<boolean> {
    return await this.isVisible(this.loadingSpinner)
  }

  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.isEnabled(this.loginButton)
  }

  async expectToBeOnLoginPage(): Promise<void> {
    await this.expectToBeVisible(this.usernameInput, 'Login page should be displayed')
  }

  async expectErrorMessageToBeVisible(): Promise<void> {
    await this.expectToBeVisible(this.errorMessage)
  }

  async performLogin(username: string, password: string, homeserver?: string): Promise<void> {
    await this.enterUsername(username)
    await this.enterPassword(password)
    if (homeserver) {
      await this.enterHomeserver(homeserver)
    }
    await this.clickLoginButton()
    await this.page.waitForURL('**/home**', { timeout: 10000 })
  }
}
