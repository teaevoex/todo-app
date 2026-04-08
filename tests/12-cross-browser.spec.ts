import { test, expect } from '@playwright/test'

/**
 * Cross-browser smoke tests.
 * Tagged @cross-browser so Firefox project can run them
 * (Firefox lacks WebAuthn virtual authenticator support).
 */
test.describe('Cross-browser smoke tests @cross-browser', () => {
  test('should load login page @cross-browser', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Todo/)
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('button:has-text("Register")')).toBeVisible()
    await expect(page.locator('button:has-text("Login")')).toBeVisible()
  })

  test('should redirect unauthenticated users to login @cross-browser', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.locator('#username')).toBeVisible()
  })

  test('should render login page styles correctly @cross-browser', async ({ page }) => {
    await page.goto('/login')
    // Verify the page has essential UI elements
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible()
    // Ensure the form is interactive
    const usernameInput = page.locator('#username')
    await usernameInput.fill('testcrossbrowser')
    await expect(usernameInput).toHaveValue('testcrossbrowser')
  })

  test('should have correct meta viewport @cross-browser', async ({ page }) => {
    await page.goto('/login')
    const viewport = page.locator('meta[name="viewport"]')
    await expect(viewport).toHaveAttribute('content', /width=device-width/)
  })

  test('should load calendar page redirect @cross-browser', async ({ page }) => {
    // Calendar is auth-protected, should redirect
    await page.goto('/calendar')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.locator('#username')).toBeVisible()
  })
})
