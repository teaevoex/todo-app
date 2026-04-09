import { expect, test } from '@playwright/test';
import { gotoApp, insertTodo, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('search and clear filters', async ({ page }) => {
  const { userId } = await loginAs(page, 'filter-user');
  insertTodo(userId, { title: 'Budget review', priority: 'high' });
  insertTodo(userId, { title: 'Workout session', priority: 'low' });
  await gotoApp(page);

  await page.getByPlaceholder('Search todos, subtasks, and tags...').fill('budget');
  await expect(page.getByText('Budget review')).toBeVisible();
  await expect(page.getByText('Workout session')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear All' }).click();
  await expect(page.getByText('Workout session')).toBeVisible();
});
