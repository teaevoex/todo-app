import { test, expect, type BrowserContext, type CDPSession } from '@playwright/test'

async function addVirtualAuthenticator(context: BrowserContext): Promise<{ cdpSession: CDPSession; authenticatorId: string }> {
  const cdpSession = await context.newCDPSession(context.pages()[0])
  await cdpSession.send('WebAuthn.enable')
  const { authenticatorId } = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })
  return { cdpSession, authenticatorId }
}

function uniqueUsername(): string {
  return `testuser_${Date.now()}`
}

test.describe('Authentication', () => {
  test('register a new user', async ({ page }) => {
    await page.goto('/login')
    const { cdpSession } = await addVirtualAuthenticator(page.context())

    const username = uniqueUsername()

    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()

    await page.waitForURL('/', { timeout: 15000 })
    expect(page.url()).toContain('/')
    await expect(page.getByTestId('logout-button')).toBeVisible()

    await cdpSession.detach()
  })

  test('login with existing passkey', async ({ page }) => {
    await page.goto('/login')
    const { cdpSession } = await addVirtualAuthenticator(page.context())

    // First register
    const username = uniqueUsername()
    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()
    await page.waitForURL('/', { timeout: 15000 })

    // Logout
    await page.getByTestId('logout-button').click()
    await page.waitForURL('/login', { timeout: 10000 })

    // Login
    await page.getByTestId('tab-login').click()
    await page.getByTestId('login-username-input').fill(username)
    await page.getByTestId('login-submit-btn').click()

    await page.waitForURL('/', { timeout: 15000 })
    expect(page.url()).toContain('/')
    await expect(page.getByTestId('logout-button')).toBeVisible()

    await cdpSession.detach()
  })

  test('logout clears session', async ({ page }) => {
    await page.goto('/login')
    const { cdpSession } = await addVirtualAuthenticator(page.context())

    const username = uniqueUsername()
    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()
    await page.waitForURL('/', { timeout: 15000 })

    // Logout
    await page.getByTestId('logout-button').click()
    await page.waitForURL('/login', { timeout: 10000 })
    expect(page.url()).toContain('/login')

    // Verify redirect back to /login when accessing /
    await page.goto('/')
    await page.waitForURL('/login', { timeout: 10000 })
    expect(page.url()).toContain('/login')

    await cdpSession.detach()
  })

  test('unauthenticated access to / redirects to /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForURL('/login', { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('unauthenticated access to /calendar redirects to /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/calendar')
    await page.waitForURL('/login', { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('duplicate username shows error', async ({ page }) => {
    await page.goto('/login')
    const { cdpSession } = await addVirtualAuthenticator(page.context())

    const username = uniqueUsername()

    // Register first
    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()
    await page.waitForURL('/', { timeout: 15000 })

    // Go back to login page and try to register again
    await page.goto('/login')
    // After redirect from middleware, we should get there anyway
    // Clear cookies to force back to login
    await page.context().clearCookies()
    await page.goto('/login')

    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()

    await expect(page.getByTestId('register-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('register-error')).toContainText('Username already taken')
    expect(page.url()).toContain('/login')

    await cdpSession.detach()
  })

  test('username too short shows validation error', async ({ page }) => {
    await page.goto('/login')

    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill('ab')
    await page.getByTestId('register-submit-btn').click()

    await expect(page.getByTestId('register-error')).toBeVisible()
    await expect(page.getByTestId('register-error')).toContainText('at least 3 characters')
  })

  test('login with unknown username shows error', async ({ page }) => {
    await page.goto('/login')

    await page.getByTestId('login-username-input').fill('nosuchuser_99999')
    await page.getByTestId('login-submit-btn').click()

    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('login-error')).toContainText('User not found')
  })

  test('authenticated user on /login redirects to /', async ({ page }) => {
    await page.goto('/login')
    const { cdpSession } = await addVirtualAuthenticator(page.context())

    const username = uniqueUsername()
    await page.getByTestId('tab-register').click()
    await page.getByTestId('register-username-input').fill(username)
    await page.getByTestId('register-submit-btn').click()
    await page.waitForURL('/', { timeout: 15000 })

    // Navigate to /login — should redirect to /
    await page.goto('/login')
    await page.waitForURL('/', { timeout: 10000 })
    expect(page.url()).not.toContain('/login')

    await cdpSession.detach()
  })
})
