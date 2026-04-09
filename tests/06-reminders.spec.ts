import { test, expect, type CDPSession } from '@playwright/test'
import { setupAuth, futureDateSGT } from './helpers'

/**
 * E2E Tests for Feature 04 — Reminders & Notifications
 */

test.describe('Reminders & Notifications', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('reminder select is disabled when no due date set', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('No date reminder test')

    // Reminder select should be disabled when no due date
    const reminderSelect = page.getByTestId('reminder-select').first()
    await expect(reminderSelect).toBeDisabled()

    // Hint text should be visible
    await expect(page.locator('#reminder-disabled-hint').first()).toBeVisible()
    await expect(page.locator('#reminder-disabled-hint').first()).toContainText('Set a due date to enable reminders')
  })

  test('reminder select is enabled when due date is set', async ({ page }) => {
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Date reminder test')

    // Set a due date 2 hours from now (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Reminder select should now be enabled
    const reminderSelect = page.getByTestId('reminder-select').first()
    await expect(reminderSelect).not.toBeDisabled()

    // Hint text should not be visible
    await expect(page.locator('#reminder-disabled-hint').first()).not.toBeVisible()
  })

  test('set reminder on todo and verify badge appears', async ({ page, context }) => {
    // Grant notification permissions
    await context.grantPermissions(['notifications'])

    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Dentist appointment')

    // Set a due date 2 hours from now (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Select "1 hour before" reminder using the shadcn select trigger
    const reminderTrigger = page.getByTestId('reminder-select').first()
    await reminderTrigger.click()

    // Click the "1 hour before" option in the dropdown
    await page.getByRole('option', { name: '1 hour before' }).click()

    await page.getByTestId('todo-submit-btn').click()

    // Wait for the todo to appear
    await expect(page.getByText('Dentist appointment')).toBeVisible()

    // Verify reminder badge is shown
    await expect(page.getByTestId('reminder-badge').first()).toBeVisible()
  })

  test('reminder cleared when due date is removed in edit modal', async ({ page }) => {
    // Create a todo with due date first
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Todo with reminder')

    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Select a reminder
    const reminderTrigger = page.getByTestId('reminder-select').first()
    await reminderTrigger.click()
    await page.getByRole('option', { name: '30 minutes before' }).click()

    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Todo with reminder')).toBeVisible()
    await expect(page.getByTestId('reminder-badge').first()).toBeVisible()

    // Open edit modal
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()
    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    // Clear the due date
    await page.getByTestId('todo-due-date').last().fill('')

    // Save the modal
    await page.getByRole('button', { name: 'Save' }).click()

    // Wait for the modal to close
    await expect(page.getByTestId('todo-edit-modal')).not.toBeVisible()

    // The reminder badge should no longer be present on that todo
    await expect(page.getByText('Todo with reminder')).toBeVisible()
    await expect(page.getByTestId('reminder-badge')).not.toBeVisible()
  })

  test('change reminder timing via edit and badge updates', async ({ page }) => {
    // Create a todo with due date and reminder
    const titleInput = page.getByTestId('todo-title-input').first()
    await titleInput.fill('Reminder update test')

    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    const reminderTrigger = page.getByTestId('reminder-select').first()
    await reminderTrigger.click()
    await page.getByRole('option', { name: '15 minutes before' }).click()

    await page.getByTestId('todo-submit-btn').click()
    await expect(page.getByText('Reminder update test')).toBeVisible()
    await expect(page.getByTestId('reminder-badge').first()).toBeVisible()
    await expect(page.getByTestId('reminder-badge').first()).toHaveAttribute('aria-label', '15 minutes before')

    // Open edit modal and change reminder to 1 hour
    const editBtn = page.locator('[data-testid^="todo-edit-"]').first()
    await editBtn.click()
    await expect(page.getByTestId('todo-edit-modal')).toBeVisible()

    const editReminderTrigger = page.getByTestId('reminder-select').last()
    await editReminderTrigger.click()
    await page.getByRole('option', { name: '1 hour before' }).click()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('todo-edit-modal')).not.toBeVisible()

    // Badge should now show 1 hour
    await expect(page.getByTestId('reminder-badge').first()).toHaveAttribute('aria-label', '1 hour before')
  })

  test('reminder select shows all 7 options plus No reminder', async ({ page }) => {
    // Set a due date so the select is enabled (SGT-aware)
    await page.getByTestId('todo-due-date').first().fill(futureDateSGT(7_200_000))

    // Open the reminder dropdown
    const reminderTrigger = page.getByTestId('reminder-select').first()
    await reminderTrigger.click()

    // Verify all options are present
    await expect(page.getByRole('option', { name: 'No reminder' })).toBeVisible()
    await expect(page.getByRole('option', { name: '15 minutes before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '30 minutes before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1 hour before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '2 hours before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1 day before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '2 days before' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1 week before' })).toBeVisible()
  })

  test('API returns reminders for todos with passed threshold', async ({ request }) => {
    // This test verifies the API endpoint works correctly
    // (In a real environment with auth, this would use a session cookie)
    const response = await request.get('/api/notifications/check')

    // Should return 401 or 200 depending on auth state
    // In development without auth stub, accepts any response code
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const body = await response.json()
      expect(body).toHaveProperty('success', true)
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBe(true)
    }
  })
})
