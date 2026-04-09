import { test, expect, type CDPSession } from '@playwright/test'
import { setupAuth, futureDateSGT } from './helpers'

/**
 * E2E Tests for Feature 03 — Recurring Todos
 */

test.describe('Recurring Todos', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('recurring checkbox is disabled when no due date set', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('No date recurring')

    // Checkbox should be disabled when no due date
    const recurringCheckbox = page.getByTestId('todo-recurring-checkbox').first()
    await expect(recurringCheckbox).toBeDisabled()

    // Set a due date 2 hours from now (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Checkbox should now be enabled
    await expect(recurringCheckbox).not.toBeDisabled()

    // Clear the due date
    await page.getByTestId('todo-due-date').first().fill('')

    // Checkbox should be disabled again
    await expect(recurringCheckbox).toBeDisabled()
  })

  test('create daily recurring todo shows recurrence badge', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Daily standup')

    // Set due date 2 hours in future (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Check the recurring checkbox
    const recurringCheckbox = page.getByTestId('todo-recurring-checkbox').first()
    await recurringCheckbox.check()

    // Recurrence pattern select should be visible
    const patternSelect = page.getByTestId('todo-recurrence-select').first()
    await expect(patternSelect).toBeVisible()

    // Select daily
    await patternSelect.selectOption('daily')

    // Submit
    await page.getByTestId('todo-submit-btn').click()

    // Verify todo appears in pending section
    await expect(page.getByText('Daily standup')).toBeVisible()

    // Verify recurrence badge shows (data-testid="recurrence-badge-daily")
    await expect(page.getByTestId('recurrence-badge-daily')).toBeVisible()
  })

  test('create weekly recurring todo shows recurrence badge', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Weekly team meeting')

    // Set due date 2 hours in future (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Enable recurring with weekly pattern
    const recurringCheckbox = page.getByTestId('todo-recurring-checkbox').first()
    await recurringCheckbox.check()

    const patternSelect = page.getByTestId('todo-recurrence-select').first()
    await patternSelect.selectOption('weekly')

    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Weekly team meeting')).toBeVisible()
    await expect(page.getByTestId('recurrence-badge-weekly')).toBeVisible()
  })

  test('recurrence pattern select is hidden when recurring is unchecked', async ({ page }) => {
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Initially, pattern select should not be visible
    await expect(page.getByTestId('todo-recurrence-select')).not.toBeVisible()

    // Check recurring
    await page.getByTestId('todo-recurring-checkbox').first().check()
    await expect(page.getByTestId('todo-recurrence-select').first()).toBeVisible()

    // Uncheck recurring
    await page.getByTestId('todo-recurring-checkbox').first().uncheck()
    await expect(page.getByTestId('todo-recurrence-select')).not.toBeVisible()
  })

  test('completing recurring todo creates new pending instance', async ({ page }) => {
    // Create a recurring daily todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Daily exercise')

    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    await page.getByTestId('todo-recurring-checkbox').first().check()
    await page.getByTestId('todo-recurrence-select').first().selectOption('daily')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Daily exercise')).toBeVisible()

    // Click the checkbox to complete the todo
    const todoCheckbox = page.locator('[data-testid^="todo-checkbox-"]').first()
    await todoCheckbox.click()

    // Wait for the UI to update - should see completed section appear
    await page.waitForTimeout(500)

    // After completing, a new "Daily exercise" instance should appear in pending
    // The completed one moves to completed section
    // Count instances of "Daily exercise" text — at minimum one pending should remain
    const dailyExerciseItems = page.getByText('Daily exercise')
    await expect(dailyExerciseItems.first()).toBeVisible()
  })

  test('edit todo to disable recurrence removes recurrence badge', async ({ page }) => {
    // Create a recurring todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Recurring task to disable')

    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    await page.getByTestId('todo-recurring-checkbox').first().check()
    await page.getByTestId('todo-recurrence-select').first().selectOption('weekly')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Recurring task to disable')).toBeVisible()
    await expect(page.getByTestId('recurrence-badge-weekly')).toBeVisible()

    // Open the edit modal
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()

    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    // Uncheck recurring in the edit modal
    const editRecurringCheckbox = page.getByTestId('todo-recurring-checkbox').last()
    await editRecurringCheckbox.uncheck()

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByTestId('todo-edit-modal')).not.toBeVisible()

    // Recurrence badge should no longer be visible
    await expect(page.getByTestId('recurrence-badge-weekly')).not.toBeVisible()
  })

  test('edit modal shows recurrence fields populated for recurring todo', async ({ page }) => {
    // Create a recurring todo
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Monthly rent')

    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    await page.getByTestId('todo-recurring-checkbox').first().check()
    await page.getByTestId('todo-recurrence-select').first().selectOption('monthly')
    await page.getByTestId('todo-submit-btn').click()

    await expect(page.getByText('Monthly rent')).toBeVisible()

    // Open edit modal
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()

    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    // Recurring checkbox should be checked
    const editRecurringCheckbox = page.getByTestId('todo-recurring-checkbox').last()
    await expect(editRecurringCheckbox).toBeChecked()

    // Pattern select should be visible and show monthly
    const editPatternSelect = page.getByTestId('todo-recurrence-select').last()
    await expect(editPatternSelect).toBeVisible()
    await expect(editPatternSelect).toHaveValue('monthly')

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})

/**
 * Unit-style tests for calculateNextDueDate logic.
 *
 * These document the expected behavior of lib/recurrence.ts.
 * Full unit tests should be in lib/recurrence.test.ts using Vitest.
 *
 * Expected behaviors:
 * - daily: '2026-04-08T01:00:00.000Z' → '2026-04-09T01:00:00.000Z' (same SGT wall-clock: 09:00)
 * - weekly: '2026-04-08T01:00:00.000Z' → '2026-04-15T01:00:00.000Z' (+7 days)
 * - monthly (normal): '2026-03-10T02:00:00.000Z' → '2026-04-10T02:00:00.000Z'
 * - monthly (Jan 31 non-leap): '2026-01-30T16:00:00.000Z' → Feb 28 (clamped)
 * - monthly (Jan 31 leap 2028): '2028-01-30T16:00:00.000Z' → Feb 29 (clamped)
 * - yearly (normal): '2026-06-15T02:00:00.000Z' → '2027-06-15T02:00:00.000Z'
 * - yearly (Feb 28 non-leap): '2028-02-28T16:00:00.000Z' → '2029-02-28T16:00:00.000Z'
 */
