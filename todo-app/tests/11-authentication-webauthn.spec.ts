import { expect, test } from '@playwright/test';
import { loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('logout clears session and returns user to login', async ({ page }) => {
  await loginAs(page, 'logout-user');
  await page.goto('/');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
