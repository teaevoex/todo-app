import { test, expect, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

test.describe('Todo CRUD Operations', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('create todo with title only', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Buy milk')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Buy milk')).toBeVisible()
    await expect(titleInput).toHaveValue('')
  })

  test('create todo with title, priority and due date', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Important meeting')

    await page.getByTestId('todo-priority-select').first().selectOption('high')

    // Set due date 2 hours in future using SGT-aware local string
    const futureDate = new Date(Date.now() + 7_200_000)
    // Build datetime-local string in Singapore time
    const localStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(futureDate).replace(' ', 'T')
    await page.getByTestId('todo-due-date').first().fill(localStr)

    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Important meeting')).toBeVisible()
  })

  test('edit todo title', async ({ page }) => {
    // Create a todo first
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Draft email')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Draft email')).toBeVisible()

    // Find edit button and click it
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()

    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    // Clear and fill new title in the modal
    const editTitleInput = page.getByTestId('todo-edit-modal').getByTestId('todo-title-input')
    await editTitleInput.clear()
    await editTitleInput.fill('Draft quarterly email')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByTestId('todo-edit-modal')).not.toBeVisible()
    await expect(page.getByText('Draft quarterly email')).toBeVisible()
    await expect(page.getByText('Draft email')).not.toBeVisible()
  })

  test('toggle todo completion', async ({ page }) => {
    // Create a todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Walk the dog')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Walk the dog')).toBeVisible()

    // Check the checkbox
    const checkbox = page.locator('[data-testid^="todo-checkbox-"]').first()
    await checkbox.click()

    // Should appear in completed section
    await expect(page.getByTestId('todo-section-muted')).toBeVisible({ timeout: 5000 })
  })

  test('delete todo with confirmation', async ({ page }) => {
    // Create a todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Old task')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Old task')).toBeVisible()

    // Click delete
    const deleteBtn = page.locator('[data-testid^="todo-delete-"]').first()
    await deleteBtn.click()

    // Confirm deletion
    await expect(page.getByTestId('confirm-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Old task')).not.toBeVisible()
  })

  test('validate empty title is rejected', async ({ page }) => {
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByText('Title is required')).toBeVisible()
  })

  test('validate past due date is rejected', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Future task')

    // Set a datetime 30 seconds in the future (less than 1 minute)
    const soonDate = new Date(Date.now() + 30_000)
    const localStr = soonDate.toISOString().slice(0, 16)
    await page.getByTestId('todo-due-date').first().fill(localStr)

    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByText(/at least 1 minute/)).toBeVisible()
  })

  test('shows empty state when no todos', async ({ page }) => {
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })
})
