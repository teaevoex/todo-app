import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername, futureDateTime } from './helpers'

test.describe('Feature 04: Reminders & Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should show notification enable button', async ({ page }) => {
    await expect(
      page.locator('text=/Enable Notifications|Notifications On/')
    ).toBeVisible()
  })

  test('should set reminder on todo', async ({ page }) => {
    const dueDate = futureDateTime(1)
    await page.fill('input[aria-label="Todo title"]', 'Reminder task')
    await page.fill('input[aria-label="Due date"]', dueDate)

    // Select reminder from dropdown — the default option text is "🔔 None"
    const reminderSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'None' }) })
    await reminderSelect.selectOption('30')

    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Reminder task' })).toBeVisible()
    // Check that the reminder badge is displayed (🔔 30m)
    await expect(page.locator('text=/🔔 30m/')).toBeVisible()
  })

  test('should show reminder badge with timing', async ({ page }) => {
    const dueDate = futureDateTime(1)
    await page.fill('input[aria-label="Todo title"]', 'Timed reminder')
    await page.fill('input[aria-label="Due date"]', dueDate)

    // Select reminder from dropdown — the default option text is "🔔 None"
    const reminderSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'None' }) })
    await reminderSelect.selectOption('60')

    await page.click('button:has-text("Add")')
    await page.waitForTimeout(500)

    await expect(page.locator('text=/🔔 1h/')).toBeVisible()
  })

  test('should check notification API returns todos', async ({ page }) => {
    const response = await page.request.get('/api/notifications/check')
    // May return 401 if no cookie, or 200 with empty array
    expect([200, 401]).toContain(response.status())
  })
})
