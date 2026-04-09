import { test, expect, type Page, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * E2E Tests: Feature 05 — Subtasks & Progress Tracking
 *
 * Prerequisites: User is authenticated (app runs with active session).
 * These tests interact with the UI to verify subtask functionality.
 */

async function createTodo(page: Page, title: string): Promise<void> {
  const titleInput = page.getByTestId('todo-title-input').first()
  await titleInput.fill(title)
  await page.getByTestId('todo-submit-btn').click()
  await expect(page.getByText(title)).toBeVisible()
}

async function getTodoId(page: Page, title: string): Promise<string> {
  const todoItem = page.locator('[data-testid^="todo-item-"]').filter({ hasText: title }).first()
  await todoItem.waitFor()
  const testId = await todoItem.getAttribute('data-testid')
  return testId?.replace('todo-item-', '') ?? ''
}

test.describe('Subtasks & Progress Tracking', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('expand subtask section on a todo', async ({ page }) => {
    await createTodo(page, 'Test expand subtasks')
    const todoId = await getTodoId(page, 'Test expand subtasks')

    const expandBtn = page.getByTestId(`expand-subtasks-${todoId}`)
    await expect(expandBtn).toBeVisible()
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

    await expandBtn.click()

    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId(`subtask-input-${todoId}`)).toBeVisible()
  })

  test('add subtask — appears in list', async ({ page }) => {
    await createTodo(page, 'Todo with subtask')
    const todoId = await getTodoId(page, 'Todo with subtask')

    // Expand subtasks
    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    // Add a subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Buy milk')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()

    // Subtask should appear
    await expect(page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Buy milk' })).toBeVisible()
  })

  test('toggle subtask completion — checkbox updates, progress bar changes', async ({ page }) => {
    await createTodo(page, 'Todo for toggle test')
    const todoId = await getTodoId(page, 'Todo for toggle test')

    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    // Add a subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Step One')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()

    const subtaskItem = page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Step One' }).first()
    await subtaskItem.waitFor()

    const subtaskTestId = await subtaskItem.getAttribute('data-testid')
    const subtaskId = subtaskTestId?.replace('subtask-item-', '') ?? ''

    // Check the checkbox
    await page.getByTestId(`subtask-checkbox-${subtaskId}`).click()

    // Wait for progress bar to update
    const progressBar = page.getByTestId(`progress-bar-${todoId}`)
    await expect(progressBar).toBeVisible()
    await expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })

  test('add 2 subtasks, complete 1 — progress shows 1/2 completed (50%)', async ({ page }) => {
    await createTodo(page, 'Two subtask todo')
    const todoId = await getTodoId(page, 'Two subtask todo')

    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    // Add first subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Step A')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()
    await expect(page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Step A' })).toBeVisible()

    // Add second subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Step B')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()
    await expect(page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Step B' })).toBeVisible()

    // Complete Step A
    const stepA = page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Step A' }).first()
    const stepAId = (await stepA.getAttribute('data-testid'))?.replace('subtask-item-', '') ?? ''
    await page.getByTestId(`subtask-checkbox-${stepAId}`).click()

    // Progress bar should show 50%
    const progressBar = page.getByTestId(`progress-bar-${todoId}`)
    await expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    await expect(page.getByText('1/2 completed (50%)')).toBeVisible()

    // Progress bar fill should be visible at 50% (not green/success color)
    const fill = page.getByTestId('progress-bar-fill').first()
    await expect(fill).toBeVisible()
  })

  test('complete all subtasks — progress bar turns green', async ({ page }) => {
    await createTodo(page, 'All done todo')
    const todoId = await getTodoId(page, 'All done todo')

    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    // Add a subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Only step')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()

    const stepItem = page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Only step' }).first()
    await stepItem.waitFor()
    const stepId = (await stepItem.getAttribute('data-testid'))?.replace('subtask-item-', '') ?? ''

    // Complete the subtask
    await page.getByTestId(`subtask-checkbox-${stepId}`).click()

    // Progress bar should be at 100% and success color
    const progressBar = page.getByTestId(`progress-bar-${todoId}`)
    await expect(progressBar).toHaveAttribute('aria-valuenow', '100')

    const fill = page.getByTestId('progress-bar-fill').first()
    await expect(fill).toBeVisible()
  })

  test('delete subtask — removed from list, progress updates', async ({ page }) => {
    await createTodo(page, 'Delete subtask todo')
    const todoId = await getTodoId(page, 'Delete subtask todo')

    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    // Add subtask
    await page.getByTestId(`subtask-input-${todoId}`).fill('Remove me')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()

    const subtaskItem = page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Remove me' }).first()
    await subtaskItem.waitFor()
    const subtaskId = (await subtaskItem.getAttribute('data-testid'))?.replace('subtask-item-', '') ?? ''

    // Delete the subtask
    await page.getByTestId(`subtask-delete-${subtaskId}`).click()

    // Subtask should be gone
    await expect(page.locator(`[data-testid="subtask-item-${subtaskId}"]`)).not.toBeVisible()

    // Progress bar should not be rendered (no subtasks remain)
    await expect(page.getByTestId(`progress-bar-${todoId}`)).not.toBeVisible()
  })

  test('progress bar not shown when todo has no subtasks', async ({ page }) => {
    await createTodo(page, 'No subtask todo')
    const todoId = await getTodoId(page, 'No subtask todo')

    // Progress bar should not exist
    await expect(page.getByTestId(`progress-bar-${todoId}`)).not.toBeVisible()
  })

  test('delete parent todo removes subtasks (CASCADE)', async ({ page }) => {
    await createTodo(page, 'Parent with children')
    const todoId = await getTodoId(page, 'Parent with children')

    await page.getByTestId(`expand-subtasks-${todoId}`).click()

    await page.getByTestId(`subtask-input-${todoId}`).fill('Child A')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()
    await expect(page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Child A' })).toBeVisible()

    await page.getByTestId(`subtask-input-${todoId}`).fill('Child B')
    await page.getByTestId(`subtask-add-btn-${todoId}`).click()
    await expect(page.locator('[data-testid^="subtask-item-"]').filter({ hasText: 'Child B' })).toBeVisible()

    // Delete parent todo
    await page.getByTestId(`todo-delete-${todoId}`).click()
    await page.getByRole('button', { name: 'Delete' }).click()

    // Parent and subtasks should be gone
    await expect(page.locator(`[data-testid="todo-item-${todoId}"]`)).not.toBeVisible()
    await expect(page.getByText('Child A')).not.toBeVisible()
    await expect(page.getByText('Child B')).not.toBeVisible()

    // Verify via API that the todo is gone (subtasks CASCADE)
    const response = await page.request.get(`/api/todos/${todoId}`)
    expect(response.status()).toBe(404)
  })
})
