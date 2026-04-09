import { test, expect, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

test.describe('Priority System', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('create todo with high priority shows red badge', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Urgent task')

    await page.getByTestId('todo-priority-select').first().selectOption('high')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Urgent task')).toBeVisible()
    await expect(page.locator('[data-testid="priority-badge-high"]').first()).toBeVisible()
  })

  test('create todo with low priority shows blue badge', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Low priority task')

    await page.getByTestId('todo-priority-select').first().selectOption('low')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Low priority task')).toBeVisible()
    await expect(page.locator('[data-testid="priority-badge-low"]').first()).toBeVisible()
  })

  test('default priority is medium with yellow badge', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Default priority task')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Default priority task')).toBeVisible()
    await expect(page.locator('[data-testid="priority-badge-medium"]').first()).toBeVisible()
  })

  test('filter by high priority shows only high priority todos', async ({ page }) => {
    // Create todos with different priorities
    const titleInput = page.getByTestId('todo-title-input').first()

    await titleInput.fill('High task')
    await page.getByTestId('todo-priority-select').first().selectOption('high')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('High task')).toBeVisible()

    await titleInput.fill('Medium task')
    await page.getByTestId('todo-priority-select').first().selectOption('medium')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Medium task')).toBeVisible()

    await titleInput.fill('Low task')
    await page.getByTestId('todo-priority-select').first().selectOption('low')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Low task')).toBeVisible()

    // Apply high filter
    await page.getByTestId('priority-filter').selectOption('high')

    // Only high priority todo should be visible
    await expect(page.getByText('High task')).toBeVisible()
    await expect(page.getByText('Medium task')).not.toBeVisible()
    await expect(page.getByText('Low task')).not.toBeVisible()
  })

  test('filter resets section when no matching todos', async ({ page }) => {
    // Create only medium priority todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Medium only task')
    await page.getByTestId('todo-priority-select').first().selectOption('medium')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Medium only task')).toBeVisible()

    // Filter to high -- no todos match
    await page.getByTestId('priority-filter').selectOption('high')

    // Active section should not be visible (count=0 hides the section)
    await expect(page.getByTestId('todo-section-default')).not.toBeVisible()
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('edit priority from low to high updates badge', async ({ page }) => {
    // Create a low priority todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Was low priority')
    await page.getByTestId('todo-priority-select').first().selectOption('low')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Was low priority')).toBeVisible()

    // Verify it starts with low badge
    await expect(page.locator('[data-testid="priority-badge-low"]').first()).toBeVisible()

    // Open edit modal
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()
    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    // Change priority to high in the modal
    await page.getByTestId('todo-edit-modal').getByTestId('todo-priority-select').selectOption('high')
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify the badge is now high
    await expect(page.locator('[data-testid="priority-badge-high"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="priority-badge-low"]')).not.toBeVisible()
  })

  test('verify sort order: high before medium before low', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()

    // Create in reverse order: low, high, medium
    await titleInput.fill('Low task sort')
    await page.getByTestId('todo-priority-select').first().selectOption('low')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Low task sort')).toBeVisible()

    await titleInput.fill('High task sort')
    await page.getByTestId('todo-priority-select').first().selectOption('high')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('High task sort')).toBeVisible()

    await titleInput.fill('Medium task sort')
    await page.getByTestId('todo-priority-select').first().selectOption('medium')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Medium task sort')).toBeVisible()

    // Get all todo items in the active section
    const activeSection = page.getByTestId('todo-section-default')
    await expect(activeSection).toBeVisible()

    const todoItems = activeSection.locator('[data-testid^="todo-item-"]')
    const count = await todoItems.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Check text content order: high, medium, low
    const texts = await todoItems.allTextContents()
    const highIndex = texts.findIndex((t) => t.includes('High task sort'))
    const mediumIndex = texts.findIndex((t) => t.includes('Medium task sort'))
    const lowIndex = texts.findIndex((t) => t.includes('Low task sort'))

    expect(highIndex).toBeLessThan(mediumIndex)
    expect(mediumIndex).toBeLessThan(lowIndex)
  })

  test('priority filter dropdown is visible', async ({ page }) => {
    // Create at least one todo so the list shows
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Test todo for filter')
    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Test todo for filter')).toBeVisible()

    await expect(page.getByTestId('priority-filter')).toBeVisible()
  })
})
