import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('reminder selector enables when due date is set', async ({ page }) => {
  await loginAs(page, 'reminder-user');
  await gotoApp(page);

  const reminderSelect = page.getByLabel('Todo reminder');
  await expect(reminderSelect).toBeDisabled();
  await page.getByLabel('Todo due date').fill('2030-01-01T09:00');
  await expect(reminderSelect).toBeEnabled();
  await reminderSelect.selectOption('15');
  await page.getByLabel('Todo title').fill('Reminder task');
  const createRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const refreshRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createRequest, refreshRequest]);
  await expect(page.getByText(/15m/i)).toBeVisible();
});
