import type { Page, CDPSession } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Set up WebAuthn virtual authenticator via CDP, register a new user,
 * and wait for redirect to the home page.
 *
 * Returns a cleanup function that detaches the CDP session.
 */
export async function setupAuth(page: Page): Promise<{ cdpSession: CDPSession; username: string }> {
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

  const username = `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  await page.goto('/login')
  await page.getByTestId('tab-register').click()
  await page.getByTestId('register-username-input').fill(username)
  await page.getByTestId('register-submit-btn').click()
  await page.waitForURL('/', { timeout: 15000 })

  return { cdpSession, username }
}

/**
 * Create a todo via the form and wait for it to appear.
 */
export async function createTodo(page: Page, title: string, options?: { priority?: string }): Promise<void> {
  const titleInput = page.getByTestId('todo-title-input').first()
  await titleInput.fill(title)
  if (options?.priority) {
    await page.getByTestId('todo-priority-select').first().selectOption(options.priority)
  }
  await page.getByTestId('todo-submit-btn').click()
  await expect(page.getByText(title).first()).toBeVisible()
}

/**
 * Get the numeric ID of a todo by its title.
 */
export async function getTodoId(page: Page, title: string): Promise<string> {
  const todoItem = page.locator('[data-testid^="todo-item-"]').filter({ hasText: title }).first()
  await todoItem.waitFor()
  const testId = await todoItem.getAttribute('data-testid')
  return testId?.replace('todo-item-', '') ?? ''
}

/**
 * Build a datetime-local string N milliseconds from now in Asia/Singapore timezone.
 * Suitable for filling into <input type="datetime-local">.
 */
export function futureDateSGT(offsetMs: number): string {
  const dt = new Date(Date.now() + offsetMs)
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt).replace(' ', 'T')
}
