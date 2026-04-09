import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('create edit complete and delete a todo', async ({ page }) => {
  await loginAs(page, 'crud-user');
  await gotoApp(page);

  await page.getByLabel('Todo title').fill('Buy groceries');
  const createRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const refreshRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createRequest, refreshRequest]);
  await expect(page.getByText('Buy groceries')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByLabel('Edit todo title').fill('Buy groceries and cook');
  const updateRequest = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+$/) !== null && response.request().method() === 'PUT');
  const postUpdateRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await Promise.all([updateRequest, postUpdateRefresh]);
  await expect(page.getByText('Buy groceries and cook')).toBeVisible();

  const completeRequest = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+$/) !== null && response.request().method() === 'PUT');
  const completeRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByLabel('Toggle Buy groceries and cook').click();
  await Promise.all([completeRequest, completeRefresh]);
  await expect(page.getByText('Completed (1)')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const deleteRequest = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+$/) !== null && response.request().method() === 'DELETE');
  const postDeleteRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await Promise.all([deleteRequest, postDeleteRefresh]);
  await expect(page.getByText('Buy groceries and cook')).toHaveCount(0);
});
