import { test, expect } from '@playwright/test'
import { registerUser, uniqueUsername } from './helpers'

test.describe('Feature 11: Authentication (WebAuthn)', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Todo App')
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('button:has-text("Login")')).toBeVisible()
    await expect(page.locator('button:has-text("Register")')).toBeVisible()
  })

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    await expect(page.locator('#username')).toBeVisible()
  })

  test('should redirect unauthenticated from calendar to login', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForURL('/login')
    await expect(page.locator('#username')).toBeVisible()
  })

  test('should register a new user with passkey', async ({ page }) => {
    const username = uniqueUsername()
    await registerUser(page, username)
    await expect(page.locator('text="My Todos"')).toBeVisible()
    await expect(page.locator(`text="${username}"`)).toBeVisible()
  })

  test('should show error for empty username', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('button:has-text("Login")')).toBeDisabled()
    await expect(page.locator('button:has-text("Register")')).toBeDisabled()
  })

  test('should logout and redirect to login', async ({ page }) => {
    const username = uniqueUsername()
    await registerUser(page, username)
    await page.click('button:has-text("Logout")')
    await page.waitForURL('/login')
    await expect(page.locator('#username')).toBeVisible()
  })
})
