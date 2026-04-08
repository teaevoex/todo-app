import { test, expect } from '@playwright/test'
import { registerUser, createTodo, addSubtask, uniqueUsername } from './helpers'

test.describe('Feature 05: Subtasks & Progress Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should expand subtasks section', async ({ page }) => {
    await createTodo(page, 'Parent task')
    await page.click('button:has-text("Subtasks")')
    await expect(page.locator('input[placeholder*="subtask"]').first()).toBeVisible()
  })

  test('should add subtask to a todo', async ({ page }) => {
    await createTodo(page, 'Task with subtask')
    await page.click('button:has-text("Subtasks")')
    await page.fill('input[placeholder*="subtask"]', 'Child task 1')
    await page.click('button:has-text("Add"):near(input[placeholder*="subtask"])')
    await page.waitForTimeout(500)

    await expect(page.locator('text="Child task 1"')).toBeVisible()
  })

  test('should show progress bar after adding subtasks', async ({ page }) => {
    await createTodo(page, 'Progress task')
    await page.click('button:has-text("Subtasks")')

    // Add 2 subtasks
    await page.fill('input[placeholder*="subtask"]', 'Sub A')
    await page.click('button:has-text("Add"):near(input[placeholder*="subtask"])')
    await page.waitForTimeout(300)
    await page.fill('input[placeholder*="subtask"]', 'Sub B')
    await page.click('button:has-text("Add"):near(input[placeholder*="subtask"])')
    await page.waitForTimeout(300)

    // Progress should show 0/2
    await expect(page.locator('text="0/2 subtasks"')).toBeVisible()
  })

  test('should toggle subtask completion and update progress', async ({ page }) => {
    await createTodo(page, 'Toggle subtask')
    await page.click('button:has-text("Subtasks")')

    await page.fill('input[placeholder*="subtask"]', 'Toggleable sub')
    await page.click('button:has-text("Add"):near(input[placeholder*="subtask"])')
    await page.waitForTimeout(500)

    // Toggle the subtask checkbox
    const subtaskCheckbox = page.locator('text="Toggleable sub"').locator('..').locator('input[type="checkbox"]')
    await subtaskCheckbox.click()
    await page.waitForTimeout(500)

    // Progress should show 1/1
    await expect(page.locator('text="1/1 subtasks"')).toBeVisible()
  })

  test('should delete a subtask', async ({ page }) => {
    await createTodo(page, 'Delete subtask')
    await page.click('button:has-text("Subtasks")')

    await page.fill('input[placeholder*="subtask"]', 'Remove me')
    await page.click('button:has-text("Add"):near(input[placeholder*="subtask"])')
    await page.waitForTimeout(500)

    await expect(page.locator('text="Remove me"')).toBeVisible()

    // Click delete on the subtask
    await page.locator('text="Remove me"').locator('..').locator('button:has-text("✕")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text="Remove me"')).not.toBeVisible()
  })
})
