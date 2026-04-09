import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('create tag and filter by it', async ({ page }) => {
  await loginAs(page, 'tag-user');
  await gotoApp(page);

  await page.getByPlaceholder('Tag name').fill('work');
  const createTagRequest = page.waitForResponse((response) => response.url().endsWith('/api/tags') && response.request().method() === 'POST');
  const refreshTagRequest = page.waitForResponse((response) => response.url().endsWith('/api/tags') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Create Tag' }).click();
  await Promise.all([createTagRequest, refreshTagRequest]);
  await expect(page.getByRole('button', { name: 'Filter by tag work' })).toBeVisible();

  await page.getByLabel('Todo title').fill('Project task');
  await page.getByRole('button', { name: 'Add tag work' }).click();
  const createTodoRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const attachTagRequest = page.waitForResponse((response) => response.url().match(/\/api\/todos\/\d+\/tags$/) !== null && response.request().method() === 'POST');
  const refreshTodoRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createTodoRequest, attachTagRequest, refreshTodoRequest]);

  await page.getByRole('button', { name: 'Filter by tag work' }).click();
  await expect(page.getByText('Project task')).toBeVisible();
});
