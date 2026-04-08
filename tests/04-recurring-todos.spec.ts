import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername, futureDateTime } from './helpers'

test.describe('Feature 03: Recurring Todos', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should create a daily recurring todo', async ({ page }) => {
    const dueDate = futureDateTime(1)
    await page.fill('input[aria-label="Todo title"]', 'Daily task')
    await page.selectOption('select[aria-label="Priority"]', 'high')
    await page.fill('input[aria-label="Due date"]', dueDate)
    // Click the label containing "Repeat" to toggle the checkbox
    await page.locator('label', { hasText: 'Repeat' }).click()
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Daily task' })).toBeVisible()
    // Recurrence badge shows the pattern with emoji
    await expect(page.getByText('🔄 Daily')).toBeVisible()
  })

  test('should create a weekly recurring todo', async ({ page }) => {
    const dueDate = futureDateTime(7)
    await page.fill('input[aria-label="Todo title"]', 'Weekly review')
    await page.fill('input[aria-label="Due date"]', dueDate)
    // Click the label containing "Repeat" to toggle the checkbox
    await page.locator('label', { hasText: 'Repeat' }).click()
    await page.waitForTimeout(200)
    // Select weekly pattern from the recurrence select that appears
    const recurrenceSelect = page.locator('select').filter({ has: page.locator('option[value="weekly"]') })
    await recurrenceSelect.selectOption('weekly')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Weekly review' })).toBeVisible()
    await expect(page.getByText('🔄 Weekly')).toBeVisible()
  })

  test('should show recurrence badge', async ({ page }) => {
    const dueDate = futureDateTime(1)
    await page.fill('input[aria-label="Todo title"]', 'Badge check')
    await page.fill('input[aria-label="Due date"]', dueDate)
    // Click the label containing "Repeat" to toggle the checkbox
    await page.locator('label', { hasText: 'Repeat' }).click()
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    // Recurrence badge should be visible in the todo item
    const todoTitle = page.locator('[data-testid="todo-title"]', { hasText: 'Badge check' })
    await expect(todoTitle).toBeVisible()
    // The recurrence badge (🔄 Daily) appears next to the title
    await expect(todoTitle.locator('..').getByText('🔄 Daily')).toBeVisible()
  })

  test('should require due date for recurring todos', async ({ page }) => {
    await page.fill('input[aria-label="Todo title"]', 'No date recurring')
    await page.locator('label', { hasText: 'Repeat' }).click()
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    await expect(page.locator('text="Recurring todos must have a due date"')).toBeVisible()
  })

  test('should create next instance when completing recurring todo', async ({ page }) => {
    const dueDate = futureDateTime(1)
    await createTodo(page, 'Recurring complete test', {
      priority: 'high',
      dueDate,
      recurring: true,
      recurrencePattern: 'daily',
    })
    await page.waitForTimeout(500)

    // Verify todo exists
    const todoTitle = page.locator('[data-testid="todo-title"]', { hasText: 'Recurring complete test' })
    await expect(todoTitle).toBeVisible()

    // Complete the recurring todo by clicking the checkbox (aria-label based)
    const checkbox = page.locator(`input[aria-label="Mark \\"Recurring complete test\\" as complete"]`)
    await checkbox.click()
    await page.waitForTimeout(1500)

    // A new instance should be created (the recurring todo spawns a copy)
    // The completed one goes to "Completed" section, the new one appears in active
    const allInstances = page.locator('[data-testid="todo-title"]', { hasText: 'Recurring complete test' })
    // We should have at least 2 instances now (1 completed + 1 new)
    await expect(allInstances).toHaveCount(2)
  })
})
