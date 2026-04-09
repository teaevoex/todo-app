import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('create and complete a recurring todo', async ({ page }) => {
  await loginAs(page, 'recurring-user');
  await gotoApp(page);

  await page.getByLabel('Todo title').fill('Daily standup');
  await page.getByLabel('Todo due date').fill('2030-01-01T09:00');
  await page.getByLabel('Repeat').check();
  await page.getByLabel('Recurrence pattern').selectOption('daily');
  const createRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const refreshRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createRequest, refreshRequest]);

  await expect(page.getByRole('button', { name: /daily/i }).first()).toBeVisible();
  const completeRequest = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+$/) !== null && response.request().method() === 'PUT');
  const completeRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByLabel('Toggle Daily standup').click();
  await Promise.all([completeRequest, completeRefresh]);
  await expect(page.getByText('Daily standup')).toHaveCount(2);
});
