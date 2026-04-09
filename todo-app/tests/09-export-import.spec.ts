import { expect, test } from '@playwright/test';
import { gotoApp, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('export endpoint returns data and import restores a todo', async ({ page }) => {
  await loginAs(page, 'import-user');
  await gotoApp(page);

  await page.getByLabel('Todo title').fill('Portable task');
  const createRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
  const refreshRequest = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await Promise.all([createRequest, refreshRequest]);

  const exported = await page.evaluate(async () => {
    const response = await fetch('/api/todos/export');
    return response.json();
  });

  await page.evaluate(async () => {
    const todos = await fetch('/api/todos').then((response) => response.json());
    await Promise.all((todos.todos as Array<{ id: number }>).map((todo) => fetch(`/api/todos/${todo.id}`, { method: 'DELETE' })));
  });
  const deleteRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.reload();
  await deleteRefresh;
  await expect(page.getByText('Portable task')).toHaveCount(0);

  await page.evaluate(async (payload) => {
    await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }, exported);

  const importRefresh = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'GET');
  await page.reload();
  await importRefresh;
  await expect(page.getByText('Portable task')).toBeVisible();
});
