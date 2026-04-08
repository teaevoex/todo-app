import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername, futureDateTime } from './helpers'

test.describe('Feature 02: Priority System', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should create todo with each priority level', async ({ page }) => {
    await createTodo(page, 'High priority task', { priority: 'high' })
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'High priority task' })).toBeVisible()
    // Verify badge in the todo section (not the form select options)
    await expect(page.locator('section').getByText('High', { exact: true })).toBeVisible()

    await createTodo(page, 'Medium priority task', { priority: 'medium' })
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Medium priority task' })).toBeVisible()

    await createTodo(page, 'Low priority task', { priority: 'low' })
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Low priority task' })).toBeVisible()
    await expect(page.locator('section').getByText('Low', { exact: true })).toBeVisible()
  })

  test('should default to medium priority', async ({ page }) => {
    await createTodo(page, 'Default priority')
    // The "Medium" badge should be visible for the created todo
    const todoItem = page.locator('[data-testid="todo-title"]', { hasText: 'Default priority' }).locator('..')
    await expect(todoItem.locator('text="Medium"')).toBeVisible()
  })

  test('should filter by priority', async ({ page }) => {
    await createTodo(page, 'High task', { priority: 'high' })
    await createTodo(page, 'Low task', { priority: 'low' })

    // Filter by high
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'High task' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Low task' })).not.toBeVisible()

    // Filter by low
    await page.selectOption('[data-testid="priority-filter"]', 'low')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Low task' })).toBeVisible()
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'High task' })).not.toBeVisible()
  })

  test('should sort todos by priority (high first)', async ({ page }) => {
    await createTodo(page, 'Low first', { priority: 'low' })
    await createTodo(page, 'High second', { priority: 'high' })

    const titles = await page.locator('[data-testid="todo-title"]').allTextContents()
    const highIndex = titles.indexOf('High second')
    const lowIndex = titles.indexOf('Low first')
    expect(highIndex).toBeLessThan(lowIndex)
  })
})
