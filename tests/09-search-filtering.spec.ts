import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername } from './helpers'

test.describe('Feature 08: Search & Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
    // Create multiple todos for filtering
    await createTodo(page, 'Buy groceries', { priority: 'high' })
    await createTodo(page, 'Read a book', { priority: 'low' })
    await createTodo(page, 'Write report', { priority: 'medium' })
  })

  test('should search by title', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'groceries')
    // Wait for debounce
    await page.waitForTimeout(400)

    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Read a book' })).not.toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Write report' })).not.toBeVisible()
  })

  test('should search case-insensitively', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'BUY')
    await page.waitForTimeout(400)
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).toBeVisible()
  })

  test('should filter by priority', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Read a book' })).not.toBeVisible()
  })

  test('should combine search and priority filter (AND logic)', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'report')
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await page.waitForTimeout(400)

    // "Write report" is medium, not high — should not be visible
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Write report' })).not.toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).not.toBeVisible()
  })

  test('should show empty state when no results match', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'nonexistent')
    await page.waitForTimeout(400)

    await expect(page.locator('text="No todos match your filters"')).toBeVisible()
  })

  test('should clear all filters', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'nonexistent')
    await page.waitForTimeout(400)

    await page.click('text="Clear all filters"')
    await page.waitForTimeout(300)

    // All todos should be visible again
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Read a book' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Write report' })).toBeVisible()
  })
})
