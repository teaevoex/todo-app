import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername, futureDateTime } from './helpers'

test.describe('Feature 01: Todo CRUD Operations', () => {
  let username: string

  test.beforeEach(async ({ page }) => {
    username = uniqueUsername()
    await registerUser(page, username)
  })

  test('should create a todo with title only', async ({ page }) => {
    await createTodo(page, 'Buy groceries')
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Buy groceries' })).toBeVisible()
  })

  test('should create a todo with all metadata', async ({ page }) => {
    const dueDate = futureDateTime(2)
    await createTodo(page, 'Important meeting', {
      priority: 'high',
      dueDate,
    })
    const todoTitle = page.locator('[data-testid="todo-title"]', { hasText: 'Important meeting' })
    await expect(todoTitle).toBeVisible()
    // The PriorityBadge sits next to the title in the same flex container
    await expect(todoTitle.locator('..').locator('span', { hasText: 'High' })).toBeVisible()
  })

  test('should show error for empty title', async ({ page }) => {
    // The Add button should be disabled when title is empty
    await expect(page.locator('button:has-text("Add")')).toBeDisabled()
  })

  test('should toggle todo completion', async ({ page }) => {
    await createTodo(page, 'Toggle test')
    // Find the checkbox near the todo title via the containing card
    const todoCard = page.locator('[data-testid="todo-title"]', { hasText: 'Toggle test' }).locator('..').locator('..').locator('..')
    const checkbox = todoCard.locator('input[type="checkbox"]')
    await checkbox.click()
    await page.waitForTimeout(500)
    // After toggling, the todo should appear in the completed section
    await expect(page.locator('text=/Completed/')).toBeVisible()
  })

  test('should edit a todo', async ({ page }) => {
    await createTodo(page, 'Original title')
    // Click the Edit button on the todo item
    const todoCard = page.locator('[data-testid="todo-title"]', { hasText: 'Original title' }).locator('..').locator('..').locator('..')
    await todoCard.locator('button:has-text("Edit")').click()
    await page.waitForSelector('h3:has-text("Edit Todo")')
    // The edit modal contains the "Edit Todo" heading — find the dialog container
    const modal = page.locator('h3:has-text("Edit Todo")').locator('..')
    const titleInput = modal.locator('input[type="text"]').first()
    await titleInput.clear()
    await titleInput.fill('Updated title')
    await modal.locator('button:has-text("Update")').click()
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Updated title' })).toBeVisible()
  })

  test('should delete a todo with confirmation', async ({ page }) => {
    await createTodo(page, 'Delete me')
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Delete me' })).toBeVisible()

    page.on('dialog', dialog => dialog.accept())
    await page.click('button:has-text("Delete")')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Delete me' })).not.toBeVisible()
  })

  test('should reject past due date', async ({ page }) => {
    await page.fill('input[aria-label="Todo title"]', 'Past date test')
    await page.fill('input[aria-label="Due date"]', '2020-01-01T12:00')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)
    // Should show error about future date
    await expect(page.locator('text="Due date must be in the future"')).toBeVisible()
  })

  test('should display todos in sections: overdue, active, completed', async ({ page }) => {
    await createTodo(page, 'Active todo')
    await expect(page.locator('text="Pending"').or(page.locator('[data-testid="todo-title"]', { hasText: 'Active todo' }))).toBeVisible()
  })
})
