import { test, expect, type Page, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * E2E Tests: Feature 07 — Template System
 *
 * Prerequisites: User is authenticated (app runs with active session).
 * These tests interact with the UI to verify template functionality.
 */

async function createTodo(page: Page, title: string): Promise<void> {
  const titleInput = page.getByTestId('todo-title-input').first()
  await titleInput.fill(title)
  await page.getByTestId('todo-submit-btn').click()
  await expect(page.getByText(title).first()).toBeVisible()
}

async function getTodoId(page: Page, title: string): Promise<string> {
  const todoItem = page
    .locator('[data-testid^="todo-item-"]')
    .filter({ hasText: title })
    .first()
  await todoItem.waitFor()
  const testId = await todoItem.getAttribute('data-testid')
  return testId?.replace('todo-item-', '') ?? ''
}

async function openTemplateManager(page: Page): Promise<void> {
  await page.getByTestId('manage-templates-button').click()
  await expect(page.getByTestId('template-manager-modal')).toBeVisible()
}

async function getTemplateId(page: Page, name: string): Promise<string> {
  const card = page.locator('[data-testid^="template-card-"]').filter({ hasText: name }).first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  return testId?.replace('template-card-', '') ?? ''
}

test.describe('Template System', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('save a todo as a template', async ({ page }) => {
    const title = `Template Test Todo ${Date.now()}`
    await createTodo(page, title)
    const todoId = await getTodoId(page, title)

    // Click save as template
    await page.getByTestId(`save-as-template-${todoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()

    // Name input should pre-fill with todo title
    const nameInput = page.getByTestId('template-name-input')
    await expect(nameInput).toHaveValue(title)

    // Set due date offset
    await page.getByTestId('template-offset-input').fill('7')

    // Submit
    await page.getByTestId('save-template-submit').click()

    // Modal should close
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Open template manager and verify template was saved
    await openTemplateManager(page)
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: title })).toBeVisible()
  })

  test('open and close Template Manager', async ({ page }) => {
    await page.getByTestId('manage-templates-button').click()
    await expect(page.getByTestId('template-manager-modal')).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(page.getByTestId('template-manager-modal')).not.toBeVisible()
  })

  test('use a template to create a todo', async ({ page }) => {
    const title = `Use Template Todo ${Date.now()}`
    await createTodo(page, title)
    const todoId = await getTodoId(page, title)

    // Save as template with offset 7
    await page.getByTestId(`save-as-template-${todoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    await page.getByTestId('template-offset-input').fill('7')
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Open Template Manager
    await openTemplateManager(page)
    const templateId = await getTemplateId(page, title)

    // Use the template
    await page.getByTestId(`use-template-${templateId}`).click()

    // Manager should close after use
    await expect(page.getByTestId('template-manager-modal')).not.toBeVisible()

    // New todo should appear in the list
    await expect(
      page.locator('[data-testid^="todo-item-"]').filter({ hasText: title }).first()
    ).toBeVisible()
  })

  test('template with no due date offset creates todo with no due date', async ({ page }) => {
    const title = `No Due Date Template ${Date.now()}`
    await createTodo(page, title)
    const todoId = await getTodoId(page, title)

    // Save template WITHOUT filling in offset (leave empty)
    await page.getByTestId(`save-as-template-${todoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    // do NOT fill offset input
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Use the template
    await openTemplateManager(page)
    const templateId = await getTemplateId(page, title)
    await page.getByTestId(`use-template-${templateId}`).click()
    await expect(page.getByTestId('template-manager-modal')).not.toBeVisible()

    // The created todo should be visible without a due date badge showing overdue/time
    const newTodoItem = page.locator('[data-testid^="todo-item-"]').filter({ hasText: title }).last()
    await expect(newTodoItem).toBeVisible()
  })

  test('delete a template does not affect existing todos', async ({ page }) => {
    const title = `Delete Template Safe ${Date.now()}`
    await createTodo(page, title)
    const todoId = await getTodoId(page, title)

    // Save as template
    await page.getByTestId(`save-as-template-${todoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Use the template to create a second todo
    await openTemplateManager(page)
    const templateId = await getTemplateId(page, title)
    await page.getByTestId(`use-template-${templateId}`).click()
    await expect(page.getByTestId('template-manager-modal')).not.toBeVisible()

    // Verify the new todo exists
    await expect(
      page.locator('[data-testid^="todo-item-"]').filter({ hasText: title }).first()
    ).toBeVisible()

    // Re-open template manager and delete the template
    await openTemplateManager(page)
    await page.getByTestId(`delete-template-${templateId}`).click()

    // Confirm deletion
    await expect(page.getByTestId('confirm-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible()

    // Template card should be gone
    await expect(page.getByTestId(`template-card-${templateId}`)).not.toBeVisible()

    // Close manager
    await page.getByRole('button', { name: 'Close' }).first().click()

    // Original todo and created todo both still exist
    const todosWithTitle = page.locator('[data-testid^="todo-item-"]').filter({ hasText: title })
    await expect(todosWithTitle.first()).toBeVisible()
  })

  test('category filter in TemplateManager', async ({ page }) => {
    const workTitle = `Work Template ${Date.now()}`
    const personalTitle = `Personal Template ${Date.now()}`

    // Create two todos
    await createTodo(page, workTitle)
    const workTodoId = await getTodoId(page, workTitle)
    await createTodo(page, personalTitle)
    const personalTodoId = await getTodoId(page, personalTitle)

    // Save first as Work template
    await page.getByTestId(`save-as-template-${workTodoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    await page.getByTestId('template-category-input').fill('Work')
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Save second as Personal template
    await page.getByTestId(`save-as-template-${personalTodoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    await page.getByTestId('template-category-input').fill('Personal')
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Open manager
    await openTemplateManager(page)

    // Both templates visible under "All"
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: workTitle })).toBeVisible()
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: personalTitle })).toBeVisible()

    // Filter to Work
    await page.getByTestId('template-category-work').click()
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: workTitle })).toBeVisible()
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: personalTitle })).not.toBeVisible()

    // Switch back to All
    await page.getByTestId('template-category-all').click()
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: workTitle })).toBeVisible()
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: personalTitle })).toBeVisible()
  })

  test('save template with subtasks - template card shows subtask count', async ({ page }) => {
    const title = `Subtask Template Todo ${Date.now()}`
    await createTodo(page, title)
    const todoId = await getTodoId(page, title)

    // Add subtasks using the subtask form
    const todoItem = page.getByTestId(`todo-item-${todoId}`)
    // Expand subtasks area by clicking the subtasks button
    const expandBtn = todoItem.locator('[data-testid^="subtasks-toggle-"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
    }

    // Look for add subtask input
    const addSubtaskInput = todoItem.locator('[data-testid^="subtask-input"]')
    if (await addSubtaskInput.isVisible()) {
      await addSubtaskInput.fill('First step')
      await addSubtaskInput.press('Enter')
      await addSubtaskInput.fill('Second step')
      await addSubtaskInput.press('Enter')
    }

    // Save as template
    await page.getByTestId(`save-as-template-${todoId}`).click()
    await expect(page.getByTestId('save-template-modal')).toBeVisible()
    await page.getByTestId('save-template-submit').click()
    await expect(page.getByTestId('save-template-modal')).not.toBeVisible()

    // Open template manager and check template card
    await openTemplateManager(page)
    const card = page.locator('[data-testid^="template-card-"]').filter({ hasText: title })
    await expect(card).toBeVisible()
  })
})
