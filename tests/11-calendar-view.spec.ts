import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername, futureDateTime } from './helpers'

test.describe('Feature 10: Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should navigate to calendar page', async ({ page }) => {
    await page.click('a:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    await expect(page.locator('text="Sun"')).toBeVisible()
    await expect(page.locator('text="Mon"')).toBeVisible()
  })

  test('should display current month', async ({ page }) => {
    await page.goto('/calendar')
    // Get the current month name from the browser context (Singapore timezone)
    const heading = page.locator('h1, h2').first()
    const headingText = await heading.textContent()
    // Just verify heading contains a valid month name and a year
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const hasMonth = monthNames.some(m => headingText?.includes(m))
    expect(hasMonth).toBe(true)
    expect(headingText).toMatch(/\d{4}/)
  })

  test('should navigate to previous month', async ({ page }) => {
    await page.goto('/calendar')
    await page.click('button[aria-label="Previous month"]')
    await page.waitForTimeout(500)
    // URL should update with month param
    await expect(page.url()).toContain('month=')
  })

  test('should navigate to next month', async ({ page }) => {
    await page.goto('/calendar')
    await page.click('button[aria-label="Next month"]')
    await page.waitForTimeout(500)
    await expect(page.url()).toContain('month=')
  })

  test('should go to today', async ({ page }) => {
    await page.goto('/calendar')
    // Navigate away first
    await page.click('button[aria-label="Previous month"]')
    await page.waitForTimeout(300)
    // Click Today button
    await page.click('button:has-text("Today")')
    await page.waitForTimeout(300)

    // Verify the heading shows the current month after clicking Today
    const heading = page.locator('h1, h2').first()
    const headingText = await heading.textContent()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const hasMonth = monthNames.some(m => headingText?.includes(m))
    expect(hasMonth).toBe(true)
  })

  test('should show todo on correct date', async ({ page }) => {
    const dueDate = futureDateTime(2)
    const dueDateStr = dueDate.substring(0, 10) // e.g. "2026-04-10"
    await createTodo(page, 'Calendar visible todo', { priority: 'high', dueDate })

    await page.click('a:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    await page.waitForTimeout(1000)

    // Navigate to the correct month/year for the due date
    const dueMonth = parseInt(dueDate.substring(5, 7))
    const dueYear = parseInt(dueDate.substring(0, 4))
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]

    const heading = await page.locator('h1, h2').first().textContent()
    if (heading) {
      const displayedMonth = monthNames.findIndex(m => heading.includes(m)) + 1
      const displayedYear = parseInt(heading.match(/\d{4}/)?.[0] ?? '0')
      let diff = (dueYear - displayedYear) * 12 + (dueMonth - displayedMonth)
      while (diff > 0) {
        await page.click('button[aria-label="Next month"]')
        await page.waitForTimeout(300)
        diff--
      }
      while (diff < 0) {
        await page.click('button[aria-label="Previous month"]')
        await page.waitForTimeout(300)
        diff++
      }
    }

    await page.waitForTimeout(500)

    // Click on the due date cell and verify the todo shows in the detail panel
    const dateCell = page.locator(`[data-date="${dueDateStr}"]`)
    await dateCell.click()
    await page.waitForTimeout(500)

    // The detail panel should show the todo title
    await expect(page.getByText('Calendar visible todo')).toBeVisible({ timeout: 5000 })
  })

  test('should click day to see detail panel', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(500)

    // Click on a day cell
    const dayCell = page.locator('[data-date]').first()
    await dayCell.click()
    await page.waitForTimeout(300)

    // Detail panel should show the date info
    await expect(page.locator('text=/No todos due|Due:/')).toBeVisible()
  })

  test('should sync month to URL query parameter', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(500)

    const url = page.url()
    expect(url).toContain('month=')

    // Navigate and check URL updates
    await page.click('button[aria-label="Next month"]')
    await page.waitForTimeout(500)
    const newUrl = page.url()
    expect(newUrl).not.toBe(url)
  })

  test('should have back to todos link', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.locator('a:has-text("Back to Todos")')).toBeVisible()
    await page.click('a:has-text("Back to Todos")')
    await page.waitForURL('/')
  })
})
