import { test, expect, type Page } from '../fixtures/base.fixture'
import { LoginPage } from '../pages/login.page'
import { ChatPage } from '../pages/chat.page'

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }: { page: Page }) => {
    loginPage = new LoginPage(page)
    await loginPage.navigateToLogin()
  })

  test.describe('Login Page', () => {
    test('should display login page correctly', async ({ page }: { page: Page }) => {
      await loginPage.expectToBeOnLoginPage()
      await expect(page).toHaveTitle(/HuLa|Login/)
    })

    test('should show all login form elements', async ({ page }: { page: Page }) => {
      await expect(page.locator('[data-test="username-input"]')).toBeVisible()
      await expect(page.locator('[data-test="password-input"]')).toBeVisible()
      await expect(page.locator('[data-test="login-button"]')).toBeVisible()
      await expect(page.locator('[data-test="register-link"]')).toBeVisible()
    })

    test('should have disabled login button when fields are empty', async () => {
      const isEnabled = await loginPage.isLoginButtonEnabled()
      expect(isEnabled).toBe(false)
    })

    test('should enable login button when username is entered', async ({ page }: { page: Page }) => {
      await loginPage.enterUsername('testuser')
      await expect(page.locator('[data-test="login-button"]')).toBeEnabled()
    })
  })

  test.describe('Login Form Validation', () => {
    test('should show error for empty username', async () => {
      await loginPage.enterPassword('password123')
      await loginPage.clickLoginButton()
      await loginPage.expectErrorMessageToBeVisible()
    })

    test('should show error for empty password', async () => {
      await loginPage.enterUsername('testuser')
      await loginPage.clickLoginButton()
      await loginPage.expectErrorMessageToBeVisible()
    })

    test('should show error for invalid username format', async () => {
      await loginPage.enterUsername('invalid@username')
      await loginPage.enterPassword('password123')
      await loginPage.clickLoginButton()
      const errorMessage = await loginPage.getErrorMessage()
      expect(errorMessage).toContain('invalid')
    })

    test('should show error for short password', async () => {
      await loginPage.enterUsername('testuser')
      await loginPage.enterPassword('123')
      await loginPage.clickLoginButton()
      await loginPage.expectErrorMessageToBeVisible()
    })
  })

  test.describe('Homeserver Configuration', () => {
    test('should accept custom homeserver', async ({ page }: { page: Page }) => {
      await loginPage.enterHomeserver('custom.matrix.server')
      await loginPage.enterUsername('testuser')
      await loginPage.enterPassword('password123')
      await loginPage.clickLoginButton()
      await page.waitForTimeout(1000)
    })

    test('should show error for invalid homeserver', async () => {
      await loginPage.enterHomeserver('invalid-server')
      await loginPage.enterUsername('testuser')
      await loginPage.enterPassword('password123')
      await loginPage.clickLoginButton()
      await loginPage.expectErrorMessageToBeVisible()
    })
  })

  test.describe('Registration Flow', () => {
    test('should navigate to registration page', async ({ page }: { page: Page }) => {
      await loginPage.clickRegisterLink()
      await expect(page).toHaveURL(/.*register/)
    })
  })

  test.describe('Password Recovery', () => {
    test('should navigate to password recovery page', async ({ page }: { page: Page }) => {
      await loginPage.clickForgotPasswordLink()
      await expect(page).toHaveURL(/.*forgot-password/)
    })
  })
})

test.describe('Authenticated User', () => {
  test('should be able to access chat after login', async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    const chatPage = new ChatPage(authenticatedPage)
    await chatPage.navigateToChat()
    await chatPage.expectChatListToBeVisible()
  })
})
