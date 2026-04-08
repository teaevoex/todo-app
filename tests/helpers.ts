import { Page, BrowserContext } from '@playwright/test'

/**
 * Reusable E2E test helpers for the Todo App.
 *
 * Virtual WebAuthn authenticator is configured via Chromium
 * launch flags in playwright.config.ts.
 */

const BASE = 'http://localhost:3000'

/**
 * Register a new user and land on the home page.
 * Relies on the virtual authenticator provided by Chromium flags.
 */
export async function registerUser(page: Page, username: string): Promise<void> {
  await page.goto('/login')
  await page.fill('#username', username)

  // Set up virtual authenticator via CDP
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send('WebAuthn.enable')
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })

  await page.click('button:has-text("Register")')
  await page.waitForURL('/', { timeout: 10000 })
}

/**
 * Login an existing user by username.
 */
export async function loginUser(page: Page, username: string): Promise<void> {
  await page.goto('/login')
  await page.fill('#username', username)

  // Set up virtual authenticator via CDP
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send('WebAuthn.enable')
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })

  await page.click('button:has-text("Login")')
  await page.waitForURL('/', { timeout: 10000 })
}

/**
 * Create a new todo via the UI form.
 */
export async function createTodo(
  page: Page,
  title: string,
  options?: {
    priority?: 'high' | 'medium' | 'low'
    dueDate?: string
    recurring?: boolean
    recurrencePattern?: string
    reminderMinutes?: string
  }
): Promise<void> {
  await page.fill('input[aria-label="Todo title"]', title)

  if (options?.priority) {
    await page.selectOption('select[aria-label="Priority"]', options.priority)
  }

  if (options?.dueDate) {
    await page.fill('input[aria-label="Due date"]', options.dueDate)
  }

  if (options?.recurring) {
    await page.locator('label', { hasText: 'Repeat' }).click()
    if (options.recurrencePattern) {
      const recurrenceSelect = page.locator('select').filter({ has: page.locator('option[value="weekly"]') })
      await recurrenceSelect.selectOption(options.recurrencePattern)
    }
  }

  await page.click('button:has-text("Add")')
  await page.waitForTimeout(500)
}

/**
 * Add a subtask to a todo by expanding the subtask section.
 */
export async function addSubtask(
  page: Page,
  todoTitle: string,
  subtaskTitle: string
): Promise<void> {
  const todoItem = page.locator(`text="${todoTitle}"`).locator('..').locator('..').locator('..')
  await todoItem.locator('button:has-text("Subtasks")').click()
  await todoItem.locator('input[placeholder*="subtask"]').fill(subtaskTitle)
  await todoItem.locator('button:has-text("Add"):near(input[placeholder*="subtask"])').click()
  await page.waitForTimeout(300)
}

/**
 * Create a tag via the Manage Tags modal.
 */
export async function createTag(
  page: Page,
  name: string,
  color?: string
): Promise<void> {
  await page.click('button:has-text("Manage Tags")')
  await page.waitForSelector('h3:has-text("Manage Tags")')
  await page.fill('input[placeholder="New tag name..."]', name)
  await page.locator('button:has-text("Add")').last().click()
  await page.waitForTimeout(300)
}

/**
 * Close any open modal by clicking outside or pressing Escape.
 */
export async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

/**
 * Generate a future datetime string for the due date input.
 * Returns format "YYYY-MM-DDThh:mm" in Singapore time.
 */
export function futureDateTime(daysFromNow: number = 1): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T12:00`
}

/**
 * Get a unique username for each test.
 */
export function uniqueUsername(): string {
  return `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
