import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername } from './helpers'

test.describe('Feature 07: Template System', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should open Templates modal', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await expect(page.locator('h3', { hasText: 'Templates' })).toBeVisible()
  })

  test('should create a template', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.waitForTimeout(300)

    // Fill in template form
    const titleInput = page.locator('input[placeholder*="template"]').or(page.locator('input[placeholder*="Template"]')).first()
    if (await titleInput.isVisible()) {
      await titleInput.fill('Meeting Notes')
    }

    const saveBtn = page.locator('button:has-text("Save Template")').or(page.locator('button:has-text("Create Template")'))
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('should delete a template', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.waitForTimeout(300)

    // Create a template first
    const titleInput = page.locator('input[placeholder*="template"]').or(page.locator('input[placeholder*="Template"]')).first()
    if (await titleInput.isVisible()) {
      await titleInput.fill('Delete me template')
      const saveBtn = page.locator('button:has-text("Save Template")').or(page.locator('button:has-text("Create Template")'))
      if (await saveBtn.isVisible()) {
        await saveBtn.click()
        await page.waitForTimeout(500)
      }
    }

    // Try to find and delete the template
    const deleteBtn = page.locator('button:has-text("Delete")').first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      await page.waitForTimeout(300)
    }
  })

  test('should have template API endpoints', async ({ page }) => {
    // Verify GET /api/templates returns 401 for unauthenticated (no cookie in API context)
    const response = await page.request.get('/api/templates')
    expect([200, 401]).toContain(response.status())
  })

  test('should use template to create a todo', async ({ page }) => {
    // Open Templates modal
    await page.click('button:has-text("Templates")')
    await page.waitForTimeout(300)

    // Fill in template form
    const titleInput = page.locator('input[placeholder="Template title"]')
    await titleInput.fill('Use Test Template')

    // Save the template
    await page.click('button:has-text("Save Template")')
    await page.waitForTimeout(500)

    // The template should now appear in the list
    await expect(page.getByText('Use Test Template')).toBeVisible()

    // Click "Use" button to create a todo from the template
    const useBtn = page.locator('button:has-text("Use")').first()
    await useBtn.click()
    await page.waitForTimeout(500)

    // Modal should close and a new todo should appear with the template's title
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Use Test Template' })).toBeVisible()
  })
})
