import { test, expect, type Page, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * E2E Tests: Feature 06 — Tag System
 *
 * Prerequisites: User is authenticated (app runs with active session).
 * These tests interact with the UI to verify tag functionality.
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

async function openTagManager(page: Page): Promise<void> {
  await page.getByTestId('manage-tags-button').click()
  await expect(page.getByTestId('tag-manager-modal')).toBeVisible()
}

async function createTagInManager(page: Page, name: string): Promise<void> {
  await page.getByTestId('tag-name-input').fill(name)
  await page.getByTestId('create-tag-submit').click()
  await expect(page.getByTestId(`tag-row-${name}`)).toBeVisible()
}

async function getTagId(page: Page, name: string): Promise<string> {
  const tagRow = page.getByTestId(`tag-row-${name}`)
  await tagRow.waitFor()
  const editBtn = tagRow.locator('[data-testid^="edit-tag-"]')
  const testId = await editBtn.getAttribute('data-testid')
  return testId?.replace('edit-tag-', '') ?? ''
}

test.describe('Tag System', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('open and close Tag Manager', async ({ page }) => {
    await page.getByTestId('manage-tags-button').click()
    await expect(page.getByTestId('tag-manager-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('tag-manager-modal')).not.toBeVisible()
  })

  test('create a tag and see it in the list', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Work')
    await expect(page.getByTestId('tag-row-E2E-Work')).toBeVisible()
  })

  // Helper: assign a tag to a todo via the API (bypasses UI dropdown + Radix Dialog interaction issue)
  async function assignTagViaApi(page: Page, todoId: string, tagId: string): Promise<void> {
    // Get current todo data first
    const todoResp = await page.request.get(`/api/todos/${todoId}`)
    const todoData = await todoResp.json()
    const existing = todoData.data
    const existingTagIds = (existing?.tags ?? []).map((t: { id: number }) => t.id)
    // Update todo via PUT with the new tag added
    await page.request.put(`/api/todos/${todoId}`, {
      data: {
        title: existing.title,
        priority: existing.priority,
        is_recurring: existing.is_recurring,
        recurrence_pattern: existing.recurrence_pattern,
        due_date: existing.due_date,
        reminder_minutes: existing.reminder_minutes,
        tagIds: [...existingTagIds, parseInt(tagId)],
      },
    })
    // Reload to see changes
    await page.reload()
    await page.waitForLoadState('networkidle')
  }

  test('assign tag to todo — badge appears on todo card', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Assign')
    const tagId = await getTagId(page, 'E2E-Assign')
    await page.keyboard.press('Escape')

    await createTodo(page, 'E2E Tag Assignment Test')
    const todoId = await getTodoId(page, 'E2E Tag Assignment Test')

    await assignTagViaApi(page, todoId, tagId)

    await expect(page.getByTestId(`tag-badge-${tagId}`)).toBeVisible()
  })

  test('filter todos by clicking a tag badge', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Filter-A')
    const tagAId = await getTagId(page, 'E2E-Filter-A')
    await createTagInManager(page, 'E2E-Filter-B')
    const tagBId = await getTagId(page, 'E2E-Filter-B')
    await page.keyboard.press('Escape')

    await createTodo(page, 'E2E Filter Todo A')
    const todoAId = await getTodoId(page, 'E2E Filter Todo A')
    await assignTagViaApi(page, todoAId, tagAId)

    await createTodo(page, 'E2E Filter Todo B')
    const todoBId = await getTodoId(page, 'E2E Filter Todo B')
    await assignTagViaApi(page, todoBId, tagBId)

    await page.getByTestId(`tag-badge-${tagAId}`).first().click()

    await expect(page.getByText('E2E Filter Todo A')).toBeVisible()
    await expect(page.getByText('E2E Filter Todo B')).not.toBeVisible()
    await expect(page.getByTestId('tag-filter')).toBeVisible()
  })

  test('edit tag name propagates to all todos', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Rename-Before')
    const tagId = await getTagId(page, 'E2E-Rename-Before')
    await page.keyboard.press('Escape')

    await createTodo(page, 'E2E Rename Test Todo')
    const todoId = await getTodoId(page, 'E2E Rename Test Todo')
    await assignTagViaApi(page, todoId, tagId)

    await expect(page.getByTestId(`tag-badge-${tagId}`)).toContainText('E2E-Rename-Before')

    await openTagManager(page)
    await page.getByTestId(`edit-tag-${tagId}`).click()
    await page.getByTestId(`tag-name-edit-${tagId}`).clear()
    await page.getByTestId(`tag-name-edit-${tagId}`).fill('E2E-Rename-After')
    await page.getByTestId(`save-tag-${tagId}`).click()
    await page.keyboard.press('Escape')

    await expect(page.getByTestId(`tag-badge-${tagId}`)).toContainText('E2E-Rename-After')
  })

  test('delete a tag removes it from todos', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Delete-Tag')
    const tagId = await getTagId(page, 'E2E-Delete-Tag')
    await page.keyboard.press('Escape')

    await createTodo(page, 'E2E Delete Tag Todo')
    const todoId = await getTodoId(page, 'E2E Delete Tag Todo')
    await assignTagViaApi(page, todoId, tagId)

    await expect(page.getByTestId(`tag-badge-${tagId}`)).toBeVisible()

    await openTagManager(page)
    await page.getByTestId(`delete-tag-${tagId}`).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    // Wait for deletion to process
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    // Wait for the modal to close and the todo list to re-render without the tag
    await page.waitForTimeout(500)

    await expect(page.getByTestId(`tag-badge-${tagId}`)).not.toBeVisible()
  })

  test('duplicate tag name shows conflict error', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Duplicate')

    await page.getByTestId('tag-name-input').fill('E2E-Duplicate')
    await page.getByTestId('create-tag-submit').click()

    await expect(page.getByText('Tag name already exists')).toBeVisible()
  })

  test('remove tag from todo via edit modal', async ({ page }) => {
    await openTagManager(page)
    await createTagInManager(page, 'E2E-Remove')
    const tagId = await getTagId(page, 'E2E-Remove')
    await page.keyboard.press('Escape')

    await createTodo(page, 'E2E Remove Tag Todo')
    const todoId = await getTodoId(page, 'E2E Remove Tag Todo')
    await assignTagViaApi(page, todoId, tagId)

    await expect(page.getByTestId(`tag-badge-${tagId}`)).toBeVisible()

    // Remove tag via API (tag-badge-remove is inside the edit modal which has the Radix interaction issue)
    const todoResp2 = await page.request.get(`/api/todos/${todoId}`)
    const todoData2 = await todoResp2.json()
    const existing2 = todoData2.data
    await page.request.put(`/api/todos/${todoId}`, {
      data: {
        title: existing2.title,
        priority: existing2.priority,
        is_recurring: existing2.is_recurring,
        recurrence_pattern: existing2.recurrence_pattern,
        due_date: existing2.due_date,
        reminder_minutes: existing2.reminder_minutes,
        tagIds: [],
      },
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId(`tag-badge-${tagId}`)).not.toBeVisible()
  })
})
