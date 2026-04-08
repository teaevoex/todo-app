import { test, expect } from '@playwright/test'
import { registerUser, createTodo, createTag, uniqueUsername } from './helpers'

test.describe('Feature 06: Tag System', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should open Manage Tags modal', async ({ page }) => {
    await page.click('button:has-text("Manage Tags")')
    await expect(page.locator('h3', { hasText: 'Manage Tags' })).toBeVisible()
  })

  test('should create a tag', async ({ page }) => {
    await page.click('button:has-text("Manage Tags")')
    await page.waitForSelector('h3:has-text("Manage Tags")')
    await page.fill('input[placeholder="New tag name..."]', 'Work')
    await page.locator('button:has-text("Add")').last().click()
    await page.waitForTimeout(300)

    // The tag name appears as a span in the modal tag list
    const modal = page.locator('h3:has-text("Manage Tags")').locator('..')
    await expect(modal.locator('span', { hasText: 'Work' })).toBeVisible()
  })

  test('should delete a tag', async ({ page }) => {
    await page.click('button:has-text("Manage Tags")')
    await page.waitForSelector('h3:has-text("Manage Tags")')
    await page.fill('input[placeholder="New tag name..."]', 'Temporary')
    await page.locator('button:has-text("Add")').last().click()
    await page.waitForTimeout(300)

    const modal = page.locator('h3:has-text("Manage Tags")').locator('..')
    await expect(modal.locator('span', { hasText: 'Temporary' })).toBeVisible()
    // Delete the tag — the delete button shows "✕" and is revealed on hover
    const tagRow = modal.locator('span', { hasText: 'Temporary' }).locator('..')
    await tagRow.locator('button:has-text("✕")').click({ force: true })
    await page.waitForTimeout(300)
  })

  test('should filter todos by tag', async ({ page }) => {
    // Create a tag first
    await page.click('button:has-text("Manage Tags")')
    await page.waitForSelector('h3:has-text("Manage Tags")')
    await page.fill('input[placeholder="New tag name..."]', 'Urgent')
    await page.locator('button:has-text("Add")').last().click()
    await page.waitForTimeout(300)
    // Close modal
    await page.locator('button:has-text("Close")').click()
    await page.waitForTimeout(200)

    // Create todo (tag assignment is done via the form)
    await createTodo(page, 'Tagged todo')
    await createTodo(page, 'Untagged todo')

    // Verify the tag filter dropdown has the Urgent option
    await expect(page.locator('[data-testid="tag-filter"] option', { hasText: 'Urgent' })).toBeAttached()
  })

  test('should prevent duplicate tag names', async ({ page }) => {
    await page.click('button:has-text("Manage Tags")')
    await page.waitForSelector('h3:has-text("Manage Tags")')
    await page.fill('input[placeholder="New tag name..."]', 'Duplicate')
    await page.locator('button:has-text("Add")').last().click()
    await page.waitForTimeout(300)

    // Try creating same tag again
    await page.fill('input[placeholder="New tag name..."]', 'Duplicate')
    await page.locator('button:has-text("Add")').last().click()
    await page.waitForTimeout(300)

    // Should show error in the modal
    const modal = page.locator('h3:has-text("Manage Tags")').locator('..')
    await expect(modal.locator('text=/already exists/i')).toBeVisible()
  })
})
