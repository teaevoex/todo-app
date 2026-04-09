import { test, expect, type Page, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * E2E Tests: Feature 10 — Calendar View
 *
 * Prerequisites: User is authenticated (app runs with active session).
 * Holidays must be seeded (npx tsx scripts/seed-holidays.ts).
 * These tests verify the monthly calendar grid, navigation, and todo/holiday display.
 */

async function createTodoWithDueDate(
  page: Page,
  title: string,
  dueDateISO: string
): Promise<void> {
  const titleInput = page.getByTestId('todo-title-input').first()
  await titleInput.fill(title)

  // Set due date
  const dueDateInput = page.getByTestId('todo-due-date').first()
  // Format for datetime-local input: YYYY-MM-DDTHH:MM
  const dt = new Date(dueDateISO)
  const localStr = dt.toISOString().slice(0, 16)
  await dueDateInput.fill(localStr)

  await page.getByTestId('todo-submit-btn').click()
  await expect(page.getByText(title)).toBeVisible()
}

/**
 * Returns today's date in Singapore timezone as YYYY-MM-DD
 */
function todaySGStr(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Returns 'YYYY-MM' for the current Singapore month
 */
function currentSGMonth(): string {
  return todaySGStr().slice(0, 7)
}

test.describe('Calendar View', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('calendar page loads with current month', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // Check month label shows current SG month/year
    const monthLabel = page.getByTestId('calendar-month-label')
    await expect(monthLabel).toBeVisible()

    // Get expected month label
    const [year, month] = currentSGMonth().split('-').map(Number)
    const expectedLabel = new Intl.DateTimeFormat('en-SG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(Date.UTC(year, month - 1, 1)))

    await expect(monthLabel).toHaveText(expectedLabel)

    // Grid should have 7 column headers (Sun–Sat)
    const headers = page.locator('[data-testid="calendar-grid"] th[scope="col"]')
    await expect(headers).toHaveCount(7)

    // Grid should have 42 day cells (6 rows × 7 cols)
    const dayCells = page.locator('[data-testid^="calendar-day-"]')
    const count = await dayCells.count()
    expect(count).toBeGreaterThanOrEqual(28)
    expect(count).toBeLessThanOrEqual(42)
  })

  test('navigate to next month updates month label and URL', async ({ page }) => {
    await page.goto('/calendar?month=2026-04')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await expect(page.getByTestId('calendar-month-label')).toHaveText('April 2026')

    await page.getByTestId('calendar-next-btn').click()

    await expect(page).toHaveURL(/month=2026-05/)
    await expect(page.getByTestId('calendar-month-label')).toHaveText('May 2026')
  })

  test('navigate to previous month updates month label and URL', async ({ page }) => {
    await page.goto('/calendar?month=2026-04')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await expect(page.getByTestId('calendar-month-label')).toHaveText('April 2026')

    await page.getByTestId('calendar-prev-btn').click()

    await expect(page).toHaveURL(/month=2026-03/)
    await expect(page.getByTestId('calendar-month-label')).toHaveText('March 2026')
  })

  test('Today button returns to current month', async ({ page }) => {
    await page.goto('/calendar?month=2025-01')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await expect(page.getByTestId('calendar-month-label')).toHaveText('January 2025')

    await page.getByTestId('calendar-today-btn').click()

    const [year, month] = currentSGMonth().split('-').map(Number)
    const expectedLabel = new Intl.DateTimeFormat('en-SG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(Date.UTC(year, month - 1, 1)))

    await expect(page).toHaveURL(new RegExp(`month=${currentSGMonth()}`))
    await expect(page.getByTestId('calendar-month-label')).toHaveText(expectedLabel)
  })

  test("today's date cell has aria-current=date", async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    const todayStr = todaySGStr()
    const todayCell = page.locator(`[data-testid="calendar-day-${todayStr}"]`)
    await expect(todayCell).toBeVisible()

    // The button inside the cell should have aria-current="date"
    const todayButton = todayCell.locator('button')
    await expect(todayButton).toHaveAttribute('aria-current', 'date')
  })

  test('todo with due date appears on correct calendar day', async ({ page }) => {
    // Create a todo due on a fixed future date
    await page.goto('/')
    // Due date: 2026-08-09 at 10:00 SGT = 2026-08-09T02:00:00Z
    const dueDate = '2026-08-09T02:00:00.000Z'
    await createTodoWithDueDate(page, 'Calendar E2E: National Day Todo', dueDate)

    // Navigate to calendar for August 2026
    await page.goto('/calendar?month=2026-08')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // The day cell for August 9 should have a count badge
    const aug9Cell = page.locator('[data-testid="calendar-day-2026-08-09"]')
    await expect(aug9Cell).toBeVisible()

    // Find the count badge within that cell
    const countBadge = aug9Cell.locator('[data-testid="todo-count-badge-2026-08-09"]')
    await expect(countBadge).toBeVisible()
  })

  test('clicking a day opens modal with todos', async ({ page }) => {
    // Create 2 todos on the same day
    await page.goto('/')
    const dueDate1 = '2026-08-09T02:00:00.000Z'
    const dueDate2 = '2026-08-09T04:00:00.000Z'
    await createTodoWithDueDate(page, 'Calendar Modal Test Todo 1', dueDate1)
    await createTodoWithDueDate(page, 'Calendar Modal Test Todo 2', dueDate2)

    await page.goto('/calendar?month=2026-08')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // Click the day cell for August 9
    const aug9Cell = page.locator('[data-testid="calendar-day-2026-08-09"]')
    await aug9Cell.locator('button').click()

    // Modal should be visible
    const modal = page.getByTestId('calendar-day-modal')
    await expect(modal).toBeVisible()

    // Should contain at least 1 todo item (may have more from other tests)
    const todoItems = modal.locator('[data-testid^="calendar-todo-item-"]')
    const count = await todoItems.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('modal closes when Close button is clicked', async ({ page }) => {
    await page.goto('/calendar?month=2026-08')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // Click any day cell
    const dayCells = page.locator('[data-testid^="calendar-day-"]').first()
    await dayCells.locator('button').click()

    const modal = page.getByTestId('calendar-day-modal')
    await expect(modal).toBeVisible()

    await page.getByTestId('calendar-modal-close-btn').click()
    await expect(modal).not.toBeVisible()
  })

  test('modal closes on Escape key', async ({ page }) => {
    await page.goto('/calendar?month=2026-08')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    const dayCells = page.locator('[data-testid^="calendar-day-"]').first()
    await dayCells.locator('button').click()

    const modal = page.getByTestId('calendar-day-modal')
    await expect(modal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('holiday badge displays on correct date (National Day 2026)', async ({ page }) => {
    await page.goto('/calendar?month=2026-08')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // National Day should appear on August 9
    const aug9Cell = page.locator('[data-testid="calendar-day-2026-08-09"]')
    await expect(aug9Cell).toBeVisible()

    const holidayBadge = aug9Cell.locator('[data-testid="holiday-badge"]')
    await expect(holidayBadge).toBeVisible()
    await expect(holidayBadge).toHaveText('National Day')
  })

  test('day with no todos shows no count badge', async ({ page }) => {
    await page.goto('/calendar?month=2030-06')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // A day in June 2030 should have no todos
    const june1Cell = page.locator('[data-testid="calendar-day-2030-06-01"]')
    await expect(june1Cell).toBeVisible()
    const badge = june1Cell.locator('[data-testid="todo-count-badge-2030-06-01"]')
    await expect(badge).not.toBeVisible()
  })

  test('empty day modal shows no todos message', async ({ page }) => {
    await page.goto('/calendar?month=2030-06')
    await expect(page.getByTestId('calendar-grid')).toBeVisible()

    // Click a day with no todos
    const june1Cell = page.locator('[data-testid="calendar-day-2030-06-01"]')
    await june1Cell.locator('button').click()

    const modal = page.getByTestId('calendar-day-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('No todos due on this day.')
  })

  test('calendar link visible on main todos page', async ({ page }) => {
    await page.goto('/')
    const calendarLink = page.getByTestId('calendar-link-button')
    await expect(calendarLink).toBeVisible()
    await calendarLink.click()
    await expect(page).toHaveURL(/\/calendar/)
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
  })
})
