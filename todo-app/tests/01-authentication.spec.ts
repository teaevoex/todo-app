import { expect, test } from '@playwright/test';
import { loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('login page loads for unauthenticated user', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Passkey Sign In')).toBeVisible();
});

test('protected root redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('authenticated user visiting login is redirected home', async ({ page }) => {
  await loginAs(page, 'copilot-test-user');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
});

test('auth me returns 401 without a session', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const result = await fetch('/api/auth/me', { cache: 'no-store' });
    return {
      status: result.status,
      body: (await result.json()) as { user: null },
    };
  });

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ user: null });
});

test('auth me returns the signed-in user session', async ({ page }) => {
  await loginAs(page, 'session-check-user');
  await page.goto('/');

  const response = await page.evaluate(async () => {
    const result = await fetch('/api/auth/me', { cache: 'no-store' });
    return {
      status: result.status,
      body: (await result.json()) as { user: { userId: number; username: string } },
    };
  });

  expect(response.status).toBe(200);
  expect(response.body.user.username).toBe('session-check-user');
  expect(response.body.user.userId).toBeGreaterThan(0);
});
